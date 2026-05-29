// === ColorForge — Kids Mode (Hidden) ===
// Complete kids mode built but hidden behind parental gate.
// Toggle visible via settings → enable kids mode toggle in future update.

window.KidsMode = {
  active: false,
  questionAnswer: 0,
  difficulty: 'multiplication',

  // Generate a math question for the parental gate
  generateQuestion() {
    const a = Math.floor(Math.random() * 9) + 2;
    const b = Math.floor(Math.random() * 9) + 2;
    this.questionAnswer = a * b;
    document.getElementById('gate-question').textContent = `What is ${a} × ${b}?`;
    document.getElementById('gate-answer').value = '';
  },

  validateAnswer() {
    const answer = parseInt(document.getElementById('gate-answer').value);
    return answer === this.questionAnswer;
  },

  activate() {
    this.active = true;
    localStorage.setItem('colorforge_kidsMode', 'true');

    // Transform the app for kids
    this.applyKidsTheme();
    this.hideAdultFeatures();
    this.loadPreGeneratedPacks();

    app.toast('Kids Mode active! 🧒 Safe coloring environment.');
  },

  deactivate() {
    this.active = false;
    localStorage.removeItem('colorforge_kidsMode');
    this.restoreAdultTheme();
    app.navigate('discover');
  },

  applyKidsTheme() {
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', '#FFF8F0');
    root.style.setProperty('--bg-secondary', '#FFE4CC');
    root.style.setProperty('--bg-card', '#FFD4A8');
    root.style.setProperty('--bg-input', '#FFFFFF');
    root.style.setProperty('--accent', '#FF6B35');
    root.style.setProperty('--accent-light', '#FF8C5A');
    root.style.setProperty('--text-primary', '#2D1B0E');
    root.style.setProperty('--text-secondary', '#6B4226');
    root.style.setProperty('--border', '#FFC488');
  },

  restoreAdultTheme() {
    const root = document.documentElement;
    root.style.cssText = '';
  },

  hideAdultFeatures() {
    // Hide community, pro, AI generation
    document.querySelector('[data-screen="community"]').style.display = 'none';
    document.querySelector('[data-screen="pro"]').style.display = 'none';

    // Simplify create screen — replace AI prompt with pre-generated pack selector
    const createScreen = document.getElementById('screen-create');
    if (createScreen) {
      createScreen.innerHTML = `
        <div class="create-container">
          <h2>🐾 Pick a Coloring Page!</h2>
          <div class="kids-pack-grid" id="kids-packs"></div>
        </div>
      `;
      this.loadPreGeneratedPacks();
    }

    // Simplify navigation — only Discover + Gallery
    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.dataset.screen !== 'discover' && tab.dataset.screen !== 'gallery') {
        tab.style.display = 'none';
      }
    });

    // Kids-safe palette (fewer, larger swatches)
    const paletteColors = [
      '#FF4444', '#FF8800', '#FFDD00', '#44CC44',
      '#4488FF', '#AA44FF', '#FF88CC', '#885522',
      '#FFFFFF', '#888888', '#444444', '#000000',
    ];
    // Palette already rendered in studio.js; kids mode just uses it

    // Disable AI text input
    const promptInput = document.getElementById('prompt-input');
    if (promptInput) promptInput.disabled = true;

    // Hide style chips (kids don't need them)
    const styleChips = document.getElementById('style-chips');
    if (styleChips) styleChips.style.display = 'none';
  },

  loadPreGeneratedPacks() {
    const packs = [
      { id: 'animals', name: '🐾 Animals', icon: '🐶', pages: 20 },
      { id: 'dinosaurs', name: '🦕 Dinosaurs', icon: '🦖', pages: 15 },
      { id: 'vehicles', name: '🚗 Vehicles', icon: '🚒', pages: 18 },
      { id: 'princess', name: '👸 Princess', icon: '👑', pages: 20 },
      { id: 'space', name: '🚀 Space', icon: '🌟', pages: 16 },
      { id: 'underwater', name: '🐠 Underwater', icon: '🐙', pages: 18 },
      { id: 'food', name: '🍕 Food Fun', icon: '🍦', pages: 14 },
      { id: 'monsters', name: '👾 Monsters', icon: '👹', pages: 20 },
    ];

    const container = document.getElementById('kids-packs');
    if (!container) return;

    container.innerHTML = packs.map(p => `
      <div class="style-card" onclick="KidsMode.openPack('${p.id}')">
        <div class="style-icon">${p.icon}</div>
        <div class="style-name">${p.name}</div>
        <div class="style-count">${p.pages} pages</div>
      </div>
    `).join('');
  },

  openPack(packId) {
    // In kids mode, open predefined coloring pages instead of generating
    app.toast(`Opening ${packId} pack... 🎨`);
    app.openStudio(null, packId);
  },

  // Kids-safe save (no export, no share)
  kidsSave() {
    const dataUrl = Studio.getImageData();
    Gallery.addPage(dataUrl, 'colored', 'Kids Mode');
    app.toast('Saved! Great job! ⭐');
  },
};
