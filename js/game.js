'use strict';
// ===================================================================
//  GAME – input, UI overlays, camera, main loop
// ===================================================================
const Input = { up: false, down: false, left: false, right: false, run: false, space: false, fire: false, horn: false, hornPress: false, ePress: false, mx: 0, my: 0, worldX: 0, worldY: 0, rmb: false, locked: false };
const $ = id => document.getElementById(id);
const el = {};
G.fade = 0; G.garageCd = 0; G.wastedT = 0; G.prompt = null; G.bellT = 10;

// ------------------------------------------------------------------ input
function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
    switch (k) {
      case 'KeyW': case 'ArrowUp': Input.up = true; break;
      case 'KeyS': case 'ArrowDown': Input.down = true; break;
      case 'KeyA': case 'ArrowLeft': Input.left = true; break;
      case 'KeyD': case 'ArrowRight': Input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': Input.run = true; break;
      case 'Space': Input.space = true; break;
      case 'KeyH': if (!Input.horn) Input.hornPress = true; Input.horn = true; break;
    }
    if (!e.repeat) onKeyPress(k);
  });
  window.addEventListener('keyup', e => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': Input.up = false; break;
      case 'KeyS': case 'ArrowDown': Input.down = false; break;
      case 'KeyA': case 'ArrowLeft': Input.left = false; break;
      case 'KeyD': case 'ArrowRight': Input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': Input.run = false; break;
      case 'Space': Input.space = false; break;
      case 'KeyH': Input.horn = false; break;
    }
  });
  window.addEventListener('mousemove', e => {
    Input.mx = e.clientX; Input.my = e.clientY;
    if (G.mode === 'play' && (document.pointerLockElement === canvas || Input.rmb)) {
      cam.yaw += e.movementX * 0.0024; cam.pitch = clamp(cam.pitch + e.movementY * 0.002, -0.12, 1.25); cam.lastLook = G.t;
    }
  });
  window.addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('.ui')) return;
    if (e.button === 0) {
      if (G.mode === 'dialog') { Dialog.advance(); return; }
      Input.fire = true; if (G.mode === 'play') lockMouse();
    } else if (e.button === 2) Input.rmb = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) Input.fire = false; else if (e.button === 2) Input.rmb = false; });
  document.addEventListener('pointerlockchange', () => {
    const was = Input.locked; Input.locked = document.pointerLockElement === canvas;
    if (was && !Input.locked && G.mode === 'play') setPause(true);
  });
  window.addEventListener('wheel', e => { if (G.mode === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { for (const k in Input) if (typeof Input[k] === 'boolean') Input[k] = false; if (G.mode === 'play') setPause(true); });
}
function lockMouse() { try { if (document.pointerLockElement !== canvas) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* not available */ } }
function onKeyPress(k) {
  if (G.mode === 'title') return;
  if (G.mode === 'dialog') { if (k === 'Space' || k === 'Enter' || k === 'KeyE') Dialog.advance(); return; }
  if (k === 'Escape' || k === 'KeyP') {
    if (G.mode === 'play') setPause(true); else if (G.mode === 'pause') setPause(false);
    else if (G.mode === 'map') G.mode = 'play'; else if (G.mode === 'shop') Shop.close();
    return;
  }
  if (k === 'KeyM') { if (G.mode === 'play') G.mode = 'map'; else if (G.mode === 'map') G.mode = 'play'; return; }
  if (G.mode === 'shop') { const n = parseInt(k.replace('Digit', ''), 10); if (n >= 1 && n <= SHOP.length) Shop.buy(n - 1); return; }
  if (G.mode !== 'play') return;
  switch (k) {
    case 'KeyE': Input.ePress = true; break;
    case 'KeyQ': cycleWeapon(1); break;
    case 'KeyR': Snd.radioOn = !Snd.radioOn; if (!Snd.radioOn) Snd.setRadio(false); break;
    case 'KeyN': Fare.toggle(); break;
    case 'KeyF': if (player.owned.nattu && player.ammo.nattu > 0 && player.cd <= 0 && !player.dead) fireWeapon(player, cam.yaw, 'nattu'); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': {
      const wk = WEAPON_ORDER[parseInt(k.slice(5), 10) - 1]; if (player.owned[wk] && (WEAPONS[wk].melee || player.ammo[wk] > 0)) player.weapon = wk; break;
    }
  }
}
function cycleWeapon(dir) {
  const list = WEAPON_ORDER.filter(w => player.owned[w] && (WEAPONS[w].melee || player.ammo[w] > 0));
  let i = list.indexOf(player.weapon); if (i < 0) i = 0; player.weapon = list[(i + dir + list.length) % list.length];
}

