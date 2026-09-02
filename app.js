import {
  COURSES,
  INSTRUCTORS,
  LIVE_SESSIONS,
  ASSIGNMENTS,
  CURRENT_STUDENT,
  IMAGES,
  RECITERS,
  SURAHS,
} from "./data.js";
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
    this.audioElement = new Audio();
    this.initAudioEngine();
    this.init();
  }

  async init() {
    this.renderNavigation();
    this.renderMainContent();
    this.renderFooter();
    this.bindGlobalEvents();
  }

  initAudioEngine() {
    this.audioElement.preload = "metadata";
    this.audioElement.volume = this.volume;
    this.loadAudioSource();
    this.audioElement.addEventListener("timeupdate", () => {
      this.currentTime = this.audioElement.currentTime;
      this.duration =
        this.audioElement.duration || this.currentSurah.durationSeconds;
      this.updateAudioProgressUI();
    });
    this.audioElement.addEventListener("play", () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
    });
    this.audioElement.addEventListener("pause", () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
    });
    this.audioElement.addEventListener("loadedmetadata", () => {
      this.duration =
        this.audioElement.duration || this.currentSurah.durationSeconds;
      this.updateAudioProgressUI();
    });
    this.audioElement.addEventListener("ended", () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
    });
  }

  loadAudioSource() {
    const serverCode = this.selectedReciter?.serverCode || "ar.alafasy";
    const audioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${serverCode}/${this.currentSurah.number}.mp3`;
    if (this.audioElement.src !== audioUrl) {
      this.audioElement.src = audioUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.isMuted ? 0 : this.volume;
    }
  }

  togglePlayPause() {
    if (this.audioElement.paused || this.audioElement.ended) {
      this.audioElement.play().catch(() => {});
    } else {
      this.audioElement.pause();
    }
  }

  setSurah(surahId) {
    const found = this.surahs.find(
      (s) => s.id === surahId || s.number === parseInt(surahId),
    );
    if (found) {
      this.currentSurah = found;
      this.activeAyahIndex = 0;
      this.currentTime = 0;
      this.loadAudioSource();
      if (this.currentView === "recitation") this.renderMainContent();
      this.showToast(`Loaded Surah ${found.name}`);
    }
  }

  setReciter(reciterId) {
    const found = this.reciters.find(
      (r) => r.id === reciterId || r.serverCode === reciterId,
    );
    if (found) {
      this.selectedReciter = found;
      this.loadAudioSource();
      if (this.currentView === "recitation") this.renderMainContent();
      this.showToast(`Reciter switched to ${found.name}`);
    }
  }

  updatePlayStateUI() {
    const btn = document.getElementById("player-master-play-btn");
    if (btn) btn.innerHTML = this.isPlaying ? Icons.pause : Icons.play;
  }

  updateAudioProgressUI() {
    const curEl = document.getElementById("player-time-current");
    const totEl = document.getElementById("player-time-total");
    const slider = document.getElementById("player-seek-slider");
    if (curEl) curEl.innerText = this.formatTime(this.currentTime);
    if (totEl)
      totEl.innerText = this.formatTime(
        this.duration || this.currentSurah.durationSeconds,
      );
    if (slider) {
      slider.max = this.duration || this.currentSurah.durationSeconds;
      slider.value = this.currentTime;
    }
  }

  formatTime(seconds) {
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
              Darul-Arkom
            </span>
          </div>

          <div class="hidden md:flex items-center gap-6 lg:gap-8">
            <a href="./index.html" class="text-[#E1A100] hover:text-white text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group"
              >Home<span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span
            ></a>
            <a href="" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group"
              >Services<span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span
            ></a>
            <a href="./register.html" class="text-white/80 hover:text-[#E1A100] text-base lg:text-lg font-medium transition-all duration-200 hover:scale-110 relative group"
              >Register<span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span
            ></a>
            <a href="" class="text-white/80 hover:text-[#E1A100] text-base font-medium transition-all duration-200 hover:scale-110 relative group"
              >Contact<span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E1A100] group-hover:w-full transition-all duration-300"></span
            ></a>
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
          <a href="./index.html" class="text-[#E1A100] hover:text-white hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Home</a>
          <a href="" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Services</a>
          <a href="./register.html" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4">Register</a>
          <a href="" class="text-white/80 hover:text-[#E1A100] hover:bg-green-800 text-lg font-medium transition-colors duration-200 py-3 px-4 rounded-lg mx-4 mb-4">Contact</a>
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
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div class="bg-[#064e3b] rounded-2xl p-6 text-white border border-[#E1A100]">
          <h1 class="text-2xl font-bold text-[#E1A100] mb-4">Quran Reciter</h1>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-[#E1A100] mb-2 font-semibold">Select Surah:</label>
              <select id="player-surah-select" class="w-full px-3 py-2.5 rounded-xl bg-white text-[#064e3b] border border-[#E1A100] focus:outline-none focus:ring-2 focus:ring-[#E1A100] cursor-pointer">
                ${this.surahs.map((s) => `<option value="${s.id}" ${s.id === this.currentSurah.id ? "selected" : ""}>${s.number}. ${s.name} (${s.englishName})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm text-[#E1A100] mb-2 font-semibold">Select Reciter:</label>
              <select id="player-reciter-select" class="w-full px-3 py-2.5 rounded-xl bg-white text-[#064e3b] border border-[#E1A100] focus:outline-none focus:ring-2 focus:ring-[#E1A100] cursor-pointer">
                ${this.reciters.map((r) => `<option value="${r.id}" ${r.id === this.selectedReciter.id ? "selected" : ""}>${r.name}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-[#064e3b]/20">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-[#064e3b]">${this.currentSurah.name} (${this.currentSurah.arabicName})</h2>
            <span class="text-sm text-gray-500">${this.currentSurah.ayahCount} Ayahs</span>
          </div>
          <div class="mt-4 flex items-center gap-4">
            <button id="player-master-play-btn" class="w-12 h-12 rounded-full bg-[#064e3b] text-[#E1A100] flex items-center justify-center hover:bg-[#0a6b4a] transition-colors cursor-pointer">${this.isPlaying ? Icons.pause : Icons.play}</button>
            <span id="player-time-current" class="text-sm text-gray-600">0:00</span>
            <input type="range" id="player-seek-slider" min="0" max="${this.currentSurah.durationSeconds}" value="0" class="flex-1 audio-range" />
            <span id="player-time-total" class="text-sm text-gray-600">${this.formatTime(this.currentSurah.durationSeconds)}</span>
          </div>
        </div>
        <div class="space-y-4">
          ${this.currentSurah.ayahs
            .map(
              (ayah, idx) => `
            <div class="bg-white rounded-xl p-4 border border-[#064e3b]/10">
              <p class="font-arabic text-2xl text-right leading-loose text-[#064e3b]">${ayah.arabic}</p>
              <p class="text-sm text-gray-600 mt-2 italic">${ayah.english}</p>
              <p class="text-xs text-[#E1A100] mt-1">${ayah.transliteration}</p>
            </div>
          `,
            )
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

      if (target.closest("#nav-brand-logo")) this.navigate("home");
      else if (target.closest("#hero-reciter-btn")) this.navigate("recitation");
      else if (target.closest("#player-master-play-btn"))
        this.togglePlayPause();
    });

    document.addEventListener("change", (e) => {
      if (e.target.id === "player-surah-select") {
        this.setSurah(e.target.value);
      } else if (e.target.id === "player-reciter-select") {
        this.setReciter(e.target.value);
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "player-seek-slider") {
        this.audioElement.currentTime = parseFloat(e.target.value);
      }
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DaarulArkomApp();
});
