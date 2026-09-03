import { COURSES, RECITERS, SURAHS } from "./data.js";
import { Icons } from "./icons.js";

class DaarulArkomApp {
  constructor() {
    this.currentView = "home";
    this.surahs = SURAHS;
    this.reciters = RECITERS;
    this.currentSurah = SURAHS[0];
    this.selectedReciter = RECITERS[0];
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.activeAyahIndex = 0;
    this.loopMode = "off";
    this.playbackRate = 1.0;
    this.fontSize = "normal";
    this.showTranslation = true;
    this.showTransliteration = true;
    this.autoScroll = true;
    this.volume = 0.9;
    this.isMuted = false;
    this.isMobileMenuOpen = false;

    this.surahTextCache = {};
    this.reciterAudioCache = {};
    this.isLoadingVerses = false;
    this.isSwitchingReciter = false;
    this.missingAudioCount = 0;

    this.bookmarks = new Set();

    this.repeat = {
      active: false,
      startIdx: 0,
      endIdx: 0,
      totalReps: 5,
      repsDone: 0,
      cursorIdx: 0,
      pauseMs: 500,
    };

    this.hideTextMode = false;
    this.revealedAyahs = new Set();

    this.audioSlots = { A: new Audio(), B: new Audio() };
    this.activeSlotKey = "A";
    this.preloadedAyahIndex = null;

    this.initAudioEngine();
    this.init();
  }

  get audioElement() {
    return this.audioSlots[this.activeSlotKey];
  }

  get inactiveAudio() {
    return this.audioSlots[this.activeSlotKey === "A" ? "B" : "A"];
  }

  async init() {
    this.renderNavigation();
    this.renderMainContent();
    this.renderFooter();
    this.bindGlobalEvents();
    await this.loadSurah(this.currentSurah, { autoplay: false });
  }

  initAudioEngine() {
    Object.values(this.audioSlots).forEach((audio) => {
      audio.preload = "auto";
      audio.volume = this.volume;

      audio.addEventListener("timeupdate", () => {
        if (audio !== this.audioElement) return;
        this.currentTime = audio.currentTime;
        this.duration = audio.duration || 0;
        this.updateAudioProgressUI();
      });

      audio.addEventListener("play", () => {
        if (audio !== this.audioElement) return;
        this.isPlaying = true;
        this.updatePlayStateUI();
      });

      audio.addEventListener("pause", () => {
        if (audio !== this.audioElement) return;
        this.isPlaying = false;
        this.updatePlayStateUI();
      });

      audio.addEventListener("loadedmetadata", () => {
        if (audio !== this.audioElement) return;
        this.duration = audio.duration || 0;
        this.updateAudioProgressUI();
      });

      audio.addEventListener("ended", () => {
        if (audio !== this.audioElement) return;
        this.handleAyahEnded();
      });

      audio.addEventListener("error", () => {
        if (!audio.src) return;
        if (audio === this.audioElement) {
          this.missingAudioCount += 1;
          if (this.missingAudioCount === 1) {
            this.showToast(
              `Couldn't play ${this.selectedReciter.name}'s audio for this ayah — try another reciter`,
            );
          }
          this.isPlaying = false;
          this.updatePlayStateUI();
          this.stopRepeatMode();
        } else {
          this.preloadedAyahIndex = null;
        }
      });
    });
  }

  getAyahAudioUrl(ayah) {
    return ayah?.audioUrl || null;
  }

  predictNextIndex(currentIdx) {
    if (this.repeat.active) {
      const r = this.repeat;
      if (currentIdx === r.endIdx) {
        return r.repsDone + 1 < r.totalReps ? r.startIdx : null;
      }
      return currentIdx + 1;
    }
    const nextIdx = currentIdx + 1;
    if (nextIdx < (this.currentSurah.ayahs?.length || 0)) return nextIdx;
    if (this.loopMode === "surah") return 0;
    return null;
  }

  preloadForContext(currentIdx) {
    const predicted = this.predictNextIndex(currentIdx);
    if (predicted === null || predicted === undefined) {
      this.preloadedAyahIndex = null;
      return;
    }
    const ayah = this.currentSurah.ayahs?.[predicted];
    const url = ayah ? this.getAyahAudioUrl(ayah) : null;
    if (!url) {
      this.preloadedAyahIndex = null;
      return;
    }
    const inactive = this.inactiveAudio;
    if (inactive.src !== url) {
      inactive.pause();
      inactive.src = url;
      inactive.preload = "auto";
      inactive.load();
    }
    this.preloadedAyahIndex = predicted;
  }

  loadAndPlayAyah(idx, { autoplay = true } = {}) {
    const ayah = this.currentSurah.ayahs?.[idx];
    if (!ayah) return;

    const url = this.getAyahAudioUrl(ayah);
    if (!url) {
      this.missingAudioCount += 1;
      if (this.missingAudioCount === 1) {
        this.showToast(
          `${this.selectedReciter.name}'s recitation isn't available for ayah ${ayah.numberInSurah} — try another reciter`,
        );
      }
      this.activeAyahIndex = idx;
      this.isPlaying = false;
      this.updatePlayStateUI();
      return;
    }

    if (this.preloadedAyahIndex === idx && this.inactiveAudio.src === url) {
      const outgoing = this.audioElement;
      this.activeSlotKey = this.activeSlotKey === "A" ? "B" : "A";
      const incoming = this.audioElement;
      outgoing.pause();
      this.activeAyahIndex = idx;
      this.preloadedAyahIndex = null;
      incoming.playbackRate = this.playbackRate;
      incoming.volume = this.isMuted ? 0 : this.volume;
      this.updateActiveAyahUI();
      if (autoplay) incoming.play().catch(() => {});
      this.preloadForContext(idx);
      return;
    }

    this.activeAyahIndex = idx;
    const active = this.audioElement;
    active.src = url;
    active.playbackRate = this.playbackRate;
    active.volume = this.isMuted ? 0 : this.volume;
    active.load();
    this.updateActiveAyahUI();

    if (autoplay) {
      active.play().catch(() => {});
    }

    this.preloadForContext(idx);
  }

