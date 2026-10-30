'use strict';
// ===================================================================
//  MISSIONS – five story jobs from Maran Anna + Auto-driver side gig
// ===================================================================
const tp = (tx, ty) => ({ x: (tx + 0.5) * TS, y: (ty + 0.5) * TS });
const playerPos = () => player.veh ? { x: player.veh.x, y: player.veh.y } : { x: player.x, y: player.y };
const nearPt = (pt, r) => { const p = playerPos(); return dist(p.x, p.y, pt.x, pt.y) < r; };
const BOOKIE_ROUTE = [[9, 3], [7, 1], [4, 1], [2, 3], [1, 4], [3, 5], [5, 5], [4, 7], [3, 7]]; // node coords (i,j)

const MDEFS = [
  {
    id: 'm1', name: 'Vanakkam, Chennai', reward: 1500, giver: () => ({ ...tp(137, 62), who: 'Pandi', label: 'Pandi' }),
    intro: [
      ['Pandi', 'Machi Muthu! Finally awake? Maran Anna has been calling since morning.'],
      ['Muthu', 'Anna? What does the don want with a broke auto driver like me?'],
      ['Pandi', 'Work, da. A hot biriyani parcel for his T. Nagar office. Take my auto - it is parked right there.'],
      ['Pandi', 'Mind the signals... not that anyone does. And stay away from the police!'],
    ],
    start(m) {
      const p = tp(136, 64); m.veh = Missions.vehicle(m, 'auto', p.x, p.y, Math.PI / 2, { col: '#fbc02d' });
      m.dest = tp(44, 60); m.step = 0;
      Missions.objective(m, "Get into Pandi's auto"); m.blips.push({ x: p.x, y: p.y, label: 'Auto', col: '#ffd54a', follow: m.veh });
      Sub.say('Tip', 'Press E next to a vehicle to get in. W/S = gas/brake, A/D = steer, SPACE = handbrake, H = horn.', 6);
    },
    update(m, dt) {
      if (m.veh.wreck) return Missions.fail('Pandi\'s auto was destroyed!');
      if (m.step === 0 && player.veh === m.veh) {
        m.step = 1; m.blips.length = 0; m.timer = 190; Missions.objective(m, "Deliver the biriyani to Anna's office in T. Nagar");
        m.blips.push({ ...m.dest, label: 'Anna\'s Office', col: '#ffd54a', big: true });
        Sub.say('Pandi', 'T. Nagar, da! Follow the yellow marker. Left side driving, remember?', 4);
      } else if (m.step === 1) {
        if (player.veh !== m.veh) { m.timerPaused = true; if (!m.warned) { Sub.say('Muthu', 'Where is my auto?!', 2); m.warned = true; } Missions.objective(m, "Get back into the auto"); }
        else {
          m.timerPaused = false; m.warned = false; Missions.objective(m, "Deliver the biriyani to Anna's office in T. Nagar");
          if (nearPt(m.dest, 70) && Math.hypot(m.veh.vx, m.veh.vy) < 200) Missions.pass(m, [['Maran Anna', 'Hot biriyani, on time. Not bad for a former auto driver, Muthu.'], ['Maran Anna', 'Come back to me tomorrow. I have a real job for you.']]);
        }
      }
    },
  },
  {
    id: 'm2', name: 'Collection Day', reward: 2500, giver: () => ({ ...tp(44, 60), who: 'Maran Anna', label: 'Maran Anna' }),
    intro: [
      ['Maran Anna', 'Muthu! The biriyani was a little cold, but fine. Listen carefully.'],
      ['Maran Anna', 'Three shopkeepers owe me money. Koyambedu Market, Parry\'s Corner and the Mylapore bazaar.'],
      ['Maran Anna', 'Be polite with the first two. The third one... may need some persuasion.'],
    ],
    start(m) {
      m.stops = [{ ...tp(20, 48), name: 'Koyambedu Market', done: false, line: 'Anna\'s man? Take it, take it - no trouble please!' }, { ...tp(44, 24), name: "Parry's Corner", done: false, line: 'Tell Anna the season was slow... here, take this.' }, { ...tp(80, 72), name: 'Mylapore Bazaar', done: false, fight: true, line: 'You dare come here?! Boys - teach him a lesson!' }];
      m.collected = 0; m.step = 0; m.thugs = [];
      for (const s of m.stops) m.blips.push({ x: s.x, y: s.y, label: s.name, col: '#ffd54a', stop: s });
      Missions.objective(m, 'Collect the money (0/3)');
    },
    update(m, dt) {
      if (m.step === 0) {
        for (const s of m.stops) {
          if (s.done || s.fighting) continue;
          if (nearPt(s, 60) && (!player.veh || Math.hypot(player.veh.vx, player.veh.vy) < 220)) {
            Sub.say('Shopkeeper', s.line, 3.2);
            if (s.fight) {
              s.fighting = true; m.thugs = [];
              for (let k = 0; k < 4; k++) { const e = Missions.enemy(m, s.x + rand(-120, 120), s.y + rand(-60, 60) - 80, k < 3 ? 'bat' : 'pistol'); e.alert = true; e.aggro = 700; m.thugs.push(e); }
              m.blips = m.blips.filter(b => b.stop !== s); Missions.objective(m, 'Deal with the thugs!');
            } else { s.done = true; m.collected++; G.cash += 800; Snd.cash(); popup('+' + fmtMoney(800), s.x, s.y, '#7CFC8A'); m.blips = m.blips.filter(b => b.stop !== s); Missions.objective(m, 'Collect the money (' + m.collected + '/3)'); }
          }
        }
        const f = m.stops.find(s => s.fighting && !s.done);
        if (f && m.thugs.every(t => t.dead)) { f.done = true; m.collected++; G.cash += 800; Snd.cash(); popup('+' + fmtMoney(800), f.x, f.y, '#7CFC8A'); Sub.say('Muthu', 'Collected. Now back to Anna.', 2.5); }
        if (f && !f.done) Missions.objective(m, 'Deal with the thugs! (' + m.thugs.filter(t => !t.dead).length + ' left)');
        else if (!f || f.done) Missions.objective(m, 'Collect the money (' + m.collected + '/3)');
        if (m.collected >= 3) { m.step = 1; m.blips.length = 0; m.dest = tp(44, 60); m.blips.push({ ...m.dest, label: 'Maran Anna', col: '#ffd54a', big: true }); Missions.objective(m, 'Return to Anna in T. Nagar'); }
      } else if (nearPt(m.dest, 70)) Missions.pass(m, [['Maran Anna', 'All three. And no police. You are better than I thought, Muthu.'], ['Maran Anna', 'Meet Dilip at Guindy. He wants a race, and I want my name on the winner\'s side.']]);
    },
  },
  {
    id: 'm3', name: 'Chennai Express', reward: 4000, giver: () => ({ ...tp(20, 72), who: 'Dilip', label: 'Dilip' }),
    intro: [
      ['Dilip', 'Muthu! Heard you drive like an MTC bus driver - scary and unpredictable.'],
      ['Dilip', 'Race me and my cousin. Guindy to Chepauk, through the whole city. Loser buys biriyani for everyone.'],
      ['Muthu', 'No rules?'], ['Dilip', 'Only one rule: do not scratch the bus.'],
    ],
    start(m) {
      m.cps = [[3, 6], [5, 6], [5, 7], [8, 7], [11, 7], [11, 5], [11, 3], [9, 3]].map(([i, j]) => ({ n: j * NI + i, ...nodePos(j * NI + i) }));
      m.idx = 0; m.go = 4.2; m.step = 0;
      const pv = Missions.vehicle(m, 'suv', 22.5 * TS, 73.75 * TS, 0, { col: '#c62828' }); m.pv = pv;
      const r1 = Missions.vehicle(m, 'hatch', 19.5 * TS, 75.3 * TS, 0, { col: '#1565c0' }), r2 = Missions.vehicle(m, 'hatch', 19.5 * TS, 73.75 * TS, 0, { col: '#fdd835' });
      m.rivals = [r1, r2].map((v, k) => { v.driver = { npc: true }; v.ai = { mode: 'script', fn: null, idx: 0, spd: k ? 0.88 : 0.8 }; v.hb = true; return v; });
      for (const v of m.rivals) v.ai.fn = (vv, dt) => Missions.raceAI(m, vv, dt);
      Missions.objective(m, 'Get in the red SUV'); m.blips.push({ x: pv.x, y: pv.y, label: 'Your car', col: '#ffd54a', follow: pv });
    },
    update(m, dt) {
      if (m.step === 0) { if (player.veh) { m.step = 1; m.blips.length = 0; Sub.say('Dilip', 'Ready? 3... 2... 1...', 3.5); } return; }
      if (m.step === 1) {
        m.go -= dt; for (const v of m.rivals) v.hb = true;
        if (m.go < 3.2) Missions.objective(m, 'Race starts in ' + Math.max(0, Math.ceil(m.go - 0.2)));
        if (m.go <= 0.2) { m.step = 2; for (const v of m.rivals) v.hb = false; Banner.show('GO!', '', '#8bc34a', 1); Snd.horn(1, 0.6); Missions.setCP(m); }
        return;
      }
      const cp = m.cps[m.idx];
      if (nearPt(cp, 95)) { m.idx++; Snd.pickup(); if (m.idx >= m.cps.length) return Missions.pass(m, [['Dilip', 'Aiyo, you actually won! My cousin says you cheated.'], ['Muthu', 'Cheating is a tradition in Chennai traffic.']]); Missions.setCP(m); }
      for (const v of m.rivals) if (v.ai.idx >= m.cps.length) return Missions.fail('Dilip\'s cousin won the race!');
      Missions.objective(m, 'Race! Checkpoint ' + (m.idx + 1) + '/' + m.cps.length + ' | Position ' + (1 + m.rivals.filter(v => v.ai.idx > m.idx || (v.ai.idx === m.idx && dist(v.x, v.y, cp.x, cp.y) < dist(playerPos().x, playerPos().y, cp.x, cp.y))).length) + '/3');
    },
  },
  {
    id: 'm4', name: 'The Bookie', reward: 5500, giver: () => ({ ...tp(116, 48), who: 'Maran Anna', label: 'Maran Anna' }),
    intro: [
      ['Maran Anna', 'Sait the bookie sold tonight\'s match - to my rival. Now he is running to the airport with my money.'],
      ['Maran Anna', 'Take that bike outside. Stop his SUV. However you like. Make it loud.'],
      ['Muthu', 'And the police?'], ['Maran Anna', 'Chennai has enough police. Run faster.'],
    ],
    start(m) {
      const b = tp(116, 49); m.bike = Missions.vehicle(m, 'bike', b.x, b.y, -Math.PI / 2, { col: '#b71c1c' });
      m.route = BOOKIE_ROUTE.map(([i, j]) => j * NI + i); m.wp = 0; m.step = 0; m.t0 = 3.5;
      const start = m.route[0];
      // face the SUV along the first leg of his escape route so he never has to U-turn
      const dm = bfsDist(m.route[1]); let sd = 2, best = 1e9;
      for (let d = 0; d < 4; d++) { const nb = neighbor(start, d); if (nb >= 0 && dm[nb] >= 0 && dm[nb] < best) { best = dm[nb]; sd = d; } }
      const sp0 = nodePos(start);   // clear a stretch of road so the chase starts cleanly
      for (let i = vehicles.length - 1; i >= 0; i--) { const o = vehicles[i]; if (o.driver !== player && !o.mission && dist(o.x, o.y, sp0.x, sp0.y) < 420) vehicles.splice(i, 1); }
      const bv = spawnTrafficAt(start, sd, 0.5, 'suv') || spawnTrafficAt(start, (sd + 2) % 4, 0.5, 'suv');
      if (!bv) return Missions.fail('Could not set the scene - try again.');
      bv.mission = true; bv.col = '#15171a'; bv.hp = bv.maxhp = 1100; m.ents.push(bv); m.boss = bv; bv.bossFlag = 'bookie';
      bv.driver = { npc: true }; bv.ai = { mode: 'script', idx: 0, fn: (v, dt) => Missions.bookieAI(m, v, dt) };
      const ev = spawnTrafficAt(start, sd, 0.22, 'hatch');
      if (ev) { ev.mission = true; ev.col = '#6d4c41'; m.ents.push(ev); m.escort = ev; ev.driver = { npc: true }; ev.ai = { mode: 'script', fn: (v, dt) => Missions.escortAI(m, v, dt) }; }
      Missions.objective(m, 'Get on the bike'); m.blips.push({ x: b.x, y: b.y, label: 'Bike', col: '#ffd54a', follow: m.bike });
      m.blips.push({ x: bv.x, y: bv.y, label: 'Sait', col: '#ff5252', follow: bv });
    },
    update(m, dt) {
      if (m.boss.wreck && m.step < 9) { m.step = 9; dropPickup('cash', m.boss.x, m.boss.y, 3000); return Missions.pass(m, [['Maran Anna', 'The bookie is toast. Literally. My money survived?'], ['Muthu', 'Mostly. A little crispy.']]); }
      if (m.step === 0) { if (player.veh) { m.step = 1; Sub.say('Maran Anna', 'He is heading west! Do not let him reach the airport!', 4); } return; }
      Missions.objective(m, "Stop Sait's SUV before he reaches the airport");
      const dd = dist(m.boss.x, m.boss.y, world.airportGate.x, world.airportGate.y);
      if (m.wp >= m.route.length - 1 && dd < 160) return Missions.fail('Sait reached the airport!');
    },
  },
  {
    id: 'm5', name: 'Marina Showdown', reward: 12000, giver: () => ({ ...tp(104, 60), who: 'Maran Anna', label: 'Maran Anna' }),
    intro: [
      ['Maran Anna', 'Kili Kumar and his boys have taken over Marina Beach. My Marina. Where I sold sundal as a boy.'],
      ['Maran Anna', 'End this. Take these - a pistol and a few nattu vedi. Rest is up to you.'],
      ['Muthu', 'One last job, Anna.'], ['Maran Anna', 'The last one. Chennai will remember your name.'],
    ],
    start(m) {
      player.owned.pistol = true; player.ammo.pistol = Math.max(player.ammo.pistol || 0, 90); player.owned.nattu = true; player.ammo.nattu = Math.max(player.ammo.nattu || 0, 4);
      if (player.weapon === 'fist') player.weapon = 'pistol';
      m.arena = tp(143, 56); m.wave = 0; m.step = 0; m.foes = [];
      m.blips.push({ ...m.arena, label: 'Marina Beach', col: '#ff5252', big: true });
      Missions.objective(m, 'Go to Marina Beach');
      for (const [x, y, t, a] of [[137, 52, 'health', 40], [137, 60, 'armor', 60], [139, 50, 'ammo', 40], [139, 63, 'health', 40]]) { const q = tp(x, y); pickups.push({ type: t, x: q.x, y: q.y, amt: a, wk: 'pistol', t: 0, life: 1e9, mission: true }); }
      Sub.say('Tip', 'Aim with the mouse, LEFT CLICK to shoot, Q or the wheel to switch weapon, F to throw a nattu vedi.', 6);
    },
    update(m, dt) {
      if (m.step === 0) { if (nearPt(m.arena, 520)) { m.step = 1; Missions.spawnWave(m, 1); } return; }
      const alive = m.foes.filter(f => !f.dead).length;
      if (m.step === 1) {
        Missions.objective(m, m.wave < 3 ? 'Defeat the gang - wave ' + m.wave + '/3 (' + alive + ' left)' : 'Defeat Kili Kumar!');
        if (alive === 0) { if (m.wave < 3) { m.waitT = 2.5; m.step = 2; } else { m.step = 3; } }
      } else if (m.step === 2) { m.waitT -= dt; if (m.waitT <= 0) { Missions.spawnWave(m, m.wave + 1); m.step = 1; } }
      else if (m.step === 3) {
        Missions.pass(m, [['Kili Kumar', 'Aiyo... Maran Anna sent a rowdy... I mean, a driver?'], ['Muthu', 'An auto driver with a bad temper.'], ['Maran Anna', 'Chennai is ours again, Muthu. Take the city. It is yours.']]); m.step = 4;
      }
    },
  },
];