// ------------------------------------------------------------------ dialogue
const Dialog = {
  lines: [], i: 0, cb: null, text: '', shown: 0,
  start(lines, cb) {
    if (G.mode !== 'play') { setTimeout(() => Dialog.start(lines, cb), 800); return; }
    this.lines = lines; this.i = 0; this.cb = cb; G.mode = 'dialog'; el.dialog.style.display = 'block'; this.set();
  },
  set() {
    const [who, text] = this.lines[this.i]; this.text = text; this.shown = 0;
    el.dwho.textContent = who; el.dwho.style.color = who === 'Muthu' ? '#ff8a65' : who === 'Maran Anna' ? '#ffd54a' : who === 'Kili Kumar' ? '#ff5252' : '#80deea';
    el.dtxt.textContent = '';
  },
  update(dt) { if (G.mode !== 'dialog') return; this.shown = Math.min(this.text.length, this.shown + dt * 60); el.dtxt.textContent = this.text.slice(0, Math.floor(this.shown)); },
  advance() {
    if (G.mode !== 'dialog') return;
    if (this.shown < this.text.length) { this.shown = this.text.length; return; }
    this.i++;
    if (this.i >= this.lines.length) { el.dialog.style.display = 'none'; G.mode = 'play'; Input.fire = false; if (this.cb) this.cb(); }
    else this.set();
  },
};

// ------------------------------------------------------------------ shop
const SHOP = [
  { name: 'Pistol + 36 rounds', desc: 'Reliable street sidearm', price: 2500, can: () => true, give() { grant('pistol'); } },
  { name: 'SMG + 120 rounds', desc: 'Spray and pray', price: 7000, can: () => true, give() { grant('smg'); } },
  { name: 'Shotgun + 16 shells', desc: 'Close range, big noise', price: 5200, can: () => true, give() { grant('shotgun'); } },
  { name: 'Nattu Vedi x5', desc: 'Country bombs. Press F to throw', price: 900, can: () => true, give() { grant('nattu'); } },
  { name: 'Ammo refill', desc: 'Top up all guns you own', price: 700, can: () => Object.keys(player.owned).some(w => !WEAPONS[w].melee), give() { for (const w in player.owned) if (!WEAPONS[w].melee) player.ammo[w] = Math.min(WEAPONS[w].maxAmmo, (player.ammo[w] || 0) + WEAPONS[w].pack); } },
  { name: 'Body armour', desc: 'Absorbs 75% of damage until it breaks', price: 1500, can: () => player.armor < 100, give() { player.armor = 100; } },
];
function grant(wk) { const w = WEAPONS[wk]; player.owned[wk] = true; player.ammo[wk] = Math.min(w.maxAmmo, (player.ammo[wk] || 0) + w.pack); if (player.weapon === 'fist' || player.weapon === 'bat') player.weapon = wk; }
const Shop = {
  open() { G.mode = 'shop'; el.shop.style.display = 'flex'; try { document.exitPointerLock(); } catch (e) { } this.render(); },
  close() { el.shop.style.display = 'none'; G.mode = 'play'; },
  buy(i) {
    const it = SHOP[i]; if (!it) return;
    if (G.cash < it.price) { Snd.fail(); this.msg('Not enough cash!'); return; }
    if (!it.can()) { this.msg('You do not need that right now.'); return; }
    G.cash -= it.price; it.give(); Snd.buy(); this.msg('Purchased: ' + it.name); this.render();
  },
  msg(t) { el.shopmsg.textContent = t; },
  render() {
    el.shopcash.textContent = fmtMoney(G.cash);
    el.shoplist.innerHTML = '';
    SHOP.forEach((it, i) => {
      const d = document.createElement('div'); d.className = 'item' + (G.cash < it.price ? ' poor' : '');
      d.innerHTML = '<span class="k">' + (i + 1) + '</span><span class="n">' + it.name + '<small>' + it.desc + '</small></span><span class="p">' + fmtMoney(it.price) + '</span>';
      d.addEventListener('click', () => this.buy(i)); el.shoplist.appendChild(d);
    });
  },
};

