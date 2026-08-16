/* Wallpaper Engine waterflow + ripple + godrays.
   Background plate is layer_02 only. Dock/figure sit on top, undistorted.
   Screen Y is top-down; GL vUv.y is bottom-up. Ripple coords must flip Y. */

(() => {
  const canvas = document.getElementById("dusk");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    || location.search.includes("static");
  const mobile = matchMedia("(max-width: 640px)").matches;
  const dprCap = mobile ? 1.5 : 3;

  const plate = new Image();
  const flow = new Image();
  const dock = new Image();
  const front = new Image();
  const train = new Image();
  const reflect = new Image();
  plate.src = "assets/station.jpg";
  flow.src = "assets/flow.jpg";
  dock.src = "assets/dock.png";
  front.src = "assets/front.png";
  train.src = "assets/train.png";
  reflect.src = "assets/reflect.png";
  const TRAIN_Y0 = 0.35782, TRAIN_Y1 = 0.45320;
  const REFL_Y0 = 0.25770, REFL_Y1 = 0.34834;
  // Dock last opaque row is image y=1101. uv.y = 1 - y/1688.
  const WATER_HI = 0.34775;
  const TRAIN_SCROLL = 0.04;

  const pointer = { x: 0.5, y: 0.5, px: 0, py: 0 };
  const ripples = [];
  const MAX_R = 8;
  const rand = (a, b) => a + Math.random() * (b - a);

  const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPlate;
uniform sampler2D uFlow;
uniform sampler2D uDock;
uniform sampler2D uFront;
uniform sampler2D uTrain;
uniform sampler2D uReflect;
uniform vec2 uRes;
uniform vec2 uTex;
uniform vec2 uTrainY;
uniform vec2 uReflY;
uniform float uTime;
uniform vec2 uParallax;
uniform vec4 uRipples[8];
uniform int uRippleN;
uniform float uReduced;
uniform float uScroll;
uniform float uWaterHi;

vec2 coverUv(vec2 uv) {
  float va = uRes.x / uRes.y;
  float ia = uTex.x / uTex.y;
  vec2 c = uv;
  if (va > ia) {
    float s = ia / va;
    c.y = (uv.y - 0.5) * s + 0.5;
  } else {
    float s = va / ia;
    c.x = (uv.x - 0.5) * s + 0.5;
  }
  c += uParallax * vec2(-0.010, 0.006);
  return c;
}

vec2 rippleOff(vec2 uv) {
  vec2 acc = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 r = uRipples[i];
    float life = r.z;
    vec2 d = uv - r.xy;
    float dist = length(d);
    float radius = life * 0.10;
    float band = exp(-((dist - radius) * (dist - radius)) / 0.00028);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
    acc += dir * band * (1.0 - life) * r.w;
  }
  return acc;
}

vec4 overlayTex(vec4 col, sampler2D tex, vec2 uv) {
  vec4 t = texture2D(tex, uv);
  return mix(col, t, t.a);
}

vec4 overlayTrain(vec4 col, vec2 sampleUv, float scroll) {
  float ty = (sampleUv.y - uTrainY.x) / max(uTrainY.y - uTrainY.x, 0.0001);
  vec4 tr = texture2D(uTrain, vec2(fract(sampleUv.x + scroll), ty));
  tr.a *= step(0.0, ty) * step(ty, 1.0);
  return mix(col, tr, tr.a);
}

vec4 overlayRefl(vec4 col, vec2 sampleUv, float scroll) {
  float ry = (sampleUv.y - uReflY.x) / max(uReflY.y - uReflY.x, 0.0001);
  vec4 rf = texture2D(uReflect, vec2(fract(sampleUv.x + scroll), ry));
  rf.a *= step(0.0, ry) * step(ry, 1.0);
  return mix(col, rf, rf.a);
}

void main() {
  vec2 uv = coverUv(vUv);
  if (uReduced > 0.5) {
    vec4 still = texture2D(uPlate, uv);
    still = overlayTex(still, uDock, uv);
    still = overlayTrain(still, uv, 0.0);
    still = overlayRefl(still, uv, 0.0);
    still = overlayTex(still, uFront, uv);
    gl_FragColor = still;
    return;
  }

  vec2 flowCol = texture2D(uFlow, uv).rg;
  vec2 flowMask = (flowCol - vec2(0.498, 0.498)) * 2.0;
  float flowAmt = length(flowMask);
  float water = step(uv.y, uWaterHi);

  float t = uTime * 0.59;
  vec4 cycles = vec4(fract(t), fract(t + 0.5), fract(t + 0.25), fract(t + 0.75));
  float blend = 2.0 * abs(cycles.x - 0.5);
  float blend2 = 2.0 * abs(cycles.z - 0.5);
  cycles -= 0.5;
  vec2 amp = flowMask * 0.10;
  amp.y *= 1.0 - water;
  vec2 o1 = amp * cycles.x;
  vec2 o2 = amp * cycles.y;
  vec2 o3 = amp * cycles.z;
  vec2 o4 = amp * cycles.w;

  vec2 extra = vec2(rippleOff(vUv).x * water, 0.0);
  vec2 base = uv + extra;

  vec4 a0 = texture2D(uPlate, base);
  vec4 f1 = mix(texture2D(uPlate, base + o1), texture2D(uPlate, base + o2), blend);
  vec4 f2 = mix(texture2D(uPlate, base + o3), texture2D(uPlate, base + o4), blend2);
  float phase = texture2D(uFlow, uv * 4.44).r;
  vec4 flowed = mix(f1, f2, smoothstep(0.2, 0.8, phase));
  vec4 col = mix(a0, flowed, clamp(flowAmt, 0.0, 1.0));

  float scroll = uTime * uScroll;
  col = overlayTex(col, uDock, uv);
  col = overlayTrain(col, uv, scroll);
  col = overlayRefl(col, vec2(base.x, uv.y), scroll);
  col = overlayTex(col, uFront, uv);

  vec2 sun = vec2(0.807, 0.509) + uParallax * vec2(-0.004, 0.0);
  vec2 from = uv - sun;
  float dist = length(from);
  float ang = atan(from.y, from.x);
  float rays = pow(abs(sin(ang * 7.0 + uTime * 0.12)), 10.0);
  float fall = exp(-dist * 3.2);
  col.rgb += vec3(0.992, 0.60, 0.588) * rays * fall * 0.11;

  gl_FragColor = col;
}`;

  let gl, prog, locs, buf, W, H, dpr = 1, ready = false;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "shader");
    }
    return s;
  }

  function initGl() {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) return false;
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link");
    }
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    locs = {
      uPlate: gl.getUniformLocation(prog, "uPlate"),
      uFlow: gl.getUniformLocation(prog, "uFlow"),
      uDock: gl.getUniformLocation(prog, "uDock"),
      uFront: gl.getUniformLocation(prog, "uFront"),
      uTrain: gl.getUniformLocation(prog, "uTrain"),
      uReflect: gl.getUniformLocation(prog, "uReflect"),
      uRes: gl.getUniformLocation(prog, "uRes"),
      uTex: gl.getUniformLocation(prog, "uTex"),
      uTrainY: gl.getUniformLocation(prog, "uTrainY"),
      uReflY: gl.getUniformLocation(prog, "uReflY"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uParallax: gl.getUniformLocation(prog, "uParallax"),
      uRippleN: gl.getUniformLocation(prog, "uRippleN"),
      uReduced: gl.getUniformLocation(prog, "uReduced"),
      uScroll: gl.getUniformLocation(prog, "uScroll"),
      uWaterHi: gl.getUniformLocation(prog, "uWaterHi"),
      uRipples: [],
    };
    for (let i = 0; i < MAX_R; i++) {
      locs.uRipples[i] = gl.getUniformLocation(prog, "uRipples[" + i + "]");
    }
    upload(plate, 0, false);
    upload(flow, 1, false);
    upload(dock, 2, true);
    upload(front, 3, true);
    upload(train, 4, true);
    upload(reflect, 5, true);
    gl.uniform1i(locs.uPlate, 0);
    gl.uniform1i(locs.uFlow, 1);
    gl.uniform1i(locs.uDock, 2);
    gl.uniform1i(locs.uFront, 3);
    gl.uniform1i(locs.uTrain, 4);
    gl.uniform1i(locs.uReflect, 5);
    gl.uniform2f(locs.uTex, plate.naturalWidth, plate.naturalHeight);
    gl.uniform2f(locs.uTrainY, TRAIN_Y0, TRAIN_Y1);
    gl.uniform2f(locs.uReflY, REFL_Y0, REFL_Y1);
    gl.uniform1f(locs.uReduced, reduced ? 1 : 0);
    gl.uniform1f(locs.uScroll, reduced ? 0 : TRAIN_SCROLL);
    gl.uniform1f(locs.uWaterHi, WATER_HI);
    return true;
  }

  function upload(img, unit, rgba) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fmt = rgba ? gl.RGBA : gl.RGB;
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, img);
    return t;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function paint(t) {
    if (!gl || !ready) return;
    gl.uniform2f(locs.uRes, canvas.width, canvas.height);
    gl.uniform1f(locs.uTime, t);
    gl.uniform2f(locs.uParallax, pointer.px, pointer.py);
    const n = Math.min(ripples.length, MAX_R);
    gl.uniform1i(locs.uRippleN, n);
    for (let i = 0; i < MAX_R; i++) {
      const r = ripples[i];
      if (r) gl.uniform4f(locs.uRipples[i], r.x, r.y, r.age / r.max, r.amp);
      else gl.uniform4f(locs.uRipples[i], 0, 0, 1, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function draw2dStill() {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width, ch = canvas.height;
    const ia = plate.naturalWidth / plate.naturalHeight;
    const va = cw / ch;
    let dw, dh;
    if (va > ia) { dw = cw; dh = cw / ia; }
    else { dh = ch; dw = ch * ia; }
    ctx.fillStyle = "#121a4a";
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.drawImage(plate, dx, dy, dw, dh);
    if (dock.naturalWidth) ctx.drawImage(dock, dx, dy, dw, dh);
    const ph = plate.naturalHeight || 1688;
    if (train.naturalWidth) {
      const th = train.naturalHeight / ph * dh;
      const ty = dy + (1 - TRAIN_Y1) * dh;
      ctx.drawImage(train, dx, ty, dw, th);
    }
    if (reflect.naturalWidth) {
      const rh = reflect.naturalHeight / ph * dh;
      const ry = dy + (1 - REFL_Y1) * dh;
      ctx.drawImage(reflect, dx, ry, dw, rh);
    }
    if (front.naturalWidth) ctx.drawImage(front, dx, dy, dw, dh);
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reduced) {
      pointer.px += ((pointer.x - 0.5) * 2 - pointer.px) * 0.05;
      pointer.py += ((pointer.y - 0.5) * 2 - pointer.py) * 0.05;
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age += dt;
        if (ripples[i].age > ripples[i].max) ripples.splice(i, 1);
      }
    }
    paint(now / 1000);
    if (!reduced) requestAnimationFrame(frame);
  }

  function plateUv(nx, ny) {
    const va = W / Math.max(H, 1);
    const ia = (plate.naturalWidth || 3652) / (plate.naturalHeight || 1688);
    let x = nx;
    let y = 1 - ny;
    if (va > ia) {
      const s = ia / va;
      y = (y - 0.5) * s + 0.5;
    } else {
      const s = va / ia;
      x = (x - 0.5) * s + 0.5;
    }
    return { x, y };
  }

  function inWater(nx, ny) {
    return plateUv(nx, ny).y < WATER_HI;
  }

  let lastRipple = 0;
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / Math.max(W, 1);
    pointer.y = e.clientY / Math.max(H, 1);
    if (reduced || !ready || !inWater(pointer.x, pointer.y)) return;
    if (performance.now() - lastRipple > 110) {
      lastRipple = performance.now();
      ripples.push({
        x: pointer.x, y: 1 - pointer.y, age: 0,
        max: rand(0.9, 1.4), amp: rand(0.004, 0.007),
      });
      if (ripples.length > MAX_R) ripples.shift();
    }
  }, { passive: true });

  addEventListener("pointerdown", (e) => {
    if (reduced || !ready) return;
    pointer.x = e.clientX / Math.max(W, 1);
    pointer.y = e.clientY / Math.max(H, 1);
    if (!inWater(pointer.x, pointer.y)) return;
    ripples.push({
      x: pointer.x, y: 1 - pointer.y, age: 0,
      max: 1.6, amp: 0.012,
    });
    if (ripples.length > MAX_R) ripples.shift();
  }, { passive: true });

  addEventListener("resize", () => { resize(); if (ready && reduced) paint(0); });

  function makeGrain() {
    const g = document.createElement("canvas");
    g.width = g.height = 96;
    const gctx = g.getContext("2d");
    const imgd = gctx.createImageData(96, 96);
    for (let i = 0; i < imgd.data.length; i += 4) {
      const v = 118 + Math.random() * 20 | 0;
      imgd.data[i] = imgd.data[i + 1] = imgd.data[i + 2] = v;
      imgd.data[i + 3] = 14;
    }
    gctx.putImageData(imgd, 0, 0);
    document.querySelector(".grain").style.backgroundImage = `url(${g.toDataURL()})`;
  }

  function start() {
    resize();
    makeGrain();
    let ok = false;
    try { ok = initGl(); } catch (e) { ok = false; }
    ready = true;
    if (!ok) { draw2dStill(); return; }
    if (reduced) paint(0);
    else requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }

  let pending = 6;
  function one() { pending -= 1; if (pending === 0) start(); }
  plate.onload = one;
  flow.onload = one;
  dock.onload = one;
  front.onload = one;
  train.onload = one;
  reflect.onload = one;
  plate.onerror = one;
  flow.onerror = one;
  dock.onerror = one;
  front.onerror = one;
  train.onerror = one;
  reflect.onerror = one;
})();