const Missions = {
  active: null, done: {}, failedLast: null, cooldown: 0,
  load(d) { this.done = d || {}; },
  next() { return MDEFS.find(d => !this.done[d.id]); },
  giverMarker() {
    if (this.active) return null; const d = this.next(); if (!d) return null;
    const g = d.giver(); return { x: g.x, y: g.y, r: 52, col: '#ffd54a', icon: '!', label: g.label + ' - ' + d.name, def: d, mission: true };
  },
  begin(def) {
    this.active = { def, blips: [], ents: [], t: 0, step: 0, text: '', timer: null, timerPaused: false };
    Sub.clear();
    Dialog.start(def.intro, () => {
      Banner.show(def.name.toUpperCase(), 'Reward ' + fmtMoney(def.reward), '#ffd54a', 2.4);
      def.start(this.active);
    });
  },
  objective(m, t) { m.text = t; },
  vehicle(m, type, x, y, a, o) { const v = makeVehicle(type, x, y, a, o); v.mission = true; v.free = true; m.ents.push(v); return v; },
  enemy(m, x, y, weapon, o) { o = o || {}; const e = makePed('enemy', x, y, { weapon, hp: o.hp, shirt: o.shirt, aggro: 600 }); e.mission = true; m.ents.push(e); m.foes && m.foes.push(e); return e; },
  setCP(m) { m.blips.length = 0; const c = m.cps[m.idx], n = m.cps[m.idx + 1]; m.blips.push({ x: c.x, y: c.y, label: 'CP ' + (m.idx + 1), col: '#ffd54a', big: true }); if (n) m.blips.push({ x: n.x, y: n.y, label: '', col: 'rgba(255,213,74,.5)' }); },
  update(dt) {
    Fare.update(dt);
    const m = this.active; if (!m) return;
    m.t += dt;
    if (m.timer != null && !m.timerPaused) { m.timer -= dt; if (m.timer <= 0) return this.fail('Time is up!'); }
    for (const b of m.blips) if (b.follow) { b.x = b.follow.x; b.y = b.follow.y; }
    m.def.update(m, dt);
  },
  cleanup() {
    const m = this.active; if (!m) return;
    for (const e of m.ents) { e.mission = false; if (e.ai && e.ai.mode === 'script' && e.type) { e.ai = null; e.driver = null; e.free = true; e.hb = true; } }
    m.def.cleanup && m.def.cleanup(m);
    for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].mission) pickups.splice(i, 1);
    this.active = null;
  },
  pass(m, outro) {
    if (this.active !== m || m.finished) return; m.finished = true;
    this.done[m.def.id] = true; G.cash += m.def.reward; G.stats.missions++;
    Snd.win(); Banner.show('MISSION PASSED', '+' + fmtMoney(m.def.reward) + '  —  ' + m.def.name, '#8bc34a', 3.6);
    const finalM = !MDEFS.some(d => !this.done[d.id]);
    this.cleanup();
    if (outro && outro.length) setTimeout(() => Dialog.start(outro, () => { if (finalM) Banner.show('CHENNAI IS YOURS', 'சென்னை உன்னுடையது', '#ffd54a', 6); }), 1800);
    saveGame(true);
  },
  fail(reason) {
    const m = this.active; if (!m || m.finished) return; m.finished = true;
    Snd.fail(); Banner.show('MISSION FAILED', reason, '#e53935', 3.2); this.cleanup();
  },
  playerDied() { if (this.active && !this.active.finished) this.fail('You were taken out.'); Fare.stop(); },
  vehDestroyed(v, src) { /* mission handlers poll wreck state */ },
  pedKilled(p, src) { },
  vehEntered(v) { },

  // ---- shared AI helpers
  raceAI(m, v, dt) {
    const ai = v.ai; if (m.step < 2) { v.throttle = 0; v.hb = true; return; }
    if (ai.idx >= m.cps.length) { v.throttle = 0; v.hb = true; return; }
    const cp = m.cps[ai.idx];
    const dd = graphDrive(v, dt, ai, cp.n, { speed: ai.spd * (m.idx > ai.idx + 0 ? 1.12 : 1) * (ai.idx > m.idx && dist(v.x, v.y, playerPos().x, playerPos().y) > 700 ? 0.72 : 1) });
    if (dist(v.x, v.y, cp.x, cp.y) < 100) { ai.idx++; ai.prev = -1; }
  },
  bookieAI(m, v, dt) {
    const ai = v.ai; if (m.step < 1) { v.throttle = 0; v.hb = true; return; }
    const target = m.route[Math.min(m.wp + 1, m.route.length - 1)];
    const pp = playerPos(), close = dist(v.x, v.y, pp.x, pp.y) < 260;
    graphDrive(v, dt, ai, target, { speed: close ? 0.72 : 0.56 });
    const np = nodePos(target); if (dist(v.x, v.y, np.x, np.y) < 130 && m.wp < m.route.length - 1) m.wp++;
    if (Math.random() < dt * 0.4) hornVeh(v);
  },
  escortAI(m, v, dt) {
    const ai = v.ai; if (m.step < 1 || !m.boss || m.boss.wreck) { v.throttle = 0; v.hb = true; return; }
    graphDrive(v, dt, ai, nearestNode(m.boss.x, m.boss.y), { speed: 0.7 });
    const pp = playerPos(), d = dist(v.x, v.y, pp.x, pp.y);
    if (d < 330 && lineClear(v.x, v.y, pp.x, pp.y) && ((ai.shoot = (ai.shoot || 0) - dt) <= 0)) {
      ai.shoot = 0.55; const a = Math.atan2(pp.y - v.y, pp.x - v.x) + rand(-.14, .14);
      fireWeapon({ kind: 'enemy', x: v.x, y: v.y, cd: 0, veh: v, a }, a, 'pistol');
    }
  },
  spawnWave(m, n) {
    m.foes = []; m.wave = n;
    const c = m.arena;
    const spots = (k) => Array.from({ length: k }, (_, i) => ({ x: c.x + rand(-170, 220), y: c.y + rand(-230, 230) }));
    const mk = (k, wp, o) => spots(k).forEach(s => { let x = s.x, y = s.y; if (tileAtPx(x, y) === T.WATER || tileAtPx(x, y) === T.WALL || tileAtPx(x, y) === T.BUILDING) { x = c.x; y = c.y + rand(-100, 100); } const e = Missions.enemy(m, x, y, wp, o); e.alert = true; e.aggro = 900; });
    if (n === 1) { mk(3, 'bat'); mk(3, 'pistol'); Sub.say('Kili Kumar', 'Maran\'s dog has arrived! Get him, boys!', 3); }
    else if (n === 2) { mk(2, 'shotgun'); mk(3, 'pistol'); mk(1, 'bat'); Sub.say('Kili Kumar', 'Is that all you got?! Bring the big guns!', 3); }
    else {
      const boss = Missions.enemy(m, c.x + 110, c.y, 'shotgun', { hp: 300 }); boss.shirt = '#ffd54a'; boss.alert = true; boss.aggro = 1000; boss.isBoss = true; m.blips.push({ x: boss.x, y: boss.y, label: 'Kili Kumar', col: '#ff5252', follow: boss });
      mk(4, 'smg'); Sub.say('Kili Kumar', 'Enough! I will finish you myself, you auto-wala!', 3);
      for (const [x, y, t, a] of [[139, 56, 'health', 60], [147, 52, 'armor', 80], [146, 62, 'ammo', 60]]) { const q = tp(x, y); pickups.push({ type: t, x: q.x, y: q.y, amt: a, wk: 'pistol', t: 0, life: 1e9, mission: true }); }
    }
    Banner.show(n < 3 ? 'WAVE ' + n : 'BOSS', n < 3 ? '' : 'Kili Kumar', '#ff5252', 1.6);
  },
};

