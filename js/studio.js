// === ColorForge — Canvas Coloring Studio ===
window.Studio = {
  canvas: null,
  ctx: null,
  tool: 'fill',
  currentColor: '#ff6b6b',
  brushSize: 8,
  zoomLevel: 1,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  undoStack: [],
  redoStack: [],
  baseImage: null,
  colorLayer: null,
  
  // Custom spray-paint attributes
  sprayInterval: null,
  currentSprayX: 0,
  currentSprayY: 0,

  // Global Fill Option
  globalFillMode: false,

  init(imageDataUrl) {
    this.canvas = document.getElementById('studio-canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.undoStack = [];
    this.redoStack = [];
    this.zoomLevel = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.tool = 'fill';
    this.globalFillMode = false;
    this.stopSpraying();

    // Setup palette
    this.setupPalette();
    this.setupCanvasEvents();

    if (imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        this.initCanvas(img);
      };
      img.src = imageDataUrl;
    } else {
      // Create blank canvas with a simple pattern
      this.initBlankCanvas();
    }

    // Update UI
    this.updateToolButtonsUI();
  },

  updateToolButtonsUI() {
    document.querySelectorAll('#btn-fill, #btn-brush, #btn-eraser, #btn-spray').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${this.tool}`);
    if (btn) btn.classList.add('active');

    const globalBtn = document.getElementById('btn-global');
    if (globalBtn) {
      globalBtn.textContent = `Global: ${this.globalFillMode ? 'On' : 'Off'}`;
      globalBtn.classList.toggle('active', this.globalFillMode);
    }

    document.getElementById('btn-undo').disabled = this.undoStack.length <= 1;
    document.getElementById('btn-redo').disabled = this.redoStack.length === 0;
  },

  initCanvas(img) {
    const workspace = document.querySelector('.studio-workspace');
    const maxW = workspace.clientWidth - 40;
    const maxH = workspace.clientHeight - 40;
    let w = img.width, h = img.height;
    const ratio = Math.min(maxW / w, maxH / h);
    w = Math.floor(w * ratio);
    h = Math.floor(h * ratio);

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(img, 0, 0, w, h);

    // Store base image (line art) for erasing back to original
    this.baseImage = this.ctx.getImageData(0, 0, w, h);
    this.saveState();
  },

  initBlankCanvas() {
    const w = 600, h = 800;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, w, h);

    // Draw some test patterns
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      this.ctx.beginPath();
      this.ctx.arc(w/2, h/2, 50 + i * 55, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(w/2, h/2);
      this.ctx.lineTo(w/2 + Math.cos(angle) * 350, h/2 + Math.sin(angle) * 350);
      this.ctx.stroke();
    }

    this.baseImage = this.ctx.getImageData(0, 0, w, h);
    this.saveState();
  },

  // Palette
  setupPalette() {
    const colors = [
      '#ff6b6b', '#ff8787', '#ffa94d', '#ffd43b', '#69db7c',
      '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac',
      '#ffffff', '#ced4da', '#868e96', '#495057', '#212529',
      '#ffc9c9', '#ffd8a8', '#ffec99', '#b2f2bb', '#96f2d7',
      '#a5d8ff', '#bac8ff', '#eebefa', '#fcc2d7', '#e599f7',
      '#ff922b', '#f06595', '#20c997', '#339af0', '#845ef7',
    ];
    const container = document.getElementById('palette-colors');
    container.innerHTML = colors.map(c => `
      <div class="palette-swatch${c === this.currentColor ? ' selected' : ''}"
           style="background:${c}"
           onclick="Studio.selectColor('${c}', this)"></div>
    `).join('');

    document.getElementById('custom-color').addEventListener('input', (e) => {
      this.currentColor = e.target.value;
      document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
    });

    document.getElementById('brush-size').addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
    });
  },

  selectColor(color, el) {
    this.currentColor = color;
    document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
    if (el) el.classList.add('selected');
    document.getElementById('custom-color').value = color;
    this.triggerHaptic();
  },

  // Canvas Events
  setupCanvasEvents() {
    // Standard events
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.handlePointerUp());
    this.canvas.addEventListener('pointerleave', () => this.handlePointerUp());
    
    // Zoom and scroll wheel gestures for desktop comfort
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
      this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + zoomDelta));
      this.applyTransform();
    }, { passive: false });

    // Touch gestures for smooth pinch-to-zoom
    this.setupTouchGestures();
  },

  setupTouchGestures() {
    let initialDist = 0;
    let initialZoom = 1;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = this.zoomLevel;
        this.isPanning = false;
        this.stopSpraying();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialDist > 0) {
          const scale = dist / initialDist;
          // Apply smooth mathematical scale
          this.zoomLevel = Math.max(0.5, Math.min(3.0, initialZoom * scale));
          this.applyTransform();
        }
      }
    }, { passive: false });
  },

  handlePointerDown(e) {
    // Touch Palm Rejection: Reject touches that are very large (like a palm)
    if (e.pointerType === 'touch') {
      const w = e.width || 0;
      const h = e.height || 0;
      const rx = e.radiusX || 0;
      const ry = e.radiusY || 0;
      if (w > 40 || h > 40 || rx > 20 || ry > 20) {
        console.log('Palm touch rejected on pointerdown:', { w, h, rx, ry });
        return;
      }
    }

    if (this.tool === 'pan' || e.ctrlKey || e.metaKey) {
      this.isPanning = true;
      this.panStartX = e.clientX - this.offsetX;
      this.panStartY = e.clientY - this.offsetY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const pos = this.getCanvasPos(e);
    if (!pos) return;

    if (this.tool === 'fill') {
      this.floodFill(pos.x, pos.y, this.currentColor);
    } else if (this.tool === 'brush') {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    } else if (this.tool === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    } else if (this.tool === 'spray') {
      this.startSpraying(pos.x, pos.y);
    } else if (this.tool === 'eyedropper') {
      this.pickColorAt(pos.x, pos.y);
    }
  },

  handlePointerMove(e) {
    // Touch Palm Rejection: Ignore large touches during movement
    if (e.pointerType === 'touch') {
      const w = e.width || 0;
      const h = e.height || 0;
      const rx = e.radiusX || 0;
      const ry = e.radiusY || 0;
      if (w > 40 || h > 40 || rx > 20 || ry > 20) {
        console.log('Palm touch rejected on pointermove:', { w, h, rx, ry });
        return;
      }
    }

    if (this.isPanning) {
      this.offsetX = e.clientX - this.panStartX;
      this.offsetY = e.clientY - this.panStartY;
      this.applyTransform();
      return;
    }

    if (e.buttons !== 1) return; // Only primary button
    const pos = this.getCanvasPos(e);
    if (!pos) return;

    if (this.tool === 'brush') {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    } else if (this.tool === 'eraser') {
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = this.brushSize * 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    } else if (this.tool === 'spray') {
      this.currentSprayX = pos.x;
      this.currentSprayY = pos.y;
    }
  },

  handlePointerUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    if (this.tool === 'brush' || this.tool === 'eraser') {
      this.ctx.closePath();
      this.saveState();
    } else if (this.tool === 'spray') {
      this.stopSpraying();
    }
  },

  // ── Spray Paint Mechanics ─────────────
  startSpraying(x, y) {
    this.stopSpraying();
    this.currentSprayX = x;
    this.currentSprayY = y;
    this.sprayInterval = setInterval(() => {
      const radius = this.brushSize * 1.8;
      const density = 25; // dots per 20ms
      this.ctx.fillStyle = this.currentColor;
      
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        // quadratic polar distribution for realistic spray falloff
        const dist = Math.pow(Math.random(), 0.6) * radius;
        const sx = this.currentSprayX + Math.cos(angle) * dist;
        const sy = this.currentSprayY + Math.sin(angle) * dist;
        this.ctx.fillRect(Math.floor(sx), Math.floor(sy), 1.5, 1.5);
      }
    }, 20);
  },

  stopSpraying() {
    if (this.sprayInterval) {
      clearInterval(this.sprayInterval);
      this.sprayInterval = null;
      this.saveState();
    }
  },

  // ── Global & Flood Fill ───────────────
  floodFill(startX, startY, fillColor) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const getPixel = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return null;
      const i = (y * w + x) * 4;
      return [data[i], data[i+1], data[i+2], data[i+3]];
    };

    const targetColor = getPixel(startX, startY);
    if (!targetColor) return;

    // Parse fill color
    const fc = this.hexToRgb(fillColor);
    if (!fc) return;

    // Don't fill if same color (within tolerance)
    const colorMatch = (a, b) =>
      Math.abs(a[0] - b[0]) < 30 && Math.abs(a[1] - b[1]) < 30 && Math.abs(a[2] - b[2]) < 30;

    if (colorMatch(targetColor, [fc.r, fc.g, fc.b])) return;

    // A. Global Fill Mode: Change ALL pixels matching targetColor
    if (this.globalFillMode) {
      for (let i = 0; i < data.length; i += 4) {
        const pixel = [data[i], data[i+1], data[i+2], data[i+3]];
        if (colorMatch(pixel, targetColor)) {
          data[i] = fc.r;
          data[i+1] = fc.g;
          data[i+2] = fc.b;
        }
      }
      this.ctx.putImageData(imageData, 0, 0);
      this.saveState();
      return;
    }

    // B. Standard Scanline Flood Fill for Local Regions
    const stack = [[startX, startY]];
    const visited = new Uint8Array(w * h);
    const maxStack = 100000;

    while (stack.length > 0 && stack.length < maxStack) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (visited[y * w + x]) continue;

      const pixel = getPixel(x, y);
      if (!pixel) continue;
      if (!colorMatch(pixel, targetColor)) continue;

      visited[y * w + x] = 1;
      const idx = (y * w + x) * 4;
      data[idx] = fc.r;
      data[idx+1] = fc.g;
      data[idx+2] = fc.b;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.saveState();
  },

  toggleGlobalFill() {
    this.globalFillMode = !this.globalFillMode;
    this.updateToolButtonsUI();
    this.triggerHaptic();
    this.toast(`Global Fill ${this.globalFillMode ? 'Enabled' : 'Disabled'}`);
  },

  // Undo/Redo
  saveState() {
    this.undoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    this.redoStack = [];
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.updateToolButtonsUI();
  },

  undo() {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    const state = this.undoStack[this.undoStack.length - 1];
    this.ctx.putImageData(state, 0, 0);
    this.updateToolButtonsUI();
    this.triggerHaptic();
  },

  redo() {
    if (this.redoStack.length === 0) return;
    const state = this.redoStack.pop();
    this.undoStack.push(state);
    this.ctx.putImageData(state, 0, 0);
    this.updateToolButtonsUI();
    this.triggerHaptic();
  },

  // Tools
  setTool(tool) {
    this.tool = tool;
    this.updateToolButtonsUI();
    this.triggerHaptic();
    if (this.tool !== 'spray') this.stopSpraying();
    if (this.tool === 'eyedropper') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  },

  pickColor() {
    this.setTool('eyedropper');
  },

  pickColorAt(x, y) {
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    this.currentColor = hex;
    this.selectColor(hex, null);
    document.getElementById('custom-color').value = hex;
    this.setTool('fill');
    this.toast(`Color picked: ${hex}`);
  },

  // Zoom
  zoomIn() {
    this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
    this.applyTransform();
    this.triggerHaptic();
  },
  zoomOut() {
    this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
    this.applyTransform();
    this.triggerHaptic();
  },
  zoomFit() {
    this.zoomLevel = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.applyTransform();
    this.triggerHaptic();
  },
  applyTransform() {
    this.canvas.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomLevel})`;
  },

  // Mobile Taptic haptics
  triggerHaptic() {
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (err) {}
    }
  },

  // Export
  exportPNG() {
    const link = document.createElement('a');
    link.download = `colorforge-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
    this.toast('Exported as PNG!');
  },

  getImageData() {
    return this.canvas.toDataURL('image/png');
  },

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top) * scaleY)
    };
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
};

// Global lowercase studio binding for HTML compatibility
window.studio = window.Studio;
