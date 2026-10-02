(() => {
  'use strict';

  // ---------------------------------------------------------------- roster
  const DEFAULT_NAMES = [
    'Ahmed Bahaa', 'Andrii Andrieiev', 'Andrii Sheremeta', 'Anna Tymofyeyeva', 'Danylo Baranov',
    'Khrystyna Bronevych', 'Kostiantyn Onyshchuk', 'Maksym Denysov', 'Maksym Onishko',
    'Mykhailo Kolpakov', 'Oleh Chobotar', 'Oleksandr Posmitiuha', 'Roman Lahodniuk',
    'Roman Vozniak', 'Stanislav Orlov', 'Uliana Skrynnyk', 'Vladyslav Haleta',
  ];
  const STORE_KEY = 'wtn.roster.v1';
  const SOUND_KEY = 'wtn.sound.v1';
  const TIMEBOX_KEY = 'wtn.timebox.v1';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  function loadRoster() {
    try {
      const r = JSON.parse(store.get(STORE_KEY));
      if (Array.isArray(r) && r.length) {
        return r.filter(p => p && typeof p.name === 'string' && p.name.trim())
          .map(p => ({ name: p.name.trim(), present: p.present !== false }));
      }
    } catch (e) { /* fall through */ }
    return DEFAULT_NAMES.map(name => ({ name, present: true }));
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  let roster = loadRoster().sort(byName);
  const saveRoster = () => store.set(STORE_KEY, JSON.stringify(roster));

  const initials = name => {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] || ''))).toUpperCase();
  };
  // Stable colour per person: hash the name into a hue.
  const hueFor = name => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h * 137.508) % 360;
  };
  const colorFor = name => `hsl(${hueFor(name)}, 78%, 62%)`;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const firstName = n => n.split(/\s+/)[0];
  const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  // ---------------------------------------------------------------- sound
  let soundOn = store.get(SOUND_KEY) !== 'off';
  let audio = null;
  let lastBlip = 0;
  let muteForSkip = false;
  function ac() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
    }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  function tone(freq, dur = 0.07, type = 'sine', vol = 0.04, when = 0) {
    if (!soundOn || muteForSkip) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function blip(x, strength, kind) {
    const now = performance.now();
    if (now - lastBlip < 40) return;
    lastBlip = now;
    if (kind === 'bumper') tone(220 + Math.random() * 60, 0.12, 'square', 0.03);
    else tone(500 + (x / W) * 900, 0.05, 'triangle', Math.min(0.05, 0.012 + strength / 12000));
  }
  const fanfare = place => {
    const base = place === 1 ? 523 : 392;
    [0, 4, 7, 12].forEach((s, i) => tone(base * Math.pow(2, s / 12), 0.16, 'triangle', 0.05, i * 0.07));
  };

  // ---------------------------------------------------------------- world
  const W = 640, R = 10, G = 980, L = 22, RW = W - 22;
  const FINISH_Y = 3300, WORLD_H = 3520;
  const STEP = 1 / 60, SUB = 6, MAXV = 760;

  let segs = [], pegs = [], spinners = [], bands = [], labels = [], gate = null;

  function seg(x1, y1, x2, y2, o = {}) {
    const s = { x1, y1, x2, y2, t: o.t ?? 3, e: o.e ?? 0.35, gate: !!o.gate, off: false };
    segs.push(s); return s;
  }
  const peg = (x, y, r, o = {}) => pegs.push({ x, y, r, e: o.e ?? 0.5, bumper: !!o.bumper, glow: 0 });
  const spinner = (x, y, len, w, a) => spinners.push({ x, y, len, w, a, t: 5, e: 0.4 });

  function buildTrack() {
    segs = []; pegs = []; spinners = []; labels = [];
    // outer walls
    seg(L, 0, L, WORLD_H); seg(RW, 0, RW, WORLD_H); seg(L, 0, RW, 0);
    // start box + gate
    gate = seg(L, 236, RW, 236, { gate: true, t: 4 });

    // 1. peg forest
    labels.push({ y: 300, text: 'PEG FOREST' });
    for (let row = 0, y = 330; y < 900; row++, y += 46) {
      const off = row % 2 ? 28 : 0;
      for (let x = L + 30 + off; x < RW - 18; x += 56) peg(x, y, 5);
    }

    // 2. switchbacks
    labels.push({ y: 945, text: 'SWITCHBACKS' });
    let y = 980;
    for (let i = 0; i < 5; i++, y += 150) {
      if (i % 2 === 0) seg(L, y, RW - 84, y + 100, { e: 0.25 });
      else seg(RW, y, L + 84, y + 100, { e: 0.25 });
      // a kicker peg on every ramp to break up the pack
      peg(i % 2 === 0 ? W * 0.45 : W * 0.55, y + 8, 6);
    }

    // 3. spinners
    labels.push({ y: 1730, text: 'SPINNERS' });
    [1820, 2010, 2200].forEach((sy, r) => {
      spinner(W * 0.3, sy, 92, r % 2 ? 1.9 : -1.9, r);
      spinner(W * 0.7, sy, 92, r % 2 ? -1.9 : 1.9, r + 1.3);
      for (const px of [W * 0.5, L + 30, RW - 30]) peg(px, sy + 95, 6);
    });

    // 4. bumper pit
    labels.push({ y: 2340, text: 'BUMPER PIT' });
    for (let row = 0, by = 2420; by < 2900; row++, by += 112) {
      const off = row % 2 ? 65 : 0;
      for (let bx = L + 70 + off; bx < RW - 40; bx += 130) peg(bx, by, 19, { bumper: true, e: 1.0 });
      for (let bx = L + 135 - off; bx < RW - 30; bx += 130) if (bx > L + 20) peg(bx, by + 56, 5);
    }

    // 5. funnel + chute + finish + bin
    labels.push({ y: 2955, text: 'THE FUNNEL' });
    seg(L, 2980, W / 2 - 42, 3200); seg(RW, 2980, W / 2 + 42, 3200);
    seg(W / 2 - 42, 3200, W / 2 - 42, 3270); seg(W / 2 + 42, 3200, W / 2 + 42, 3270);
    spinner(W / 2, 3110, 36, 3.2, 0);
    seg(L, 3440, W / 2, 3490, { e: 0.2 }); seg(W / 2, 3490, RW, 3440, { e: 0.2 });

    // broad-phase bands
    bands = [];
    const nb = Math.ceil(WORLD_H / 100) + 1;
    for (let i = 0; i < nb; i++) bands.push({ segs: [], pegs: [] });
    const addTo = (list, item, y0, y1) => {
      for (let b = Math.max(0, Math.floor(y0 / 100)); b <= Math.min(nb - 1, Math.floor(y1 / 100)); b++) bands[b][list].push(item);
    };
    for (const s of segs) addTo('segs', s, Math.min(s.y1, s.y2) - s.t - R - 2, Math.max(s.y1, s.y2) + s.t + R + 2);
    for (const p of pegs) addTo('pegs', p, p.y - p.r - R - 2, p.y + p.r + R + 2);
  }

  // ---------------------------------------------------------------- marbles
  let marbles = [];
  let finished = [];
  let simTime = 0;
  const particles = [];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function makeMarbles() {
    const players = shuffle(roster.filter(p => p.present).map(p => p.name));
    const cols = Math.max(1, Math.floor((RW - L - 20) / (2 * R + 12)));
    marbles = players.map((name, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const rowCount = Math.min(cols, players.length - r * cols);
      const span = (rowCount - 1) * (2 * R + 12);
      return {
        name, ini: initials(name), color: colorFor(name),
        x: W / 2 - span / 2 + c * (2 * R + 12) + (Math.random() - 0.5) * 4,
        y: 210 - r * (2 * R + 10),
        vx: 0, vy: 0, done: false, place: 0, bestY: 0, stuckT: 0, trail: [],
      };
    });
    finished = [];
    simTime = 0;
    particles.length = 0;
    gate.off = false;
  }

  // Circle vs capsule (segment with thickness). (wx,px,py) = angular velocity + pivot for moving parts.
  function hitCapsule(m, ax, ay, bx, by, t, e, w, px, py) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let u = ((m.x - ax) * dx + (m.y - ay) * dy) / len2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const cx = ax + dx * u, cy = ay + dy * u;
    return resolve(m, cx, cy, R + t, e, w ? -w * (cy - py) : 0, w ? w * (cx - px) : 0);
  }
  function resolve(m, cx, cy, rr, e, svx, svy) {
    let nx = m.x - cx, ny = m.y - cy;
    const d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr) return 0;
    const d = Math.sqrt(d2);
    if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
    m.x = cx + nx * rr; m.y = cy + ny * rr;
    let rvx = m.vx - svx, rvy = m.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    rvx -= vt * 0.0008 * tx; rvy -= vt * 0.0008 * ty;
    m.vx = rvx + svx; m.vy = rvy + svy;
    m._nx = nx; m._ny = ny;
    return -vn;
  }

  function substep(dt) {
    for (const s of spinners) s.a += s.w * dt;

    for (const m of marbles) {
      m.vy += G * dt;
      m.vx *= 0.9996; m.vy *= 0.9996;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > MAXV) { m.vx *= MAXV / sp; m.vy *= MAXV / sp; }
      m.x += m.vx * dt; m.y += m.vy * dt;

      const band = bands[Math.max(0, Math.min(bands.length - 1, Math.floor(m.y / 100)))];
      for (const s of band.segs) {
        if (s.off) continue;
        hitCapsule(m, s.x1, s.y1, s.x2, s.y2, s.t, s.e, 0, 0, 0);
      }
      for (const p of band.pegs) {
        const imp = resolve(m, p.x, p.y, R + p.r, p.e, 0, 0);
        if (imp > 40) {
          p.glow = 1;
          if (p.bumper) {
            // bumpers always fire the marble away with some punch
            const out = m.vx * m._nx + m.vy * m._ny;
            if (out < 420) { m.vx += (420 - out) * m._nx; m.vy += (420 - out) * m._ny; }
            shake = Math.min(6, shake + 2);
          }
          if (!m.done) blip(p.x, imp, p.bumper ? 'bumper' : 'peg');
        }
      }
      for (const s of spinners) {
        if (Math.abs(m.y - s.y) > s.len + R + s.t) continue;
        const ex = Math.cos(s.a) * s.len, ey = Math.sin(s.a) * s.len;
        hitCapsule(m, s.x - ex, s.y - ey, s.x + ex, s.y + ey, s.t, s.e, s.w, s.x, s.y);
      }
      // safety: never leave the track
      if (m.x < L + R) { m.x = L + R + 1; m.vx = Math.abs(m.vx); }
      if (m.x > RW - R) { m.x = RW - R - 1; m.vx = -Math.abs(m.vx); }
      if (m.y > WORLD_H) { m.y = WORLD_H - 40; m.vy = 0; }
    }

    // marble vs marble
    for (let i = 0; i < marbles.length; i++) {
      const a = marbles[i];
      for (let j = i + 1; j < marbles.length; j++) {
        const b = marbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx > 2 * R || dx < -2 * R || dy > 2 * R || dy < -2 * R) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, o = (2 * R - d) / 2;
        a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const k = -(1 + 0.6) * vn / 2;
          a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny;
        }
      }
    }
  }

  function step() {
    const dt = STEP / SUB;
    for (let i = 0; i < SUB; i++) substep(dt);
    simTime += STEP;

    for (const m of marbles) {
      if (!m.done && gate.off) {
        // unstick anyone parked for too long (balanced on a peg, wedged in a corner)
        if (m.y > m.bestY + 4) { m.bestY = m.y; m.stuckT = 0; }
        else if ((m.stuckT += STEP) > 2.2) {
          m.vx = (Math.random() - 0.5) * 420; m.vy = -260; m.stuckT = 0; m.bestY = m.y;
        }
        if (m.y > FINISH_Y) finish(m);
      }
    }
    for (const p of pegs) if (p.glow > 0) p.glow = Math.max(0, p.glow - STEP * 3);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 500 * STEP; p.x += p.vx * STEP; p.y += p.vy * STEP; p.life -= STEP;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // hard stop: if the race drags on, rank the stragglers by how far they got
    if (simTime > 150) marbles.filter(m => !m.done).sort((a, b) => b.y - a.y).forEach(finish);
  }

  function finish(m) {
    m.done = true;
    finished.push(m);
    m.place = finished.length;
    if (!muteForSkip) {
      burst(m.x, FINISH_Y, m.color, m.place === 1 ? 70 : 22);
      fanfare(m.place);
      toast(m);
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 320;
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: 0.8 + Math.random() * 0.8,
        color: i % 3 === 0 ? '#ffc93c' : color, size: 2 + Math.random() * 3,
      });
    }
  }

  // ---------------------------------------------------------------- render
  const canvas = document.getElementById('track');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, scale = 1, offX = 0, camY = 0, shake = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(1, r.width); ch = Math.max(1, r.height);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    scale = Math.min(1.3, (cw - 24) / W);
    offX = (cw - W * scale) / 2;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const viewH = () => ch / scale;

  function updateCamera(dt) {
    let target;
    if (state === 'ready' || state === 'countdown') target = 0;
    else {
      const live = marbles.filter(m => !m.done);
      target = live.length ? Math.max(...live.map(m => m.y)) - viewH() * 0.42 : WORLD_H;
    }
    target = Math.max(0, Math.min(WORLD_H - viewH() + 10, target));
    camY += (target - camY) * Math.min(1, dt * 3.5);
  }

  function draw() {
    const vh = viewH();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e1c';
    ctx.fillRect(0, 0, cw, ch);

    const sx = reduceMotion ? 0 : (Math.random() - 0.5) * shake, sy = reduceMotion ? 0 : (Math.random() - 0.5) * shake;
    shake *= 0.9;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + sx), dpr * (-camY * scale + sy));
    const top = camY - 40, bot = camY + vh + 40;

    // track surface
    ctx.fillStyle = '#131833';
    ctx.fillRect(L, Math.max(0, top), RW - L, bot - top);
    // faint lane grid
    ctx.strokeStyle = 'rgba(141,147,189,0.06)'; ctx.lineWidth = 1;
    for (let gy = Math.floor(top / 80) * 80; gy < bot; gy += 80) {
      ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(RW, gy); ctx.stroke();
    }

    // section labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 34px Bungee, Impact, sans-serif';
    ctx.fillStyle = 'rgba(141,147,189,0.16)';
    for (const l of labels) if (l.y > top && l.y < bot) ctx.fillText(l.text, W / 2, l.y);

    // finish line
    if (FINISH_Y > top && FINISH_Y < bot) {
      const sq = 10;
      for (let x = W / 2 - 42, i = 0; x < W / 2 + 42; x += sq, i++) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = (i + r) % 2 ? '#eceeff' : '#0b0e1c';
          ctx.fillRect(x, FINISH_Y - sq + r * sq, Math.min(sq, W / 2 + 42 - x), sq);
        }
      }
      ctx.font = '400 18px Bungee, Impact, sans-serif';
      ctx.fillStyle = '#ffc93c';
      ctx.fillText('FINISH', W / 2, FINISH_Y + 34);
    }

    // walls
    ctx.lineCap = 'round';
    for (const s of segs) {
      if (s.off || Math.max(s.y1, s.y2) < top || Math.min(s.y1, s.y2) > bot) continue;
      ctx.strokeStyle = s.gate ? '#ffc93c' : '#5b67b8';
      ctx.lineWidth = s.t * 2;
      if (s.gate) ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // pegs and bumpers
    for (const p of pegs) {
      if (p.y < top || p.y > bot) continue;
      if (p.bumper) {
        const g = p.glow;
        ctx.fillStyle = g > 0 ? `rgba(255,201,60,${0.25 + g * 0.6})` : 'rgba(255,93,115,0.18)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + g * 4, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = g > 0 ? '#ffc93c' : '#ff5d73';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = g > 0 ? '#ffc93c' : '#ff5d73';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        if (p.glow > 0) {
          ctx.fillStyle = `rgba(255,201,60,${p.glow * 0.45})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7 * p.glow, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = p.glow > 0.3 ? '#ffc93c' : '#aab3e8';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // spinners
    for (const s of spinners) {
      if (s.y + s.len < top || s.y - s.len > bot) continue;
      const ex = Math.cos(s.a) * s.len, ey = Math.sin(s.a) * s.len;
      ctx.strokeStyle = '#7f8cf0'; ctx.lineWidth = s.t * 2;
      ctx.beginPath(); ctx.moveTo(s.x - ex, s.y - ey); ctx.lineTo(s.x + ex, s.y + ey); ctx.stroke();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // marbles
    for (const m of marbles) {
      if (m.y < top - 30 || m.y > bot + 30) continue;
      if (m.trail.length > 1) {
        ctx.strokeStyle = m.color; ctx.lineCap = 'round';
        for (let i = 1; i < m.trail.length; i++) {
          ctx.globalAlpha = (i / m.trail.length) * 0.35;
          ctx.lineWidth = R * 2 * (i / m.trail.length) * 0.8;
          ctx.beginPath(); ctx.moveTo(m.trail[i - 1][0], m.trail[i - 1][1]); ctx.lineTo(m.trail[i][0], m.trail[i][1]); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      const grd = ctx.createRadialGradient(m.x - R * 0.35, m.y - R * 0.4, 1, m.x, m.y, R);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, m.color); grd.addColorStop(1, shade(m.color));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10131f';
      ctx.font = '800 8.5px Figtree, system-ui, sans-serif';
      ctx.fillText(m.ini, m.x, m.y + 0.5);
    }

    // leader name tag
    if (state === 'racing') {
      const live = marbles.filter(m => !m.done);
      if (live.length) {
        const lead = live.reduce((a, b) => (b.y > a.y ? b : a));
        tag(lead.x, lead.y - R - 10, firstName(lead.name), '#ffc93c');
        if (live.length === 1 && marbles.length > 1) tag(lead.x, lead.y + R + 16, 'last one!', '#ff5d73');
      }
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawMinimap();
  }

  function tag(x, y, text, color) {
    ctx.font = '800 11px Figtree, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(11,14,28,0.85)';
    roundRect(x - w / 2, y - 9, w, 18, 9); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 0.5);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const shadeCache = new Map();
  function shade(c) {
    if (!shadeCache.has(c)) shadeCache.set(c, c.replace(/(\d+)%\)$/, (_, l) => `${Math.round(l * 0.55)}%)`));
    return shadeCache.get(c);
  }

  function drawMinimap() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = cw - 14, y0 = 14, h = ch - 28;
    ctx.fillStyle = 'rgba(42,49,96,0.8)';
    roundRect(x - 3, y0, 6, h, 3); ctx.fill();
    const vh = viewH();
    ctx.fillStyle = 'rgba(236,238,255,0.18)';
    ctx.fillRect(x - 5, y0 + (camY / WORLD_H) * h, 10, (vh / WORLD_H) * h);
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect(x - 6, y0 + (FINISH_Y / WORLD_H) * h - 1, 12, 2);
    for (const m of marbles) {
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(x, y0 + (Math.min(m.y, WORLD_H) / WORLD_H) * h, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- UI
  const $ = id => document.getElementById(id);
  const startBtn = $('startBtn'), startBtn2 = $('startBtn2'), skipBtn = $('skipBtn');
  const soundBtn = $('soundBtn'), rosterBtn = $('rosterBtn');
  const startCard = $('startCard'), countdownEl = $('countdown'), toastsEl = $('toasts');
  const panelReady = $('panelReady'), panelRace = $('panelRace'), panelMeet = $('panelMeet');

  let state = 'ready';
  let speed = 1;
  let speakers = [], cur = 0, turnStart = 0;
  let timebox = parseInt(store.get(TIMEBOX_KEY), 10) || 120;
  $('timebox').value = String(timebox);
  if (!$('timebox').value) { $('timebox').value = '120'; timebox = 120; }

  const marbleChip = (name, cls = '') =>
    `<span class="marble ${cls}" style="--c:${colorFor(name)}">${esc(initials(name))}</span>`;

  function setState(s) {
    state = s;
    panelReady.hidden = s !== 'ready' && s !== 'countdown';
    panelRace.hidden = s !== 'racing';
    panelMeet.hidden = s !== 'meeting';
    startCard.hidden = s !== 'ready';
    skipBtn.disabled = s !== 'racing' && s !== 'countdown';
    startBtn.disabled = s === 'countdown' || s === 'racing';
    startBtn.firstChild.textContent = s === 'meeting' ? 'Race again ' : 'Start race ';
  }

  function renderGrid() {
    const present = roster.filter(p => p.present);
    $('gridList').innerHTML = present.map(p =>
      `<li><span class="rk"></span>${marbleChip(p.name)}<span class="nm">${esc(p.name)}</span><span></span></li>`).join('');
    $('rosterCount').textContent = String(present.length);
    $('startCount').textContent = String(present.length);
    const ok = present.length >= 2;
    startBtn2.disabled = !ok;
    if (state === 'ready') startBtn.disabled = !ok;
  }

  let lastStand = 0;
  function renderStandings(force) {
    const now = performance.now();
    if (!force && now - lastStand < 180) return;
    lastStand = now;
    const order = finished.concat(marbles.filter(m => !m.done).sort((a, b) => b.y - a.y));
    $('standList').innerHTML = order.map((m, i) => `<li class="${m.done ? 'done' : 'racing'}">
      <span class="rk">${i + 1}</span>${marbleChip(m.name)}<span class="nm">${esc(m.name)}</span>
      <span class="tag">${m.done ? '✓' : Math.max(0, Math.round((FINISH_Y - m.y) / 10)) + 'm'}</span></li>`).join('');
    $('raceClock').textContent = simTime.toFixed(1) + 's';
  }

  function toast(m) {
    const el = document.createElement('div');
    el.className = 'toast' + (m.place === 1 ? ' first' : '');
    el.innerHTML = `${marbleChip(m.name)}<span class="pos">${ordinal(m.place)}</span><span>${esc(m.name)}</span>`;
    toastsEl.prepend(el);
    while (toastsEl.children.length > 4) toastsEl.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  function startRace() {
    if (state === 'countdown' || state === 'racing') return;
    if (roster.filter(p => p.present).length < 2) { openRoster(); return; }
    ac();
    toastsEl.innerHTML = '';
    makeMarbles();
    camY = 0;
    setState('countdown');
    let n = 3;
    const tick = () => {
      countdownEl.hidden = false;
      countdownEl.textContent = n > 0 ? String(n) : 'GO!';
      countdownEl.classList.remove('pop'); void countdownEl.offsetWidth; countdownEl.classList.add('pop');
      tone(n > 0 ? 440 : 880, n > 0 ? 0.12 : 0.3, 'square', 0.04);
      if (n > 0) { n--; countdownTimer = setTimeout(tick, 800); }
      else {
        gate.off = true;
        for (const m of marbles) { m.vx = (Math.random() - 0.5) * 60; m.bestY = m.y; }
        setState('racing');
        renderStandings(true);
        countdownTimer = setTimeout(() => { countdownEl.hidden = true; }, 800);
      }
    };
    tick();
  }
  let countdownTimer = 0;

  function skipRace() {
    if (state === 'countdown') {
      clearTimeout(countdownTimer);
      countdownEl.hidden = true;
      gate.off = true;
      setState('racing');
    }
    if (state !== 'racing') return;
    muteForSkip = true;
    while (finished.length < marbles.length) step();
    muteForSkip = false;
    toastsEl.innerHTML = '';
    burst(W / 2, FINISH_Y, '#ffc93c', 60);
    fanfare(1);
    endRace();
  }

  let endTimer = 0;
  function endRace() {
    if (state !== 'racing') return;
    state = 'ending';
    renderStandings(true);
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      speakers = finished.map(m => m.name);
      cur = 0; turnStart = meetStart = performance.now();
      talk = speakers.map(() => 0); doneAt = 0; popT = 0; flyer = null; fx.length = 0; sand.key = '';
      setState('meeting');
      renderMeeting(true);
    }, 1400);
  }

  function renderMeeting(flash) {
    const name = speakers[cur];
    const done = cur >= speakers.length;
    $('speakerName').textContent = done ? 'Round complete' : name;
    $('speakerMarble').style.setProperty('--c', done ? '#ffc93c' : colorFor(name));
    $('speakerMarble').textContent = done ? '✓' : initials(name);
    $('turnPos').textContent = done ? `${speakers.length} of ${speakers.length}` : `${cur + 1} of ${speakers.length}`;
    $('upNext').textContent = cur + 1 < speakers.length ? speakers[cur + 1] : (done ? '—' : 'Nobody, wrap it up');
    $('nextBtn').firstChild.textContent = cur + 1 >= speakers.length ? 'Finish round ' : 'Next speaker ';
    $('nextBtn').disabled = done;
    $('prevBtn').disabled = cur === 0;
    $('queueList').innerHTML = speakers.map((n, i) => `<li data-i="${i}" class="${i < cur ? 'spoke' : i === cur ? 'current' : ''}">
      <span class="rk">${i + 1}</span>${marbleChip(n)}<span class="nm">${esc(n)}</span><span class="tag">${i < cur ? fmt(talk[i] || 0) : i === cur ? 'now' : ''}</span></li>`).join('');
    if (flash) {
      const card = $('speakerCard');
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    }
    updateTimer();
  }

  function updateTimer() {
    if (state !== 'meeting') return;
    const done = cur >= speakers.length;
    const secs = done ? 0 : Math.floor((performance.now() - turnStart) / 1000);
    const over = secs > timebox;
    $('turnTimer').textContent = done ? '—' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    $('turnTimer').classList.toggle('over', over);
    $('turnMeter').parentElement.classList.toggle('over', over);
    $('turnMeter').style.width = done ? '100%' : Math.min(100, (secs / timebox) * 100) + '%';
  }
  setInterval(updateTimer, 250);

  function goTo(i) {
    if (state !== 'meeting') return;
    const now = performance.now();
    if (cur < speakers.length) talk[cur] += (now - turnStart) / 1000;
    const prev = cur;
    cur = Math.max(0, Math.min(speakers.length, i));
    if (cur === prev) return;
    turnStart = now;
    popT = 0;
    fx.length = 0;
    // the speaker who just finished rolls into the tray
    flyer = cur === prev + 1 && prev < speakers.length && lastSpot
      ? { i: prev, x: lastSpot.x, y: lastSpot.y, r: lastSpot.r, t: 0 } : null;
    if (cur < speakers.length) { doneAt = 0; tone(660, 0.1, 'triangle', 0.04); }
    else { doneAt = now; flyer = null; fanfare(1); if (!reduceMotion) spawnConfetti(140, 0, cw); }
    renderMeeting(true);
  }

  // roster dialog
  const dlg = $('rosterDlg');
  function renderRoster() {
    $('rosterList').innerHTML = roster.map((p, i) => `<li class="${p.present ? '' : 'off'}">
      <input type="checkbox" id="rp${i}" data-i="${i}" ${p.present ? 'checked' : ''}>
      ${marbleChip(p.name)}
      <label for="rp${i}">${esc(p.name)}</label>
      <button type="button" class="rm" data-rm="${i}" aria-label="Remove ${esc(p.name)}">×</button></li>`).join('');
  }
  function rosterChanged() {
    saveRoster(); renderRoster(); renderGrid();
    if (state === 'ready') makeMarbles();
  }
  function openRoster() {
    renderRoster();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  $('rosterList').addEventListener('change', e => {
    const i = e.target.dataset.i;
    if (i != null) { roster[i].present = e.target.checked; rosterChanged(); }
  });
  $('rosterList').addEventListener('click', e => {
    const i = e.target.dataset.rm;
    if (i != null) { roster.splice(+i, 1); rosterChanged(); }
  });
  const addPlayer = () => {
    const v = $('addName').value.trim();
    if (!v) return;
    roster.push({ name: v, present: true });
    roster.sort(byName);
    $('addName').value = '';
    rosterChanged();
  };
  $('addBtn').addEventListener('click', addPlayer);
  $('addName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPlayer(); } });
  $('resetRoster').addEventListener('click', () => {
    roster = DEFAULT_NAMES.map(name => ({ name, present: true }));
    rosterChanged();
  });
  rosterBtn.addEventListener('click', openRoster);

  // controls
  startBtn.addEventListener('click', () => { if (state === 'meeting') raceAgain(); else startRace(); });
  startBtn2.addEventListener('click', startRace);
  skipBtn.addEventListener('click', skipRace);
  $('nextBtn').addEventListener('click', () => goTo(cur + 1));
  $('prevBtn').addEventListener('click', () => goTo(cur - 1));
  $('queueList').addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li) goTo(+li.dataset.i);
  });
  $('timebox').addEventListener('change', e => { timebox = +e.target.value; store.set(TIMEBOX_KEY, String(timebox)); updateTimer(); });
  function raceAgain() {
    clearTimeout(endTimer);
    setState('ready');
    makeMarbles();
    startRace();
  }
  $('againBtn').addEventListener('click', raceAgain);

  document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => {
    speed = +b.dataset.speed;
    document.querySelectorAll('.seg-btn').forEach(o => o.classList.toggle('is-on', o === b));
  }));

  function paintSound() {
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; store.set(SOUND_KEY, soundOn ? 'on' : 'off'); paintSound();
    if (soundOn) tone(660, 0.08, 'triangle', 0.04);
  });
  paintSound();

  document.addEventListener('keydown', e => {
    if (dlg.open || e.target.closest('input, select, textarea')) return;
    if (e.key === 'Enter' && (state === 'ready')) { e.preventDefault(); startRace(); }
    else if ((e.key === ' ' || e.key === 'ArrowRight') && state === 'meeting') { e.preventDefault(); goTo(cur + 1); }
    else if (e.key === 'ArrowLeft' && state === 'meeting') { e.preventDefault(); goTo(cur - 1); }
    else if ((e.key === 'r' || e.key === 'R') && state === 'meeting') raceAgain();
    else if (e.key === 's' && (state === 'racing' || state === 'countdown')) skipRace();
  });

  // ---------------------------------------------------------------- meeting stage
  // While people talk the canvas shows the speaker's marble under a spotlight, a sand hourglass
  // in their colour that drains over the time-box, the next speaker warming up and a tray of
  // everyone who has spoken. After the last speaker it shows the round's scoreboard.
  function hslRgb(h, s, l) {
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  const rgbFor = name => hslRgb(hueFor(name), 0.78, 0.62);
  const HOT = [255, 70, 60];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgbStr = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const fmt = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  const sand = { key: '', C: 0, Rr: 0, cs: 0, mid: 0, maxW: 0, mask: null, grid: null, N: 0, passed: 0, off: null, octx: null, img: null, pal: null };
  const fx = [];
  let talk = [], meetStart = 0, doneAt = 0, popT = 1, flyer = null, clock = 0, lastSpot = null;

  const hgW = (u, maxW, neck) => neck + (maxW - neck) * Math.pow(Math.sin(Math.min(1, u * 1.12) * Math.PI / 2), 0.75);

  function buildSand(hh, frac, name) {
    const cs = Math.max(3, Math.round(hh / 110));
    let Rr = Math.floor(hh / cs); if (Rr % 2) Rr--;
    const mid = Rr / 2, maxW = Math.floor(Rr * 0.3), C = maxW * 2 + 2;
    const mask = new Uint8Array(C * Rr), grid = new Uint8Array(C * Rr);
    for (let r = 0; r < Rr; r++) {
      const w = hgW(Math.abs(r + 0.5 - mid) / mid, maxW, 1.2);
      for (let c = 0; c < C; c++) if (Math.abs(c + 0.5 - C / 2) < w) mask[r * C + c] = 1;
    }
    let topCells = 0;
    for (let i = 0; i < mid * C; i++) topCells += mask[i];
    const N = Math.floor(topCells * 0.8), drained = Math.round(N * frac);
    const fill = (r0, dir, count) => {
      for (let r = r0; count > 0 && r >= 0 && r < Rr; r += dir)
        for (let c = 0; c < C && count > 0; c++) if (mask[r * C + c]) { grid[r * C + c] = 1 + (Math.random() * 4 | 0); count--; }
    };
    fill(mid - 1, -1, N - drained);
    fill(Rr - 1, -1, drained);
    const off = sand.off || document.createElement('canvas');
    off.width = C; off.height = Rr;
    const octx = off.getContext('2d');
    const base = rgbFor(name);
    Object.assign(sand, {
      C, Rr, cs, mid, maxW, mask, grid, N, passed: drained, off, octx, img: octx.createImageData(C, Rr),
      pal: [0.72, 0.86, 1, 1.12].map(f => base.map(v => Math.min(255, Math.round(v * f)))),
    });
  }

  function stepSand(allowed) {
    const { C, Rr, mid, mask, grid } = sand;
    for (let r = Rr - 2; r >= 0; r--) {
      const ltr = Math.random() < 0.5;
      for (let k = 0; k < C; k++) {
        const c = ltr ? k : C - 1 - k, i = r * C + c, g = grid[i];
        if (!g) continue;
        if (r + 1 === mid && sand.passed >= allowed) continue; // the neck only lets time through
        const below = i + C;
        let t = -1;
        if (mask[below] && !grid[below]) t = below;
        else {
          const d = Math.random() < 0.5 ? 1 : -1;
          for (const dc of [d, -d]) {
            const cc = c + dc;
            if (cc >= 0 && cc < C && mask[below + dc] && !grid[below + dc]) { t = below + dc; break; }
          }
        }
        if (t >= 0) { grid[t] = g; grid[i] = 0; if (r + 1 === mid) sand.passed++; }
      }
    }
  }

  function drawHourglass(cx, top, over) {
    const { C, Rr, cs, mid, maxW, grid, img, pal, octx, off } = sand;
    const w = C * cs, h = Rr * cs, gx = cx - w / 2;
    const d = img.data;
    for (let i = 0; i < grid.length; i++) {
      const g = grid[i], p = i * 4;
      if (g) { const c = pal[g - 1]; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; }
      else d[p + 3] = 0;
    }
    octx.putImageData(img, 0, 0);
    // posts
    ctx.strokeStyle = '#5b67b8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const x of [gx - 10, gx + w + 10]) { ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, top + h + 4); ctx.stroke(); }
    // glass
    const outline = () => {
      ctx.beginPath();
      for (let s = 0; s <= 80; s++) {
        const y = (s / 80) * Rr, ww = hgW(Math.abs(y - mid) / mid, maxW, 1.2) + 0.6;
        ctx.lineTo(cx - ww * cs, top + y * cs);
      }
      for (let s = 80; s >= 0; s--) {
        const y = (s / 80) * Rr, ww = hgW(Math.abs(y - mid) / mid, maxW, 1.2) + 0.6;
        ctx.lineTo(cx + ww * cs, top + y * cs);
      }
      ctx.closePath();
    };
    outline();
    ctx.fillStyle = 'rgba(170,179,232,0.06)'; ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, gx, top, w, h);
    ctx.imageSmoothingEnabled = true;
    outline();
    ctx.strokeStyle = over ? 'rgba(255,93,115,0.75)' : 'rgba(170,179,232,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    // glint
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - w * 0.3, top + h * 0.1); ctx.lineTo(cx - w * 0.36, top + h * 0.3); ctx.stroke();
    // caps
    ctx.fillStyle = '#ffc93c';
    for (const y of [top - 12, top + h + 2]) { roundRect(gx - 18, y, w + 36, 10, 5); ctx.fill(); }
  }

  function drawMarble(x, y, r, name, heat = 0) {
    const base = mix(rgbFor(name), HOT, heat);
    const grd = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, rgbStr(base)); grd.addColorStop(1, rgbStr(base.map(v => v * 0.5)));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10131f';
    ctx.font = `800 ${Math.max(7, r * 0.62)}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), x, y + r * 0.04);
  }

  function fitFont(text, maxW, size, family, weight = 400) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (s > 12 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
    return s;
  }

  function spawnConfetti(n, x0, w) {
    const cols = ['#ffc93c', '#ff5d73', '#7f8cf0', '#5fe0b0', '#eceeff'];
    for (let i = 0; i < n; i++) fx.push({
      kind: 'confetti', x: x0 + Math.random() * w, y: -10 - Math.random() * 120, vx: (Math.random() - 0.5) * 60,
      vy: 60 + Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 6,
      color: cols[i % cols.length], size: 4 + Math.random() * 4,
    });
  }

  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt;
      if (p.kind === 'steam') { p.x += p.vx * dt; p.y += p.vy * dt; p.size += 14 * dt; }
      else { p.vy = Math.min(p.vy + 120 * dt, 160); p.x += p.vx * dt + Math.sin(p.rot) * 0.6; p.y += p.vy * dt; p.rot += p.vr * dt; }
      if (p.life <= 0 || p.y > ch + 20) fx.splice(i, 1);
    }
  }
  function drawFx() {
    for (const p of fx) {
      if (p.kind === 'steam') {
        ctx.fillStyle = `rgba(200,205,230,${Math.max(0, p.life / p.max) * 0.22})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
  }

  function drawMeeting(dt) {
    clock += dt;
    const motion = !reduceMotion;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(0, 0, cw, ch);
    updateFx(dt);
    if (cur >= speakers.length) { drawScoreboard(); drawFx(); return; }
    ctx.fillStyle = '#131833'; ctx.fillRect(0, ch - 64, cw, 64);

    const name = speakers[cur];
    const el = (performance.now() - turnStart) / 1000;
    const frac = Math.min(1, el / timebox), overS = Math.max(0, el - timebox);
    const heat = Math.min(1, overS / 30);
    const wide = cw >= 620;
    const pad = 20, stripH = 64, area = ch - stripH;

    // layout
    let mCx, mCy, mr, hgCx, hgTop, hh, nameY, nameMax, timeY;
    if (wide) {
      hh = Math.min(520, area - pad * 2 - 56);
      hgCx = cw * 0.68; hgTop = pad + 14 + (area - pad * 2 - 56 - hh) / 2; timeY = hgTop + hh + 40;
      mCx = cw * 0.28; mr = Math.max(34, Math.min(70, area * 0.11)); mCy = area * 0.42;
      nameY = mCy + mr + 48; nameMax = cw * 0.46;
    } else {
      mr = 26; mCx = cw / 2; nameY = pad + 36; mCy = nameY + 30 + mr; nameMax = cw - 40;
      hgTop = mCy + mr + 30; timeY = area - 18; hh = Math.max(120, timeY - 28 - hgTop); hgCx = cw / 2;
    }

    const key = `${cur}|${Math.round(hh)}`;
    if (sand.key !== key) { buildSand(hh, frac, name); sand.key = key; }
    const allowed = Math.floor(sand.N * frac);
    stepSand(allowed); stepSand(allowed);

    // spotlight cone + pool
    const cone = ctx.createLinearGradient(0, 0, 0, mCy + mr);
    cone.addColorStop(0, 'rgba(255,225,150,0.14)'); cone.addColorStop(1, 'rgba(255,225,150,0.03)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(mCx - 18, 0); ctx.lineTo(mCx + 18, 0);
    ctx.lineTo(mCx + mr * 2.4, mCy + mr + 10); ctx.lineTo(mCx - mr * 2.4, mCy + mr + 10); ctx.closePath(); ctx.fill();
    const pool = ctx.createRadialGradient(mCx, mCy, mr * 0.5, mCx, mCy, mr * 3.2);
    pool.addColorStop(0, heat > 0 ? `rgba(255,93,115,${0.1 + heat * 0.15})` : 'rgba(255,201,60,0.12)'); pool.addColorStop(1, 'rgba(255,201,60,0)');
    ctx.fillStyle = pool; ctx.fillRect(mCx - mr * 3.2, mCy - mr * 3.2, mr * 6.4, mr * 6.4);

    drawHourglass(hgCx, hgTop, overS > 0);

    // the speaker
    popT = Math.min(1, popT + dt * 2.4);
    const sc = easeBack(popT);
    const bob = motion ? Math.sin(clock * 2.2) * 4 : 0;
    const jit = motion && heat > 0 ? (1 + heat * 3) : 0;
    const jx = (Math.random() - 0.5) * jit, jy = (Math.random() - 0.5) * jit;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(mCx, mCy + mr + 10, mr * (0.9 - bob / 60), mr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    if (overS > 0) {
      ctx.strokeStyle = `rgba(255,93,115,${0.35 + 0.3 * Math.sin(clock * 6)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mCx + jx, mCy + bob + jy, mr * sc + 8 + 3 * Math.sin(clock * 6), 0, Math.PI * 2); ctx.stroke();
      if (motion && Math.random() < 0.15 + heat * 0.5) {
        fx.push({ kind: 'steam', x: mCx + (Math.random() - 0.5) * mr, y: mCy - mr * 0.8 + bob, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * 30, size: 4, life: 1.6, max: 1.6 });
      }
    }
    drawFx();
    if (sc > 0.01) drawMarble(mCx + jx, mCy + bob + jy, mr * sc, name, heat);
    lastSpot = { x: mCx, y: mCy, r: mr };

    // name
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffc93c';
    ctx.font = '800 11px Figtree, system-ui, sans-serif';
    const eyebrow = `NOW SPEAKING · ${cur + 1} OF ${speakers.length}`;
    if (wide) {
      ctx.fillText(eyebrow, mCx, mCy - mr - 34);
      const parts = name.split(/\s+/), first = parts[0], rest = parts.slice(1).join(' ');
      fitFont(first, nameMax, Math.min(44, cw * 0.045), 'Bungee, Impact, sans-serif');
      ctx.fillStyle = '#eceeff'; ctx.fillText(first, mCx, nameY);
      if (rest) {
        fitFont(rest, nameMax, 18, 'Figtree, system-ui, sans-serif', 700);
        ctx.fillStyle = '#8d93bd'; ctx.fillText(rest, mCx, nameY + 34);
      }
    } else {
      ctx.fillText(eyebrow, mCx, pad + 6);
      fitFont(name, nameMax, 24, 'Bungee, Impact, sans-serif');
      ctx.fillStyle = '#eceeff'; ctx.fillText(name, mCx, nameY);
    }

    // time under the hourglass
    ctx.font = `700 ${wide ? 22 : 18}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = overS > 0 ? '#ff5d73' : '#eceeff';
    ctx.fillText(overS > 0 ? `+${fmt(overS)} over` : `${fmt(timebox - el + 0.999)} left`, hgCx, timeY);

    drawStrip(dt, stripH, motion);
  }

  // bottom strip: who has spoken (tray) and who is warming up next
  function drawStrip(dt, stripH, motion) {
    const y = ch - stripH / 2, r = 11;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '800 10px Figtree, system-ui, sans-serif';
    ctx.fillStyle = '#8d93bd';
    ctx.fillText('SPOKEN', 16, y - 20);
    const nextName = speakers[cur + 1];
    const nextW = nextName ? Math.min(220, cw * 0.4) : 0;
    const trayW = cw - 32 - nextW;
    const step = Math.min(2 * r + 6, (trayW - 2 * r) / Math.max(1, speakers.length - 1));
    const slot = i => [16 + r + i * step, y + 6];
    for (let i = 0; i < cur; i++) {
      if (flyer && flyer.i === i) continue;
      const [sx, sy] = slot(i);
      drawMarble(sx, sy, r, speakers[i]);
    }
    if (!cur) { ctx.fillStyle = 'rgba(141,147,189,0.5)'; ctx.font = '600 12px Figtree, system-ui, sans-serif'; ctx.fillText('nobody yet', 16, y + 6); }
    if (flyer) {
      flyer.t = Math.min(1, flyer.t + dt * 1.8);
      const t = flyer.t, e = t * t * (3 - 2 * t);
      const [tx, ty] = slot(flyer.i);
      const x = flyer.x + (tx - flyer.x) * e, yy = flyer.y + (ty - flyer.y) * e - Math.sin(e * Math.PI) * 80;
      drawMarble(x, yy, flyer.r + (r - flyer.r) * e, speakers[flyer.i]);
      if (t >= 1) flyer = null;
    }
    if (nextName) {
      const nx = cw - nextW + 4;
      ctx.textAlign = 'left';
      ctx.font = '800 10px Figtree, system-ui, sans-serif'; ctx.fillStyle = '#ffc93c';
      ctx.fillText('UP NEXT', nx, y - 20);
      const hop = motion ? Math.abs(Math.sin(clock * 4)) * 8 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(nx + 13, y + 20, 10 - hop / 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      drawMarble(nx + 13, y + 6 - hop, 13, nextName);
      ctx.fillStyle = '#eceeff'; ctx.textAlign = 'left';
      fitFont(nextName, nextW - 40, 14, 'Figtree, system-ui, sans-serif', 700);
      ctx.fillText(nextName, nx + 34, y + 6);
    }
  }

  function drawScoreboard() {
    const n = speakers.length;
    const total = ((doneAt || performance.now()) - meetStart) / 1000;
    const overCount = talk.filter(s => s > timebox).length;
    const pad = 20;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont('Round complete', cw - 40, 34, 'Bungee, Impact, sans-serif');
    ctx.fillStyle = '#ffc93c'; ctx.fillText('Round complete', cw / 2, pad + 22);
    ctx.font = '600 14px Figtree, system-ui, sans-serif'; ctx.fillStyle = '#8d93bd';
    ctx.fillText(`${n} updates · ${fmt(total)} total · ${overCount ? overCount + ' over the time-box' : 'nobody went over'}`, cw / 2, pad + 54);

    const top = pad + 100, bottom = ch - pad;
    const rowH = Math.min(30, (bottom - top) / n);
    const r = Math.max(6, Math.min(11, rowH * 0.38));
    const nameW = Math.min(190, cw * 0.32);
    const x0 = Math.max(16, (cw - Math.min(cw - 32, 760)) / 2), x1 = cw - x0;
    const barX = x0 + r * 2 + 10 + nameW, barMax = Math.max(40, x1 - barX - 110);
    const maxT = Math.max(timebox, ...talk);
    const spoken = talk.map((s, i) => [s, i]).filter(([s]) => s >= 1);
    const fastest = spoken.length > 1 ? spoken.reduce((a, b) => (b[0] < a[0] ? b : a))[1] : -1;
    const longest = spoken.length > 1 ? spoken.reduce((a, b) => (b[0] > a[0] ? b : a))[1] : -1;
    const lineX = barX + (timebox / maxT) * barMax;
    ctx.strokeStyle = 'rgba(255,201,60,0.4)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lineX, top - 6); ctx.lineTo(lineX, top + rowH * n); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '700 10px Figtree, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,201,60,0.8)';
    ctx.fillText(`${fmt(timebox)} time-box`, lineX, top - 14);
    const fs = Math.max(10, Math.min(14, rowH * 0.5));
    speakers.forEach((name, i) => {
      const y = top + rowH * i + rowH / 2, s = talk[i] || 0;
      const bounce = reduceMotion ? 0 : Math.max(0, Math.sin(clock * 3 - i * 0.35)) * Math.min(4, rowH * 0.12);
      drawMarble(x0 + r, y - bounce, r, name);
      ctx.textAlign = 'left';
      fitFont(name, nameW, fs, 'Figtree, system-ui, sans-serif', 700);
      ctx.fillStyle = '#eceeff'; ctx.fillText(name, x0 + r * 2 + 10, y);
      const bw = (s / maxT) * barMax, okW = Math.min(bw, (timebox / maxT) * barMax);
      const bh = Math.max(4, rowH * 0.42);
      ctx.fillStyle = rgbStr(rgbFor(name), 0.85); ctx.fillRect(barX, y - bh / 2, okW, bh);
      if (bw > okW) { ctx.fillStyle = '#ff5d73'; ctx.fillRect(barX + okW, y - bh / 2, bw - okW, bh); }
      ctx.font = `700 ${fs - 1}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillStyle = s > timebox ? '#ff5d73' : '#8d93bd';
      const tx = barX + bw + 8;
      ctx.fillText(fmt(s), tx, y);
      const badge = i === fastest ? 'fastest' : i === longest ? 'longest' : '';
      if (badge) {
        ctx.font = `800 ${fs - 3}px Figtree, system-ui, sans-serif`;
        ctx.fillStyle = i === fastest ? '#5fe0b0' : '#ffc93c';
        ctx.fillText(badge.toUpperCase(), tx + 44, y);
      }
    });
    if (!reduceMotion && Math.random() < 0.08) spawnConfetti(1, 0, cw);
  }

  // ---------------------------------------------------------------- main loop
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state === 'meeting') {
      drawMeeting(dt);
      requestAnimationFrame(frame);
      return;
    }
    if (state === 'racing' || state === 'ending') {
      acc += dt * speed;
      let n = 0;
      while (acc >= STEP && n < 12) { step(); acc -= STEP; n++; }
      if (n === 12) acc = 0;
      for (const m of marbles) {
        m.trail.push([m.x, m.y]);
        if (m.trail.length > 7) m.trail.shift();
      }
      if (state === 'racing') {
        renderStandings(false);
        if (finished.length === marbles.length) endRace();
      }
    } else {
      // ready / countdown: marbles rest in the start box while the gate is shut
      acc += dt; while (acc >= STEP) { step(); acc -= STEP; }
      simTime = 0;
    }
    updateCamera(dt);
    draw();
    requestAnimationFrame(frame);
  }

  buildTrack();
  makeMarbles();
  renderGrid();
  setState('ready');
  // settle the start box so the first frame shows marbles resting on the gate
  for (let i = 0; i < 90; i++) step();
  simTime = 0;
  for (const m of marbles) m.stuckT = 0;
  requestAnimationFrame(frame);
})();