// ------------------------------------------------------------------ pause
function setPause(on) {
  if (on) { G.mode = 'pause'; el.pause.style.display = 'flex'; try { document.exitPointerLock(); } catch (e) { } Snd.engine(false, 0, 0); Snd.setRadio(false); Snd.siren(0, 0); }
  else { el.pause.style.display = 'none'; G.mode = 'play'; lockMouse(); }
}

// ------------------------------------------------------------------ game flow
function newGame(save) {
  vehicles.length = 0; peds.length = 0; bullets.length = 0; parts.length = 0; pickups.length = 0; popups.length = 0; explosions.length = 0; bombs.length = 0;
  Sub.clear(); Banner.q.length = 0; Banner.cur = null;
  Missions.active = null; Missions.done = save && save.done ? save.done : {}; Fare.stop(false);
  Object.assign(player, { hp: 100, maxhp: 100, armor: 0, dead: false, veh: null, weapon: 'fist', owned: { fist: true, bat: true }, ammo: {}, cd: 0, kvx: 0, kvy: 0, deadA: rand(0, TAU), deadT: 0, arrestT: 0, hitT: 0, swing: 0 });
  G.cash = 500; G.wanted = 0; G.heat = 0; G.dayMin = 8 * 60 + 20; G.stats = { kills: 0, missions: 0, hits: 0 }; G.rain = 0; G.rainTarget = 0; G.rainT = 200; G.fade = 0; G.slowmo = 0; G.flash = 0;
  if (save) {
    G.cash = save.cash ?? 500; Object.assign(player.owned, save.owned || {}); player.ammo = save.ammo || {}; player.armor = save.armor || 0; player.weapon = save.weapon || 'fist'; G.dayMin = save.dayMin ?? G.dayMin; G.stats = save.stats || G.stats;
  }
  const home = world.homePos; player.x = home.x; player.y = home.y; player.a = -Math.PI / 2;
  cam.x = player.x; cam.y = player.y; cam.yaw = -Math.PI / 2; cam.pitch = 0.34;
  // parked rides
  const hatch = makeVehicle('hatch', (92 + 0.5) * TS, 58 * TS, Math.PI / 2, { col: '#c0c4c9' }); hatch.free = true;
  for (const s of world.parkedSpawns) { const v = makeVehicle(s.type, s.x, s.y, s.a, {}); v.free = true; v.keep = true; }
  // static pickups
  const SP = [['health', 66, 23, 40], ['armor', 78, 23, 60], ['health', 138, 54, 40], ['health', 138, 68, 40], ['health', 102, 60, 40], ['cash', 90, 24, 300], ['cash', 42, 60, 250], ['weapon', 116, 21, 24, 'pistol'], ['armor', 140, 78, 60], ['cash', 20, 46, 200]];
  for (const [t, tx, ty, amt, wk] of SP) { const q = tp(tx, ty); pickups.push({ type: t, x: q.x, y: q.y, amt, wk, t: 0, life: 1e9, respawn: 200, hidden: 0 }); }
  G.mode = 'play'; hud.help = 18;
  updatePopulation(0.2, true);
  Sub.say('Pandi (phone)', 'Muthu! Get to Marina Beach, east of Mylapore. Follow the yellow arrow, da. Take the hatchback parked in your garden!', 7);
  Banner.show('CHENNAI', 'சென்னை', '#ffd54a', 2.8);
}

