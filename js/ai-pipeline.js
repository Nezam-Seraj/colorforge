// === ColorForge — AI Generation Pipeline ===
// Primary: Gemini 2.0 Flash (native image gen, free tier)
// Secondary: Replicate SDXL (higher quality)
// Fallback: procedural generation

window.AIPipeline = {
  replicateToken: null,
  geminiToken: null,
  generationTimeout: 60000,

  async generate(prompt, style, complexity) {
    // 1. Try server-side Gemini proxy (secure — key never in browser)
    try { return await this.generateViaGemini(prompt, style, complexity); }
    catch (e) { console.warn('Gemini proxy failed, trying next:', e.message); }
    // 2. Try Replicate (if token configured)
    if (this.replicateToken) {
      try { return await this.generateViaReplicate(prompt, style, complexity); }
      catch (e) { console.warn('Replicate failed, using fallback:', e.message); }
    }
    // Notify user of fallback
    if (window.app && typeof window.app.toast === 'function') {
      window.app.toast('⚠️ AI Offline (no API key). Using offline procedural drawing.');
    }
    // 3. Procedural fallback
    return await this.generateProcedural(prompt, style, complexity);
  },

  async generateViaGemini(prompt, style, complexity) {
    // Client-side direct bypass (runs 100% in browser, avoids server-side proxy completely)
    if (this.geminiToken) {
      const stylePrompts = {
        mandala: 'symmetrical mandala pattern, geometric precision, sacred geometry',
        botanical: 'detailed botanical illustration, leaves and flowers, natural forms',
        geometric: 'geometric abstract pattern, clean lines, mathematical precision',
        fantasy: 'fantasy illustration, mythical creatures, magical atmosphere',
        zen: 'zen meditation art, flowing lines, peaceful minimal design',
        animals: 'animal portrait, detailed fur and features, natural pose',
        architecture: 'architectural drawing, buildings and structures, detailed',
        abstract: 'abstract art pattern, flowing curves and shapes, artistic',
        food: 'food illustration, appetizing details, culinary art',
        space: 'space scene, planets and stars, cosmic wonder',
      };
      const complexityPrompts = {
        simple: 'simple outlines, large open spaces, easy to color, minimal details',
        medium: 'moderate detail, balanced composition, clear sections',
        intricate: 'highly detailed, intricate patterns, many small sections, fine lines',
      };
      const fullPrompt = [
        'coloring book page',
        'clean black and white line art',
        'thick bold outlines',
        'no shading, no grayscale',
        'white background',
        stylePrompts[style] || style,
        complexityPrompts[complexity] || 'moderate detail',
        prompt,
      ].join(', ');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiToken}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{'parts': [{'text': fullPrompt}]}],
          systemInstruction: {
            parts: [{
              text: 'You are a coloring book artist. Generate ONLY black and white line art suitable for coloring. Rules:\n- Pure black lines on pure white background\n- NO color, NO shading, NO grayscale, NO fills\n- Thick, bold outlines around major shapes\n- Thinner lines for internal details\n- Clean, crisp vector-art style\n- All shapes must be fully enclosed (closed paths) so they can be bucket-filled\n- Output as a single image with no text overlay'
            }]
          },
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.4,
          }
        }),
        signal: AbortSignal.timeout(this.generationTimeout),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(err.error?.message || `Google API error ${response.status}`);
      }

      const data = await response.json();
      for (const part of data.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
      throw new Error('No image returned from Google direct call');
    }

    // Call our secure server-side proxy — API key never touches the browser
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style, complexity }),
      signal: AbortSignal.timeout(this.generationTimeout),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    if (!data.image) throw new Error('No image returned');
    return data.image;
  },

  async generateViaReplicate(prompt, style, complexity) {
    const stylePrompts = {
      mandala: 'symmetrical mandala pattern, geometric precision, sacred geometry',
      botanical: 'detailed botanical illustration, leaves and flowers, natural forms',
      geometric: 'geometric abstract pattern, clean lines, mathematical precision',
      fantasy: 'fantasy illustration, mythical creatures, magical atmosphere',
      zen: 'zen meditation art, flowing lines, peaceful minimal design',
      animals: 'animal portrait, detailed fur and features, natural pose',
      architecture: 'architectural drawing, buildings and structures, detailed',
      abstract: 'abstract art pattern, flowing curves and shapes, artistic',
      food: 'food illustration, appetizing details, culinary art',
      space: 'space scene, planets and stars, cosmic wonder',
    };

    const complexityPrompts = {
      simple: 'simple outlines, large open spaces, easy to color, minimal details',
      medium: 'moderate detail, balanced composition, clear sections',
      intricate: 'highly detailed, intricate patterns, many small sections, fine lines',
    };

    const fullPrompt = [
      'coloring book page',
      'clean black and white line art',
      'thick bold outlines',
      'no shading, no grayscale',
      'white background',
      stylePrompts[style] || style,
      complexityPrompts[complexity] || 'moderate detail',
      prompt,
    ].join(', ');

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt: fullPrompt,
          negative_prompt: 'color, shading, grayscale, blurry, photograph, realism, 3d, render',
          width: 768,
          height: 1024,
          num_outputs: 1,
          scheduler: 'K_EULER_ANCESTRAL',
          num_inference_steps: 30,
          guidance_scale: 9,
        },
      }),
      signal: AbortSignal.timeout(this.generationTimeout),
    });

    if (!response.ok) throw new Error(`Replicate API error: ${response.status}`);

    const prediction = await response.json();
    const result = await this.pollPrediction(prediction.urls.get);
    return result.output[0];
  },

  async pollPrediction(getUrl, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const resp = await fetch(getUrl, {
        headers: { 'Authorization': `Token ${this.replicateToken}` },
      });
      const prediction = await resp.json();

      if (prediction.status === 'succeeded') return prediction;
      if (prediction.status === 'failed') throw new Error('Generation failed');
      if (prediction.status === 'canceled') throw new Error('Generation canceled');

      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Generation timed out');
  },

  // ═══════════════════════════════════════════
  // Procedural fallback — rich coloring-book line art
  // ═══════════════════════════════════════════
  async generateProcedural(prompt, style, complexity) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        const w = 768, h = 1024;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        const seed = this.hashString(prompt + style + complexity);
        const rng = this.mulberry32(seed);

        const detail = { simple: 0.4, medium: 0.7, intricate: 1.0 }[complexity] || 0.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Cohesive authentic line weights
        const LINE_OUTLINE = 5.0;
        const LINE_MEDIUM = 2.5;
        const LINE_DETAIL = 1.2;

        // Dispatch to style-specific renderer
        switch (style) {
          case 'mandala': this.drawMandalaV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'botanical': this.drawBotanicalV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'geometric': this.drawGeometricV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'fantasy': this.drawFantasyV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'zen': this.drawZenV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'animals': this.drawAnimalsV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'architecture': this.drawArchitectureV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'abstract': this.drawAbstractV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'space': this.drawSpaceV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          case 'food': this.drawFoodV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL); break;
          default: this.drawMandalaV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL);
        }

        resolve(canvas.toDataURL('image/png'));
      }, 300);
    });
  },

  // ── V2: Rich Mandala ──────────────────
  drawMandalaV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2, cy = h/2 + 20;
    const maxR = Math.min(w, h) * 0.42;
    const rings = Math.floor(4 + detail * 8);

    // Rings (closed)
    for (let r = 0; r < rings; r++) {
      const radius = 30 + (r / rings) * maxR;
      const segments = Math.floor(6 + r * 2 + detail * 4);
      const segmentAngle = (Math.PI * 2) / segments;

      // Outer boundary ring is thick, inner ones are medium
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = (r === rings - 1) ? LINE_OUTLINE : LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Petal loops & inner details
      for (let i = 0; i < segments; i++) {
        const angle = i * segmentAngle + rng() * 0.05;
        const petalLen = 20 + rng() * (40 + detail * 30);
        const petalW = 6 + rng() * 16;

        // Draw organic Bezier-curved petal (fully closed)
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy + Math.sin(angle) * radius;
        const px = cx + Math.cos(angle) * (radius + petalLen);
        const py = cy + Math.sin(angle) * (radius + petalLen);

        const leftAngle = angle - segmentAngle * 0.35;
        const rightAngle = angle + segmentAngle * 0.35;
        const cp1x = cx + Math.cos(leftAngle) * (radius + petalLen * 0.5);
        const cp1y = cy + Math.sin(leftAngle) * (radius + petalLen * 0.5);
        const cp2x = cx + Math.cos(rightAngle) * (radius + petalLen * 0.5);
        const cp2y = cy + Math.sin(rightAngle) * (radius + petalLen * 0.5);

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cp1x, cp1y, px, py);
        ctx.quadraticCurveTo(cp2x, cp2y, sx, sy);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();

        // Inner detail on petals (fully closed)
        if (rng() > 0.3 && detail > 0.3) {
          const innerR = radius - 8 - rng() * 15;
          ctx.beginPath();
          ctx.ellipse(
            cx + Math.cos(angle) * innerR,
            cy + Math.sin(angle) * innerR,
            4 + rng() * 8, 3 + rng() * 5, angle, 0, Math.PI * 2
          );
          ctx.lineWidth = LINE_DETAIL;
          ctx.strokeStyle = '#1a1a2e';
          ctx.stroke();
        }
      }
    }

    // Center ornament (fully closed)
    ctx.beginPath();
    for (let i = 0; i < 8 + detail * 8; i++) {
      const a = (i / (8 + detail * 8)) * Math.PI * 2;
      const or = 8 + rng() * 16;
      const ox = cx + Math.cos(a) * or;
      const oy = cy + Math.sin(a) * or;
      ctx.moveTo(cx, cy);
      ctx.lineTo(ox, oy);
    }
    ctx.lineWidth = LINE_DETAIL;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
  },

  // ── V2: Rich Botanical ────────────────
  drawBotanicalV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2;
    const stems = Math.floor(2 + detail * 3);

    for (let s = 0; s < stems; s++) {
      const sx = cx - 60 + s * (120 / Math.max(stems - 1, 1)) + rng() * 40 - 20;
      const topY = 50 + rng() * 80;
      const sway = (rng() - 0.5) * 80;

      // Main stem (thick outline)
      ctx.beginPath();
      ctx.moveTo(sx, h);
      ctx.bezierCurveTo(
        sx + sway * 0.5, h * 0.7,
        sx + sway, h * 0.35,
        sx, topY
      );
      ctx.lineWidth = LINE_OUTLINE;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Leaves along stem
      const leafCount = Math.floor(6 + detail * 10);
      
      // We will batch all leaf veins into a single stroke call to optimize mobile
      const veinLines = [];

      for (let i = 0; i < leafCount; i++) {
        const t = i / leafCount;
        const ly = h - t * (h - topY);
        const lx = sx + sway * Math.sin(t * Math.PI) + (rng() - 0.5) * 20;
        const side = i % 2 === 0 ? 1 : -1;
        const la = -0.3 + t * 1.2;

        const leafLen = 15 + rng() * (detail * 25);
        const leafW = 7 + rng() * (detail * 10);
        const lx_center = lx + side * 12;
        const ly_center = ly;

        // endpoints of the leaf
        const startX = lx_center - Math.cos(la) * leafLen;
        const startY = ly_center - Math.sin(la) * leafLen;
        const endX = lx_center + Math.cos(la) * leafLen;
        const endY = ly_center + Math.sin(la) * leafLen;

        // perpendicular vectors
        const perpX = -Math.sin(la) * leafW;
        const perpY = Math.cos(la) * leafW;

        // Draw organic Bezier Leaf (closed)
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(lx_center + perpX, ly_center + perpY, endX, endY);
        ctx.quadraticCurveTo(lx_center - perpX, ly_center - perpY, startX, startY);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();

        // Accumulate veins for batching
        if (detail > 0.3) {
          veinLines.push({
            x1: lx - (side * 8), y1: ly,
            x2: lx + side * (18 + rng() * 15), y2: ly + (rng() - 0.5) * 6
          });
        }
      }

      // Batch stroke all veins
      if (veinLines.length > 0) {
        ctx.beginPath();
        for (const line of veinLines) {
          ctx.moveTo(line.x1, line.y1);
          ctx.lineTo(line.x2, line.y2);
        }
        ctx.lineWidth = LINE_DETAIL;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();
      }

      // Flower/bloom at top (closed petals)
      const bloomR = 12 + rng() * (detail * 20);
      const petals = Math.floor(5 + rng() * 4);
      for (let p = 0; p < petals; p++) {
        const pa = (p / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          sx + Math.cos(pa) * bloomR * 0.6,
          topY + Math.sin(pa) * bloomR * 0.6,
          bloomR * 0.7, bloomR * 0.3, pa, 0, Math.PI * 2
        );
        ctx.lineWidth = LINE_MEDIUM;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();
      }
      // Pistil center (closed)
      ctx.beginPath();
      ctx.arc(sx, topY, bloomR * 0.4, 0, Math.PI * 2);
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Ground line (closed bottom section)
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(20, h - 5);
    ctx.quadraticCurveTo(cx, h - 20 + rng() * 10, w - 20, h - 5);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();
  },

  // ── V2: Geometric Patterns ────────────
  drawGeometricV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const gridSize = Math.floor(3 + detail * 5);
    const cellW = w / gridSize;
    const cellH = h / gridSize;

    // We will batch all inner details/dots to optimize mobile draw calls
    const innerDots = [];

    for (let row = 0; row <= gridSize; row++) {
      for (let col = 0; col <= gridSize; col++) {
        const x = col * cellW + (row % 2) * cellW / 2;
        const y = row * cellH;

        if (x > w + 20 || y > h + 20) continue;

        const shape = Math.floor(rng() * 4);
        ctx.beginPath();

        switch (shape) {
          case 0: // Diamond (closed)
            ctx.moveTo(x, y - cellH/2);
            ctx.lineTo(x + cellW/2, y);
            ctx.lineTo(x, y + cellH/2);
            ctx.lineTo(x - cellW/2, y);
            ctx.closePath();
            break;
          case 1: // Circle (closed)
            ctx.arc(x, y, cellW * 0.35, 0, Math.PI * 2);
            break;
          case 2: // Hexagon (closed)
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 - Math.PI/6;
              const px = x + Math.cos(a) * cellW * 0.4;
              const py = y + Math.sin(a) * cellW * 0.4;
              i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
          case 3: // Triangle (closed)
            ctx.moveTo(x, y - cellH/2);
            ctx.lineTo(x + cellW/2, y + cellH/2);
            ctx.lineTo(x - cellW/2, y + cellH/2);
            ctx.closePath();
            break;
        }
        ctx.lineWidth = LINE_OUTLINE;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();

        // Collect inner details for batching
        if (detail > 0.5 && rng() > 0.3) {
          innerDots.push({ x, y, r: cellW * 0.12 + rng() * 5 });
        }
      }
    }

    // Batch stroke all inner circles
    if (innerDots.length > 0) {
      ctx.beginPath();
      for (const d of innerDots) {
        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      ctx.lineWidth = LINE_DETAIL;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }
  },

  // ── V2: Fantasy (Dragon/Castle) ──────
  drawFantasyV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2, cy = h/2;

    // Castle silhouette (fully closed at bottom)
    ctx.beginPath();
    ctx.moveTo(60, h);
    ctx.lineTo(60, cy + 100);
    ctx.lineTo(40, cy + 50);
    ctx.lineTo(40, cy - 50);
    // Battlements
    for (let i = 0; i < 3; i++) {
      ctx.lineTo(40 + i*25, cy - 50);
      ctx.lineTo(40 + i*25, cy - 80);
      ctx.lineTo(40 + (i+1)*25, cy - 80);
    }
    ctx.lineTo(110, cy - 50);
    ctx.lineTo(110, cy + 100);
    ctx.lineTo(cx - 30, cy + 150);
    ctx.lineTo(cx - 30, cy - 120);
    // Main tower
    ctx.lineTo(cx, cy - 220);
    ctx.lineTo(cx + 30, cy - 120);
    ctx.lineTo(cx + 30, cy + 150);
    ctx.lineTo(w - 60, cy + 100);
    ctx.lineTo(w - 60, h);
    ctx.closePath();
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Windows (closed)
    for (let i = 0; i < Math.floor(detail * 8); i++) {
      const wx = 60 + rng() * (w - 120);
      const wy = cy - 50 + rng() * 200;
      ctx.beginPath();
      ctx.arc(wx, wy, 8 + rng() * 12, 0, Math.PI, true);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Dragon in sky (closed body loop)
    const dx = w * 0.7 + rng() * 60;
    const dy = h * 0.15 + rng() * 40;
    ctx.beginPath();
    ctx.moveTo(dx - 80, dy);
    ctx.quadraticCurveTo(dx - 40, dy - 60, dx, dy - 40);
    ctx.quadraticCurveTo(dx + 40, dy - 20, dx + 60, dy);
    ctx.quadraticCurveTo(dx + 80, dy + 20, dx + 60, dy + 30);
    ctx.quadraticCurveTo(dx + 30, dy + 20, dx, dy + 10);
    ctx.quadraticCurveTo(dx - 30, dy + 30, dx - 60, dy + 10);
    ctx.closePath();
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Dragon wings (closed curves)
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(dx + side * 30, dy - 20);
      ctx.quadraticCurveTo(dx + side * 80, dy - 120, dx + side * 40, dy - 80);
      ctx.quadraticCurveTo(dx + side * 20, dy - 100, dx + side * 10, dy - 40);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Ground line (closed bottom block)
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - 55);
    ctx.quadraticCurveTo(cx, h - 40 + rng()*10, w, h - 55);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Batch stars to minimize draw calls
    if (detail > 0.3) {
      ctx.beginPath();
      const numStars = Math.floor(detail * 15);
      for (let i = 0; i < numStars; i++) {
        const scx = rng() * w;
        const scy = rng() * h * 0.5;
        const sr = 3 + rng() * 4;
        const pts = 4 + Math.floor(rng() * 2);
        
        // Add star path directly
        for (let j = 0; j < pts * 2; j++) {
          const radius = j % 2 === 0 ? sr : sr * 0.4;
          const angle = (j / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
          const sx = scx + Math.cos(angle) * radius;
          const sy = scy + Math.sin(angle) * radius;
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
      }
      ctx.lineWidth = LINE_DETAIL;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }
  },

  // ── V2: Zen Garden ────────────────────
  drawZenV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2, cy = h/2;

    // Circular zen garden base (thick outline)
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.4, 0, Math.PI * 2);
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Batch all raked sand patterns into a single path!
    ctx.beginPath();
    const rings = Math.floor(4 + detail * 6);
    for (let r = 0; r < rings; r++) {
      const radius = 40 + r * (Math.min(w, h) * 0.35 / rings);
      // concentric circles
      ctx.moveTo(cx + radius, cy);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    }

    // Wavy pattern overlay
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const waveR = 100 + Math.sin(a * 8 + rng()) * 30 + detail * 40;
      const wx = cx + Math.cos(a) * waveR;
      const wy = cy + Math.sin(a) * waveR;
      a === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
    }
    ctx.lineWidth = LINE_DETAIL;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Rock clusters (closed)
    for (let i = 0; i < Math.floor(3 + detail * 5); i++) {
      const ra = rng() * Math.PI * 2;
      const rr = 50 + rng() * (Math.min(w, h) * 0.3);
      const rx = cx + Math.cos(ra) * rr;
      const ry = cy + Math.sin(ra) * rr;

      ctx.beginPath();
      const rockPts = 5 + Math.floor(rng() * 5);
      for (let p = 0; p < rockPts; p++) {
        const pa = (p / rockPts) * Math.PI * 2 + rng() * 0.3;
        const pr = 8 + rng() * 20;
        const px = rx + Math.cos(pa) * pr;
        const py = ry + Math.sin(pa) * pr;
        p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Bamboo stalks (thick outline)
    for (let i = 0; i < 3; i++) {
      const bx = w * 0.2 + i * w * 0.3;
      ctx.beginPath();
      ctx.moveTo(bx, h);
      ctx.quadraticCurveTo(bx + (rng() - 0.5) * 40, h * 0.5, bx + (rng() - 0.5) * 30, h * 0.15);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Bamboo nodes (batched lines)
      ctx.beginPath();
      for (let n = 0; n < 4; n++) {
        const ny = h * 0.8 - n * h * 0.18;
        ctx.moveTo(bx - 10, ny);
        ctx.lineTo(bx + 10, ny);
      }
      ctx.lineWidth = LINE_DETAIL;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }
  },

  // ── V2: Animals ───────────────────────
  drawAnimalsV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2, cy = h/2 - 30;
    const animals = ['cat', 'owl', 'butterfly', 'elephant', 'fox', 'fish'];
    const animal = animals[Math.floor(rng() * animals.length)];

    const drawDetail = (fn) => { if (detail > 0.4) fn(); };

    if (animal === 'cat') {
      // Head
      ctx.beginPath(); ctx.arc(cx, cy, 140, 0, Math.PI * 2); ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Ears (closed bezier loops)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 90, cy - 100);
        ctx.bezierCurveTo(cx + side * 110, cy - 180, cx + side * 140, cy - 230, cx + side * 130, cy - 230);
        ctx.bezierCurveTo(cx + side * 90, cy - 180, cx + side * 30, cy - 120, cx + side * 30, cy - 120);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        // Inner ear pink area
        ctx.beginPath();
        ctx.moveTo(cx + side * 80, cy - 105);
        ctx.quadraticCurveTo(cx + side * 110, cy - 180, cx + side * 115, cy - 200);
        ctx.quadraticCurveTo(cx + side * 80, cy - 150, cx + side * 45, cy - 115);
        ctx.closePath();
        ctx.lineWidth = LINE_DETAIL;
        ctx.stroke();
      }

      // Eyes (closed loops)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(cx + side * 45, cy - 20, 28, 0, Math.PI * 2);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + side * 40, cy - 20, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + side * 37, cy - 23, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Nose (closed triangle)
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 15);
      ctx.lineTo(cx, cy + 30);
      ctx.lineTo(cx + 15, cy + 15);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Whiskers (batched)
      ctx.beginPath();
      ctx.lineWidth = LINE_DETAIL;
      for (let side = -1; side <= 1; side += 2) {
        for (let w = 0; w < 3; w++) {
          ctx.moveTo(cx + side * 20, cy + 15 + w * 12);
          ctx.quadraticCurveTo(cx + side * 80, cy + 10 + w * 15, cx + side * 120, cy + 20 + w * 10);
        }
      }
      ctx.stroke();

      // Body hint (closed)
      ctx.beginPath();
      ctx.ellipse(cx, cy + 200, 120, 100, 0, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      drawDetail(() => {
        // Fur texture (batched)
        ctx.beginPath();
        ctx.lineWidth = LINE_DETAIL;
        for (let i = 0; i < 12; i++) {
          const fa = rng() * Math.PI * 2;
          const fr = 130 + rng() * 20;
          ctx.moveTo(cx + Math.cos(fa) * fr, cy + Math.sin(fa) * fr);
          ctx.lineTo(cx + Math.cos(fa) * (fr + 20), cy + Math.sin(fa) * (fr + 20));
        }
        ctx.stroke();
      });

    } else if (animal === 'owl') {
      // Body (closed oval)
      ctx.beginPath(); ctx.ellipse(cx, cy + 40, 130, 160, 0, 0, Math.PI * 2); ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Head (closed circle)
      ctx.beginPath(); ctx.arc(cx, cy - 80, 100, 0, Math.PI * 2); ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Eye rings (closed circles)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.arc(cx + side * 35, cy - 90, 40, 0, Math.PI * 2); ctx.lineWidth = LINE_MEDIUM; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + side * 35, cy - 90, 14, 0, Math.PI * 2); ctx.fillStyle = '#1a1a2e'; ctx.fill();
        ctx.beginPath(); ctx.arc(cx + side * 31, cy - 94, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      }

      // Beak (closed triangle)
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 50);
      ctx.lineTo(cx, cy - 25);
      ctx.lineTo(cx + 12, cy - 50);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Wings (closed curves)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 130, cy + 20);
        ctx.quadraticCurveTo(cx + side * 100, cy + 80, cx + side * 60, cy + 160);
        ctx.quadraticCurveTo(cx + side * 100, cy + 100, cx + side * 130, cy + 20);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

      // Chest feathers (batched)
      drawDetail(() => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const fx = cx - 30 + i * 12;
          const fy = cy + 40 + i * 15;
          const fr = 10 + rng() * 8;
          ctx.moveTo(fx + fr, fy);
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        }
        ctx.lineWidth = LINE_DETAIL;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();
      });

    } else if (animal === 'butterfly') {
      // Upper & Lower wings (closed curves)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.ellipse(cx + side * 100, cy - 60, 110, 70, side * 0.3, 0, Math.PI * 2);
        ctx.lineWidth = LINE_OUTLINE;
        ctx.strokeStyle = '#1a1a2e';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(cx + side * 80, cy + 80, 70, 80, -side * 0.2, 0, Math.PI * 2);
        ctx.lineWidth = LINE_OUTLINE;
        ctx.stroke();

        // Wing patterns (closed circles)
        drawDetail(() => {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const wx = cx + side * 100 + rng()*60 - 30;
            const wy = cy - 60 + rng()*60 - 30;
            const wr = 6 + rng() * 14;
            ctx.moveTo(wx + wr, wy);
            ctx.arc(wx, wy, wr, 0, Math.PI * 2);
          }
          ctx.lineWidth = LINE_DETAIL;
          ctx.strokeStyle = '#1a1a2e';
          ctx.stroke();
        });
      }
      
      // Body (closed)
      ctx.beginPath(); ctx.ellipse(cx, cy, 14, 90, 0, 0, Math.PI * 2); ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Antennae (closed paths at ends)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 6, cy - 90);
        ctx.quadraticCurveTo(cx + side * 50, cy - 160, cx + side * 60, cy - 180);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + side * 60, cy - 180, 6, 0, Math.PI * 2);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

    } else if (animal === 'elephant') {
      // Body (closed ellipse)
      ctx.beginPath();
      ctx.ellipse(cx, cy + 80, 160, 120, 0, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Legs (closed)
      ctx.beginPath();
      ctx.rect(cx - 120, cy + 150, 60, 100);
      ctx.rect(cx - 30, cy + 170, 50, 80);
      ctx.rect(cx + 40, cy + 150, 60, 100);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Head (closed bezier)
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy - 80);
      ctx.bezierCurveTo(cx - 100, cy - 80, cx - 100, cy + 20, cx - 50, cy + 40);
      ctx.bezierCurveTo(cx - 20, cy + 50, cx + 20, cy + 50, cx + 50, cy + 40);
      ctx.bezierCurveTo(cx + 100, cy + 20, cx + 100, cy - 80, cx + 60, cy - 80);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Ears (closed loops)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 70, cy - 80);
        ctx.bezierCurveTo(cx + side * 180, cy - 140, cx + side * 220, cy + 40, cx + side * 140, cy + 80);
        ctx.bezierCurveTo(cx + side * 90, cy + 100, cx + side * 50, cy + 20, cx + side * 50, cy + 20);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        // Ear inner pattern (closed loops)
        ctx.beginPath();
        ctx.moveTo(cx + side * 80, cy - 60);
        ctx.bezierCurveTo(cx + side * 150, cy - 100, cx + side * 180, cy + 20, cx + side * 120, cy + 50);
        ctx.closePath();
        ctx.lineWidth = LINE_DETAIL;
        ctx.stroke();
      }

      // Trunk (closed)
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy + 30);
      ctx.bezierCurveTo(cx - 40, cy + 120, cx - 100, cy + 120, cx - 120, cy + 80);
      ctx.bezierCurveTo(cx - 130, cy + 60, cx - 110, cy + 50, cx - 110, cy + 70);
      ctx.bezierCurveTo(cx - 95, cy + 100, cx - 55, cy + 95, cx - 5, cy + 30);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Eyes (closed)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(cx + side * 30, cy - 20, 14, 0, Math.PI * 2);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + side * 28, cy - 20, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
      }

      // Blanket (decorative back blanket)
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy - 10);
      ctx.bezierCurveTo(cx - 50, cy + 20, cx + 50, cy + 20, cx + 80, cy - 10);
      ctx.lineTo(cx + 90, cy + 60);
      ctx.bezierCurveTo(cx + 40, cy + 90, cx - 40, cy + 90, cx - 90, cy + 60);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      // Blanket details (batched)
      ctx.beginPath();
      ctx.lineWidth = LINE_DETAIL;
      for (let i = 0; i < 5; i++) {
        const bx = cx - 60 + i * 30;
        ctx.moveTo(bx, cy + 10);
        ctx.lineTo(bx, cy + 70);
      }
      ctx.stroke();

    } else if (animal === 'fox') {
      // Snout/Face outer (closed curves)
      ctx.beginPath();
      ctx.moveTo(cx - 110, cy - 40);
      ctx.bezierCurveTo(cx - 120, cy + 30, cx - 60, cy + 60, cx, cy + 80);
      ctx.bezierCurveTo(cx + 60, cy + 60, cx + 120, cy + 30, cx + 110, cy - 40);
      ctx.bezierCurveTo(cx + 80, cy - 100, cx - 80, cy - 100, cx - 110, cy - 40);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Inner white cheek patches (closed curves)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 110, cy - 40);
        ctx.bezierCurveTo(cx + side * 90, cy + 10, cx + side * 40, cy + 30, cx, cy + 50);
        ctx.bezierCurveTo(cx + side * 30, cy + 40, cx + side * 50, cy - 10, cx + side * 45, cy - 25);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

      // Nose (closed triangle)
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 65);
      ctx.lineTo(cx + 12, cy + 65);
      ctx.quadraticCurveTo(cx, cy + 85, cx, cy + 85);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.stroke();

      // Big Fox Ears (closed)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 90, cy - 65);
        ctx.bezierCurveTo(cx + side * 130, cy - 170, cx + side * 80, cy - 210, cx + side * 60, cy - 210);
        ctx.bezierCurveTo(cx + side * 40, cy - 150, cx + side * 30, cy - 90, cx + side * 30, cy - 90);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        // Inner ear (closed)
        ctx.beginPath();
        ctx.moveTo(cx + side * 80, cy - 80);
        ctx.bezierCurveTo(cx + side * 105, cy - 150, cx + side * 75, cy - 180, cx + side * 65, cy - 180);
        ctx.bezierCurveTo(cx + side * 55, cy - 140, cx + side * 45, cy - 100, cx + side * 45, cy - 100);
        ctx.closePath();
        ctx.lineWidth = LINE_DETAIL;
        ctx.stroke();
      }

      // Eyes (closed circles)
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.arc(cx + side * 45, cy + 10, 16, 0, Math.PI * 2);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + side * 43, cy + 8, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
      }

      // Body (sitting body)
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy + 70);
      ctx.bezierCurveTo(cx - 100, cy + 160, cx - 110, cy + 220, cx - 50, cy + 240);
      ctx.lineTo(cx + 50, cy + 240);
      ctx.bezierCurveTo(cx + 110, cy + 220, cx + 100, cy + 160, cx + 70, cy + 70);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Bushy Tail (closed)
      ctx.beginPath();
      ctx.moveTo(cx + 50, cy + 160);
      ctx.bezierCurveTo(cx + 160, cy + 160, cx + 180, cy + 40, cx + 140, cy + 40);
      ctx.bezierCurveTo(cx + 90, cy + 40, cx + 60, cy + 130, cx + 60, cy + 130);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Tail Tip zigzag (closed to partition tail tip)
      ctx.beginPath();
      ctx.moveTo(cx + 130, cy + 50);
      ctx.lineTo(cx + 115, cy + 70);
      ctx.lineTo(cx + 135, cy + 85);
      ctx.lineTo(cx + 120, cy + 100);
      ctx.bezierCurveTo(cx + 155, cy + 90, cx + 155, cy + 45, cx + 130, cy + 50);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

    } else if (animal === 'fish') {
      // Teardrop fish body (closed curves)
      ctx.beginPath();
      ctx.moveTo(cx - 160, cy);
      ctx.bezierCurveTo(cx - 80, cy - 130, cx + 80, cy - 130, cx + 120, cy);
      ctx.bezierCurveTo(cx + 80, cy + 130, cx - 80, cy + 130, cx - 160, cy);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Big circular eye (closed)
      ctx.beginPath();
      ctx.arc(cx - 70, cy - 30, 24, 0, Math.PI * 2);
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx - 75, cy - 30, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();

      // Mouth (closed smile)
      ctx.beginPath();
      ctx.moveTo(cx - 130, cy + 20);
      ctx.quadraticCurveTo(cx - 110, cy + 40, cx - 90, cy + 20);
      ctx.quadraticCurveTo(cx - 110, cy + 15, cx - 130, cy + 20);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      // Tail Fin (closed)
      ctx.beginPath();
      ctx.moveTo(cx + 110, cy - 10);
      ctx.bezierCurveTo(cx + 180, cy - 120, cx + 220, cy - 100, cx + 210, cy - 40);
      ctx.bezierCurveTo(cx + 180, cy - 10, cx + 180, cy + 10, cx + 210, cy + 40);
      ctx.bezierCurveTo(cx + 220, cy + 100, cx + 180, cy + 120, cx + 110, cy + 10);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      // Tail fin ribs (batched)
      ctx.beginPath();
      ctx.lineWidth = LINE_DETAIL;
      for (let i = 0; i < 5; i++) {
        const ry = cy - 60 + i * 30;
        ctx.moveTo(cx + 120, cy + (i - 2) * 8);
        ctx.quadraticCurveTo(cx + 160, ry, cx + 195, ry + (i - 2) * 5);
      }
      ctx.stroke();

      // Dorsal Fin (closed)
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 100);
      ctx.bezierCurveTo(cx + 10, cy - 160, cx + 80, cy - 150, cx + 80, cy - 70);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      // Pectoral Fin (closed)
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 40);
      ctx.bezierCurveTo(cx - 30, cy + 110, cx + 20, cy + 120, cx + 20, cy + 60);
      ctx.closePath();
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();

      // Scales (closed cells in columns)
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const sy = cy - 60 + i * 50 + (i === 1 ? 0 : 5);
        ctx.arc(cx - 20, sy, 28, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const sy = cy - 35 + i * 50;
        ctx.arc(cx + 20, sy, 28, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

      // Water bubbles (closed)
      ctx.beginPath();
      ctx.lineWidth = LINE_DETAIL;
      const bLocations = [
        { x: cx - 180, y: cy - 70, r: 12 },
        { x: cx - 210, y: cy - 110, r: 8 },
        { x: cx - 170, y: cy - 140, r: 18 }
      ];
      for (const b of bLocations) {
        ctx.moveTo(b.x + b.r, b.y);
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
  },

  // ── V2: Architecture / Cityscape ──────
  drawArchitectureV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const buildings = Math.floor(5 + detail * 8);
    const bw = w / buildings;
    const horizon = h * 0.25 + rng() * h * 0.15;

    for (let i = 0; i < buildings; i++) {
      const bx = i * bw;
      const bh = horizon + rng() * (h - horizon - 40);
      const by = h - bh;

      // Main building (closed)
      ctx.beginPath();
      ctx.rect(bx + 6, by, bw - 12, bh);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();

      // Roof style (closed)
      if (rng() > 0.5) {
        ctx.beginPath();
        ctx.moveTo(bx + 6, by);
        ctx.lineTo(bx + bw/2, by - 15 - rng() * 25);
        ctx.lineTo(bx + bw - 6, by);
        ctx.closePath();
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(bx + 6, by - 10, bw - 12, 10);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

      // Windows (closed)
      const rows = Math.floor(bh / 55);
      const cols = Math.floor((bw - 20) / 30) || 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rng() > 0.25) {
            const wx = bx + 14 + c * ((bw - 28) / cols);
            const wy = by + 12 + r * 55;
            const ww = (bw - 28) / cols - 6;
            const wh = 28 + rng() * 10;

            if (rng() > 0.5) {
              ctx.beginPath();
              ctx.moveTo(wx, wy + wh);
              ctx.lineTo(wx, wy + wh/3);
              ctx.arc(wx + ww/2, wy + wh/3, ww/2, Math.PI, 0);
              ctx.lineTo(wx + ww, wy + wh);
              ctx.closePath();
              ctx.lineWidth = LINE_MEDIUM;
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.rect(wx, wy, ww, wh);
              ctx.lineWidth = LINE_MEDIUM;
              ctx.stroke();
            }
          }
        }
      }
    }

    // Ground line (closed block)
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - 5);
    ctx.lineTo(w, h - 5);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.lineWidth = LINE_OUTLINE;
    ctx.stroke();

    // Moon/sun (closed)
    if (detail > 0.3) {
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.12, 35 + rng() * 15, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();
    }
  },

  // ── V2: Abstract / Flowing ────────────
  drawAbstractV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const elements = Math.floor(15 + detail * 25);

    // Large flowing curves (thick)
    for (let i = 0; i < Math.floor(detail * 6); i++) {
      ctx.beginPath();
      const startX = rng() * w, startY = rng() * h;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 4; j++) {
        const cpx = rng() * w, cpy = rng() * h;
        const ex = rng() * w, ey = rng() * h;
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      }
      ctx.lineWidth = LINE_OUTLINE;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Concentric organic shapes (closed)
    for (let i = 0; i < elements; i++) {
      const sx = 50 + rng() * (w - 100);
      const sy = 50 + rng() * (h - 100);
      const shapeType = Math.floor(rng() * 3);

      ctx.beginPath();
      switch (shapeType) {
        case 0: // Organic blob (closed)
          const blobPts = 6 + Math.floor(rng() * 6);
          for (let p = 0; p < blobPts; p++) {
            const a = (p / blobPts) * Math.PI * 2 + rng() * 0.5;
            const r = 15 + rng() * 60;
            const px = sx + Math.cos(a) * r;
            const py = sy + Math.sin(a) * r;
            p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        case 1: // Swirl (non-closed ribbon but drawn closed)
          for (let a = 0; a < Math.PI * 3; a += 0.15) {
            const r = 5 + a * 12;
            const px = sx + Math.cos(a + rng()) * r;
            const py = sy + Math.sin(a + rng()) * r;
            a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          break;
        case 2: // Zigzag polygon (closed)
          const zpPts = 3 + Math.floor(rng() * 4);
          for (let p = 0; p < zpPts * 2; p++) {
            const a = (p / (zpPts * 2)) * Math.PI * 2;
            const r = p % 2 === 0 ? 30 + rng() * 50 : 15 + rng() * 25;
            const px = sx + Math.cos(a) * r;
            const py = sy + Math.sin(a) * r;
            p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
      }
      ctx.lineWidth = LINE_MEDIUM;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }

    // Batch background dots to optimize draw calls
    if (detail > 0.5) {
      ctx.beginPath();
      for (let i = 0; i < Math.floor(detail * 25); i++) {
        const dx = rng() * w;
        const dy = rng() * h;
        const dr = 2 + rng() * 6;
        ctx.moveTo(dx + dr, dy);
        ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      }
      ctx.lineWidth = LINE_DETAIL;
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
    }
  },

  // ── V2: Space ─────────────────────────
  drawSpaceV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2, cy = h/2;
    const planets = Math.floor(2 + detail * 6);

    // Large central planet (thick)
    ctx.beginPath();
    ctx.arc(cx, cy + 30, 75, 0, Math.PI * 2);
    ctx.lineWidth = LINE_OUTLINE;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();

    // Planet Ring (closed)
    if (rng() > 0.4) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 150, 35, 0.25, 0, Math.PI * 2);
      ctx.lineWidth = LINE_MEDIUM;
      ctx.stroke();
    }

    // Surface details on central planet (closed circles)
    for (let i = 0; i < Math.floor(detail * 6); i++) {
      const ca = rng() * Math.PI * 2;
      const cd = rng() * 50;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ca) * cd, cy + 30 + Math.sin(ca) * cd, 6 + rng() * 10, 0, Math.PI * 2);
      ctx.lineWidth = LINE_DETAIL;
      ctx.stroke();
    }

    // Smaller planets (closed)
    for (let i = 0; i < planets; i++) {
      const px = 80 + rng() * (w - 160);
      const py = 80 + rng() * (h - 160);
      const pr = 15 + rng() * 30;

      if (Math.hypot(px - cx, py - cy) < 140) continue; // prevent overlapping

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE;
      ctx.stroke();

      // Ring for some
      if (rng() > 0.55) {
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 1.5, pr * 0.35, rng() * 0.5, 0, Math.PI * 2);
        ctx.lineWidth = LINE_MEDIUM;
        ctx.stroke();
      }

      // Craters (closed)
      for (let j = 0; j < Math.floor(detail * 3); j++) {
        const ca = rng() * Math.PI * 2;
        const cd = rng() * pr * 0.5;
        ctx.beginPath();
        ctx.arc(px + Math.cos(ca) * cd, py + Math.sin(ca) * cd, 3 + rng() * 4, 0, Math.PI * 2);
        ctx.lineWidth = LINE_DETAIL;
        ctx.stroke();
      }
    }

    // Batch stars to minimize draw calls
    ctx.beginPath();
    const starCount = 30 + Math.floor(detail * 30);
    for (let i = 0; i < starCount; i++) {
      const scx = rng() * w;
      const scy = rng() * h;
      const sr = 3 + rng() * 4;
      const pts = 4;
      
      // Add star path directly
      for (let j = 0; j < pts * 2; j++) {
        const radius = j % 2 === 0 ? sr : sr * 0.4;
        const angle = (j / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        const sx = scx + Math.cos(angle) * radius;
        const sy = scy + Math.sin(angle) * radius;
        j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
    }
    ctx.lineWidth = LINE_DETAIL;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();
  },

  // ── V2: Food ──────────────────────────
  drawFoodV2(ctx, w, h, detail, rng, LINE_OUTLINE, LINE_MEDIUM, LINE_DETAIL) {
    const cx = w/2;
    const foods = ['cupcake', 'pizza', 'sushi'];
    const food = foods[Math.floor(rng() * foods.length)];

    if (food === 'cupcake') {
      const baseY = h - 180;
      
      // Wrapper (closed)
      ctx.beginPath();
      ctx.moveTo(cx - 90, baseY + 120);
      ctx.lineTo(cx - 60, baseY - 60);
      ctx.lineTo(cx + 60, baseY - 60);
      ctx.lineTo(cx + 90, baseY + 120);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Wrapper ridges (batched lines)
      ctx.beginPath();
      for (let i = 1; i < 8; i++) {
        ctx.moveTo(cx - 90 + i * 22.5, baseY + 120);
        ctx.lineTo(cx - 60 + i * 15, baseY - 60);
      }
      ctx.lineWidth = LINE_DETAIL; ctx.stroke();

      // Frosting layers (closed organic curves)
      ctx.beginPath();
      ctx.arc(cx, baseY - 80, 100, Math.PI, 0);
      ctx.quadraticCurveTo(cx + 110, baseY - 160, cx + 50, baseY - 190);
      ctx.quadraticCurveTo(cx, baseY - 220, cx - 50, baseY - 190);
      ctx.quadraticCurveTo(cx - 110, baseY - 160, cx - 100, baseY - 80);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE; ctx.stroke();

      // Batch sprinkles (closed loops)
      ctx.beginPath();
      for (let i = 0; i < Math.floor(detail * 15); i++) {
        const sx = cx - 75 + rng() * 150;
        const sy = baseY - 170 + rng() * 80;
        const sa = rng() * Math.PI;
        
        // draw a small ellipse in batch
        const rx = 5, ry = 2.5;
        for (let a = 0; a <= Math.PI * 2; a += 0.2) {
          const ex = sx + Math.cos(a) * rx * Math.cos(sa) - Math.sin(a) * ry * Math.sin(sa);
          const ey = sy + Math.cos(a) * rx * Math.sin(sa) + Math.sin(a) * ry * Math.cos(sa);
          a === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
        }
      }
      ctx.lineWidth = LINE_DETAIL; ctx.stroke();

      // Cherry (closed)
      ctx.beginPath(); ctx.arc(cx, baseY - 210, 22, 0, Math.PI * 2); ctx.lineWidth = LINE_MEDIUM; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, baseY - 232); ctx.quadraticCurveTo(cx + 20, baseY - 270, cx + 25, baseY - 255); ctx.lineWidth = LINE_DETAIL; ctx.stroke();

    } else if (food === 'pizza') {
      const cy = h/2 - 40;
      // Crust (closed concentric)
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 185, 0, Math.PI * 2);
      ctx.lineWidth = LINE_MEDIUM; ctx.stroke();

      // Slice lines (batched lines)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI / 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 185, cy + Math.sin(a) * 185);
      }
      ctx.lineWidth = LINE_MEDIUM; ctx.stroke();

      // Pepperoni (closed circles)
      for (let i = 0; i < Math.floor(8 + detail * 10); i++) {
        const pa = rng() * Math.PI * 2;
        const pd = 40 + rng() * 120;
        const px = cx + Math.cos(pa) * pd;
        const py = cy + Math.sin(pa) * pd;
        if (Math.hypot(px - cx, py - cy) < 160) {
          ctx.beginPath();
          ctx.arc(px, py, 15, 0, Math.PI * 2);
          ctx.lineWidth = LINE_MEDIUM;
          ctx.stroke();

          // Pepperoni dots (closed circles)
          if (detail > 0.4) {
            ctx.beginPath();
            for (let j = 0; j < 3; j++) {
              const da = rng() * Math.PI * 2;
              const dd = rng() * 7;
              const dcx = px + Math.cos(da)*dd;
              const dcy = py + Math.sin(da)*dd;
              ctx.moveTo(dcx + 1.5, dcy);
              ctx.arc(dcx, dcy, 1.5, 0, Math.PI*2);
            }
            ctx.fillStyle = '#1a1a2e'; ctx.fill();
          }
        }
      }

    } else if (food === 'sushi') {
      const cy = h/2 - 40;
      // Plate (closed)
      ctx.beginPath();
      ctx.ellipse(cx, cy + 140, 200, 35, 0, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();
      
      // Rice oval (closed)
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 100, 60, 0, 0, Math.PI * 2);
      ctx.lineWidth = LINE_OUTLINE; ctx.stroke();
      
      // Rice texture (batched loops)
      ctx.beginPath();
      for (let i = 0; i < Math.floor(detail * 10); i++) {
        const rx = cx - 75 + rng() * 150;
        const ry = cy - 25 + rng() * 85;
        const rr = 8, rw = 4;
        const ra = rng() * 0.5;
        for (let a = 0; a <= Math.PI * 2; a += 0.3) {
          const ex = rx + Math.cos(a) * rr * Math.cos(ra) - Math.sin(a) * rw * Math.sin(ra);
          const ey = ry + Math.cos(a) * rr * Math.sin(ra) + Math.sin(a) * rw * Math.cos(ra);
          a === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
        }
      }
      ctx.lineWidth = LINE_DETAIL; ctx.strokeStyle = '#1a1a2e'; ctx.stroke();

      // Fish on top (closed organic curves)
      ctx.beginPath();
      ctx.moveTo(cx - 85, cy - 10);
      ctx.quadraticCurveTo(cx - 40, cy - 60, cx + 40, cy - 60);
      ctx.quadraticCurveTo(cx + 80, cy - 20, cx + 65, cy + 10);
      ctx.quadraticCurveTo(cx + 20, cy - 15, cx - 85, cy - 10);
      ctx.closePath();
      ctx.lineWidth = LINE_OUTLINE; ctx.stroke();

      // Fish stripes (batched lines)
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const fx = cx - 50 + i * 30;
        ctx.moveTo(fx, cy - 55);
        ctx.lineTo(fx, cy - 5);
      }
      ctx.lineWidth = LINE_DETAIL; ctx.stroke();
    }
  },

  // Star helper
  drawStar(ctx, cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * 0.4;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();
  },

  // Utility
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },

  mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },

  setToken(token) {
    this.replicateToken = token;
  },
};

// Auto-initialize from localStorage
(function() {
  try {
    const replicateToken = JSON.parse(localStorage.getItem('colorforge_replicate_token'));
    if (replicateToken) window.AIPipeline.replicateToken = replicateToken;
  } catch(e) {}
})();
