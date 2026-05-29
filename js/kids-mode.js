// === ColorForge — Kids Mode (Hidden) ===
// Complete kids mode built but hidden behind parental gate.

window.KidsMode = {
  active: false,
  questionAnswer: 0,
  difficulty: 'multiplication',

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

  activate(suppressToast = false) {
    this.active = true;
    localStorage.setItem('colorforge_kidsMode', 'true');
    this.applyKidsTheme();
    this.hideAdultFeatures();
    this.loadPreGeneratedPacks();
    
    const toggle = document.getElementById('kids-toggle');
    if (toggle) {
      toggle.innerHTML = '<i data-lucide="log-out"></i> Exit Kids Mode';
      lucide.createIcons();
    }
    
    if (!suppressToast) {
      app.toast('Kids Mode active! Safe coloring environment.');
    }
  },

  deactivate() {
    this.active = false;
    localStorage.removeItem('colorforge_kidsMode');
    window.location.reload();
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
    document.querySelector('[data-screen="community"]').style.display = 'none';
    document.querySelector('[data-screen="pro"]').style.display = 'none';

    const createScreen = document.getElementById('screen-create');
    if (createScreen) {
      createScreen.innerHTML = `
        <div class="create-container">
          <h2>Pick a Coloring Page!</h2>
          <div class="kids-pack-grid" id="kids-packs"></div>
        </div>
      `;
      this.loadPreGeneratedPacks();
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
      if (tab.dataset.screen !== 'discover' && tab.dataset.screen !== 'gallery') {
        tab.style.display = 'none';
      }
    });

    const promptInput = document.getElementById('prompt-input');
    if (promptInput) promptInput.disabled = true;

    const styleChips = document.getElementById('style-chips');
    if (styleChips) styleChips.style.display = 'none';
  },

  loadPreGeneratedPacks() {
    const packs = [
      { id: 'animals', icon: 'paw-print', name: 'Animals', pages: 20 },
      { id: 'dinosaurs', icon: 'skull', name: 'Dinosaurs', pages: 15 },
      { id: 'vehicles', icon: 'car', name: 'Vehicles', pages: 18 },
      { id: 'princess', icon: 'crown', name: 'Princess', pages: 20 },
      { id: 'space', icon: 'rocket', name: 'Space', pages: 16 },
      { id: 'underwater', icon: 'fish', name: 'Underwater', pages: 18 },
      { id: 'food', icon: 'utensils', name: 'Food Fun', pages: 14 },
      { id: 'monsters', icon: 'ghost', name: 'Monsters', pages: 20 },
    ];

    const container = document.getElementById('kids-packs');
    if (!container) return;

    container.innerHTML = packs.map(p => `
      <div class="style-card" onclick="KidsMode.openPack('${p.id}')">
        <div class="style-icon"><i data-lucide="${p.icon}"></i></div>
        <div class="style-name">${p.name}</div>
        <div class="style-count">${p.pages} pages</div>
      </div>
    `).join('');
    lucide.createIcons();
  },

  openPack(packId) {
    app.toast(`Opening ${packId} pack...`);
    app.openStudio(null, packId);
  },

  kidsSave() {
    const dataUrl = Studio.getImageData();
    Gallery.addPage(dataUrl, 'colored', 'Kids Mode');
    app.toast('Saved! Great job!');
  },
};