function respawn() {
  const kind = G.mode, mk = world.markers.find(m => m.id === (kind === 'wasted' ? 'hospital' : 'police'));
  const loss = Math.min(G.cash, Math.max(100, Math.floor(G.cash * 0.1))); G.cash -= loss;
  player.dead = false; player.hp = 100; player.armor = 0; player.veh = null; player.kvx = player.kvy = 0; player.arrestT = 0;
  player.x = mk.x; player.y = mk.y + 10; clearWanted();
  for (const p of peds) if (p.kind === 'cop') { p.memT = 0; p.alert = false; }
  for (const v of vehicles) if (v.ai && v.ai.mode === 'pursuit') v.ai = { mode: 'leave', far: (Math.random() * NI * NJ) | 0 };
  G.mode = 'play'; G.wastedT = 0; G.slowmo = 0; G.fade = 1; G.flash = 0; Input.fire = false;
  cam.x = player.x; cam.y = player.y; cam.yaw = -Math.PI / 2;
  Sub.say(kind === 'wasted' ? 'Hospital' : 'Police Station', kind === 'wasted' ? 'Patched up. The bill: ' + fmtMoney(loss) + '. Try not to get shot next time.' : 'Released with a warning. Fine: ' + fmtMoney(loss) + '. Stay out of trouble, Muthu.', 5);
}

function doGarage(m) {
  const veh = player.veh; const cost = G.cash >= 250 ? 250 : 0;
  G.cash -= cost; veh.hp = veh.maxhp; veh.fireT = 0; veh.col = pick(VDEF[veh.type].colors.length > 1 ? VDEF[veh.type].colors : ['#c62828', '#1565c0', '#f2f2f2']);
  if (veh.type === 'auto') veh.col = pick(VDEF.auto.colors); if (veh.type === 'cab') veh.col = '#1c1c1c';
  const hadHeat = G.wanted > 0; clearWanted(); G.garageCd = 8; Snd.buy();
  Banner.show("PAY 'N' SPRAY", hadHeat ? 'Repainted - wanted level cleared' : 'Repaired and repainted' + (cost ? ' (' + fmtMoney(cost) + ')' : ''), '#4fc3f7', 2.4);
}

function updateInteractions(dt) {
  G.prompt = null; G.garageCd = Math.max(0, G.garageCd - dt);
  const press = Input.ePress; Input.ePress = false;
  if (player.dead || G.mode !== 'play') return;
  const pp = playerPos();
  const g = Missions.giverMarker(); const markers = world.markers.slice(); if (g) markers.push(g);
  if (player.veh) {
    const v = player.veh, sp = Math.hypot(v.vx, v.vy);
    const gm = world.markers.find(m => m.id === 'garage');
    if (gm && dist(gm.x, gm.y, v.x, v.y) < gm.r && sp < 220 && G.garageCd <= 0 && (G.wanted > 0 || v.hp < v.maxhp * 0.98)) doGarage(gm);
    G.prompt = null;
    if (g && dist(g.x, g.y, v.x, v.y) < g.r + 14 && sp < 120) { G.prompt = 'E  Talk to ' + g.label; if (press) { exitVehicle(); Missions.begin(g.def); } }
    else if (press && player.enterCd <= 0) exitVehicle();
    return;
  }
  for (const m of markers) {
    if (dist(m.x, m.y, pp.x, pp.y) > m.r + 8) continue;
    if (m.mission) { G.prompt = 'E  Talk to ' + m.label; if (press) { Missions.begin(m.def); return; } }
    else if (m.id === 'home') { G.prompt = 'E  Rest at home (heal + save)'; if (press) { sleepAtHome(); return; } }
    else if (m.id === 'arms') { G.prompt = 'E  Murugan Arms - open shop'; if (press) { Shop.open(); return; } }
    else if (m.id === 'hospital') { if (player.hp < player.maxhp) { G.prompt = 'E  Treatment - ' + fmtMoney(300); if (press) { if (G.cash >= 300) { G.cash -= 300; player.hp = player.maxhp; Snd.buy(); } else Snd.fail(); return; } } }
  }
  if (player.enterCd > 0) return;
  const v = nearestVehicle(player.x, player.y, 66, vv => !(vv.ai && vv.ai.mode === 'script'));
  if (v) {
    G.prompt = v.driver ? 'E  Hijack ' + v.def.name : 'E  Enter ' + v.def.name;
    if (press) enterVehicle(v);
  }
}
function sleepAtHome() {
  player.hp = player.maxhp; G.dayMin = (G.dayMin + 360) % 1440; G.fade = 1; clearWanted(); saveGame(false); Snd.buy();
  Sub.say('Muthu', 'Slept like a baby. Chennai is waiting.', 3);
}

