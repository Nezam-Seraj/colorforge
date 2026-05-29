// === ColorForge — Gallery Manager ===
window.Gallery = {
  pages: [],

  init() {
    this.pages = JSON.parse(localStorage.getItem('colorforge_gallery') || '[]');
  },

  addPage(dataUrl, status, type) {
    this.pages.unshift({
      id: Date.now(),
      dataUrl,
      status,
      type,
      createdAt: new Date().toISOString(),
    });
    this.save();
    this.render();
  },

  removePage(id) {
    this.pages = this.pages.filter(p => p.id !== id);
    this.save();
    this.render();
  },

  getPages(filter = 'all') {
    if (filter === 'all') return this.pages;
    if (filter === 'colored') return this.pages.filter(p => p.status === 'colored');
    if (filter === 'uncolored') return this.pages.filter(p => p.status === 'uncolored');
    if (filter === 'generated') return this.pages.filter(p => p.type === 'Generated');
    return this.pages;
  },

  save() {
    try {
      // Limit storage — keep last 100
      if (this.pages.length > 100) this.pages = this.pages.slice(0, 100);
      localStorage.setItem('colorforge_gallery', JSON.stringify(this.pages));
    } catch(e) {
      // Storage full — remove oldest
      this.pages = this.pages.slice(0, 50);
      localStorage.setItem('colorforge_gallery', JSON.stringify(this.pages));
    }
  },

  render(filter = 'all') {
    this.init();
    const pages = this.getPages(filter);
    const grid = document.getElementById('gallery-grid');
    const count = document.getElementById('gallery-count');

    count.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;

    if (pages.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎨</span>
          <h3>No pages yet</h3>
          <p>Create your first coloring page or color the daily challenge!</p>
          <button class="btn-primary" onclick="app.navigate('create')">Create One Now</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = pages.map(p => `
      <div class="gallery-item" onclick="Gallery.openPage('${p.id}')" title="${p.type} · ${new Date(p.createdAt).toLocaleDateString()}">
        <img src="${p.dataUrl}" alt="Coloring page" loading="lazy">
        ${p.status === 'generated' ? '<span class="item-badge">AI</span>' : ''}
      </div>
    `).join('');

    // Setup filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render(btn.dataset.filter);
      });
    });
  },

  openPage(id) {
    const page = this.pages.find(p => p.id === parseInt(id));
    if (!page) return;

    if (page.status === 'uncolored' || page.status === 'generated') {
      app.openStudio(page.dataUrl, 'From Gallery');
    } else {
      // View colored page — could add a viewer, for now re-open in studio
      app.openStudio(page.dataUrl, 'From Gallery');
    }
  },
};

Gallery.init();
