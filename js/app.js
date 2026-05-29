// === ColorForge — Main App Controller ===
window.app = {
  currentScreen: 'discover',
  generationCount: 0,
  maxFreeGenerations: 3,
  isPro: false,
  currentMood: null,

  init() {
    ErrorBoundary.init();
    this.setupNavigation();
    this.setupMoodPicker();
    this.setupPromptInput();
    this.setupStyleChips();
    this.generateDailyChallenge();
    this.loadTrendingStyles();
    this.loadStylePacks();
    this.updateGenerationCounter();
    this.loadGallery();
    this.setupKidsToggle();
    this.loadSettings();
    if (this.getFromStorage('isPro')) this.upgradeToPro();
    if (localStorage.getItem('colorforge_kidsMode') === 'true') {
      KidsMode.activate(true);
    }
    this.registerServiceWorker();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then(reg => {
            console.log('Service Worker registered successfully:', reg.scope);
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      console.log('New update installed. Reloading...');
                      if (typeof this.toast === 'function') {
                        this.toast('✨ App updated! Reloading to apply changes...');
                      }
                      setTimeout(() => {
                        window.location.reload();
                      }, 1200);
                    }
                  }
                };
              }
            };
          })
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }
  },

  // Navigation
  setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this.navigate(tab.dataset.screen));
    });

    // Horizontal mouse wheel scrolling for navbar tabs (especially useful on desktop)
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs) {
      navTabs.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          navTabs.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
  },

  navigate(screen) {
    this.currentScreen = screen;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`[data-screen="${screen}"]`);
    if (tab) tab.classList.add('active');
    
    // Smooth sliding screen transitions
    const screenIndices = { discover: 0, create: 1, gallery: 2, community: 3, pro: 4, settings: 5 };
    const idx = screenIndices[screen];
    if (idx !== undefined) {
      document.getElementById('screens').style.setProperty('--slide-translate', `-${idx * 100}%`);
    }

    if (screen === 'gallery') this.loadGallery();
    if (screen === 'discover') this.generateDailyChallenge();
    
    // Onboarding trigger
    if (screen === 'create') {
      this.triggerOnboardingFlow();
    }

    // Taptic feedback
    if (window.Studio && window.Studio.triggerHaptic) {
      window.Studio.triggerHaptic();
    }
  },

  // Mood Picker
  setupMoodPicker() {
    document.querySelectorAll('.mood-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this.currentMood = chip.dataset.mood;
        this.navigate('create');
        // Pre-fill based on mood
        const prompts = {
          stressed: 'a peaceful zen garden with soft flowing lines',
          anxious: 'gentle ocean waves with mandala patterns',
          bored: 'an epic dragon soaring through crystal mountains',
          creative: 'a surreal dreamscape with floating islands',
          meditative: 'an intricate sacred geometry mandala'
        };
        document.getElementById('prompt-input').value = prompts[this.currentMood] || '';
        document.getElementById('char-count').textContent = (prompts[this.currentMood] || '').length;
      });
    });
  },

  // Prompt Input
  setupPromptInput() {
    const input = document.getElementById('prompt-input');
    const counter = document.getElementById('char-count');
    input.addEventListener('input', () => counter.textContent = input.value.length);
  },

  // Style Chips
  setupStyleChips() {
    const container = document.getElementById('style-chips');
    const styleIcons = {
      mandala: 'circle', botanical: 'leaf', geometric: 'shapes', fantasy: 'sword',
      zen: 'flower-2', animals: 'paw-print', architecture: 'building-2', abstract: 'orbit',
      food: 'utensils', space: 'rocket'
    };
    const styles = [
      { id: 'mandala', icon: 'circle', label: 'Mandala' },
      { id: 'botanical', icon: 'leaf', label: 'Botanical' },
      { id: 'geometric', icon: 'shapes', label: 'Geometric' },
      { id: 'fantasy', icon: 'sword', label: 'Fantasy' },
      { id: 'zen', icon: 'flower-2', label: 'Zen' },
      { id: 'animals', icon: 'paw-print', label: 'Animals' },
      { id: 'architecture', icon: 'building-2', label: 'Architecture' },
      { id: 'abstract', icon: 'orbit', label: 'Abstract' },
      { id: 'food', icon: 'utensils', label: 'Food' },
      { id: 'space', icon: 'rocket', label: 'Space' },
    ];
    container.innerHTML = ''; // reset first
    styles.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'style-chip';
      chip.innerHTML = `<i data-lucide="${s.icon}"></i> ${s.label}`;
      chip.dataset.style = s.id;
      chip.addEventListener('click', () => {
        document.querySelectorAll('#style-chips .style-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        if (window.Studio && window.Studio.triggerHaptic) {
          window.Studio.triggerHaptic();
        }
      });
      container.appendChild(chip);
    });
    // Refresh Lucide for these new icons
    lucide.createIcons();
    // Default select first
    container.querySelector('.style-chip')?.classList.add('selected');
  },

  getSelectedStyle() {
    const sel = document.querySelector('#style-chips .style-chip.selected');
    return sel ? sel.dataset.style : 'mandala';
  },

  getComplexity() {
    const val = document.getElementById('complexity').value;
    return { '1': 'simple', '2': 'medium', '3': 'intricate' }[val];
  },

  // Settings screen Replicate binder
  saveSettings() {
    const replicateVal = document.getElementById('replicate-api-input').value.trim();
    this.saveToStorage('replicate_token', replicateVal);
    AIPipeline.replicateToken = replicateVal || null;

    const geminiVal = document.getElementById('gemini-api-input').value.trim();
    this.saveToStorage('gemini_token', geminiVal);
    AIPipeline.geminiToken = geminiVal || null;

    if (window.Studio && window.Studio.triggerHaptic) {
      window.Studio.triggerHaptic();
    }
    this.toast('Settings saved!');
    this.checkGeminiStatus();
  },

  loadSettings() {
    const replicateToken = this.getFromStorage('replicate_token');
    const replicateInput = document.getElementById('replicate-api-input');
    if (replicateInput && replicateToken) {
      replicateInput.value = replicateToken;
      AIPipeline.replicateToken = replicateToken;
    }

    const geminiToken = this.getFromStorage('gemini_token');
    const geminiInput = document.getElementById('gemini-api-input');
    if (geminiInput && geminiToken) {
      geminiInput.value = geminiToken;
      AIPipeline.geminiToken = geminiToken;
    }
    // Check Gemini server status
    this.checkGeminiStatus();
  },

  async checkGeminiStatus() {
    const el = document.getElementById('gemini-status');
    if (!el) return;
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test', style: 'mandala', complexity: 'simple' }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json().catch(() => ({ error: 'Could not parse response' }));
      if (resp.ok && data.image) {
        el.innerHTML = '<span style="color:var(--success)">\u2713 Connected</span> — Gemini 2.0 Flash ready';
        el.style.borderColor = 'var(--success)';
      } else if (resp.status === 503) {
        el.innerHTML = '<span style="color:var(--danger)">\u2717 Not configured</span> — add GEMINI_API_KEY to Railway';
        el.style.borderColor = 'var(--danger)';
      } else {
        el.innerHTML = `<span style="color:var(--accent-warm)">\u26A0 Connection Error:</span> <span style="font-size:0.75rem">${data.error || 'Unknown error'}</span>`;
        el.style.borderColor = 'var(--accent-warm)';
      }
    } catch(e) {
      el.innerHTML = `<span style="color:var(--text-muted)">\u2014 Status Check Failed:</span> <span style="font-size:0.75rem">${e.message}</span>`;
    }
  },

  // AI Generation
  async generatePage() {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
      this.toast('Please describe what you want to color');
      return;
    }
    if (!this.isPro && this.generationCount >= this.maxFreeGenerations) {
      this.navigate('pro');
      this.toast("You've used all your free generations today. Go Pro for unlimited!");
      return;
    }

    const btn = document.getElementById('btn-generate');
    const status = document.getElementById('gen-status');
    const statusText = document.getElementById('gen-status-text');
    const result = document.getElementById('gen-result');

    // Dismiss existing recovery panel if any
    const recovery = document.getElementById('generation-recovery');
    if (recovery) recovery.style.display = 'none';

    btn.disabled = true;
    btn.style.display = 'none';
    status.style.display = 'block';
    result.style.display = 'none';

    // Animated loading messages
    const loadingMessages = [
      'Sketching your idea...',
      'Adding intricate details...',
      'Perfecting the outlines...',
      'Almost ready...',
    ];
    let msgIdx = 0;
    statusText.textContent = loadingMessages[0];
    const loadingInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      statusText.textContent = loadingMessages[msgIdx];
    }, 1800);

    try {
      const style = this.getSelectedStyle();
      const complexity = this.getComplexity();
      const imageData = await AIPipeline.generate(prompt, style, complexity);
      clearInterval(loadingInterval);

      const canvas = document.getElementById('gen-preview');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        status.style.display = 'none';
        result.style.display = 'block';
        btn.style.display = 'flex';
        btn.disabled = false;
        this.generationCount++;
        this.updateGenerationCounter();
        statusText.textContent = loadingMessages[0]; // Reset
      };
      img.onerror = () => {
        clearInterval(loadingInterval);
        throw new Error('Failed to load generated image');
      };
      img.src = imageData;
    } catch (err) {
      clearInterval(loadingInterval);
      console.error('Generation failed:', err);
      status.style.display = 'none';
      btn.style.display = 'flex';
      btn.disabled = false;
      statusText.textContent = loadingMessages[0];

      // Build premium interactive recovery flow rather than just a toast
      this.triggerErrorRecoveryUI();
    }
  },

  triggerErrorRecoveryUI() {
    const form = document.querySelector('.create-form');
    let recovery = document.getElementById('generation-recovery');
    if (!recovery) {
      recovery = document.createElement('div');
      recovery.id = 'generation-recovery';
      recovery.className = 'recovery-container';
      form.appendChild(recovery);
    }
    
    recovery.style.display = 'block';
    recovery.innerHTML = `
      <h3>Generation Issue</h3>
      <p>The AI generator failed or timed out. Try one of these recovery methods:</p>
      <div class="recovery-actions-grid">
        <button class="recovery-btn recovery-btn-retry-simple" onclick="app.retryWithSimple()">
          Retry with Simple Complexity (Highly Reliable)
        </button>
        <button class="recovery-btn recovery-btn-retry-zen" onclick="app.retryWithZen()">
          Switch to Zen Style (Simplifies Details)
        </button>
        <button class="recovery-btn recovery-btn-procedural" onclick="app.retryProcedural()">
          Instant Procedural Fallback (Works Offline!)
        </button>
      </div>
    `;
    this.toast('Generation failed. Try an option below!');
  },

  retryWithSimple() {
    document.getElementById('complexity').value = '1'; // set simple
    const recovery = document.getElementById('generation-recovery');
    if (recovery) recovery.style.display = 'none';
    this.toast('Retrying with Simple complexity...');
    this.generatePage();
  },

  retryWithZen() {
    document.querySelectorAll('#style-chips .style-chip').forEach(c => {
      if (c.dataset.style === 'zen') c.classList.add('selected');
      else c.classList.remove('selected');
    });
    const recovery = document.getElementById('generation-recovery');
    if (recovery) recovery.style.display = 'none';
    this.toast('Retrying with Zen style...');
    this.generatePage();
  },

  async retryProcedural() {
    const recovery = document.getElementById('generation-recovery');
    if (recovery) recovery.style.display = 'none';
    this.toast('Invoking instant offline generator...');
    
    // Temporarily bypass replicate Token to force procedural pipeline
    const originalToken = AIPipeline.replicateToken;
    AIPipeline.replicateToken = null;
    
    await this.generatePage();
    
    // Restore replicate token
    AIPipeline.replicateToken = originalToken;
  },

  regenerate() {
    document.getElementById('gen-result').style.display = 'none';
    this.generatePage();
  },

  colorGenerated() {
    const canvas = document.getElementById('gen-preview');
    const dataUrl = canvas.toDataURL();
    this.openStudio(dataUrl, 'Generated Page');
  },

  saveToGallery() {
    const canvas = document.getElementById('gen-preview');
    const dataUrl = canvas.toDataURL();
    Gallery.addPage(dataUrl, 'uncolored', 'Generated');
    document.getElementById('gen-result').style.display = 'none';
    document.getElementById('btn-generate').style.display = 'flex';
    this.toast('Saved to gallery!');
  },

  // Daily Challenge
  generateDailyChallenge() {
    const today = new Date().toDateString();
    const challenges = [
      { title: 'Enchanted Forest', desc: 'A mystical woodland scene with hidden creatures', seed: today + 'forest' },
      { title: 'Cosmic Mandala', desc: 'Stars and planets arranged in harmony', seed: today + 'cosmic' },
      { title: 'Ocean Depths', desc: 'Underwater world with coral and sea life', seed: today + 'ocean' },
      { title: 'Steampunk Workshop', desc: 'Gears, pipes, and Victorian machinery', seed: today + 'steampunk' },
      { title: 'Japanese Garden', desc: 'Koi ponds, bridges, and cherry blossoms', seed: today + 'garden' },
      { title: 'Dragon\'s Lair', desc: 'A sleeping dragon surrounded by treasure', seed: today + 'dragon' },
      { title: 'City Skyline', desc: 'A futuristic cityscape at twilight', seed: today + 'city' },
    ];
    const idx = Math.abs(today.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % challenges.length;
    const challenge = challenges[idx];
    document.getElementById('challenge-title').textContent = challenge.title;
    document.getElementById('challenge-desc').textContent = challenge.desc;

    // Draw a placeholder on challenge canvas
    const canvas = document.getElementById('challenge-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e0d5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    // Simple pattern
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(canvas.width/2, canvas.height/2, 20 + i * 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#3d6a99';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(challenge.title, canvas.width/2, canvas.height/2);
  },

  startDailyChallenge() {
    if (!this.isPro && this.generationCount >= this.maxFreeGenerations) {
      this.navigate('pro');
      return;
    }
    this.generationCount++;
    this.updateGenerationCounter();
    this.openStudio(null, document.getElementById('challenge-title').textContent);
  },

  // Color Studio
  openStudio(imageDataUrl, title) {
    document.getElementById('studio-title').textContent = title || 'Coloring...';
    document.getElementById('screen-studio').classList.add('active');
    document.getElementById('screens').style.overflow = 'hidden';
    Studio.init(imageDataUrl);
  },

  closeStudio() {
    document.getElementById('screen-studio').classList.remove('active');
    document.getElementById('screens').style.overflow = 'auto';
  },

  saveColored() {
    const dataUrl = Studio.getImageData();
    Gallery.addPage(dataUrl, 'colored', 'Hand-colored');
    this.toast('Saved to gallery!');
  },

  // Kids Mode
  setupKidsToggle() {
    const toggle = document.getElementById('kids-toggle');
    if (toggle) toggle.style.display = 'inline-flex';
  },

  toggleKidsGate() {
    document.getElementById('screen-kids-gate').classList.add('active');
    KidsMode.generateQuestion();
  },

  closeKidsGate() {
    document.getElementById('screen-kids-gate').classList.remove('active');
  },

  unlockKidsMode() {
    if (KidsMode.validateAnswer()) {
      document.getElementById('screen-kids-gate').classList.remove('active');
      if (KidsMode.active) {
        KidsMode.deactivate();
        this.toast('Kids Mode deactivated!');
      } else {
        KidsMode.activate();
        this.toast('Kids Mode activated!');
      }
    } else {
      this.toast('Wrong answer. Try again.');
    }
  },

  // Pro & Payments
  purchase(plan) {
    if (Payments.isPlayStore()) {
      Payments.launchGooglePlayBilling(plan);
    } else {
      this.toast('Google Play Store coming soon!');
      this.upgradeToPro();
    }
  },

  upgradeToPro() {
    this.isPro = true;
    this.maxFreeGenerations = 999;
    this.saveToStorage('isPro', true);
    document.getElementById('pro-status').textContent = 'Pro';
    document.getElementById('pro-status').classList.add('pro');
    this.updateGenerationCounter();
    this.toast('You\'re now a Pro member!');
  },

  updateGenerationCounter() {
    document.getElementById('gen-count').textContent =
      `${this.generationCount}/${this.isPro ? '∞' : this.maxFreeGenerations}`;
  },

  // Gallery Loader with shimmering skeletons
  loadGallery() {
    const grid = document.getElementById('gallery-grid');
    if (grid) {
      grid.innerHTML = Array(6).fill().map(() => `
        <div class="gallery-item skeleton" style="aspect-ratio: 3/4;"></div>
      `).join('');
    }
    setTimeout(() => {
      Gallery.render();
    }, 450);
  },

  // Trending Styles Loader with shimmering skeletons
  loadTrendingStyles() {
    const container = document.getElementById('trending-styles');
    if (container) {
      container.innerHTML = Array(6).fill().map(() => `
        <div class="style-card skeleton" style="height: 110px;"></div>
      `).join('');
    }
    setTimeout(() => {
      const styles = [
        { icon: 'circle', name: 'Mandala', count: '2.4k colored' },
        { icon: 'sword', name: 'Fantasy', count: '1.8k colored' },
        { icon: 'leaf', name: 'Botanical', count: '1.5k colored' },
        { icon: 'orbit', name: 'Abstract', count: '1.2k colored' },
        { icon: 'shapes', name: 'Geometric', count: '980 colored' },
        { icon: 'flower-2', name: 'Zen Garden', count: '820 colored' },
      ];
      container.innerHTML = styles.map(s => `
        <div class="style-card" onclick="document.getElementById('prompt-input').value='${s.name.toLowerCase()} coloring page'; app.navigate('create')">
          <div class="style-icon"><i data-lucide="${s.icon}"></i></div>
          <div class="style-label">${s.name}</div>
          <div class="style-count">${s.count}</div>
        </div>
      `).join('');
      lucide.createIcons();
    }, 400);
  },

  // Onboarding flow
  triggerOnboardingFlow() {
    if (this.getFromStorage('onboarding_completed')) return;
    if (document.querySelector('.onboarding-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);

    let currentStep = 1;

    const tooltips = [
      {
        targetId: 'style-chips',
        title: '1. Pick a Style',
        text: 'Choose a beautiful starting style pack, like Mandala or Botanical, to shape your line art!',
        arrowClass: 'arrow-top',
        positionOffset(rect) {
          return {
            top: rect.bottom + 12 + window.scrollY,
            left: rect.left + 20
          };
        }
      },
      {
        targetId: 'prompt-input',
        title: '2. Describe Your Idea',
        text: 'Type whatever you can imagine! E.g. "a cute little fox in the forest" or "a massive castle".',
        arrowClass: 'arrow-top',
        positionOffset(rect) {
          return {
            top: rect.bottom + 12 + window.scrollY,
            left: rect.left + 20
          };
        }
      },
      {
        targetId: 'btn-generate',
        title: '3. Generate & Color!',
        text: 'Tap here to let AI generate clean outlines, then start coloring instantly!',
        arrowClass: 'arrow-bottom',
        positionOffset(rect, tooltipHeight) {
          return {
            top: rect.top - tooltipHeight - 12 + window.scrollY,
            left: rect.left + 20
          };
        }
      }
    ];

    const renderTooltip = () => {
      const existing = document.querySelector('.onboarding-tooltip');
      if (existing) existing.remove();

      const config = tooltips[currentStep - 1];
      const target = document.getElementById(config.targetId);
      if (!target) {
        dismiss();
        return;
      }

      // Scroll target into view
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });

      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        
        tooltip.innerHTML = `
          <h4>${config.title}</h4>
          <p>${config.text}</p>
          <div class="tooltip-arrow ${config.arrowClass}"></div>
          <div class="onboarding-actions">
            <button class="onboarding-btn-skip">Skip</button>
            <button class="onboarding-btn-next">${currentStep === 3 ? 'Got it!' : 'Next'}</button>
          </div>
        `;
        
        document.body.appendChild(tooltip);

        const tooltipHeight = tooltip.offsetHeight;
        const coords = config.positionOffset(rect, tooltipHeight);
        
        let leftPos = Math.max(16, Math.min(window.innerWidth - 276, coords.left));
        tooltip.style.top = `${coords.top}px`;
        tooltip.style.left = `${leftPos}px`;

        tooltip.querySelector('.onboarding-btn-skip').onclick = () => {
          dismiss();
        };
        tooltip.querySelector('.onboarding-btn-next').onclick = () => {
          if (currentStep === 3) {
            dismiss();
          } else {
            currentStep++;
            renderTooltip();
          }
        };

        if (window.Studio && window.Studio.triggerHaptic) {
          window.Studio.triggerHaptic();
        }
      }, 300);
    };

    const dismiss = () => {
      overlay.remove();
      const existing = document.querySelector('.onboarding-tooltip');
      if (existing) existing.remove();
      this.saveToStorage('onboarding_completed', true);
      if (window.Studio && window.Studio.triggerHaptic) {
        window.Studio.triggerHaptic();
      }
    };

    renderTooltip();
  },

  // Style Packs
  loadStylePacks() {
    const packs = [
      { name: 'Mandala Mastery', pages: 50, price: '$3.99', icon: 'circle' },
      { name: 'Fantasy Realms', pages: 40, price: '$3.99', icon: 'sword' },
      { name: 'Zen & Meditation', pages: 35, price: '$2.99', icon: 'flower-2' },
      { name: 'Floral Collection', pages: 45, price: '$3.99', icon: 'leaf' },
    ];
    const container = document.getElementById('style-packs');
    container.innerHTML = packs.map(p => `
      <div class="style-card" onclick="app.purchase('pack_${p.name.toLowerCase().replace(/ /g,'_')}')">
        <div class="style-icon"><i data-lucide="${p.icon}"></i></div>
        <div class="style-name">${p.name}</div>
        <div class="style-count">${p.pages} pages · ${p.price}</div>
      </div>
    `).join('');
    lucide.createIcons();
  },

  // Utilities
  toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  saveToStorage(key, value) {
    try { localStorage.setItem(`colorforge_${key}`, JSON.stringify(value)); } catch(e) {}
  },

  getFromStorage(key) {
    try { return JSON.parse(localStorage.getItem(`colorforge_${key}`)); } catch(e) { return null; }
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());