// ------------------------------------------------------------------ camera
// ------------------------------------------------------------------ simulation
const _vq = [];
function stepSim(dt) {
  G.t += dt; G.dayMin = (G.dayMin + dt / 0.6) % 1440;
  G.rainT -= dt;
  if (G.rainT <= 0) { if (G.rainTarget > 0) { G.rainTarget = 0; G.rainT = rand(160, 380); } else { G.rainTarget = rand(0.5, 1); G.rainT = rand(60, 140); } }
  G.rain += (G.rainTarget - G.rain) * Math.min(1, dt * 0.15);
  vgrid.clear(); pgrid.clear();
  for (const v of vehicles) vgrid.add(v);
  for (const p of peds) if (!p.dead) pgrid.add(p);
  updatePlayer(dt);
  for (const v of vehicles) {
    if (v.ai && !v.wreck) {
      if (v.type === 'police' && v.ai.mode === 'traffic' && G.wanted > 0 && dist(v.x, v.y, player.x, player.y) < 1100) { v.ai = { mode: 'pursuit' }; v.siren = true; }
      switch (v.ai.mode) {
        case 'traffic': trafficAI(v, dt); break;
        case 'pursuit': policeCarAI(v, dt); break;
        case 'leave': leaveAI(v, dt); break;
        case 'script': if (v.ai.fn) v.ai.fn(v, dt); break;
        default: v.throttle = 0; v.hb = true;
      }
    }
    stepVehicle(v, dt);
  }
  for (const v of vehicles) { vgrid.query(v.x, v.y, 120, _vq); for (const o of _vq) if (o.id > v.id) vehVsVeh(v, o); }
  for (const v of vehicles) vehHitPeds(v);
  if (player.veh) { player.x = player.veh.x; player.y = player.veh.y; }
  updatePeds(dt); updateBullets(dt); updateBombs(dt);
  for (let i = explosions.length - 1; i >= 0; i--) { explosions[i].t += dt; if (explosions[i].t > explosions[i].max) explosions.splice(i, 1); }
  updateParts(dt); updatePickups(dt); updatePolice(dt); updatePopulation(dt); Missions.update(dt);
  G.shake *= Math.exp(-dt * 7); if (G.shake < 0.05) G.shake = 0;
  G.flash = Math.max(0, G.flash - dt * 0.8);
  // regen a little when resting? no - GTA style. Armor never regens.
}

