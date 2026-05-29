# 🎨 ColorForge

**Describe it. AI draws it. You color it.**

ColorForge is an AI-powered adult coloring page generator that runs entirely in your browser. Type a prompt — "a mandala with ocean waves" — and get a beautiful black-and-white line art page ready to color. Works offline, installable as a PWA.

<p align="center">
  <img src="assets/icon-512.png" width="128" alt="ColorForge icon">
</p>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **AI Generation** | Connect your Replicate API key for SDXL-powered coloring pages, or use the built-in procedural engine |
| 🎭 **10 Art Styles** | Mandala, Botanical, Geometric, Fantasy, Zen Garden, Animals, Architecture, Abstract, Space, Food |
| 🎚️ **Complexity Control** | Simple, Medium, or Intricate — from loose shapes to fine-detailed patterns |
| 🎨 **Full Color Studio** | Flood fill, brush tool, eraser, undo/redo, zoom, and export |
| 📱 **PWA** | Install on any device, works offline |
| 🔒 **COPPA-Safe Kids Mode** | Hidden behind a parental math gate — no tracking, no ads |
| 💾 **Gallery** | Save your colored pages locally, filter by style |
| 🌙 **Dark Theme** | Designed for comfortable late-night coloring |

---

## 🚀 Quick Start

No build step. Serve the folder:

```bash
# Python
python3 -m http.server 8080 -d colorforge

# Node
npx serve colorforge

# Or just open index.html
```

Then open `http://localhost:8080` on your phone or desktop.

---

## 🎨 Style Previews

| Mandala | Botanical | Fantasy |
|---|---|---|
| Intricate sacred geometry petals | Leafy stems with blooming flowers | Castle silhouette with dragon |

| Animals | Space | Architecture |
|---|---|---|
| Cat, owl, or butterfly line art | Planets with rings and craters | Cityscape with arched windows |

*10 styles total — each with unique procedural generation.*

---

## 🧩 Architecture

```
colorforge/
├── index.html            # Main PWA shell
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker (offline support)
├── style.css             # Dark theme, 500+ lines
├── privacy.html          # COPPA-compliant privacy policy
├── assets/
│   ├── icon.svg          # Source SVG
│   ├── icon-192.png      # PWA icon
│   └── icon-512.png      # PWA icon
└── js/
    ├── app.js            # App controller, navigation, generation flow
    ├── ai-pipeline.js    # Replicate API + procedural generation engine
    ├── studio.js         # Canvas-based coloring studio
    ├── gallery.js        # Local gallery with localStorage
    ├── kids-mode.js      # Parental gate + safe kids mode
    ├── payments.js       # Google Play Billing bridge
    ├── error-boundary.js # Global crash recovery UI
    └── discover.js       # Trending styles + daily challenges
```

---

## 🔗 AI Backend

### Replicate API (recommended)
Set your token to unlock SDXL-powered generation:

```js
AIPipeline.setToken('your-replicate-token');
```

### Procedural Fallback
No API key? The built-in engine generates deterministic, seed-based line art across all 10 styles. Every prompt + style + complexity combination produces a unique, reproducible design.

---

## 🛣️ Roadmap

- [ ] Replicate API key input in settings UI
- [ ] Community gallery (shared pages)
- [ ] More animal variants (elephant, fox, fish)
- [ ] Export as printable PDF
- [ ] Google Play / App Store TWA deployment

---

## 📄 License

MIT — color freely.

---

<p align="center">
  <b>Built with ❤️ by <a href="https://github.com/Nezam-Seraj">Nezam Seraj</a></b>
</p>
