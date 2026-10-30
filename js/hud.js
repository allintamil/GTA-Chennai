'use strict';
// ===================================================================
//  HUD – canvas drawn overlay
// ===================================================================
const HF = '"Bebas Neue","Teko",Impact,"Arial Narrow",sans-serif';
const hud = { district: null, distT: 0, help: 18, mapOpen: false };

function htext(s, x, y, size, col, align, font, stroke) {
  ctx.font = (font ? '' : '') + size + 'px ' + (font || HF); ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = stroke || 'rgba(0,0,0,.75)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
}
function starPath(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function panel(x, y, w, h, a) { ctx.fillStyle = 'rgba(8,14,22,' + (a === undefined ? 0.62 : a) + ')'; rrect(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke(); }
function clockStr() { const m = Math.floor(G.dayMin), h = Math.floor(m / 60) % 24, mm = m % 60; return ((h % 12) || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }

function drawHUD() {
  const w = cam.w, h = cam.h; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  if (G.mode === 'title') return;
  // damage flash vignette
  if (G.flash > 0) { const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85); g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, 'rgba(200,0,0,' + (G.flash * 1.2).toFixed(2) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  if (G.mode === 'wasted' || G.mode === 'busted') {
    const a = clamp(G.wastedT / 1.2, 0, 0.55); ctx.fillStyle = G.mode === 'wasted' ? 'rgba(40,0,0,' + a + ')' : 'rgba(0,10,50,' + a + ')'; ctx.fillRect(0, 0, w, h);
  }
  drawStatus(w, h);
  drawRadar(w, h);
  drawMissionPanel(w, h);
  drawEdgeArrows(w, h);
  drawDistrict(w, h);
  drawPrompt(w, h);
  if (player.veh) drawSpeedo(w, h);
  drawSubs(w, h);
  drawBanner(w, h);
  if (hud.help > 0) drawHelp(w, h);
  if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(G.fade, 0, 1) + ')'; ctx.fillRect(0, 0, w, h); }
}

function drawStatus(w, h) {
  const x = w - 24;
  htext(fmtMoney(G.cash), x, 40, 38, '#9be15d', 'right');
  htext(clockStr() + (G.rain > 0.2 ? '  ☂' : daylight() > 0.5 ? '  ☀' : '  ☾'), x, 74, 22, '#e8eef5', 'right');
  // health / armour
  const bw = 190, bx = x - bw;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(ctx, bx - 2, 92, bw + 4, 14, 6); ctx.fill();
  const hp = clamp(player.hp / player.maxhp, 0, 1); ctx.fillStyle = hp > 0.3 ? '#e53935' : (Math.sin(G.t * 10) > 0 ? '#ff8a80' : '#b71c1c'); rrect(ctx, bx, 94, bw * hp, 10, 5); ctx.fill();
  if (player.armor > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(ctx, bx - 2, 110, bw + 4, 12, 6); ctx.fill(); ctx.fillStyle = '#42a5f5'; rrect(ctx, bx, 112, bw * clamp(player.armor / 100, 0, 1), 8, 4); ctx.fill(); }
  // wanted stars
  const sy = player.armor > 0 ? 146 : 130;
  const searching = G.wanted > 0 && !G.copSeen && Math.floor(G.t * 3) % 2;
  for (let i = 0; i < 5; i++) {
    starPath(x - 14 - i * 30, sy, 13);
    if (i < G.wanted) { ctx.fillStyle = searching ? '#7f8c9a' : (Math.floor(G.t * 5) % 2 && G.copSeen ? '#ff5252' : '#ffd54a'); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  // weapon
  const wk = player.weapon, wp = WEAPONS[wk];
  panel(x - 190, sy + 22, 190, 44, 0.55);
  htext(wp.name.toUpperCase(), x - 180, sy + 36, 20, '#fff', 'left');
  htext(wp.melee ? '∞' : String(player.ammo[wk] || 0), x - 10, sy + 50, 22, wp.melee ? '#aaa' : (player.ammo[wk] > 0 ? '#ffd54a' : '#ff5252'), 'right');
  if (Fare.on) { htext('AUTO DRIVER  ' + fmtMoney(Fare.earned) + '  (' + Fare.count + ')', x, sy + 84, 18, '#66bb6a', 'right'); }
  if (player.swim) htext('SWIMMING', x, sy + 84, 18, '#4fc3f7', 'right');
}

function drawRadar(w, h) {
  const R = Math.min(96, h * 0.15), cx = 28 + R, cy = h - 28 - R, half = 560, scale = R / half, S = world.miniS;
  const pp = playerPos();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0b1a28'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  const sw = half * 2 / TS * S;
  ctx.drawImage(world.mini, pp.x / TS * S - sw / 2, pp.y / TS * S - sw / 2, sw, sw, cx - R, cy - R, R * 2, R * 2);
  const night = nightAlpha(); if (night > 0.1) { ctx.fillStyle = 'rgba(0,10,40,' + night * 0.35 + ')'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
  const blip = (x, y, col, r, shape, edge) => {
    let dx = (x - pp.x) * scale, dy = (y - pp.y) * scale, d = Math.hypot(dx, dy), off = false;
    if (d > R - 5) { if (!edge) return; dx *= (R - 6) / d; dy *= (R - 6) / d; off = true; }
    ctx.fillStyle = col; ctx.beginPath();
    if (shape === 'sq') ctx.rect(cx + dx - r, cy + dy - r, r * 2, r * 2); else if (off) { ctx.arc(cx + dx, cy + dy, r * 0.75, 0, TAU); } else ctx.arc(cx + dx, cy + dy, r, 0, TAU);
    ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1; ctx.stroke();
  };
  for (const m of world.markers) blip(m.x, m.y, m.col, 4.5, 'c', false);
  const g = Missions.giverMarker(); if (g) blip(g.x, g.y, '#ffd54a', 6, 'c', true);
  for (const b of activeBlips()) blip(b.x, b.y, b.col.startsWith('#') ? b.col : '#ffd54a', 6, 'c', true);
  if (G.wanted > 0) {
    const f = Math.floor(G.t * 4) % 2;
    for (const v of vehicles) if (v.type === 'police' && v.ai && v.ai.mode === 'pursuit' && !v.wreck) blip(v.x, v.y, f ? '#ff3b30' : '#2979ff', 4, 'sq', false);
    for (const p of peds) if (p.kind === 'cop' && !p.dead) blip(p.x, p.y, f ? '#ff3b30' : '#2979ff', 3, 'c', false);
  }
  for (const p of peds) if (p.kind === 'enemy' && !p.dead && p.alert) blip(p.x, p.y, '#ff5252', 3.5, 'c', false);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,14,22,.9)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.stroke();
  // player arrow
  const ang = player.veh ? player.veh.a : player.a; ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  htext('N', cx, cy - R + 11, 14, '#fff', 'center');
}

function drawMissionPanel(w, h) {
  const m = Missions.active; if (!m) return;
  const pw = Math.min(520, w - 330), x = (w - pw) / 2 - 40, y = 14;
  const lines = wrapText(m.text, pw - 28, 19);
  const ph = 46 + lines.length * 22;
  panel(x, y, pw, ph, 0.7);
  htext(m.def.name.toUpperCase(), x + 14, y + 20, 24, '#ffd54a', 'left');
  htext(fmtMoney(m.def.reward), x + pw - 14, y + 20, 22, '#9be15d', 'right');
  lines.forEach((l, i) => htext(l, x + 14, y + 46 + i * 22, 19, '#fff', 'left', '"Segoe UI",sans-serif'));
  if (m.timer != null) {
    const tm = Math.max(0, m.timer), s = Math.floor(tm / 60) + ':' + String(Math.floor(tm % 60)).padStart(2, '0');
    htext(s, x + pw + 14, y + 24, 38, tm < 20 && Math.floor(G.t * 3) % 2 ? '#ff5252' : '#fff', 'left');
  }
}
function wrapText(s, maxW, size) {
  ctx.font = size + 'px "Segoe UI",sans-serif'; const words = s.split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

function drawEdgeArrows(w, h) {
  const list = activeBlips().slice(); const g = Missions.giverMarker(); if (g && !Missions.active) list.push({ x: g.x, y: g.y, col: '#ffd54a', label: g.label });
  for (const b of list) {
    const sc = worldToScreen(b.x, b.y, 3); let sx = sc.x, sy = sc.y;
    if (!sc.vis) { sx = w - sx; sy = h - sy; }
    if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) continue;
    const a = Math.atan2(sy - h / 2, sx - w / 2), mx = w / 2 - 44, my = h / 2 - 44;
    const t = Math.min(Math.abs(mx / Math.cos(a)), Math.abs(my / Math.sin(a)));
    const x = w / 2 + Math.cos(a) * t, y = h / 2 + Math.sin(a) * t;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = b.col.startsWith('#') ? b.col : '#ffd54a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, -11); ctx.lineTo(-4, 0); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    const pp = playerPos(); htext(Math.round(dist(pp.x, pp.y, b.x, b.y) / TS * 5) + ' m', x - Math.cos(a) * 30, y - Math.sin(a) * 30, 14, '#fff', 'center');
  }
}

function drawDistrict(w, h) {
  const pp = playerPos(), d = districtAt(pp.x, pp.y);
  if (hud.district !== d.en) { hud.district = d.en; hud.distT = 4.2; }
  hud.distT -= 0.016;
  if (hud.distT > 0) {
    const a = clamp(Math.min(hud.distT, 4.2 - hud.distT) * 2.5, 0, 1); ctx.globalAlpha = a;
    htext(d.en.toUpperCase(), 40, h - 235, 46, '#ffd54a', 'left'); htext(d.ta, 42, h - 196, 26, '#fff', 'left', TAMIL_FONT);
    ctx.globalAlpha = 1;
  }
  const st = streetAt(pp.x, pp.y); if (st && player.veh) htext(st, 40, h - 275 + 70, 18, 'rgba(255,255,255,.8)', 'left', '"Segoe UI",sans-serif');
}

function drawPrompt(w, h) {
  if (!G.prompt || G.mode !== 'play') return;
  const tx = G.prompt; ctx.font = 'bold 20px "Segoe UI",sans-serif'; const tw = ctx.measureText(tx).width + 36;
  const py = h - 118 - (Sub.cur ? 92 : 0);
  panel(w / 2 - tw / 2, py, tw, 38, 0.72); htext(tx, w / 2, py + 19, 20, '#fff', 'center', '"Segoe UI",sans-serif');
}

function drawSpeedo(w, h) {
  const v = player.veh, kmh = Math.round(Math.hypot(v.vx, v.vy) * 0.22);
  const x = w - 24, y = h - 30;
  panel(x - 236, y - 108, 236, 102, 0.6);
  htext(v.def.name.toUpperCase(), x - 14, y - 90, 18, '#ffd54a', 'right');
  htext(String(kmh), x - 222, y - 56, 52, '#fff', 'left');
  ctx.font = '52px ' + HF; const nw = ctx.measureText(String(kmh)).width;
  htext('km/h', x - 222 + nw + 8, y - 44, 16, '#9fb3c8', 'left');
  htext(Snd.radioOn ? '♫ KUTHU FM [R]' : 'RADIO OFF [R]', x - 14, y - 58, 14, Snd.radioOn ? '#ff80ab' : '#789', 'right', '"Segoe UI",sans-serif');
  const hp = clamp(v.hp / v.maxhp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; rrect(ctx, x - 222, y - 24, 208, 10, 5); ctx.fill();
  ctx.fillStyle = hp > 0.5 ? '#66bb6a' : hp > 0.25 ? '#ffa726' : '#ef5350'; rrect(ctx, x - 221, y - 23, 206 * hp, 8, 4); ctx.fill();
  if (v.type === 'auto' || v.type === 'cab') htext('[N] auto-driver job', x - 14, y - 120, 14, '#a5d6a7', 'right', '"Segoe UI",sans-serif');
}

function drawSubs(w, h) {
  const s = Sub.cur; if (!s) return;
  const bw = Math.max(300, Math.min(760, w - 560)), lines = wrapText(s.text, bw - 30, 20), bh = 22 + lines.length * 24 + 8;
  const x = Math.max(12, w / 2 - bw / 2 - 90), y = h - 28 - bh;
  panel(x, y, bw, bh, 0.78);
  htext(s.who.toUpperCase(), x + 14, y + 18, 18, s.who === 'Muthu' ? '#ff8a65' : s.who === 'Police Radio' ? '#64b5f6' : s.who === 'Tip' ? '#a5d6a7' : '#ffd54a', 'left');
  lines.forEach((l, i) => htext(l, x + 14, y + 44 + i * 24, 20, '#fff', 'left', '"Segoe UI",sans-serif'));
}

function drawBanner(w, h) {
  const b = Banner.cur; if (!b) return;
  const age = (b.dur - Banner.t), a = clamp(Math.min(age * 4, Banner.t * 3), 0, 1), sc = 1 + (1 - clamp(age * 5, 0, 1)) * 0.25;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(w / 2, h * 0.3); ctx.scale(sc, sc);
  htext(b.text, 0, 0, 82, b.col, 'center'); if (b.sub) htext(b.sub, 0, 54, 30, '#fff', 'center', b.sub.match(/[஀-௿]/) ? TAMIL_FONT : HF);
  ctx.restore();
}

function drawHelp(w, h) {
  hud.help -= 0.016; const a = clamp(hud.help, 0, 1) * 0.9;
  const rows = [['W A S D', 'Move / drive'], ['MOUSE', 'Look (click to capture)'], ['L-CLICK', 'Shoot / punch'], ['R-CLICK', 'Hold to aim'], ['SHIFT', 'Run'], ['E', 'Enter / exit vehicle, use markers'], ['SPACE', 'Handbrake'], ['H', 'Horn'], ['Q / 1-6', 'Switch weapon'], ['F', 'Throw nattu vedi'], ['R', 'Radio'], ['N', 'Auto-driver job'], ['M', 'City map'], ['ESC', 'Pause']];
  ctx.globalAlpha = a; panel(24, 20, 330, 30 + rows.length * 22, 0.7);
  htext('CONTROLS', 40, 40, 22, '#ffd54a', 'left');
  rows.forEach((r, i) => { htext(r[0], 40, 66 + i * 22, 15, '#ffd54a', 'left', '"Segoe UI",sans-serif'); htext(r[1], 130, 66 + i * 22, 15, '#fff', 'left', '"Segoe UI",sans-serif'); });
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ big map
function drawBigMap() {
  const w = cam.w, h = cam.h; ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(5,10,18,.94)'; ctx.fillRect(0, 0, w, h);
  const S = world.miniS, sc = Math.min((w - 100) / (COLS * S), (h - 110) / (ROWS * S)), mw = COLS * S * sc, mh = ROWS * S * sc, ox = (w - mw) / 2, oy = (h - mh) / 2 + 16;
  ctx.drawImage(world.mini, ox, oy, mw, mh);
  const k = sc * S / TS, X = x => ox + x * k, Y = y => oy + y * k;
  htext('CHENNAI  •  சென்னை', w / 2, 34, 40, '#ffd54a', 'center', HF);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of world.landmarks) {
    ctx.font = 'bold 12px ' + TAMIL_FONT; const tw = Math.max(ctx.measureText(l.name).width, ctx.measureText(l.ta).width * 0.9) + 10;
    ctx.fillStyle = 'rgba(0,0,0,.62)'; rrect(ctx, X(l.x) - tw / 2, Y(l.y) - 13, tw, 28, 5); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(l.name, X(l.x), Y(l.y) - 4); ctx.font = '11px ' + TAMIL_FONT; ctx.fillStyle = '#cfd8dc'; ctx.fillText(l.ta, X(l.x), Y(l.y) + 9);
  }
  for (const m of world.markers) { ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText((m.icon || '?').slice(0, 1), X(m.x), Y(m.y) + 0.5); }
  const g = Missions.giverMarker(); if (g) { ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(X(g.x), Y(g.y), 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('!', X(g.x), Y(g.y) + 1); htext(g.label, X(g.x), Y(g.y) - 18, 15, '#ffd54a', 'center', '"Segoe UI",sans-serif'); }
  for (const b of activeBlips()) { ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
  const pp = playerPos(); ctx.save(); ctx.translate(X(pp.x), Y(pp.y)); ctx.rotate(player.veh ? player.veh.a : player.a); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  htext('Press M or ESC to close', w / 2, h - 22, 18, '#9fb3c8', 'center', '"Segoe UI",sans-serif');
}