function updateAudio(dt, playing) {
  if (!Snd.ready) return;
  if (!playing) { Snd.engine(false, 0, 0); Snd.siren(0, 0); Snd.setRadio(false); return; }
  const v = player.veh;
  Snd.engine(!!v && !player.dead, v ? clamp(Math.abs(v.fwdSpeed || 0) / v.def.max, 0, 1.2) : 0, v ? Math.abs(v.throttle) : 0);
  Snd.setRadio(!!v && !player.dead && G.mode === 'play');
  let sv = 0; for (const o of vehicles) if (o.siren && !o.wreck) sv = Math.max(sv, 1 - dist(o.x, o.y, cam.x, cam.y) / 1100);
  Snd.siren(clamp(sv, 0, 1), G.t);
  let near = 0; for (const o of vehicles) if (!o.wreck && o.driver && dist(o.x, o.y, cam.x, cam.y) < 600) near++;
  Snd.ambience(near, nightAlpha() > 0.4);
  G.bellT -= dt; if (G.bellT <= 0 && world.templePos) { G.bellT = rand(18, 34); const d = dist(world.templePos.x, world.templePos.y, player.x, player.y); if (d < 900) Snd.bell(); }
}

let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
  G.dtReal = raw; { const ad = clamp(250 + (0.62 - cam.pitch) * 420, 110, 430), ox = player.x, oy = player.y; Input.worldX = ox + Math.cos(cam.yaw) * ad; Input.worldY = oy + Math.sin(cam.yaw) * ad; }
  Sub.update(raw); Banner.update(raw);
  switch (G.mode) {
    case 'title': {
      player.x = cam.x; player.y = cam.y; player.dead = false; player.veh = null; G.wanted = 0;
      stepSim(raw); updateCamera3D(raw); break;
    }
    case 'play': case 'wasted': case 'busted': {
      let dt = raw;
      if (G.mode !== 'play') { dt *= 0.4; G.wastedT += raw; if (G.wastedT > 3.2) G.fade = clamp((G.wastedT - 3.2) / 0.8, 0, 1); if (G.wastedT > 4.1) respawn(); }
      else if (G.fade > 0) G.fade = Math.max(0, G.fade - raw * 1.3);
      stepSim(dt); updateInteractions(dt); updateCamera3D(dt);
      if (G.mode === 'play') updateAudio(dt, true);
      break;
    }
    case 'dialog': Dialog.update(raw); updateCamera3D(raw); break;
    case 'pause': case 'shop': case 'map': updateAudio(raw, false); break;
  }
  renderWorld();
  if (G.mode === 'map') drawBigMap(); else drawHUD();
}

// ------------------------------------------------------------------ boot
function boot() {
  ['title', 'dialog', 'dwho', 'dtxt', 'shop', 'shoplist', 'shopcash', 'shopmsg', 'pause', 'loading', 'btnContinue'].forEach(id => el[id] = $(id));
  initRender(); setupInput();
  genWorld(); buildMiniMap();
  const save = loadSave(); if (!save) { el.btnContinue.classList.add('disabled'); }
  // pre-warm a living city behind the title screen
  player.x = 4300; player.y = 2350; cam.x = 4300; cam.y = 2350;
  G.mode = 'title'; updatePopulation(0.2, true);
  el.loading.style.display = 'none'; el.title.style.display = 'flex';
  $('btnNew').addEventListener('click', () => startFromTitle(null));
  el.btnContinue.addEventListener('click', () => { const s = loadSave(); if (s) startFromTitle(s); });
  $('btnResume').addEventListener('click', () => setPause(false));
  $('btnSave').addEventListener('click', () => { saveGame(false); });
  $('btnMute').addEventListener('click', e => { Snd.muted = !Snd.muted; if (Snd.master) Snd.master.gain.value = Snd.muted ? 0 : 0.8; e.target.textContent = Snd.muted ? 'Sound: OFF' : 'Sound: ON'; });
  $('btnHelp').addEventListener('click', () => { hud.help = 18; setPause(false); });
  $('btnQuit').addEventListener('click', () => { saveGame(true); location.reload(); });
  $('shopClose').addEventListener('click', () => Shop.close());
  requestAnimationFrame(t => { lastT = t; frame(t); });
}
function startFromTitle(save) {
  Snd.init(); el.title.style.display = 'none'; lockMouse();
  newGame(save);
}
window.addEventListener('load', boot);
