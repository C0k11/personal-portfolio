/* ============================================================
   Dusk lake — hand-coded canvas background.
   Layers: sky gradient, stars, sun glow, drifting clouds,
   hill silhouettes, mirror water with shimmer + pointer
   ripples, drifting motes, shooting stars on click.
   No images. Respects prefers-reduced-motion.
   ============================================================ */

(() => {
  const canvas = document.getElementById("dusk");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    || location.search.includes("static");
  const mobile = matchMedia("(max-width: 640px)").matches;

  let W, H, DPR, HORIZON;
  const base = document.createElement("canvas");   // prerendered static layers
  const bctx = base.getContext("2d");

  // scene state
  const stars = [];
  const clouds = [];
  const motes = [];
  const ripples = [];
  const meteors = [];
  let hills = [];

  const pointer = { x: 0.5, y: 0.5, px: 0.35, py: 0.0 }; // normalized; px/py = eased parallax

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- build ---------- */
  function resize() {
    DPR = 1; // scenic gradient bg — retina not worth the fill cost
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    HORIZON = H * 0.66;
    buildScene();
    renderBase();
  }

  // sky gradient + hill silhouettes + water base: drawn once per resize,
  // blitted every frame (per-frame gradient fills were saturating the thread)
  function renderBase() {
    base.width = W; base.height = H;
    const g = bctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0.0, "#191430");
    g.addColorStop(0.42, "#46285c");
    g.addColorStop(0.72, "#9c4478");
    g.addColorStop(0.92, "#e57a5a");
    g.addColorStop(1.0, "#f2b06a");
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, W, HORIZON);
    for (const hl of hills) {
      bctx.fillStyle = hl.color;
      bctx.beginPath();
      bctx.moveTo(-20, HORIZON + 1);
      for (const p of hl.pts) bctx.lineTo(p.x * W, p.y);
      bctx.lineTo(W + 20, HORIZON + 1);
      bctx.closePath();
      bctx.fill();
    }
    const wg = bctx.createLinearGradient(0, HORIZON, 0, H);
    wg.addColorStop(0.0, "#d9946b");
    wg.addColorStop(0.12, "#a3527c");
    wg.addColorStop(0.45, "#3d2456");
    wg.addColorStop(1.0, "#141026");
    bctx.fillStyle = wg;
    bctx.fillRect(0, HORIZON, W, H - HORIZON);
  }

  function buildScene() {
    stars.length = 0;
    const nStars = mobile ? 60 : 140;
    for (let i = 0; i < nStars; i++) {
      const y = Math.pow(Math.random(), 1.7) * HORIZON * 0.75; // denser high up
      stars.push({
        x: Math.random() * W, y,
        r: rand(0.4, 1.4),
        tw: rand(0.5, 1.5),      // twinkle speed
        ph: rand(0, Math.PI * 2) // phase
      });
    }

    clouds.length = 0;
    const bands = [
      { y: 0.18, scale: 1.6, speed: 4.0, tint: "rgba(70, 40, 92, 0.55)" },   // violet, high
      { y: 0.34, scale: 1.2, speed: 7.5, tint: "rgba(156, 68, 120, 0.5)" },  // magenta, mid
      { y: 0.50, scale: 0.9, speed: 12,  tint: "rgba(229, 122, 90, 0.42)" }, // coral, low
    ];
    for (const band of bands) {
      const n = mobile ? 3 : 5;
      for (let i = 0; i < n; i++) {
        clouds.push({
          x: Math.random() * W * 1.4 - W * 0.2,
          y: band.y * HORIZON + rand(-20, 20),
          w: rand(160, 380) * band.scale,
          h: rand(22, 44) * band.scale,
          speed: band.speed * rand(0.7, 1.3), // px per second
          tint: band.tint,
          par: band.scale * 8, // parallax strength
        });
      }
    }

    motes.length = 0;
    const nMotes = mobile ? 8 : 18;
    for (let i = 0; i < nMotes; i++) {
      motes.push({
        x: Math.random() * W,
        y: rand(HORIZON * 0.5, H),
        r: rand(0.8, 1.8),
        vx: rand(-6, 6), vy: rand(-4, -1),
        ph: rand(0, Math.PI * 2),
      });
    }

    // two hill silhouette layers as point lists
    hills = [
      { pts: ridge(0.86, 0.055), color: "#2b1d45", par: 6 },  // far
      { pts: ridge(0.93, 0.075), color: "#1d1435", par: 12 }, // near
    ];
  }

  function ridge(base, amp) {
    // rolling ridge across the horizon; y values relative to HORIZON
    const pts = [];
    const n = 24;
    let y = rand(-amp, amp);
    for (let i = 0; i <= n; i++) {
      y = y * 0.6 + rand(-amp, amp) * 0.4;
      pts.push({ x: i / n, y });
    }
    return pts.map(p => ({ x: p.x, y: HORIZON * base + p.y * H }));
  }

  /* ---------- draw helpers ---------- */
  function drawSun(t) {
    const sx = W * 0.62 + pointer.px * -14;
    const sy = HORIZON - H * 0.03;
    const pulse = reduced ? 1 : 1 + Math.sin(t / 3200) * 0.05;
    const r = Math.min(W, H) * 0.16 * pulse;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, "rgba(255, 214, 150, 0.85)");
    g.addColorStop(0.35, "rgba(242, 176, 106, 0.35)");
    g.addColorStop(1, "rgba(242, 176, 106, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    return { sx, sy };
  }

  function drawStars(t) {
    ctx.save();
    for (const s of stars) {
      const a = reduced ? 0.7 : 0.35 + 0.5 * Math.abs(Math.sin(t / 1000 * s.tw + s.ph));
      const fade = 1 - s.y / (HORIZON * 0.9); // fade toward horizon
      ctx.globalAlpha = a * Math.max(fade, 0);
      ctx.fillStyle = "#f3ecf2";
      ctx.beginPath();
      ctx.arc(s.x + pointer.px * -6, s.y + pointer.py * -4, s.r, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClouds(dt) {
    for (const c of clouds) {
      if (!reduced) {
        c.x += c.speed * dt;
        if (c.x - c.w > W) c.x = -c.w;
      }
      const x = c.x + pointer.px * -c.par;
      const y = c.y + pointer.py * -c.par * 0.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, c.w / 2);
      g.addColorStop(0, c.tint);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, c.h / c.w * 2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, c.w / 2, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWater(t, sun) {
    // sun pillar
    const pw = Math.min(W, H) * 0.09;
    const pg = ctx.createLinearGradient(0, HORIZON, 0, H);
    pg.addColorStop(0, "rgba(255, 210, 150, 0.4)");
    pg.addColorStop(0.5, "rgba(242, 176, 106, 0.12)");
    pg.addColorStop(1, "rgba(242, 176, 106, 0)");
    ctx.save();
    ctx.fillStyle = pg;
    const wob = reduced ? 0 : Math.sin(t / 900) * pw * 0.12;
    ctx.beginPath();
    ctx.moveTo(sun.sx - pw / 2 + wob, HORIZON);
    ctx.lineTo(sun.sx + pw / 2 + wob, HORIZON);
    ctx.lineTo(sun.sx + pw * 1.6, H);
    ctx.lineTo(sun.sx - pw * 1.6, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // shimmer bands
    if (!reduced) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#f2b06a";
      const rows = mobile ? 10 : 22;
      for (let i = 0; i < rows; i++) {
        const frac = i / rows;
        const y = HORIZON + frac * (H - HORIZON);
        const len = 30 + 160 * frac;
        const x = (Math.sin(t / (1400 + i * 130) + i * 2.1) * 0.5 + 0.5) * (W - len);
        ctx.fillRect(x, y, len, 1 + frac * 1.6);
      }
      ctx.restore();
    }
  }

  function drawRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      const life = r.age / r.max;
      if (life >= 1) { ripples.splice(i, 1); continue; }
      const radius = 6 + life * r.spread;
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - life);
      ctx.strokeStyle = "#f2c48f";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, radius, radius * 0.28, 0, 0, 7); // perspective squash
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMotes(t, dt) {
    ctx.save();
    for (const m of motes) {
      if (!reduced) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.y < HORIZON * 0.45 || m.x < -10 || m.x > W + 10) {
          m.x = Math.random() * W; m.y = rand(H * 0.75, H); m.vy = rand(-4, -1);
        }
      }
      ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(t / 800 + m.ph));
      ctx.fillStyle = "#f2c48f";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx * dt; m.y += m.vy * dt; m.age += dt;
      if (m.age > m.max) { meteors.splice(i, 1); continue; }
      const a = 1 - m.age / m.max;
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      const tail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
      tail.addColorStop(0, "#fff3dd");
      tail.addColorStop(1, "rgba(255, 243, 221, 0)");
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 0.18, m.y - m.vy * 0.18);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- main loop ---------- */
  let last = 0;
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;

    // eased pointer parallax
    if (!reduced) {
      pointer.px += ((pointer.x - 0.5) * 2 - pointer.px) * 0.04;
      pointer.py += ((pointer.y - 0.5) * 2 - pointer.py) * 0.04;
    }

    ctx.drawImage(base, 0, 0);
    drawStars(t);
    const sun = drawSun(t);
    drawClouds(dt);
    drawWater(t, sun);
    drawRipples(dt);
    drawMotes(t, dt);
    drawMeteors(dt);

    if (!reduced) setTimeout(() => requestAnimationFrame(frame), 33); // ~30fps is plenty
  }

  /* ---------- input ---------- */
  let lastRipple = 0;
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / W;
    pointer.y = e.clientY / H;
    if (reduced) return;
    // ripples only over the water
    if (e.clientY > HORIZON && performance.now() - lastRipple > 120) {
      lastRipple = performance.now();
      ripples.push({ x: e.clientX, y: e.clientY, age: 0, max: rand(1.2, 1.8), spread: rand(30, 70) });
      if (ripples.length > 24) ripples.shift();
    }
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    if (reduced) return;
    if (e.clientY <= HORIZON) {
      // shooting star from near the click, arcing down-right
      meteors.push({
        x: e.clientX + rand(-40, 40), y: Math.max(e.clientY - rand(30, 80), 10),
        vx: rand(320, 520), vy: rand(120, 220),
        age: 0, max: rand(0.5, 0.8),
      });
    } else {
      ripples.push({ x: e.clientX, y: e.clientY, age: 0, max: 2.2, spread: 110 });
    }
  }, { passive: true });

  addEventListener("resize", resize);

  /* ---------- grain tile (procedural, tiny) ---------- */
  function makeGrain() {
    const g = document.createElement("canvas");
    g.width = g.height = 96;
    const gctx = g.getContext("2d");
    const img = gctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 20 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    gctx.putImageData(img, 0, 0);
    document.querySelector(".grain").style.backgroundImage = `url(${g.toDataURL()})`;
  }

  /* ---------- go ---------- */
  resize();
  makeGrain();
  if (reduced) {
    frame(0); // single static frame
  } else {
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }
})();