// ===================================================================
//  AUTO-DRIVER SIDE JOB
// ===================================================================
const Fare = {
  on: false, state: 'off', pax: null, dest: null, t: 0, limit: 0, pay: 0, earned: 0, count: 0, away: 0, blip: null,
  toggle() {
    if (this.on) { this.stop(true); return; }
    if (Missions.active) { Sub.say('Muthu', 'Not while I am on a job.', 2); return; }
    if (!player.veh || (player.veh.type !== 'auto' && player.veh.type !== 'cab')) { Sub.say('Muthu', 'I need an auto rickshaw or a cab for this.', 2.4); return; }
    this.on = true; this.state = 'seek'; this.earned = 0; this.count = 0;
    Banner.show('AUTO DRIVER', 'Find passengers (green). Press N to stop.', '#66bb6a', 2.6);
  },
  stop(msg) {
    if (this.pax && !this.pax.dead) this.pax.keep = false;
    if (msg && this.on) Banner.show('SHIFT OVER', this.count + ' fares  •  ' + fmtMoney(this.earned), '#66bb6a', 2.6);
    this.on = false; this.state = 'off'; this.pax = null; this.dest = null; this.blip = null;
  },
  update(dt) {
    if (!this.on) return;
    if (Missions.active || player.dead) { this.stop(false); return; }
    const v = player.veh;
    if (!v || (v.type !== 'auto' && v.type !== 'cab')) { this.away += dt; if (this.away > 12) { this.stop(true); } if (this.state !== 'ride') return; } else this.away = 0;
    if (this.state === 'seek') {
      if (!this.pax || this.pax.dead || this.pax.remove) {
        for (let t = 0; t < 40; t++) {
          const ang = rand(0, TAU), r = rand(450, 900), x = player.x + Math.cos(ang) * r, y = player.y + Math.sin(ang) * r;
          if (tileAtPx(x, y) !== T.SIDEWALK) continue;
          const p = makePed('civ', x, y, {}); p.keep = true; p.state = 'idle'; p.stT = 1e6; p.speed = 0; p.fare = true; p.shirt = pick(SHIRTS); this.pax = p; say(p, 'Auto!!'); break;
        }
      } else {
        this.pax.stT = 1e6; this.pax.state = 'idle'; if (Math.random() < dt * 0.3) say(this.pax, pick(['Auto!', 'Anna! Auto!', 'Ey, auto!']));
        this.blip = { x: this.pax.x, y: this.pax.y, label: 'Passenger', col: '#66bb6a' };
        if (v && dist(v.x, v.y, this.pax.x, this.pax.y) < 70 && Math.hypot(v.vx, v.vy) < 110) {
          const lm = pick(world.landmarks.filter(l => { const d = dist(l.x, l.y, v.x, v.y); return d > 1500 && d < 4200 && l.icon !== ''; }).concat(world.markers.filter(m => m.id === 'home' || m.id === 'police')));
          if (!lm) return;
          this.dest = { x: lm.x, y: lm.y, name: lm.name || lm.label }; const d = dist(v.x, v.y, lm.x, lm.y);
          this.limit = d / 150 + 30; this.t = 0; this.pay = Math.round(80 + d * 0.06); this.pax.remove = true; this.pax = null; this.state = 'ride';
          Sub.say('Passenger', pick(['To ' + this.dest.name + ', anna. Meter potunga!', 'Seekiram ' + this.dest.name + ' poga mudiyuma?', this.dest.name + ' please. I am running late!']), 3.5);
          Snd.pickup();
        }
      }
    } else if (this.state === 'ride') {
      this.t += dt; this.blip = { x: this.dest.x, y: this.dest.y, label: this.dest.name, col: '#66bb6a' };
      if (!v) return;
      if (v.wreck) { this.stop(false); return; }
      if (dist(v.x, v.y, this.dest.x, this.dest.y) < 90 && Math.hypot(v.vx, v.vy) < 120) {
        const bonus = Math.max(0, Math.round((this.limit - this.t) * 2.5)), tot = this.pay + bonus;
        G.cash += tot; this.earned += tot; this.count++; Snd.cash();
        popup('+' + fmtMoney(tot), v.x, v.y - 20, '#7CFC8A');
        Sub.say('Passenger', pick(['Super driving, anna! Keep the change.', 'Aiyo, you drive like a pilot! Thanks!', 'Romba nandri!']), 3);
        this.state = 'seek'; this.dest = null; this.pax = null;
      } else if (this.t > this.limit + 25) { Sub.say('Passenger', 'Too late! I will take a bus!', 3); this.state = 'seek'; this.dest = null; }
    }
  },
};

// ===================================================================
//  SAVE / LOAD
// ===================================================================
function saveGame(silent) {
  try {
    const d = { cash: Math.floor(G.cash), done: Missions.done, owned: player.owned, ammo: player.ammo, armor: Math.floor(player.armor), weapon: player.weapon, dayMin: G.dayMin, stats: G.stats };
    localStorage.setItem('gtac_save_v1', JSON.stringify(d));
    if (!silent) { Banner.show('GAME SAVED', '', '#8bc34a', 1.6); }
  } catch (e) { /* storage blocked */ }
}
function loadSave() {
  try { const s = localStorage.getItem('gtac_save_v1'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
