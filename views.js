export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function renderHeroSection() {
  return `
    <section class="text-center space-y-4 py-12">
      <h1 class="text-4xl md:text-5xl font-bold text-[#003527]">Welcome to Daarul Arkom</h1>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto">Sacred Knowledge in the Modern Age. Learn Quran with authentic Tajweed from certified scholars.</p>
    </section>
  `;
}

export function renderStatsBar() {
  return `
    <section class="bg-[#003527] rounded-2xl p-8 text-center text-white">
      <div class="grid grid-cols-3 gap-4">
        <div><span class="text-3xl font-bold text-[#fed65b]">50+</span><p class="text-sm">Active Students</p></div>
        <div><span class="text-3xl font-bold text-[#fed65b]">2+</span><p class="text-sm">Certified Teachers</p></div>
        <div><span class="text-3xl font-bold text-[#fed65b]">10+</span><p class="text-sm">Years Experience</p></div>
      </div>
    </section>
  `;
}

export function renderCourseCard(course) {
  return `
    <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <h3 class="font-bold text-lg text-[#003527]">${course.title}</h3>
      <p class="text-sm text-gray-600 mt-2">${course.shortDescription || course.description}</p>
      <p class="text-[#735c00] font-bold mt-3">$${course.price}</p>
    </div>
  `;
}

export function renderQuranRecitationView(data) {
  return `
    <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div class="bg-[#003527] rounded-2xl p-6 text-white">
        <h1 class="text-2xl font-bold text-[#fed65b]">Quran Reciter</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <select id="player-surah-select" class="px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20">
            ${data.surahs.map((s) => `<option value="${s.id}" ${s.id === data.currentSurah.id ? "selected" : ""}>${s.number}. ${s.name} (${s.englishName})</option>`).join("")}
          </select>
          <select id="player-reciter-select" class="px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20">
            ${data.reciters.map((r) => `<option value="${r.id}" ${r.id === data.selectedReciter.id ? "selected" : ""}>${r.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="bg-white rounded-2xl p-6 border border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-[#003527]">${data.currentSurah.name} (${data.currentSurah.arabicName})</h2>
          <span class="text-sm text-gray-500">${data.currentSurah.ayahCount} Ayahs</span>
        </div>
        <div class="mt-4 flex items-center gap-4">
          <button id="player-master-play-btn" class="w-12 h-12 rounded-full bg-[#003527] text-[#fed65b] flex items-center justify-center">▶</button>
          <span id="player-time-current" class="text-sm">0:00</span>
          <input type="range" id="player-seek-slider" min="0" max="${data.currentSurah.durationSeconds}" value="0" class="flex-1 audio-range" />
          <span id="player-time-total" class="text-sm">${formatTime(data.currentSurah.durationSeconds)}</span>
        </div>
      </div>
      <div class="space-y-4">
        ${data.currentSurah.ayahs
          .map(
            (ayah, idx) => `
          <div class="bg-white rounded-xl p-4 border border-gray-200">
            <p class="font-arabic text-2xl text-right leading-loose">${ayah.arabic}</p>
            <p class="text-sm text-gray-600 mt-2 italic">${ayah.english}</p>
            <p class="text-xs text-[#735c00] mt-1">${ayah.transliteration}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

export function renderGlobalAudioBar(data) {
  return "";
}

export function renderAdminDashboard(data) {
  return "<div>Admin Dashboard</div>";
}

export function renderAdminAuthScreen(data) {
  return "<div>Admin Auth</div>";
}