  togglePlayPause() {
    if (!this.currentSurah.ayahs?.length) {
      this.showToast("Please wait — verses are still loading");
      return;
    }
    if (!this.audioElement.currentSrc || this.audioElement.ended) {
      this.loadAndPlayAyah(this.activeAyahIndex || 0, { autoplay: true });
      return;
    }
    if (this.audioElement.paused) {
      this.audioElement.play().catch(() => {});
    } else {
      this.audioElement.pause();
    }
  }

  handleAyahEnded() {
    if (this.repeat.active) {
      this.handleRepeatEnded();
      return;
    }
    const nextIdx = this.activeAyahIndex + 1;
    if (nextIdx < this.currentSurah.ayahs.length) {
      this.loadAndPlayAyah(nextIdx, { autoplay: true });
    } else if (this.loopMode === "surah") {
      this.loadAndPlayAyah(0, { autoplay: true });
    } else {
      this.isPlaying = false;
      this.updatePlayStateUI();
    }
  }

  async fetchSurahData(surah, reciter) {
    const audioCacheKey = `${surah.number}_${reciter.id}`;
    const needText = !this.surahTextCache[surah.number];
    const needAudio = !this.reciterAudioCache[audioCacheKey];

    if (!needText && !needAudio) {
      return this.mergeSurahData(surah.number, reciter.id);
    }

    if (needText && needAudio) {
      const editions = [
        "quran-uthmani",
        "en.sahih",
        "en.transliteration",
        reciter.serverCode,
      ];
      const url = `https://api.alquran.cloud/v1/surah/${surah.number}/editions/${editions.join(",")}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      const json = await res.json();
      const [arabicEd, englishEd, translitEd, audioEd] = json.data;

      this.surahTextCache[surah.number] = arabicEd.ayahs.map((a, idx) => ({
        numberInSurah: a.numberInSurah,
        globalNumber: a.number,
        arabic: a.text,
        english: englishEd?.ayahs?.[idx]?.text || "",
        transliteration: translitEd?.ayahs?.[idx]?.text || "",
      }));

      const map = {};
      (audioEd?.ayahs || []).forEach((a) => {
        if (a.audio) map[a.numberInSurah] = a.audio;
      });
      this.reciterAudioCache[audioCacheKey] = map;
    } else if (needAudio) {
      const url = `https://api.alquran.cloud/v1/surah/${surah.number}/${reciter.serverCode}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      const json = await res.json();
      const map = {};
      (json.data?.ayahs || []).forEach((a) => {
        if (a.audio) map[a.numberInSurah] = a.audio;
      });
      this.reciterAudioCache[audioCacheKey] = map;
    } else if (needText) {
      const editions = ["quran-uthmani", "en.sahih", "en.transliteration"];
      const url = `https://api.alquran.cloud/v1/surah/${surah.number}/editions/${editions.join(",")}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      const json = await res.json();
      const [arabicEd, englishEd, translitEd] = json.data;
      this.surahTextCache[surah.number] = arabicEd.ayahs.map((a, idx) => ({
        numberInSurah: a.numberInSurah,
        globalNumber: a.number,
        arabic: a.text,
        english: englishEd?.ayahs?.[idx]?.text || "",
        transliteration: translitEd?.ayahs?.[idx]?.text || "",
      }));
    }

    return this.mergeSurahData(surah.number, reciter.id);
  }

  mergeSurahData(surahNumber, reciterId) {
    const text = this.surahTextCache[surahNumber] || [];
    const audioMap = this.reciterAudioCache[`${surahNumber}_${reciterId}`] || {};
    return text.map((a) => ({
      ...a,
      audioUrl: audioMap[a.numberInSurah] || null,
    }));
  }

  async loadSurah(surah, { autoplay = false } = {}) {
    this.isLoadingVerses = true;
    this.missingAudioCount = 0;
    this.preloadedAyahIndex = null;
    if (this.currentView === "recitation") this.renderMainContent();

    try {
      const merged = await this.fetchSurahData(surah, this.selectedReciter);
      surah.ayahs = merged;
    } catch (err) {
      this.showToast("Couldn't load this surah — please check your connection");
    } finally {
      this.isLoadingVerses = false;
      if (this.currentView === "recitation" && this.currentSurah.id === surah.id) {
        this.renderMainContent();
      }
      if (this.currentSurah.id === surah.id && surah.ayahs?.length) {
        this.loadAndPlayAyah(0, { autoplay });
      }
    }
  }

  async setSurah(surahId) {
    const found = this.surahs.find(
      (s) => s.id === surahId || s.number === parseInt(surahId),
    );
    if (!found) return;

    this.stopRepeatMode();
    this.audioSlots.A.pause();
    this.audioSlots.B.pause();
    this.preloadedAyahIndex = null;
    this.isPlaying = false;
    this.currentSurah = found;
    this.activeAyahIndex = 0;
    this.currentTime = 0;
    this.revealedAyahs = new Set();

    if (this.currentView === "recitation") this.renderMainContent();
    this.showToast(`Loaded Surah ${found.name}`);
    await this.loadSurah(found, { autoplay: false });
  }

  async setReciter(reciterId) {
    const found = this.reciters.find(
      (r) => r.id === reciterId || r.serverCode === reciterId,
    );
    if (!found || found.id === this.selectedReciter.id) return;

    const wasPlaying = this.isPlaying;
    this.audioSlots.A.pause();
    this.audioSlots.B.pause();
    this.preloadedAyahIndex = null;
    this.selectedReciter = found;
    this.isSwitchingReciter = true;
    this.missingAudioCount = 0;
    if (this.currentView === "recitation") this.renderMainContent();

    try {
      const merged = await this.fetchSurahData(this.currentSurah, found);
      this.currentSurah.ayahs = merged;
      this.showToast(`Reciter switched to ${found.name}`);
    } catch (err) {
      this.showToast(`Couldn't load ${found.name}'s recitation — please try again`);
    } finally {
      this.isSwitchingReciter = false;
      const idxToReload = this.repeat.active
        ? this.repeat.cursorIdx
        : this.activeAyahIndex;
      if (this.currentView === "recitation") this.renderMainContent();
      if (this.currentSurah.ayahs?.length) {
        this.loadAndPlayAyah(idxToReload, { autoplay: wasPlaying });
      }
    }
  }

  jumpSurah(direction) {
    const idx = this.surahs.findIndex((s) => s.id === this.currentSurah.id);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < this.surahs.length) {
      this.setSurah(this.surahs[nextIdx].id);
    }
  }

  startRepeatMode(startIdx, endIdx, totalReps, pauseMs = 500) {
    if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];
    totalReps = Math.max(1, Math.min(100, totalReps || 5));
    this.preloadedAyahIndex = null;
    this.repeat = {
      active: true,
      startIdx,
      endIdx,
      totalReps,
      repsDone: 0,
      cursorIdx: startIdx,
      pauseMs,
    };
    this.renderMainContent();
    this.loadAndPlayAyah(startIdx, { autoplay: true });
  }

  stopRepeatMode() {
    if (!this.repeat) return;
    this.repeat.active = false;
    this.preloadedAyahIndex = null;
    this.renderMainContent();
  }

  handleRepeatEnded() {
    const r = this.repeat;
    const isLastAyahInRange = r.cursorIdx === r.endIdx;

    if (isLastAyahInRange) {
      r.repsDone += 1;
      if (r.repsDone >= r.totalReps) {
        this.showToast(`Repetition drill complete — ${r.totalReps}x 🎉`);
        this.stopRepeatMode();
        return;
      }
    }

    const nextIdx = isLastAyahInRange ? r.startIdx : r.cursorIdx + 1;
    r.cursorIdx = nextIdx;
    this.renderMainContent();

    if (r.pauseMs > 0) {
      setTimeout(() => {
        if (!this.repeat.active) return;
        this.loadAndPlayAyah(nextIdx, { autoplay: true });
      }, r.pauseMs);
    } else {
      this.loadAndPlayAyah(nextIdx, { autoplay: true });
    }
  }

  quickRepeatAyah(idx) {
    const input = document.getElementById(`quick-repeat-count-${idx}`);
    let count = input ? parseInt(input.value, 10) : 5;
    if (!count || count < 1) count = 5;
    if (count > 50) count = 50;
    this.startRepeatMode(idx, idx, count, this.repeat.pauseMs || 500);
  }

  toggleLoop() {
    this.loopMode = this.loopMode === "surah" ? "off" : "surah";
    this.renderMainContent();
  }

  seekBy(delta) {
    const max = this.audioElement.duration || 0;
    this.audioElement.currentTime = Math.min(
      Math.max(this.audioElement.currentTime + delta, 0),
      max,
    );
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    const vol = this.isMuted ? 0 : this.volume;
    this.audioSlots.A.volume = vol;
    this.audioSlots.B.volume = vol;
    const muteBtn = document.getElementById("player-mute-btn");
    if (muteBtn) muteBtn.innerHTML = this.isMuted ? Icons.volumeMute : Icons.volumeHigh;
  }

  setVolume(vol) {
    this.volume = vol;
    this.isMuted = vol === 0;
    this.audioSlots.A.volume = vol;
    this.audioSlots.B.volume = vol;
    const muteBtn = document.getElementById("player-mute-btn");
    if (muteBtn) muteBtn.innerHTML = this.isMuted ? Icons.volumeMute : Icons.volumeHigh;
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.audioSlots.A.playbackRate = rate;
    this.audioSlots.B.playbackRate = rate;
    this.renderMainContent();
  }

  setFontSize(size) {
    this.fontSize = size;
    this.renderMainContent();
  }

  playAyah(idx) {
    if (this.repeat.active) this.stopRepeatMode();
    this.loadAndPlayAyah(idx, { autoplay: true });
  }

  toggleBookmark(idx) {
    const ayah = this.currentSurah.ayahs?.[idx];
    if (!ayah) return;
    const key = `${this.currentSurah.id}:${ayah.numberInSurah}`;
    if (this.bookmarks.has(key)) {
      this.bookmarks.delete(key);
      this.showToast("Bookmark removed");
    } else {
      this.bookmarks.add(key);
      this.showToast("Ayah bookmarked");
    }
    this.renderMainContent();
  }

  toggleRevealAyah(idx) {
    if (this.revealedAyahs.has(idx)) this.revealedAyahs.delete(idx);
    else this.revealedAyahs.add(idx);
    this.renderMainContent();
  }

  updatePlayStateUI() {
    const btn = document.getElementById("player-master-play-btn");
    if (btn) btn.innerHTML = this.isPlaying ? Icons.pause : Icons.play;
    const status = document.getElementById("player-status-label");
    if (status && !this.isSwitchingReciter) {
      const ayah = this.currentSurah.ayahs?.[this.activeAyahIndex];
      status.textContent = this.isPlaying
        ? `Now Reciting — Ayah ${ayah?.numberInSurah ?? this.activeAyahIndex + 1}`
        : "Ready to Recite";
    }
    this.updateActiveAyahUI();
  }

  updateAudioProgressUI() {
    const curEl = document.getElementById("player-time-current");
    const totEl = document.getElementById("player-time-total");
    const slider = document.getElementById("player-seek-slider");
    if (curEl) curEl.innerText = this.formatTime(this.currentTime);
    if (totEl) totEl.innerText = this.formatTime(this.duration);
    if (slider) {
      slider.max = this.duration || 0;
      slider.value = this.currentTime;
    }
  }

  updateActiveAyahUI() {
    const idx = this.activeAyahIndex;
    const badge = document.getElementById("player-ayah-of-badge");
    if (badge) badge.textContent = `Ayah ${idx + 1} of ${this.currentSurah.ayahCount}`;

    document.querySelectorAll("[data-ayah-row]").forEach((el) => {
      const i = parseInt(el.dataset.ayahRow, 10);
      el.classList.toggle("ayah-active", i === idx);
      const listeningBadge = el.querySelector("[data-listening-badge]");
      if (listeningBadge) {
        listeningBadge.classList.toggle("hidden", !(i === idx && this.isPlaying));
      }
    });

    if (this.autoScroll && this.isPlaying) {
      const row = document.querySelector(`[data-ayah-row="${idx}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  navigate(view) {
    this.currentView = view;
    this.isMobileMenuOpen = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.renderNavigation();
    this.renderMainContent();
    if (view === "recitation" && !this.surahTextCache[this.currentSurah.number]) {
      this.loadSurah(this.currentSurah, { autoplay: false });
    }
  }

  renderNavigation() {
    const container = document.getElementById("navbar-container");
    if (!container) return;

    container.innerHTML = `
      <nav class="sticky top-0 z-50 shadow-lg transition-all duration-300 bg-[#064e3b] border-b border-[#E1A100]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-row justify-between items-center">
          <div class="flex items-center gap-2 sm:gap-3 hover-lift cursor-pointer" id="nav-brand-logo">
            <img
              src="./images/favicon.ico"
              alt="Markazul Islam Logo"
              class="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-[#E1A100] object-cover shadow-sm hover:rotate-12 transition-transform duration-300"
              onerror="this.style.display='none'"
            />
            <span class="text-[#E1A100] font-semibold text-sm sm:text-base md:text-lg tracking-wide">
              Daarul Arkom
            </span>
          </div>

          <div class="hidden md:flex items-center gap-6 lg:gap-8">
            <a href="#" data-nav="home" class="text-[#E1A100] hover:text-white text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group">
              Home
              <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#" data-nav="recitation" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group">
              Recitation
              <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#" data-nav="courses" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group">
              Courses
              <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#" data-nav="profile" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group">
              Profile
              <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#" data-nav="admin" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group">
              Admin
              <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span>
            </a>
          </div>

          <button
            id="menuBtn"
            aria-label="Toggle Navigation Menu"
            aria-expanded="false"
            class="md:hidden text-[#E1A100] hover:text-white p-2 focus:outline-none hover:scale-110 transition-transform"
          >
            <i id="menuIcon" class="fa-solid fa-bars text-2xl"></i>
          </button>
        </div>

        <div
          id="mobileMenu"
          class="${this.isMobileMenuOpen ? "flex" : "hidden"} md:hidden flex-col gap-2 text-center bg-[#064e3b] border-t border-[#E1A100]"
        >
          <a href="#" data-nav="home" class="text-[#E1A100] hover:text-white hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Home</a>
          <a href="#" data-nav="recitation" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Recitation</a>
          <a href="#" data-nav="courses" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Courses</a>
          <a href="#" data-nav="profile" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Profile</a>
          <a href="#" data-nav="admin" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4 mb-4">Admin</a>
        </div>
      </nav>
    `;
  }

  renderFooter() {
    const container = document.getElementById("footer-container");
    if (!container) return;
    container.innerHTML = `
      <footer class="bg-[#064e3b] text-white py-8 border-t border-[#E1A100]">
        <div class="max-w-7xl mx-auto px-4 text-center">
          <p class="text-sm text-white/70">© 2026 Daarul Arkom Digital Madrasa. All rights reserved.</p>
        </div>
      </footer>
    `;
  }

  renderMainContent() {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (this.currentView === "home") this.renderHome(main);
    else if (this.currentView === "recitation") this.renderRecitation(main);
    else if (this.currentView === "courses") this.renderCourses(main);
    else if (this.currentView === "profile") this.renderProfile(main);
    else if (this.currentView === "admin") this.renderAdmin(main);
  }

  renderHome(main) {
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-12 space-y-12">
        <section class="text-center space-y-4">
          <h1 class="text-4xl md:text-5xl font-bold text-[#064e3b]">Welcome to Daarul Arkom</h1>
          <p class="text-lg text-gray-600 max-w-2xl mx-auto">Sacred Knowledge in the Modern Age. Learn Quran with authentic Tajweed from certified scholars.</p>
          <button id="hero-reciter-btn" class="px-6 py-3 bg-[#064e3b] text-[#E1A100] rounded-xl font-bold hover:bg-[#0a6b4a] transition-colors cursor-pointer">🎧 Open Quran Reciter</button>
        </section>
      </div>
    `;
  }

  renderRecitation(main) {
    const s = this.currentSurah;
    const activeIdx = this.activeAyahIndex;
    const arabicSizeClass =
      { normal: "text-2xl", large: "text-3xl", xlarge: "text-4xl" }[
        this.fontSize
      ] || "text-2xl";
    const ayahs = s.ayahs || [];
    const r = this.repeat;
    const controlsBusy = this.isLoadingVerses || this.isSwitchingReciter;

    let statusText = "Ready to Recite";
    if (this.isSwitchingReciter) statusText = "Switching reciter…";
    else if (this.isLoadingVerses) statusText = "Loading verses…";
    else if (this.isPlaying)
      statusText = `Now Reciting — Ayah ${ayahs[activeIdx]?.numberInSurah ?? activeIdx + 1}`;

    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">

        <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/10 shadow-sm">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <span class="inline-block px-3 py-1 rounded-full bg-[#064e3b] text-[#E1A100] text-xs font-bold tracking-wide mb-3">Surah #${s.number}</span>
              <h1 class="text-3xl md:text-4xl font-bold text-[#064e3b] flex items-center gap-3 flex-wrap">
                ${s.name}
                <span class="font-arabic text-[#E1A100] text-3xl md:text-4xl">${s.arabicName}</span>
              </h1>
              <p class="text-gray-600 mt-2">"${s.englishName}" • Concurrent Synchronous Recitation &amp; Study</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto md:min-w-[420px]">
              <div>
                <label class="block text-xs font-bold text-[#064e3b] tracking-wide mb-2 uppercase">Select Surah</label>
                <select id="player-surah-select" ${controlsBusy ? "disabled" : ""} class="w-full px-3 py-2.5 rounded-xl bg-[#fbf9f5] text-[#064e3b] border border-[#064e3b]/20 focus:outline-none focus:ring-2 focus:ring-[#E1A100] cursor-pointer disabled:opacity-60">
                  ${this.surahs
                    .map(
                      (x) =>
                        `<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${x.number}. ${x.name} (${x.arabicName})</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-[#064e3b] tracking-wide mb-2 uppercase">Reciter (Qari)</label>
                <select id="player-reciter-select" ${controlsBusy ? "disabled" : ""} class="w-full px-3 py-2.5 rounded-xl bg-[#fbf9f5] text-[#064e3b] border border-[#064e3b]/20 focus:outline-none focus:ring-2 focus:ring-[#E1A100] cursor-pointer disabled:opacity-60">
                  ${this.reciters
                    .map(
                      (rec) =>
                        `<option value="${rec.id}" ${rec.id === this.selectedReciter.id ? "selected" : ""}>${rec.name} (${rec.arabicName})</option>`,
                    )
                    .join("")}
                </select>
                ${this.isSwitchingReciter ? `<p class="text-xs text-[#E1A100]/90 mt-1 font-semibold">Switching voice…</p>` : ""}
              </div>
            </div>
          </div>
        </div>

        <div class="bg-[#064e3b] rounded-2xl p-6 text-white shadow-lg">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-[#E1A100] text-[#064e3b] flex items-center justify-center text-xl flex-shrink-0">${Icons.headphones}</div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="font-bold text-lg">${s.name} — <span class="font-arabic">${s.arabicName}</span></h2>
                  <span id="player-ayah-of-badge" class="px-2 py-0.5 rounded-full bg-white/10 text-[#E1A100] text-xs font-semibold">Ayah ${activeIdx + 1} of ${s.ayahCount}</span>
                </div>
                <p class="text-sm text-[#E1A100]/90 mt-0.5">${this.selectedReciter.name} (${this.selectedReciter.arabicName}) — ${this.selectedReciter.style}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/60 mr-1 hidden sm:inline">Speed:</span>
              <div class="flex items-center bg-white/10 rounded-xl p-1 gap-1">
                ${[0.75, 1, 1.25, 1.5]
                  .map(
                    (rate) => `
                  <button data-speed="${rate}" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${this.playbackRate === rate ? "bg-[#E1A100] text-[#064e3b]" : "text-white/80 hover:bg-white/10"}">${rate}x</button>
                `,
                  )
                  .join("")}
              </div>
              <button id="player-loop-btn" title="Repeat whole surah" class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${this.loopMode === "surah" ? "bg-[#E1A100] text-[#064e3b]" : "bg-white/10 text-white/80 hover:bg-white/20"}">${Icons.repeat}</button>
            </div>
          </div>

          <div class="mt-5">
            <div class="flex items-center justify-between text-xs text-[#E1A100]/80 mb-1">
              <span id="player-time-current">${this.formatTime(this.currentTime)}</span>
              <span class="uppercase tracking-widest font-semibold" id="player-status-label">${statusText}</span>
              <span id="player-time-total">${this.formatTime(this.duration)}</span>
            </div>
            <input type="range" id="player-seek-slider" min="0" max="${this.duration || 0}" value="${this.currentTime}" class="w-full audio-range" />
          </div>

          <div class="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-2">
              <button id="player-prev-surah-btn" title="Previous surah" class="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">${Icons.skipBack}</button>
              <button id="player-back10-btn" title="Back 10s" class="px-2 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-semibold">${Icons.rewind10}</button>
              <button id="player-master-play-btn" class="w-14 h-14 rounded-full bg-[#E1A100] text-[#064e3b] flex items-center justify-center hover:brightness-95 transition">${this.isPlaying ? Icons.pause : Icons.play}</button>
              <button id="player-fwd10-btn" title="Forward 10s" class="px-2 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-semibold">${Icons.forward10}</button>
              <button id="player-next-surah-btn" title="Next surah" class="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">${Icons.skipForward}</button>
            </div>
            <div class="flex items-center gap-2">
              <button id="player-mute-btn" class="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white">${this.isMuted || this.volume === 0 ? Icons.volumeMute : Icons.volumeHigh}</button>
              <input type="range" id="player-volume-slider" min="0" max="1" step="0.01" value="${this.isMuted ? 0 : this.volume}" class="w-28 audio-range" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-4 border border-[#064e3b]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-[#064e3b]">Script Size:</span>
            ${["normal", "large", "xlarge"]
              .map(
                (size) => `
              <button data-fontsize="${size}" class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${this.fontSize === size ? "bg-[#064e3b] text-[#E1A100]" : "text-[#064e3b] hover:bg-[#064e3b]/10"}">${{ normal: "Standard", large: "Large", xlarge: "Extra Large" }[size]}</button>
            `,
              )
              .join("")}
          </div>
          <div class="flex items-center gap-5 flex-wrap">
            <label class="flex items-center gap-2 text-sm text-[#064e3b] cursor-pointer">
              <input type="checkbox" id="toggle-transliteration" class="accent-[#064e3b] w-4 h-4" ${this.showTransliteration ? "checked" : ""} />
              Transliteration
            </label>
            <label class="flex items-center gap-2 text-sm text-[#064e3b] cursor-pointer">
              <input type="checkbox" id="toggle-translation" class="accent-[#064e3b] w-4 h-4" ${this.showTranslation ? "checked" : ""} />
              English Translation
            </label>
            <label class="flex items-center gap-2 text-sm text-[#064e3b] cursor-pointer">
              <input type="checkbox" id="toggle-autoscroll" class="accent-[#064e3b] w-4 h-4" ${this.autoScroll ? "checked" : ""} />
              Auto-scroll to Active Ayah
            </label>
          </div>
        </div>

        ${ayahs.length ? `
        <div class="bg-white rounded-2xl p-5 border border-[#064e3b]/10">
          <h3 class="font-bold text-[#064e3b] mb-3">📿 Memorization Tools</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs font-semibold text-[#064e3b] mb-1">From Ayah</label>
              <select id="repeat-start-select" ${r.active ? "disabled" : ""} class="w-full px-2 py-2 rounded-lg border border-[#064e3b]/20 text-sm bg-[#fbf9f5]">
                ${ayahs.map((a, i) => `<option value="${i}" ${i === r.startIdx ? "selected" : ""}>${a.numberInSurah}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#064e3b] mb-1">To Ayah</label>
              <select id="repeat-end-select" ${r.active ? "disabled" : ""} class="w-full px-2 py-2 rounded-lg border border-[#064e3b]/20 text-sm bg-[#fbf9f5]">
                ${ayahs.map((a, i) => `<option value="${i}" ${i === r.endIdx ? "selected" : ""}>${a.numberInSurah}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#064e3b] mb-1">Repeat Count</label>
              <div class="flex items-center gap-1">
                <input type="number" id="repeat-count-input" min="1" max="100" value="${r.totalReps}" ${r.active ? "disabled" : ""} class="w-16 px-2 py-2 rounded-lg border border-[#064e3b]/20 text-sm bg-[#fbf9f5]" />
                <div class="flex gap-1">
                  ${[5, 10, 20]
                    .map(
                      (n) =>
                        `<button data-repeat-preset="${n}" ${r.active ? "disabled" : ""} class="px-2 py-1 rounded-md text-xs font-semibold bg-[#064e3b]/10 text-[#064e3b] hover:bg-[#064e3b]/20 disabled:opacity-50">${n}x</button>`,
                    )
                    .join("")}
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#064e3b] mb-1">Pause Between</label>
              <select id="repeat-pause-select" ${r.active ? "disabled" : ""} class="w-full px-2 py-2 rounded-lg border border-[#064e3b]/20 text-sm bg-[#fbf9f5]">
                ${[0, 500, 1000, 2000, 3000].map((ms) => `<option value="${ms}" ${ms === r.pauseMs ? "selected" : ""}>${ms === 0 ? "None (gapless)" : ms / 1000 + "s"}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div class="flex items-center gap-3">
              ${r.active
                ? `<button id="repeat-stop-btn" class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">■ Stop Repeating</button>
                   <span class="text-sm font-semibold text-[#064e3b]">Repeating Ayah ${ayahs[r.cursorIdx]?.numberInSurah} — Rep ${r.repsDone + 1} of ${r.totalReps}</span>`
                : `<button id="repeat-start-btn" class="px-4 py-2 rounded-xl bg-[#064e3b] text-[#E1A100] text-sm font-bold hover:bg-[#0a6b4a]">▶ Start Repetition Drill</button>`
              }
            </div>
            <label class="flex items-center gap-2 text-sm text-[#064e3b] cursor-pointer">
              <input type="checkbox" id="toggle-hide-text" class="accent-[#064e3b] w-4 h-4" ${this.hideTextMode ? "checked" : ""} />
              Hide Text (Recall Test)
            </label>
          </div>
        </div>
        ` : ""}

        <div id="ayah-list" class="space-y-4">
          ${this.isLoadingVerses && !ayahs.length
            ? `<div class="text-center py-10 text-gray-500">Loading full verses…</div>`
            : ayahs
                .map((ayah, idx) => {
                  const isActive = idx === activeIdx;
                  const bookmarkKey = `${s.id}:${ayah.numberInSurah}`;
                  const isBookmarked = this.bookmarks.has(bookmarkKey);
                  const isHidden = this.hideTextMode && !this.revealedAyahs.has(idx);
                  return `
                    <div data-ayah-row="${idx}" class="rounded-xl p-4 border bg-[#fef9e7]/40 border-[#064e3b]/10 transition-colors ${isActive ? "ayah-active" : ""}">
                      <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div class="flex items-center gap-2">
                          <button data-play-ayah="${idx}" title="Play this ayah" class="w-7 h-7 rounded-full bg-white border border-[#064e3b]/20 flex items-center justify-center text-[#064e3b] hover:bg-[#064e3b] hover:text-white transition-colors">${Icons.play}</button>
                          <span class="w-6 h-6 rounded-full border border-[#E1A100] text-[#064e3b] text-xs flex items-center justify-center font-semibold bg-white">${ayah.numberInSurah}</span>
                          <button data-bookmark-ayah="${idx}" title="Bookmark" class="w-7 h-7 flex items-center justify-center text-[#064e3b]/60 hover:text-[#064e3b]">${isBookmarked ? Icons.bookmarkFilled : Icons.bookmarkOutline}</button>
                          <div class="flex items-center gap-1">
                            <input type="number" id="quick-repeat-count-${idx}" min="1" max="50" value="5" class="w-12 px-1.5 py-1 rounded-md border border-[#064e3b]/20 text-xs bg-white" />
                            <button data-quick-repeat="${idx}" title="Repeat this ayah" class="flex items-center gap-1 px-2 h-7 rounded-full border border-[#064e3b]/20 text-[#064e3b] text-xs font-semibold hover:bg-[#064e3b] hover:text-white transition-colors">🔁</button>
                          </div>
                        </div>
                        <span data-listening-badge class="px-2 py-0.5 rounded-full bg-[#064e3b] text-[#E1A100] text-[10px] font-bold uppercase tracking-wide ${isActive && this.isPlaying ? "" : "hidden"}">Listening Now</span>
                      </div>
                      ${isHidden
                        ? `<button data-reveal-ayah="${idx}" class="w-full text-center py-6 rounded-lg bg-[#064e3b]/5 text-[#064e3b] text-sm font-semibold hover:bg-[#064e3b]/10 transition-colors">👁 Tap to reveal ayah ${ayah.numberInSurah}</button>`
                        : `
                        <p class="font-arabic ${arabicSizeClass} text-right leading-loose text-[#064e3b]">${ayah.arabic}</p>
                        ${this.showTransliteration ? `<p class="text-xs text-[#735c00] mt-2 italic">${ayah.transliteration}</p>` : ""}
                        ${this.showTranslation ? `<p class="text-sm text-gray-600 mt-1">${ayah.english}</p>` : ""}
                        ${this.hideTextMode ? `<button data-reveal-ayah="${idx}" class="text-xs text-[#064e3b]/50 mt-2 underline">Hide again</button>` : ""}
                      `
                      }
                    </div>
                  `;
                })
                .join("")}
        </div>
      </div>
    `;
  }

  renderCourses(main) {
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-12">
        <h1 class="text-3xl font-bold text-[#064e3b] mb-8">Academic Programs</h1>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${COURSES.map(
            (c) => `
            <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20 shadow-sm hover:shadow-md transition-shadow">
              <h3 class="font-bold text-lg text-[#064e3b]">${c.title}</h3>
              <p class="text-sm text-gray-600 mt-2">${c.description || c.shortDescription}</p>
              <p class="text-[#E1A100] font-bold mt-3">$${c.price}</p>
            </div>
          `,
          ).join("")}
        </div>
      </div>
    `;
  }

  renderProfile(main) {
    main.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 py-12">
        <div class="bg-white rounded-2xl p-8 border border-[#064e3b]/20 shadow-sm">
          <div class="flex items-center gap-6 mb-8">
            <div class="w-24 h-24 rounded-full bg-[#064e3b]/10 flex items-center justify-center text-4xl text-[#064e3b]">
              👤
            </div>
            <div>
              <h1 class="text-2xl font-bold text-[#064e3b]">Salman Farooq</h1>
              <p class="text-gray-600">Student • salman.f@madrasa.org</p>
              <div class="flex gap-4 mt-2">
                <span class="text-sm bg-[#E1A100]/20 text-[#064e3b] px-3 py-1 rounded-full">🔥 12 Day Streak</span>
                <span class="text-sm bg-[#064e3b]/10 text-[#064e3b] px-3 py-1 rounded-full">⭐ 450 Points</span>
              </div>
            </div>
          </div>
          <div class="border-t border-[#064e3b]/10 pt-6">
            <h2 class="font-bold text-[#064e3b] mb-4">Enrolled Courses</h2>
            <div class="space-y-3">
              ${COURSES.map(
                (c) => `
                <div class="flex items-center justify-between p-4 bg-[#fbf9f5] rounded-xl border border-[#064e3b]/10">
                  <div>
                    <p class="font-semibold text-[#064e3b]">${c.title}</p>
                    <p class="text-sm text-gray-500">${c.category} • ${c.weeksCount} weeks</p>
                  </div>
                  <span class="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">In Progress</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAdmin(main) {
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-12">
        <h1 class="text-3xl font-bold text-[#064e3b] mb-8">Admin Dashboard</h1>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20 shadow-sm">
            <h3 class="text-sm text-gray-500">Total Students</h3>
            <p class="text-3xl font-bold text-[#064e3b]">50+</p>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20 shadow-sm">
            <h3 class="text-sm text-gray-500">Courses</h3>
            <p class="text-3xl font-bold text-[#064e3b]">${COURSES.length}</p>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20 shadow-sm">
            <h3 class="text-sm text-gray-500">Teachers</h3>
            <p class="text-3xl font-bold text-[#064e3b]">2+</p>
          </div>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20 shadow-sm">
          <h2 class="font-bold text-[#064e3b] mb-4">Recent Activity</h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-[#fbf9f5] rounded-xl">
              <span>Salman Farooq completed Tajweed Foundations</span>
              <span class="text-sm text-gray-500">2 hours ago</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-[#fbf9f5] rounded-xl">
              <span>New enrollment: Ali Khan - Quranic Arabic</span>
              <span class="text-sm text-gray-500">5 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className =
      "px-4 py-3 rounded-xl bg-[#064e3b] text-white border border-[#E1A100] text-xs font-semibold shadow-xl";
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  bindGlobalEvents() {
    document.addEventListener("click", (e) => {
      const target = e.target;

      if (target.closest("#menuBtn")) {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
        const mobileMenu = document.getElementById("mobileMenu");
        const menuIcon = document.getElementById("menuIcon");
        if (mobileMenu) {
          mobileMenu.classList.toggle("hidden");
          mobileMenu.classList.toggle("flex");
        }
        if (menuIcon) {
          menuIcon.classList.toggle("fa-bars");
          menuIcon.classList.toggle("fa-xmark");
        }
        return;
      }

      const navLink = target.closest("[data-nav]");
      if (navLink) {
        e.preventDefault();
        this.navigate(navLink.dataset.nav);
        return;
      }

      if (target.closest("#nav-brand-logo")) {
        this.navigate("home");
        return;
      }

      if (target.closest("#hero-reciter-btn")) {
        this.navigate("recitation");
        return;
      }

      if (target.closest("#player-master-play-btn")) {
        this.togglePlayPause();
        return;
      }

      if (target.closest("#player-loop-btn")) {
        this.toggleLoop();
        return;
      }

      if (target.closest("#player-back10-btn")) {
        this.seekBy(-10);
        return;
      }

      if (target.closest("#player-fwd10-btn")) {
        this.seekBy(10);
        return;
      }

      if (target.closest("#player-prev-surah-btn")) {
        this.jumpSurah(-1);
        return;
      }

      if (target.closest("#player-next-surah-btn")) {
        this.jumpSurah(1);
        return;
      }

      if (target.closest("#player-mute-btn")) {
        this.toggleMute();
        return;
      }

      if (target.closest("#repeat-start-btn")) {
        this.startRepeatMode(
          this.repeat.startIdx,
          this.repeat.endIdx,
          this.repeat.totalReps,
          this.repeat.pauseMs,
        );
        return;
      }

      if (target.closest("#repeat-stop-btn")) {
        this.stopRepeatMode();
        return;
      }

      const repeatPresetBtn = target.closest("[data-repeat-preset]");
      if (repeatPresetBtn) {
        const n = parseInt(repeatPresetBtn.dataset.repeatPreset, 10);
        this.repeat.totalReps = n;
        const input = document.getElementById("repeat-count-input");
        if (input) input.value = n;
        return;
      }

      const speedBtn = target.closest("[data-speed]");
      if (speedBtn) {
        this.setPlaybackRate(parseFloat(speedBtn.dataset.speed));
        return;
      }

      const fontBtn = target.closest("[data-fontsize]");
      if (fontBtn) {
        this.setFontSize(fontBtn.dataset.fontsize);
        return;
      }

      const playAyahBtn = target.closest("[data-play-ayah]");
      if (playAyahBtn) {
        this.playAyah(parseInt(playAyahBtn.dataset.playAyah, 10));
        return;
      }

      const bookmarkBtn = target.closest("[data-bookmark-ayah]");
      if (bookmarkBtn) {
        this.toggleBookmark(parseInt(bookmarkBtn.dataset.bookmarkAyah, 10));
        return;
      }

      const quickRepeatBtn = target.closest("[data-quick-repeat]");
      if (quickRepeatBtn) {
        this.quickRepeatAyah(parseInt(quickRepeatBtn.dataset.quickRepeat, 10));
        return;
      }

      const revealBtn = target.closest("[data-reveal-ayah]");
      if (revealBtn) {
        this.toggleRevealAyah(parseInt(revealBtn.dataset.revealAyah, 10));
        return;
      }
    });

    document.addEventListener("change", (e) => {
      if (e.target.id === "player-surah-select") {
        this.setSurah(e.target.value);
      } else if (e.target.id === "player-reciter-select") {
        this.setReciter(e.target.value);
      } else if (e.target.id === "toggle-transliteration") {
        this.showTransliteration = e.target.checked;
        this.renderMainContent();
      } else if (e.target.id === "toggle-translation") {
        this.showTranslation = e.target.checked;
        this.renderMainContent();
      } else if (e.target.id === "toggle-autoscroll") {
        this.autoScroll = e.target.checked;
      } else if (e.target.id === "toggle-hide-text") {
        this.hideTextMode = e.target.checked;
        this.revealedAyahs = new Set();
        this.renderMainContent();
      } else if (e.target.id === "repeat-start-select") {
        this.repeat.startIdx = parseInt(e.target.value, 10);
      } else if (e.target.id === "repeat-end-select") {
        this.repeat.endIdx = parseInt(e.target.value, 10);
      } else if (e.target.id === "repeat-count-input") {
        let val = parseInt(e.target.value, 10);
        if (!val || val < 1) val = 1;
        if (val > 100) val = 100;
        this.repeat.totalReps = val;
      } else if (e.target.id === "repeat-pause-select") {
        this.repeat.pauseMs = parseInt(e.target.value, 10);
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "player-seek-slider") {
        this.audioElement.currentTime = parseFloat(e.target.value);
      } else if (e.target.id === "player-volume-slider") {
        this.setVolume(parseFloat(e.target.value));
      }
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DaarulArkomApp();
});