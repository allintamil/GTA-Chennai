'use strict';
// ===================================================================
//  WORLD  –  a stylised, to-scale-ish top-down Chennai
//  North is up. Bay of Bengal (Marina) is on the east edge.
// ===================================================================
const TS = 40, COLS = 156, ROWS = 101, NI = 12, NJ = 9, PER = 12;
const T = { GROUND: 0, ROAD: 1, SIDEWALK: 2, BUILDING: 3, WATER: 4, SAND: 5, GRASS: 6, BRIDGE: 7, TREE: 8, WALL: 9, TARMAC: 10, PLAZA: 11, SHALLOW: 12, RAIL: 13, DIRT: 14 };
const tiles = new Uint8Array(COLS * ROWS);
const VEH_SOLID = new Uint8Array(32), PED_SOLID = new Uint8Array(32);
[T.BUILDING, T.TREE, T.WALL, T.WATER, T.SHALLOW, T.RAIL].forEach(t => VEH_SOLID[t] = 1);
[T.BUILDING, T.TREE, T.WALL].forEach(t => PED_SOLID[t] = 1);

const rx0 = i => 1 + PER * i;          // first tile of vertical road i
const ry0 = j => 1 + PER * j;          // first tile of horizontal road j
const bx0 = bi => 4 + PER * bi;        // first tile of block bi
const by0 = bj => 4 + PER * bj;

function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.WALL;
  return tiles[ty * COLS + tx];
}
const tileAtPx = (x, y) => tileAt(Math.floor(x / TS), Math.floor(y / TS));
const vehSolidAt = (x, y) => VEH_SOLID[tileAtPx(x, y)] === 1;
const pedSolidAt = (x, y) => PED_SOLID[tileAtPx(x, y)] === 1;

const world = {
  buildings: [], trees: [], lamps: [], decor: [], markers: [], landmarks: [], parkedSpawns: [],
  walkSpawns: [], blocked: new Set(), plan: [],
};

// ------------------------------------------------------------------ plan
//  I industrial  S slum  D dense  R residential  O port  H hospital  L police
//  C central stn F fort  P park  G Guindy park  M market  X arms  Y garage
//  T stadium  N T.Nagar  E home  K temple  Q temple tank  W river  A airport
const PLAN = [
  'IISSIDDIOOO',
  'RRDDDHLCDFP',
  'WWWWWWWWWWW',
  'RMRXYDRRRTR',
  'RRDNNDREKQR',
  'RGGDDRRRRSS',
  'WWWWWWWWWWW',
  'AAADRRRRRRR',
];
const NAMES = [
  ['Ennore|எண்ணூர்', 'Ennore|எண்ணூர்', 'Tondiarpet|தண்டையார்பேட்டை', 'Tondiarpet|தண்டையார்பேட்டை', 'Royapuram|ராயபுரம்', 'Royapuram|ராயபுரம்', 'Royapuram|ராயபுரம்', 'Harbour|துறைமுகம்', 'Chennai Port|சென்னை துறைமுகம்', 'Chennai Port|சென்னை துறைமுகம்', 'Chennai Port|சென்னை துறைமுகம்'],
  ['Kolathur|கொளத்தூர்', 'Perambur|பெரம்பூர்', 'Vepery|வேப்பேரி', "Parry's|பாரிஸ்", 'Georgetown|ஜார்ஜ் டவுன்', 'Govt. General Hospital|அரசு பொது மருத்துவமனை', 'Police HQ|காவல் தலைமையகம்', 'Chennai Central|சென்னை சென்ட்ரல்', "Parry's Corner|பாரிஸ் கார்னர்", 'Fort St. George|புனித ஜார்ஜ் கோட்டை', 'Island Grounds|தீவுத்திடல்'],
  Array(11).fill('Cooum River|கூவம் ஆறு'),
  ['Anna Nagar|அண்ணா நகர்', 'Koyambedu Market|கோயம்பேடு சந்தை', 'Aminjikarai|அமைந்தகரை', 'Pudupet|புதுப்பேட்டை', 'Egmore|எழும்பூர்', 'Nungambakkam|நுங்கம்பாக்கம்', 'Chetpet|சேத்துப்பட்டு', 'Triplicane|திருவல்லிக்கேணி', 'Triplicane|திருவல்லிக்கேணி', 'Chepauk Stadium|சேப்பாக்கம் மைதானம்', 'Chepauk|சேப்பாக்கம்'],
  ['Anna Nagar|அண்ணா நகர்', 'Vadapalani|வடபழனி', 'Kodambakkam|கோடம்பாக்கம்', 'T. Nagar|தி. நகர்', 'T. Nagar|தி. நகர்', 'Teynampet|தேனாம்பேட்டை', 'Mandaveli|மந்தைவெளி', 'Mylapore|மயிலாப்பூர்', 'Kapaleeshwarar Temple|கபாலீஸ்வரர் கோயில்', 'Temple Tank|கோயில் குளம்', 'Santhome|சாந்தோம்'],
  ['Virugambakkam|விருகம்பாக்கம்', 'Guindy National Park|கிண்டி தேசியப் பூங்கா', 'Guindy|கிண்டி', 'Saidapet|சைதாப்பேட்டை', 'Saidapet|சைதாப்பேட்டை', 'Alwarpet|ஆழ்வார்பேட்டை', 'R.A. Puram|ராஜா அண்ணாமலைபுரம்', 'Adyar|அடையாறு', 'Santhome|சாந்தோம்', 'Nochikuppam|நொச்சிக்குப்பம்', 'Foreshore Estate|கடற்கரை எஸ்டேட்'],
  Array(11).fill('Adyar River|அடையாறு ஆறு'),
  ['Meenambakkam Airport|மீனம்பாக்கம் விமான நிலையம்', 'Meenambakkam Airport|மீனம்பாக்கம் விமான நிலையம்', 'Meenambakkam Airport|மீனம்பாக்கம் விமான நிலையம்', 'Velachery|வேளச்சேரி', 'Velachery|வேளச்சேரி', 'Thiruvanmiyur|திருவான்மியூர்', 'Indira Nagar|இந்திரா நகர்', 'Adyar|அடையாறு', 'Besant Nagar|பெசன்ட் நகர்', 'Besant Nagar|பெசன்ட் நகர்', "Elliot's Beach|எலியட்ஸ் கடற்கரை"],
];
const VROADS = ['Vandalur Rd', 'Inner Ring Rd', 'Arcot Rd', 'Jawahar Rd', 'Kathipara Rd', 'Poonamallee Hwy', 'Pantheon Rd', 'Anna Salai', 'Mount Rd', 'TTK Rd', 'Bharathi Salai', 'Kamarajar Salai'];
const HROADS = ['Ennore Expressway', 'Tiruvottiyur High Rd', 'EVR Periyar Salai', 'Cooum Bank Rd', 'Sardar Patel Rd', 'Greenways Rd', 'Adyar Bank Rd', 'Rajiv Gandhi Salai', 'East Coast Rd'];

const WALLPAL = ['#e8d9b5', '#d9b38c', '#c97b63', '#a8c4a2', '#8fb3c9', '#d9a0b3', '#e0c068', '#b5a4d0', '#f0e6d2', '#cfd8dc', '#e9a15a', '#86c5b5'];
const CONTPAL = ['#b8382c', '#2f6db5', '#e08a1e', '#2e8b57', '#d8d8d0', '#7b4ea3', '#c9a227'];
const SIGNS = ['ஜவுளி கடை', 'பிரியாணி', 'டீக்கடை', 'மெடிக்கல்', 'நகை மாளிகை', 'சூப்பர் மார்க்கெட்', 'பேக்கரி', 'செல் ஸ்டோர்', 'ஹார்டுவேர்ஸ்', 'சலூன்', 'ஸ்வீட்ஸ்', 'புத்தக நிலையம்', 'Sri Murugan Stores', 'Lakshmi Silks', 'Hotel Tamizh Virundhu', 'Kumaran Gold House', 'Cool Bar · ஜூஸ்', 'Annachi Mess'];
const BIGSIGNS = ['பட்டு சேலை மாளிகை', 'நகை மாளிகை', 'ஜவுளி மாளிகை', 'ELECTRONICS · எலக்ட்ரானிக்ஸ்', 'Sri Vel Textiles', 'Kumaran Gold House', 'தங்க நகைக் கடை', 'Pondy Bazaar Silks', 'Lakshmi Silks · லட்சுமி பட்டு'];

let R = mulberry32(1639);
const rr = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(a + R() * (b - a + 1));
const rpick = a => a[Math.floor(R() * a.length)];

function setT(x, y, t) { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) tiles[y * COLS + x] = t; }
function fillT(x, y, w, h, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setT(x + i, y + j, t); }
function addB(x, y, w, h, p) {
  fillT(x, y, w, h, T.BUILDING);
  const b = Object.assign({ x, y, w, h, col: '#d9c9a9', hgt: 12, kind: 'house' }, p || {});
  world.buildings.push(b); return b;
}
function addTree(px, py, r, col, solid) { world.trees.push({ x: px, y: py, r, c: col || '#2f7a35', solid: !!solid }); }
function addDecor(type, px, py, p) { world.decor.push(Object.assign({ type, x: px, y: py, a: 0 }, p || {})); }
function addMarker(id, tx, ty, p) { const m = Object.assign({ id, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, r: 46, col: '#ffd54a', label: id }, p || {}); world.markers.push(m); return m; }
function addLandmark(name, ta, tx, ty, icon) { world.landmarks.push({ name, ta, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, icon: icon || '' }); }

function bsp(rx, ry, rw, rh, o) {
  const q = [[rx, ry, rw, rh]];
  while (q.length) {
    const [x, y, w, h] = q.pop();
    const cv = w >= 5, ch = h >= 5;
    if ((cv || ch) && R() < o.split) {
      if (cv && (!ch || R() < 0.5)) { const cut = ri(2, w - 3); fillT(x + cut, y, 1, h, o.alley); q.push([x, y, cut, h], [x + cut + 1, y, w - cut - 1, h]); }
      else { const cut = ri(2, h - 3); fillT(x, y + cut, w, 1, o.alley); q.push([x, y, w, cut], [x, y + cut + 1, w, h - cut - 1]); }
    } else o.leaf(x, y, w, h);
  }
}

// ------------------------------------------------------------------ block builders
function ring(bx, by) {
  for (let k = 0; k < 9; k++) { setT(bx + k, by, T.SIDEWALK); setT(bx + k, by + 8, T.SIDEWALK); setT(bx, by + k, T.SIDEWALK); setT(bx + 8, by + k, T.SIDEWALK); }
}
function blockDense(bx, by, tall) {
  fillT(bx + 1, by + 1, 7, 7, T.SIDEWALK);
  bsp(bx + 1, by + 1, 7, 7, {
    split: 0.85, alley: T.SIDEWALK,
    leaf(x, y, w, h) {
      if (!tall && R() < 0.07) { fillT(x, y, w, h, T.PLAZA); return; }
      const sign = tall ? rpick(BIGSIGNS) : (R() < 0.7 ? rpick(SIGNS) : null);
      addB(x, y, w, h, { kind: w * h > 12 || R() < 0.4 ? 'apt' : 'shop', col: rpick(WALLPAL), hgt: tall ? ri(16, 26) : ri(10, 20), sign, signCol: rpick(['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#e65100', '#00695c']), neon: tall });
    },
  });
}
function blockResi(bx, by) {
  fillT(bx + 1, by + 1, 7, 7, T.SIDEWALK);
  bsp(bx + 1, by + 1, 7, 7, {
    split: 0.9, alley: T.SIDEWALK,
    leaf(x, y, w, h) {
      if (R() < 0.3) { fillT(x, y, w, h, T.GRASS); if (R() < 0.8) addTree((x + w / 2) * TS, (y + h / 2) * TS, rr(18, 26)); return; }
      addB(x, y, w, h, { kind: 'house', col: rpick(WALLPAL), hgt: ri(8, 14) });
    },
  });
}
function blockSlum(bx, by) {
  fillT(bx + 1, by + 1, 7, 7, T.DIRT);
  bsp(bx + 1, by + 1, 7, 7, {
    split: 1, alley: T.DIRT,
    leaf(x, y, w, h) {
      if (R() < 0.12) return;
      addB(x, y, w, h, { kind: 'tin', col: rpick(['#8d6e63', '#78909c', '#a1887f']), hgt: ri(5, 7), tarp: rpick(['#2f6fb5', '#d84315', '#388e3c', '#fbc02d']) });
    },
  });
}
function blockPark(bx, by, dens) {
  fillT(bx + 1, by + 1, 7, 7, T.GRASS);
  for (let k = 1; k <= 7; k++) { setT(bx + 4, by + k, T.PLAZA); setT(bx + k, by + 4, T.PLAZA); }
  fillT(bx + 3, by + 3, 3, 3, T.PLAZA);
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) {
    if (tiles[(by + y) * COLS + bx + x] !== T.GRASS) continue;
    if (R() < dens) { setT(bx + x, by + y, T.TREE); addTree((bx + x + 0.5) * TS + rr(-4, 4), (by + y + 0.5) * TS + rr(-4, 4), rr(24, 34), rpick(['#2f7a35', '#3b8d3a', '#276b30']), true); }
  }
}
function blockIndustrial(bx, by) {
  fillT(bx + 1, by + 1, 7, 7, T.TARMAC);
  bsp(bx + 1, by + 1, 7, 7, { split: 0.45, alley: T.TARMAC, leaf(x, y, w, h) { if (R() < 0.15) return; addB(x, y, w, h, { kind: 'wh', col: rpick(['#9aa5ad', '#b0a58f', '#8a9aa5']), hgt: 14 }); } });
}
function blockPort(bx, by) {
  fillT(bx + 1, by + 1, 7, 7, T.TARMAC);
  for (let y = 1; y <= 7; y += 2) {
    let x = 1;
    while (x <= 6) {
      if (R() < 0.7) { addB(bx + x, by + y, 3, 1, { kind: 'cont', col: rpick(CONTPAL), hgt: ri(8, 14) }); x += 4; } else x += 1;
    }
  }
}
function blockMarket(bx, by) {
  fillT(bx + 1, by + 1, 7, 7, T.DIRT);
  for (const y of [2, 5]) for (let k = 0; k < 3; k++) addB(bx + 1 + k * 3 + (y === 5 ? 1 : 0), by + y, 2, 1, { kind: 'stall', col: '#9c8f7a', hgt: 5, aw: [rpick(['#e53935', '#fb8c00', '#fdd835', '#43a047']), '#f5f5f5'] });
  for (let k = 0; k < 6; k++) addDecor('crates', (bx + rr(1.2, 7.8)) * TS, (by + rr(1.2, 7.8)) * TS, { a: rr(0, TAU) });
}
function ringComplex(bx, by, kind, col, hgt, gates) {
  // 7x7 perimeter at inner coords 1..7, `gates` = list of 'N','S','E','W' that have a 3-wide opening
  const g = s => gates.includes(s);
  const top = bx + 1, left = by + 1;
  const seg = (x, y, w, h) => { if (w > 0 && h > 0) addB(x, y, w, h, { kind, col, hgt }); };
  if (g('N')) { seg(top, left, 2, 1); seg(top + 5, left, 2, 1); } else seg(top, left, 7, 1);
  if (g('S')) { seg(top, left + 6, 2, 1); seg(top + 5, left + 6, 2, 1); } else seg(top, left + 6, 7, 1);
  if (g('W')) { seg(top, left + 1, 1, 1); seg(top, left + 5, 1, 1); } else seg(top, left + 1, 1, 5);
  if (g('E')) { seg(top + 6, left + 1, 1, 1); seg(top + 6, left + 5, 1, 1); } else seg(top + 6, left + 1, 1, 5);
}

function buildBlock(code, bi, bj) {
  const bx = bx0(bi), by = by0(bj);
  ring(bx, by);
  switch (code) {
    case 'D': blockDense(bx, by, false); break;
    case 'N': blockDense(bx, by, true); break;
    case 'R': blockResi(bx, by); break;
    case 'S': blockSlum(bx, by); break;
    case 'P': blockPark(bx, by, 0.14); break;
    case 'G': blockPark(bx, by, 0.4); break;
    case 'I': blockIndustrial(bx, by); break;
    case 'O': blockPort(bx, by); break;
    case 'M': blockMarket(bx, by); world.marketBlocks = (world.marketBlocks || []).concat([[bi, bj]]); break;
    case 'H':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      addB(bx + 1, by + 1, 7, 5, { kind: 'hospital', col: '#f2f2f2', hgt: 22, sign: 'அரசு பொது மருத்துவமனை · GOVT. GENERAL HOSPITAL', signCol: '#1565c0' });
      addMarker('hospital', bx + 4, by + 7, { col: '#ff5252', label: 'Hospital', icon: '+' });
      addLandmark('Govt. General Hospital', 'அரசு பொது மருத்துவமனை', bx + 4, by + 3, '+');
      break;
    case 'L':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      addB(bx + 1, by + 1, 7, 4, { kind: 'police', col: '#2c4a8c', hgt: 18, sign: 'காவல்துறை · POLICE HEADQUARTERS', signCol: '#0d1b4a' });
      addMarker('police', bx + 4, by + 7, { col: '#5c8dff', label: 'Police Station', icon: 'P' });
      for (let k = 0; k < 3; k++) world.parkedSpawns.push({ type: 'police', x: (bx + 1.8 + k * 2.2) * TS, y: (by + 6) * TS, a: Math.PI / 2 });
      addLandmark('Police HQ', 'காவல் தலைமையகம்', bx + 4, by + 3, 'P');
      break;
    case 'C':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      addB(bx + 1, by + 1, 7, 4, { kind: 'central', col: '#8e3b2f', hgt: 20, sign: 'சென்னை சென்ட்ரல் · CHENNAI CENTRAL', signCol: '#5d1f17' });
      fillT(bx + 1, by + 5, 7, 3, T.RAIL);
      addLandmark('Chennai Central', 'சென்னை சென்ட்ரல்', bx + 4, by + 3, 'R');
      break;
    case 'F': {
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      ringComplex(bx, by, 'fortwall', '#c8b78f', 16, ['S']);
      fillT(bx + 2, by + 2, 5, 5, T.GRASS);
      addB(bx + 3, by + 3, 3, 2, { kind: 'colonial', col: '#f3e9c9', hgt: 14, sign: 'கோட்டை · SECRETARIAT', signCol: '#7a3b1e' });
      addDecor('flag', (bx + 4.5) * TS, (by + 6) * TS);
      addLandmark('Fort St. George', 'புனித ஜார்ஜ் கோட்டை', bx + 4, by + 4, 'F');
      break;
    }
    case 'T': {
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      ringComplex(bx, by, 'stand', '#2b4f9e', 18, ['W', 'E']);
      fillT(bx + 2, by + 2, 5, 5, T.GRASS);
      addDecor('pitch', (bx + 4.5) * TS, (by + 4.5) * TS);
      addLandmark('Chepauk Stadium', 'சேப்பாக்கம் மைதானம்', bx + 4, by + 4, 'C');
      break;
    }
    case 'K': {
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      const seg = (x, y, w, h, kind) => addB(x, y, w, h, { kind: kind || 'templewall', col: '#f4efe2', hgt: kind ? 34 : 14 });
      seg(bx + 1, by + 1, 7, 1);
      seg(bx + 1, by + 7, 2, 1); seg(bx + 6, by + 7, 2, 1); seg(bx + 3, by + 7, 3, 1, 'gopuram');
      seg(bx + 1, by + 2, 1, 2); seg(bx + 1, by + 5, 1, 2);
      seg(bx + 7, by + 2, 1, 2); seg(bx + 7, by + 5, 1, 2);
      addB(bx + 3, by + 3, 3, 3, { kind: 'shrine', col: '#e9d9b0', hgt: 20 });
      addLandmark('Kapaleeshwarar Temple', 'கபாலீஸ்வரர் கோயில்', bx + 4, by + 4, 'T');
      world.templePos = { x: (bx + 4.5) * TS, y: (by + 4.5) * TS };
      break;
    }
    case 'Q':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      fillT(bx + 2, by + 2, 5, 5, T.WATER);
      setT(bx + 4, by + 4, T.PLAZA);
      addDecor('mandapam', (bx + 4.5) * TS, (by + 4.5) * TS);
      for (let k = 2; k <= 6; k++) addTree((bx + k + 0.5) * TS, (by + 1.5) * TS, 18, '#2f7a35');
      break;
    case 'Y':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      addB(bx + 1, by + 1, 7, 2, { kind: 'garage', col: '#455a64', hgt: 14, sign: 'ராஜா கேரேஜ் · PAY N\' SPRAY', signCol: '#ff6f00' });
      addMarker('garage', bx + 4, by + 5, { col: '#4fc3f7', label: "Raja's Pay N' Spray", icon: '⚒', r: 60 });
      break;
    case 'X':
      fillT(bx + 1, by + 1, 7, 7, T.PLAZA);
      addB(bx + 2, by + 1, 5, 3, { kind: 'shop', col: '#5e35b1', hgt: 14, sign: 'முருகன் ஆயுதக் கடை · ARMS', signCol: '#311b92' });
      addMarker('arms', bx + 4, by + 4, { col: '#e040fb', label: 'Murugan Arms', icon: '$' });
      addB(bx + 1, by + 5, 2, 2, { kind: 'shop', col: rpick(WALLPAL), hgt: 10, sign: rpick(SIGNS) });
      addB(bx + 6, by + 5, 2, 2, { kind: 'shop', col: rpick(WALLPAL), hgt: 10, sign: rpick(SIGNS) });
      break;
    case 'E':
      fillT(bx + 1, by + 1, 7, 7, T.GRASS);
      addB(bx + 1, by + 1, 7, 4, { kind: 'apt', col: '#7ec8a4', hgt: 16, sign: 'முத்து இல்லம் · HOME', signCol: '#1b5e20' });
      addTree((bx + 2) * TS, (by + 6.4) * TS, 22); addTree((bx + 6.8) * TS, (by + 6.4) * TS, 20);
      fillT(bx + 4, by + 5, 1, 3, T.PLAZA);
      addMarker('home', bx + 4, by + 8, { col: '#35d07f', label: 'Home (save)', icon: '⌂' });
      world.homePos = { x: (bx + 4.5) * TS, y: (by + 8.5) * TS };
      break;
  }
}

// ------------------------------------------------------------------ the rivers
function riverCenter(x, by) {
  let best = -1;
  for (let i = 0; i < NI; i++) if (Math.abs(x - (rx0(i) + 1)) <= 3) { best = i; break; }
  const xx = best >= 0 ? rx0(best) + 1 : x;
  const phase = by === by0(2) ? 0.6 : 2.1;
  return by + 4 + Math.round(1.25 * Math.sin(xx * 0.26 + phase));
}
function buildRiver(bj) {
  const by = by0(bj);
  for (let bi = 0; bi < 11; bi++) {
    const bx = bx0(bi);
    ring(bx, by); fillT(bx + 1, by + 1, 7, 7, T.GRASS);
  }
  for (let x = 1; x <= 146; x++) {
    const cy = riverCenter(x, by);
    // gap for the roads: keep rows cy-1..cy+1 as river
    for (let y = by + 1; y <= by + 7; y++) {
      const t = tiles[y * COLS + x];
      if (t === T.ROAD) continue;
      if (Math.abs(y - cy) <= 1) setT(x, y, T.WATER);
      else if (Math.abs(y - cy) === 2 && t !== T.SIDEWALK) setT(x, y, T.SAND);
    }
    for (let y = by; y <= by + 8; y++) { // sidewalks that cross the water
      if (Math.abs(y - cy) <= 1 && tiles[y * COLS + x] === T.SIDEWALK) setT(x, y, T.WATER);
    }
  }
  // bridges where vertical roads cross the water
  for (let i = 0; i < NI; i++) {
    const cxm = rx0(i) + 1;
    const cy = riverCenter(cxm, by);
    for (let x = rx0(i) - 1; x <= rx0(i) + 3; x++) for (let y = cy - 1; y <= cy + 1; y++) setT(x, y, T.BRIDGE);
  }
  // water under the road tiles themselves (road rows inside river rows) were skipped above: set them as bridge
  for (let i = 0; i < NI; i++) {
    const cy = riverCenter(rx0(i) + 1, by);
    for (let x = rx0(i); x <= rx0(i) + 2; x++) for (let y = cy - 1; y <= cy + 1; y++) setT(x, y, T.BRIDGE);
  }
  // shacks on the river banks
  for (let k = 0; k < 40; k++) {
    const x = ri(4, 134), y = by + ri(1, 6);
    let ok = true;
    for (let a = -1; a <= 2 && ok; a++) for (let b = -1; b <= 2; b++) {
      const t = tileAt(x + a, y + b), inside = a >= 0 && a <= 1 && b >= 0 && b <= 1;
      if ((inside && t !== T.GRASS) || t === T.BUILDING) { ok = false; break; }
    }
    if (ok && R() < 0.8) addB(x, y, 2, 2, { kind: 'tin', col: rpick(['#8d6e63', '#78909c', '#a1887f']), hgt: 5, tarp: rpick(['#2f6fb5', '#d84315', '#388e3c', '#fbc02d']) });
  }
  for (let k = 0; k < 60; k++) {
    const x = ri(4, 134), y = by + ri(1, 7);
    if (tileAt(x, y) === T.GRASS) addTree((x + 0.5) * TS, (y + 0.5) * TS, rr(14, 22));
  }
}

// ------------------------------------------------------------------ airport
function buildAirport() {
  const x1 = 4, x2 = 36, y1 = 88, y2 = 96;
  fillT(x1, y1, x2 - x1 + 1, y2 - y1 + 1, T.TARMAC);
  addB(6, 88, 17, 3, { kind: 'terminal', col: '#90a4ae', hgt: 18, sign: 'சென்னை விமான நிலையம் · CHENNAI AIRPORT', signCol: '#0d47a1' });
  addB(27, 88, 8, 3, { kind: 'wh', col: '#b0bec5', hgt: 16 });
  for (let k = 0; k < 4; k++) addDecor('plane', (8 + k * 5.5) * TS, 92.4 * TS, { a: 0, col: ['#ffffff', '#e0e0e0', '#fafafa', '#f5f5f5'][k], tail: ['#c62828', '#1565c0', '#2e7d32', '#ef6c00'][k] });
  addDecor('runway', 20.5 * TS, 94.5 * TS, { len: 33 * TS });
  // airport has no through-roads
  for (const i of [1, 2]) { world.blocked.add((7 * NI + i) * 4 + 1); world.blocked.add((8 * NI + i) * 4 + 3); }
  addLandmark('Chennai Airport', 'விமான நிலையம்', 14, 90, '✈');
  world.airportGate = { x: (rx0(3) + 1.5) * TS, y: (ry0(7) + 1.5) * TS };
}

// ------------------------------------------------------------------ nav graph
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const nodeX = i => (rx0(i) + 1.5) * TS, nodeY = j => (ry0(j) + 1.5) * TS;
function nodePos(n) { return { x: nodeX(n % NI), y: nodeY(Math.floor(n / NI)) }; }
function nearestNode(x, y) {
  const i = clamp(Math.round((x / TS - 2.5) / PER), 0, NI - 1), j = clamp(Math.round((y / TS - 2.5) / PER), 0, NJ - 1);
  return j * NI + i;
}
function neighbor(n, d) {
  const i = n % NI + DX[d], j = Math.floor(n / NI) + DY[d];
  if (i < 0 || j < 0 || i >= NI || j >= NJ) return -1;
  if (world.blocked.has(n * 4 + d)) return -1;
  return j * NI + i;
}
function bfsDist(target) {
  const dist = new Int16Array(NI * NJ).fill(-1); dist[target] = 0;
  const q = [target];
  for (let h = 0; h < q.length; h++) {
    const n = q[h];
    for (let d = 0; d < 4; d++) { const m = neighbor(n, d); if (m >= 0 && dist[m] < 0) { dist[m] = dist[n] + 1; q.push(m); } }
  }
  return dist;
}
// left-hand traffic: lane centre offset from the road centre line for a vehicle heading in dir d
const LANE = 30;
function laneAxis(d) { return d === 0 ? [0, -LANE] : d === 1 ? [LANE, 0] : d === 2 ? [0, LANE] : [-LANE, 0]; }

// raycast over tiles: true if the straight line is not blocked by buildings/trees/walls
function lineClear(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const tt = tileAtPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    if (tt === T.BUILDING || tt === T.WALL || tt === T.TREE) return false;
  }
  return true;
}

// ------------------------------------------------------------------ names / density
function blockOf(x, y) {
  return { bi: clamp(Math.floor((x / TS - 4) / PER), 0, 10), bj: clamp(Math.floor((y / TS - 4) / PER), 0, 7) };
}
function districtAt(x, y) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  let s;
  if (tx >= 147) s = 'Bay of Bengal|வங்காள விரிகுடா';
  else if (tx >= 136) {
    if (ty < 36) s = 'Chennai Port|சென்னை துறைமுகம்';
    else if (ty < 76) s = 'Marina Beach|மெரினா கடற்கரை';
    else s = "Elliot's Beach|எலியட்ஸ் கடற்கரை";
  } else {
    const b = blockOf(x, y);
    s = NAMES[b.bj][b.bi];
  }
  const p = s.split('|'); return { en: p[0], ta: p[1] };
}
function streetAt(x, y) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  const t = tileAt(tx, ty);
  if (t !== T.ROAD && t !== T.BRIDGE) return '';
  const i = Math.round((tx - 2.5) / PER), j = Math.round((ty - 2.5) / PER);
  const onV = i >= 0 && i < NI && Math.abs(tx - (rx0(i) + 1)) <= 1;
  const onH = j >= 0 && j < NJ && Math.abs(ty - (ry0(j) + 1)) <= 1;
  if (onV && !onH) return VROADS[i];
  if (onH && !onV) return HROADS[j];
  if (onV && onH) return VROADS[i];
  return '';
}
function pedDensityAt(tx, ty) {
  if (tx >= 136) return (ty > 38 && ty < 80) ? 1.4 : 0.25;
  const b = blockOf(tx * TS, ty * TS);
  const c = PLAN[b.bj][b.bi];
  return { D: 1.3, N: 2.4, M: 3, S: 1.6, R: 0.8, P: 1, G: 0.45, I: 0.35, O: 0.2, H: 1.4, L: 0.8, C: 2, F: 0.7, T: 1, K: 2, Q: 1.2, W: 0.5, A: 0.4, X: 1, Y: 0.6, E: 0.9 }[c] || 1;
}

// ------------------------------------------------------------------ generation
function genWorld() {
  R = mulberry32(1639);
  tiles.fill(T.GROUND);
  for (let y = 0; y < ROWS; y++) for (let x = 136; x < COLS; x++) tiles[y * COLS + x] = x === 136 ? T.SIDEWALK : x <= 146 ? T.SAND : x <= 148 ? T.SHALLOW : x <= 152 ? T.WATER : T.WALL;
  for (let i = 0; i < NI; i++) fillT(rx0(i), 1, 3, ROWS - 2, T.ROAD);
  for (let j = 0; j < NJ; j++) fillT(1, ry0(j), 135, 3, T.ROAD);
  for (let bj = 0; bj < 8; bj++) for (let bi = 0; bi < 11; bi++) {
    const code = PLAN[bj][bi];
    if (code === 'W' || code === 'A') continue;
    buildBlock(code, bi, bj);
  }
  buildRiver(2); buildRiver(6);
  buildAirport();
  // borders
  for (let x = 0; x < COLS; x++) { setT(x, 0, T.WALL); setT(x, ROWS - 1, T.WALL); }
  for (let y = 0; y < ROWS; y++) setT(0, y, T.WALL);

  // ---- Marina beach dressing
  addB(138, 56, 2, 2, { kind: 'light', col: '#f5f5f5', hgt: 56 });
  addLandmark('Marina Lighthouse', 'கலங்கரை விளக்கம்', 139, 57, '⚓');
  addLandmark('Marina Beach', 'மெரினா கடற்கரை', 141, 48, '☀');
  addLandmark('Elliot\'s Beach', 'எலியட்ஸ் கடற்கரை', 141, 90, '☀');
  addLandmark('Besant Nagar', 'பெசன்ட் நகர்', 118, 92, '');
  addLandmark('T. Nagar', 'தி. நகர்', 46, 58, '★');
  addLandmark('Koyambedu Market', 'கோயம்பேடு சந்தை', 18, 44, '');
  addLandmark('Guindy Park', 'கிண்டி பூங்கா', 22, 68, '');
  addLandmark('Chennai Port', 'சென்னை துறைமுகம்', 120, 8, '⚓');
  addLandmark('Anna Nagar', 'அண்ணா நகர்', 8, 52, '');
  addLandmark('Kapaleeshwarar Tank', 'கோயில் குளம்', bx0(9) + 4, by0(4) + 4, '');
  for (let y = 40; y < 90; y += 3) {
    if (R() < 0.55) addDecor('umbrella', (137.3 + rr(0, 2)) * TS, (y + rr(0, 2)) * TS, { col: rpick(['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5']) });
    if (y > 62 && y < 76 && R() < 0.8) addDecor('boat', (138 + rr(1, 8)) * TS, (y + rr(0, 2)) * TS, { a: rr(-0.3, 0.3) + Math.PI / 2 * (R() < 0.5 ? 0 : 0), col: rpick(['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#c62828']) });
  }
  for (let y = 5; y < ROWS - 3; y += 3) addTree(136.5 * TS, (y + 0.5) * TS, 22, '#3a8a3e', false), world.trees[world.trees.length - 1].palm = true;

  // ---- lamps and sidewalk trees along every block ring
  for (let bj = 0; bj < 8; bj++) for (let bi = 0; bi < 11; bi++) {
    const bx = bx0(bi), by = by0(bj);
    if (PLAN[bj][bi] === 'W' || PLAN[bj][bi] === 'A') continue;
    for (const [a, b] of [[0, 0], [8, 0], [0, 8], [8, 8], [4, 0], [4, 8], [0, 4], [8, 4]]) world.lamps.push({ x: (bx + a + 0.5) * TS, y: (by + b + 0.5) * TS });
    for (let k = 1; k < 8; k++) {
      if (hash2(bx + k, by) < 0.1) addTree((bx + k + 0.5) * TS, (by + 0.5) * TS, rr(16, 22));
      if (hash2(bx + k, by + 8) < 0.1) addTree((bx + k + 0.5) * TS, (by + 8.5) * TS, rr(16, 22));
    }
  }
  // spawn tables for walkers
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 3; x++) {
    const t = tiles[y * COLS + x];
    if (t === T.SIDEWALK || t === T.PLAZA || t === T.DIRT || (t === T.SAND && x < 144) || t === T.GRASS) world.walkSpawns.push(y * COLS + x);
  }
  buildBuckets();
}

// ------------------------------------------------------------------ spatial buckets for chunk rendering
const CH = 16, CHP = CH * TS, CHX = Math.ceil(COLS / CH), CHY = Math.ceil(ROWS / CH);
const bucketB = new Map(), bucketD = new Map(), bucketT = new Map(), bucketL = new Map();
function putBucket(map, item, x1, y1, x2, y2) {
  for (let cy = clamp(Math.floor(y1 / CHP), 0, CHY - 1); cy <= clamp(Math.floor(y2 / CHP), 0, CHY - 1); cy++)
    for (let cx = clamp(Math.floor(x1 / CHP), 0, CHX - 1); cx <= clamp(Math.floor(x2 / CHP), 0, CHX - 1); cx++) {
      const k = cy * 64 + cx; let a = map.get(k); if (!a) map.set(k, a = []); a.push(item);
    }
}
function buildBuckets() {
  for (const b of world.buildings) putBucket(bucketB, b, b.x * TS - 6, b.y * TS - b.hgt - 70, (b.x + b.w) * TS + b.hgt + 8, (b.y + b.h) * TS + b.hgt + 8);
  for (const d of world.decor) putBucket(bucketD, d, d.x - 220, d.y - 120, d.x + 220, d.y + 120);
  for (const t of world.trees) putBucket(bucketT, t, t.x - t.r - 4, t.y - t.r - 4, t.x + t.r + 4, t.y + t.r + 4);
  for (const l of world.lamps) putBucket(bucketL, l, l.x - 2, l.y - 2, l.x + 2, l.y + 2);
}
const treesInChunk = (cx, cy) => bucketT.get(cy * 64 + cx) || [];
const lampsInChunk = (cx, cy) => bucketL.get(cy * 64 + cx) || [];

// ------------------------------------------------------------------ painting
const chunkCache = new Map();
function getChunk(cx, cy) {
  const k = cy * 64 + cx;
  let e = chunkCache.get(k);
  if (e) { chunkCache.delete(k); chunkCache.set(k, e); return e; }
  e = renderChunk(cx, cy);
  chunkCache.set(k, e);
  if (chunkCache.size > 34) chunkCache.delete(chunkCache.keys().next().value);
  return e;
}

function paintTile(c, tx, ty, px, py) {
  const t = tiles[ty * COLS + tx], h = hash2(tx, ty);
  let col;
  switch (t) {
    case T.ROAD: col = h < 0.5 ? '#3b3e44' : '#3e4147'; break;
    case T.BRIDGE: col = '#575a60'; break;
    case T.SIDEWALK: col = h < 0.5 ? '#a9a090' : '#b0a797'; break;
    case T.GROUND: col = '#8a7f6a'; break;
    case T.BUILDING: col = '#6d665b'; break;
    case T.SAND: col = h < 0.5 ? '#dcc590' : '#e2cc98'; break;
    case T.GRASS: case T.TREE: col = h < 0.33 ? '#5a8c3c' : h < 0.66 ? '#5f9140' : '#558738'; break;
    case T.TARMAC: col = '#4b4f57'; break;
    case T.PLAZA: col = h < 0.5 ? '#cdbb9f' : '#c5b394'; break;
    case T.RAIL: col = '#6a645a'; break;
    case T.DIRT: col = h < 0.5 ? '#a0805a' : '#98784f'; break;
    case T.WATER: col = tx >= 147 ? '#1d6aa5' : (ty < 60 ? '#4d6a4f' : '#3d7d86'); break;
    case T.SHALLOW: col = '#3fb0c4'; break;
    case T.WALL: col = tx >= 149 ? '#165a8f' : '#55524d'; break;
    default: col = '#888';
  }
  c.fillStyle = col; c.fillRect(px, py, TS, TS);
  switch (t) {
    case T.SIDEWALK: c.strokeStyle = 'rgba(0,0,0,.09)'; c.lineWidth = 1; c.strokeRect(px + .5, py + .5, TS - 1, TS - 1); break;
    case T.PLAZA: c.strokeStyle = 'rgba(0,0,0,.08)'; c.strokeRect(px + .5, py + .5, TS / 2, TS / 2); c.strokeRect(px + TS / 2 + .5, py + TS / 2 + .5, TS / 2 - 1, TS / 2 - 1); break;
    case T.ROAD: case T.TARMAC:
      c.fillStyle = 'rgba(255,255,255,.035)'; for (let k = 0; k < 3; k++) c.fillRect(px + hash2(tx * 7 + k, ty) * 36, py + hash2(tx, ty * 7 + k) * 36, 2, 2);
      break;
    case T.SAND: c.fillStyle = 'rgba(120,90,40,.12)'; for (let k = 0; k < 4; k++) c.fillRect(px + hash2(tx * 5 + k, ty) * 38, py + hash2(tx, ty * 5 + k) * 38, 2, 1.5); break;
    case T.GRASS: case T.TREE: c.fillStyle = 'rgba(30,70,20,.2)'; for (let k = 0; k < 5; k++) c.fillRect(px + hash2(tx * 3 + k, ty) * 38, py + hash2(tx, ty * 3 + k) * 38, 2, 3); break;
    case T.DIRT: c.fillStyle = 'rgba(60,40,20,.2)'; for (let k = 0; k < 5; k++) c.fillRect(px + hash2(tx * 3 + k, ty) * 38, py + hash2(tx, ty * 3 + k) * 38, 3, 2); break;
    case T.RAIL: {
      c.fillStyle = '#4a3b2e'; for (let s = 0; s < 4; s++) c.fillRect(px + s * 10 + 3, py + 4, 4, 32);
      c.fillStyle = '#bdbdbd'; c.fillRect(px, py + 10, TS, 3); c.fillRect(px, py + 27, TS, 3);
      break;
    }
    case T.BRIDGE: {
      const up = tileAt(tx, ty - 1) === T.WATER, dn = tileAt(tx, ty + 1) === T.WATER, lf = tileAt(tx - 1, ty) === T.WATER, rt = tileAt(tx + 1, ty) === T.WATER;
      c.fillStyle = '#d8d4c8';
      if (up) c.fillRect(px, py, TS, 5); if (dn) c.fillRect(px, py + TS - 5, TS, 5);
      if (lf) c.fillRect(px, py, 5, TS); if (rt) c.fillRect(px + TS - 5, py, 5, TS);
      c.fillStyle = 'rgba(0,0,0,.35)';
      if (up) for (let s = 0; s < 4; s++) c.fillRect(px + s * 10 + 4, py, 2, 5);
      if (dn) for (let s = 0; s < 4; s++) c.fillRect(px + s * 10 + 4, py + TS - 5, 2, 5);
      break;
    }
    case T.WATER: if (tx < 147) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(px, py, TS, TS); } break;
  }
}

function drawRoadMarkings(c, ox, oy, cx, cy) {
  const x1 = ox, x2 = ox + CHP, y1 = oy, y2 = oy + CHP;
  c.fillStyle = 'rgba(240,240,225,.75)';
  // dashed centre lines
  for (let j = 0; j < NJ; j++) {
    const yc = (ry0(j) + 1.5) * TS; if (yc < y1 - 4 || yc > y2 + 4) continue;
    for (let x = Math.floor(x1 / 80) * 80; x < x2; x += 80) {
      const gx = x + 20, n = (gx / TS - 2.5) / PER, dn = Math.abs(n - Math.round(n)) * PER;
      if (dn < 2.7 || gx > 135 * TS || gx < TS) continue;
      c.fillRect(gx - ox, yc - 2 - oy, 36, 4);
    }
  }
  for (let i = 0; i < NI; i++) {
    const xc = (rx0(i) + 1.5) * TS; if (xc < x1 - 4 || xc > x2 + 4) continue;
    for (let y = Math.floor(y1 / 80) * 80; y < y2; y += 80) {
      const gy = y + 20, n = (gy / TS - 2.5) / PER, dn = Math.abs(n - Math.round(n)) * PER;
      if (dn < 2.7 || gy > 99 * TS || gy < TS) continue;
      c.fillRect(xc - 2 - ox, gy - oy, 4, 36);
    }
  }
  // zebra crossings around every junction
  c.fillStyle = 'rgba(245,245,235,.8)';
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const nx = rx0(i) * TS, ny = ry0(j) * TS;
    if (nx + 6 * TS < x1 || nx - 4 * TS > x2 || ny + 6 * TS < y1 || ny - 4 * TS > y2) continue;
    for (let s = 0; s < 8; s++) {
      const o = 6 + s * 14;
      if (i > 0) c.fillRect(nx - TS + 6 - ox, ny + o - oy - 1, 28, 7);
      if (i < NI - 1 || true) if (nx + 4 * TS < 136 * TS) c.fillRect(nx + 3 * TS + 6 - ox, ny + o - oy - 1, 28, 7);
      if (j > 0) c.fillRect(nx + o - ox - 1, ny - TS + 6 - oy, 7, 28);
      if (j < NJ - 1) c.fillRect(nx + o - ox - 1, ny + 3 * TS + 6 - oy, 7, 28);
    }
  }
}

function drawDecor(c, d, ox, oy) {
  const x = d.x - ox, y = d.y - oy;
  switch (d.type) {
    case 'umbrella': c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + 4, y + 4, 11, 0, TAU); c.fill(); c.fillStyle = d.col; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.fill(); c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y); c.arc(x, y, 11, k * Math.PI / 2, k * Math.PI / 2 + Math.PI / 4); c.fill(); } break;
    case 'boat': c.save(); c.translate(x, y); c.rotate(d.a); c.fillStyle = 'rgba(0,0,0,.22)'; rrect(c, -22, -7, 52, 16, 8); c.fill(); c.fillStyle = d.col; rrect(c, -26, -9, 52, 15, 8); c.fill(); c.fillStyle = '#fff'; c.fillRect(-12, -9, 24, 3); c.fillStyle = '#5d4037'; c.fillRect(-2, -3, 10, 2); c.restore(); break;
    case 'crates': c.save(); c.translate(x, y); c.rotate(d.a); c.fillStyle = '#a1783a'; c.fillRect(-7, -7, 14, 14); c.strokeStyle = '#6d4c1d'; c.strokeRect(-7, -7, 14, 14); c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, 7); c.stroke(); c.restore(); break;
    case 'flag': c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 6, y + 4, 40, 12); c.fillStyle = '#ddd'; c.fillRect(x - 2, y - 70, 4, 70); c.fillStyle = '#ff9933'; c.fillRect(x + 2, y - 70, 38, 8); c.fillStyle = '#fff'; c.fillRect(x + 2, y - 62, 38, 8); c.fillStyle = '#138808'; c.fillRect(x + 2, y - 54, 38, 8); c.strokeStyle = '#1a237e'; c.lineWidth = 1; c.beginPath(); c.arc(x + 21, y - 58, 3.5, 0, TAU); c.stroke(); break;
    case 'pitch': c.fillStyle = '#6a9d45'; c.beginPath(); c.ellipse(x, y, 88, 88, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 78, 0, TAU); c.stroke(); c.fillStyle = '#c9a46a'; c.fillRect(x - 6, y - 28, 12, 56); c.fillStyle = '#fff'; c.fillRect(x - 5, y - 28, 10, 2); c.fillRect(x - 5, y + 26, 10, 2); break;
    case 'mandapam': c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 12, y - 8, 28, 28); c.fillStyle = '#e9d9b0'; c.fillRect(x - 15, y - 17, 30, 30); c.fillStyle = '#d4a017'; c.fillRect(x - 10, y - 12, 20, 20); c.fillStyle = '#c0392b'; c.fillRect(x - 4, y - 6, 8, 8); break;
    case 'plane': {
      c.save(); c.translate(x, y); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(8, 8, 56, 8, 0, 0, TAU); c.fill();
      c.fillStyle = d.col; c.beginPath(); c.ellipse(0, 0, 56, 9, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(14, -3); c.lineTo(-14, -52); c.lineTo(-24, -52); c.lineTo(-12, -3); c.fill(); c.beginPath(); c.moveTo(14, 3); c.lineTo(-14, 52); c.lineTo(-24, 52); c.lineTo(-12, 3); c.fill();
      c.fillStyle = d.tail; c.beginPath(); c.moveTo(-50, -2); c.lineTo(-62, -18); c.lineTo(-54, -18); c.lineTo(-40, -2); c.fill(); c.beginPath(); c.moveTo(-50, 2); c.lineTo(-62, 18); c.lineTo(-54, 18); c.lineTo(-40, 2); c.fill();
      c.fillStyle = '#546e7a'; c.fillRect(48, -4, 6, 8); c.restore(); break;
    }
    case 'runway': {
      c.fillStyle = '#2f3238'; c.fillRect(x - d.len / 2, y - 60, d.len, 120);
      c.fillStyle = '#f0f0f0'; for (let k = 0; k < d.len; k += 80) c.fillRect(x - d.len / 2 + k + 10, y - 3, 40, 6);
      c.fillRect(x - d.len / 2 + 4, y - 56, d.len - 8, 2); c.fillRect(x - d.len / 2 + 4, y + 54, d.len - 8, 2);
      for (let k = 0; k < 8; k++) { c.fillRect(x - d.len / 2 + 14 + k * 4, y - 40, 2, 20); c.fillRect(x - d.len / 2 + 14 + k * 4, y + 20, 2, 20); }
      break;
    }
  }
}

function drawBuilding(c, b, ox, oy) {
  const x = b.x * TS - ox, y = b.y * TS - oy, w = b.w * TS, h = b.h * TS, H = b.hgt;
  const s = hash2(b.x, b.y);
  if (b.kind === 'light') { drawLighthouse(c, x, y, w, h, H); return; }
  // cast shadow (sun from the north-west)
  c.fillStyle = 'rgba(0,0,0,.26)';
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w + H * 0.55, y + h + H * 0.5); c.lineTo(x + w + H * 0.55, y + H * 0.5); c.lineTo(x + w, y); c.lineTo(x + H * 0.4, y + h + H * 0.45); c.closePath(); c.fill();
  // wall (south face) and roof (raised by H)
  let wall = b.col, roof = b.roof;
  switch (b.kind) {
    case 'tin': wall = shade(b.col, -20); roof = '#80919b'; break;
    case 'cont': wall = shade(b.col, -35); roof = b.col; break;
    case 'wh': wall = shade(b.col, -30); roof = shade(b.col, 8); break;
    case 'central': wall = '#a85a46'; roof = '#8a3a2c'; break;
    case 'hospital': wall = '#e6eef5'; roof = '#f7f7f7'; break;
    case 'police': wall = '#37579a'; roof = '#2a3f78'; break;
    case 'fortwall': wall = '#b09c72'; roof = '#cdbb94'; break;
    case 'stand': wall = '#8591a8'; roof = '#aeb6c6'; break;
    case 'templewall': wall = '#f4efe2'; roof = '#d9cdb0'; break;
    case 'gopuram': wall = '#e8cfa0'; roof = '#d8b070'; break;
    case 'shrine': wall = '#e9d9b0'; roof = '#d4a017'; break;
    case 'colonial': wall = '#f3e9c9'; roof = '#b5523b'; break;
    case 'terminal': wall = '#78909c'; roof = '#b3d4e8'; break;
    case 'garage': wall = '#37474f'; roof = '#546e7a'; break;
    case 'stall': wall = '#7a6e5d'; roof = '#eee'; break;
    default: wall = shade(b.col, -38); roof = roof || shade('#d2cbbb', Math.round((s - .5) * 24));
  }
  const ry = y - H;
  c.fillStyle = wall; c.fillRect(x, y + h - H, w, H);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + h - H, w, 3);
  // wall decoration
  if (b.kind === 'templewall') { for (let k = 0; k < w; k += 8) { c.fillStyle = (k / 8) % 2 ? '#c8322b' : '#f4efe2'; c.fillRect(x + k, y + h - H, 8, H); } }
  else if (H >= 10 && b.kind !== 'cont' && b.kind !== 'stall' && b.kind !== 'gopuram') {
    c.fillStyle = b.kind === 'hospital' ? '#7fb2d9' : 'rgba(25,35,50,.55)';
    for (let k = 8; k < w - 10; k += 14) { c.fillRect(x + k, y + h - H + 4, 7, Math.min(5, H - 6)); }
  }
  if (b.sign && H >= 12) {
    c.save(); c.beginPath(); c.rect(x, y + h - H, w, H); c.clip();
    c.fillStyle = b.signCol || '#b71c1c'; c.fillRect(x + 2, y + h - H + 1, w - 4, H - 2);
    c.fillStyle = '#fff'; c.font = 'bold ' + Math.min(11, H - 3) + 'px ' + TAMIL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(b.sign, x + w / 2, y + h - H / 2, w - 8); c.restore();
  }
  // roof
  c.fillStyle = roof; c.fillRect(x, ry, w, h);
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5; c.strokeRect(x + .75, ry + .75, w - 1.5, h - 1.5);
  roofDetail(c, b, x, ry, w, h, s);
}

function roofDetail(c, b, x, y, w, h, s) {
  switch (b.kind) {
    case 'house': case 'apt': case 'shop': {
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
      if (w >= 60 && s < .55) { // water tank
        const tx = x + w * (0.25 + s * .4), ty = y + h * .35;
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(tx + 3, ty + 3, 9, 0, TAU); c.fill();
        c.fillStyle = s < .3 ? '#1c2833' : '#2e5a8f'; c.beginPath(); c.arc(tx, ty, 9, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(tx, ty, 5.5, 0, TAU); c.stroke();
      }
      if (s > .3 && s < .85 && w >= 40) { c.fillStyle = '#e8e8e8'; c.fillRect(x + w - 24, y + h - 18, 13, 9); c.fillStyle = '#999'; c.fillRect(x + w - 22, y + h - 16, 9, 2); }
      if (s > .6 && w >= 50 && h >= 50) { c.fillStyle = '#263238'; c.save(); c.translate(x + 10, y + h - 24); c.rotate(-.1); c.fillRect(0, 0, 22, 14); c.strokeStyle = '#78909c'; for (let k = 0; k < 22; k += 5) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 14); c.stroke(); } c.restore(); }
      if (s > .75 && w >= 80) { for (let k = 0; k < 6; k++) { c.fillStyle = ['#e53935', '#fdd835', '#1e88e5', '#fff', '#43a047', '#ff7043'][k]; c.fillRect(x + 12 + k * 7, y + 12, 5, 8); } c.strokeStyle = '#555'; c.beginPath(); c.moveTo(x + 10, y + 12); c.lineTo(x + 55, y + 12); c.stroke(); }
      break;
    }
    case 'tin': {
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; for (let k = 3; k < w; k += 5) { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + k, y + h); c.stroke(); }
      c.fillStyle = b.tarp; c.fillRect(x + w * .15, y + h * .2, w * .5, h * .45); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + w * .55, y + h * .6, 7, 7); c.fillStyle = '#6d4c41'; c.fillRect(x + 6, y + h - 12, 6, 5); break;
    }
    case 'cont': {
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; for (let k = 5; k < w; k += 6) { c.beginPath(); c.moveTo(x + k, y + 2); c.lineTo(x + k, y + h - 2); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.7)'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('SEA·CHN', x + w / 2, y + h / 2 + 3); break;
    }
    case 'wh': {
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 3; for (let k = 8; k < w; k += 14) { c.beginPath(); c.moveTo(x + k, y + 2); c.lineTo(x + k, y + h - 2); c.stroke(); }
      c.fillStyle = '#cfd8dc'; c.fillRect(x + 8, y + 8, 12, 10); break;
    }
    case 'stall': {
      const n = Math.floor(w / 8);
      for (let k = 0; k < n; k++) { c.fillStyle = k % 2 ? b.aw[1] : b.aw[0]; c.fillRect(x + k * 8, y, 8, h); } c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, y + h - 4, w, 4); break;
    }
    case 'central': {
      c.strokeStyle = '#e9d9c7'; c.lineWidth = 3; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
      for (let k = 14; k < w - 10; k += 28) { c.fillStyle = '#a85a46'; c.fillRect(x + k, y + 10, 14, h - 20); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + k, y + 10, 14, 3); }
      const tw = 62, th = 56, tH = 36, tx = x + w / 2 - tw / 2, ty = y + 12;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(tx + 8, ty + th - tH + 8, tw, th);
      c.fillStyle = '#9a4b3a'; c.fillRect(tx, ty + th - tH, tw, tH);
      c.fillStyle = '#f3efe6'; c.beginPath(); c.arc(tx + tw / 2, ty + th - tH / 2, 12, 0, TAU); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx + tw / 2, ty + th - tH / 2); c.lineTo(tx + tw / 2, ty + th - tH / 2 - 8); c.moveTo(tx + tw / 2, ty + th - tH / 2); c.lineTo(tx + tw / 2 + 6, ty + th - tH / 2); c.stroke();
      c.fillStyle = '#b5523b'; c.fillRect(tx, ty - tH, tw, th); c.fillStyle = '#7a2f23'; c.fillRect(tx + 6, ty - tH + 6, tw - 12, th - 12);
      c.fillStyle = '#d4a017'; c.beginPath(); c.arc(tx + tw / 2, ty - tH + th / 2, 9, 0, TAU); c.fill();
      break;
    }
    case 'hospital': {
      c.fillStyle = '#e53935'; c.fillRect(x + w / 2 - 28, y + h / 2 - 8, 56, 16); c.fillRect(x + w / 2 - 8, y + h / 2 - 28, 16, 56);
      c.strokeStyle = '#90a4ae'; c.lineWidth = 3; c.beginPath(); c.arc(x + w - 38, y + 38, 24, 0, TAU); c.stroke(); c.fillStyle = '#546e7a'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', x + w - 38, y + 39); break;
    }
    case 'police': {
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POLICE', x + w / 2, y + h / 2 - 8); c.font = 'bold 14px ' + TAMIL_FONT; c.fillText('காவல்துறை', x + w / 2, y + h / 2 + 14);
      c.fillStyle = '#e53935'; c.fillRect(x + 12, y + 10, 18, 8); c.fillStyle = '#1e88e5'; c.fillRect(x + 30, y + 10, 18, 8); break;
    }
    case 'fortwall': case 'stand': {
      if (b.kind === 'stand') { const horiz = w > h; c.lineWidth = 2; for (let k = 4; k < (horiz ? h : w) - 2; k += 6) { c.strokeStyle = (k / 6 | 0) % 2 ? '#ffd600' : '#1e56c8'; c.beginPath(); if (horiz) { c.moveTo(x + 2, y + k); c.lineTo(x + w - 2, y + k); } else { c.moveTo(x + k, y + 2); c.lineTo(x + k, y + h - 2); } c.stroke(); } }
      else { c.fillStyle = 'rgba(0,0,0,.18)'; const horiz = w > h; for (let k = 4; k < (horiz ? w : h); k += 12) { if (horiz) c.fillRect(x + k, y, 6, 6); else c.fillRect(x, y + k, 6, 6); } }
      break;
    }
    case 'gopuram': {
      const tiers = 5;
      for (let k = 0; k < tiers; k++) {
        const f = 1 - k * 0.15, tw = w * f, tx = x + (w - tw) / 2, ty = y - k * 11 - 4;
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(tx + 4, ty + 6, tw, 14);
        c.fillStyle = ['#e8537a', '#26a69a', '#ffca28', '#5c6bc0', '#ef6c00'][k]; c.fillRect(tx, ty, tw, 12);
        c.fillStyle = 'rgba(255,255,255,.8)'; for (let m = 4; m < tw - 3; m += 8) c.fillRect(tx + m, ty + 3, 3, 6);
      }
      c.fillStyle = '#d4a017'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + w / 2 + (k - 1) * 14, y - tiers * 11 - 4, 4, 0, TAU); c.fill(); }
      break;
    }
    case 'shrine': {
      for (let k = 0; k < 4; k++) { c.fillStyle = ['#c9961a', '#d4a017', '#e3b52b', '#f0c94a'][k]; const p = k * 9; c.fillRect(x + p, y + p, w - p * 2, h - p * 2); }
      c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 5, 0, TAU); c.fill(); break;
    }
    case 'colonial': {
      c.strokeStyle = 'rgba(0,0,0,.25)'; for (let k = 6; k < w; k += 7) { c.beginPath(); c.moveTo(x + k, y + 2); c.lineTo(x + k, y + h - 2); c.stroke(); } c.fillStyle = '#d4a017'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 7, 0, TAU); c.fill(); break;
    }
    case 'terminal': {
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (let k = 10; k < w; k += 20) { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + k, y + h); c.stroke(); } break;
    }
    case 'garage': { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; for (let k = 4; k < w; k += 8) { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + k, y + h); c.stroke(); } break; }
  }
  if (b.neon) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 4, y + 4, w - 8, 4); }
}

function drawLighthouse(c, x, y, w, h, H) {
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.moveTo(x + 10, y + h - 10); c.lineTo(x + w + H * .6, y + h + H * .55); c.lineTo(x + w + H * .6 + 14, y + h + H * .55 + 8); c.lineTo(x + w - 10, y + h - 10); c.fill();
  c.fillStyle = '#b71c1c'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 34, 0, TAU); c.fill();
  c.fillStyle = '#f5f5f5'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 12, 30, 0, TAU); c.fill();
  c.fillStyle = '#b71c1c'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 24, 25, 0, TAU); c.fill();
  c.fillStyle = '#f5f5f5'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 36, 21, 0, TAU); c.fill();
  c.fillStyle = '#263238'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 48, 16, 0, TAU); c.fill();
  c.fillStyle = '#ffeb3b'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 50, 7, 0, TAU); c.fill();
}

function renderChunk(cx, cy) {
  const cv = document.createElement('canvas'); cv.width = CHP; cv.height = CHP;
  const c = cv.getContext('2d');
  const ox = cx * CHP, oy = cy * CHP;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y;
    if (tx >= COLS || ty >= ROWS) continue;
    paintTile(c, tx, ty, x * TS, y * TS);
  }
  drawRoadMarkings(c, ox, oy, cx, cy);
  const k = cy * 64 + cx;
  for (const d of (bucketD.get(k) || [])) drawDecor(c, d, ox, oy);
  // tree shadows
  c.fillStyle = 'rgba(0,0,0,.2)';
  for (const t of (bucketT.get(k) || [])) { c.beginPath(); c.arc(t.x - ox + 7, t.y - oy + 8, t.r * .95, 0, TAU); c.fill(); }
  const bl = (bucketB.get(k) || []).slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of bl) drawBuilding(c, b, ox, oy);
  return cv;
}

// ------------------------------------------------------------------ mini map
function buildMiniMap() {
  const S = 5, cv = document.createElement('canvas'); cv.width = COLS * S; cv.height = ROWS * S;
  const c = cv.getContext('2d');
  const cols = { [T.GROUND]: '#6b6455', [T.ROAD]: '#9aa0a8', [T.SIDEWALK]: '#555b63', [T.BUILDING]: '#2c3038', [T.WATER]: '#27506b', [T.SAND]: '#6f6548', [T.GRASS]: '#2f5a2a', [T.BRIDGE]: '#b4bac2', [T.TREE]: '#24471f', [T.WALL]: '#14304a', [T.TARMAC]: '#444a52', [T.PLAZA]: '#59554d', [T.SHALLOW]: '#2c6f86', [T.RAIL]: '#3d3a36', [T.DIRT]: '#5c4a35' };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { c.fillStyle = cols[tiles[y * COLS + x]]; c.fillRect(x * S, y * S, S, S); }
  world.mini = cv; world.miniS = S;
}

// ------------------------------------------------------------------ flat textures for the 3D renderer
const FLAT_S = 1.5;   // texture pixels per world pixel
function buildingColors(b) {
  let wall = b.col, roof = b.roof; const s = hash2(b.x, b.y);
  switch (b.kind) {
    case 'tin': wall = shade(b.col, -20); roof = '#80919b'; break;
    case 'cont': wall = shade(b.col, -35); roof = b.col; break;
    case 'wh': wall = shade(b.col, -30); roof = shade(b.col, 8); break;
    case 'central': wall = '#a85a46'; roof = '#8a3a2c'; break;
    case 'hospital': wall = '#e6eef5'; roof = '#f7f7f7'; break;
    case 'police': wall = '#37579a'; roof = '#2a3f78'; break;
    case 'fortwall': wall = '#b09c72'; roof = '#cdbb94'; break;
    case 'stand': wall = '#8591a8'; roof = '#aeb6c6'; break;
    case 'templewall': wall = '#f4efe2'; roof = '#d9cdb0'; break;
    case 'gopuram': wall = '#e8cfa0'; roof = '#d8b070'; break;
    case 'shrine': wall = '#e9d9b0'; roof = '#d4a017'; break;
    case 'colonial': wall = '#f3e9c9'; roof = '#b5523b'; break;
    case 'terminal': wall = '#78909c'; roof = '#b3d4e8'; break;
    case 'garage': wall = '#37474f'; roof = '#546e7a'; break;
    case 'stall': wall = '#7a6e5d'; roof = '#eee'; break;
    case 'light': wall = '#f5f5f5'; roof = '#f5f5f5'; break;
    default: wall = shade(b.col, -12); roof = roof || shade('#d2cbbb', Math.round((s - .5) * 24));
  }
  return { wall, roof };
}
function drawBuildingFlat(c, b, ox, oy) {
  const x = b.x * TS - ox, y = b.y * TS - oy, w = b.w * TS, h = b.h * TS, s = hash2(b.x, b.y);
  const col = buildingColors(b);
  c.fillStyle = col.roof; c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5; c.strokeRect(x + .75, y + .75, w - 1.5, h - 1.5);
  if (b.kind === 'light') return;
  if (b.kind === 'central') { c.strokeStyle = '#e9d9c7'; c.lineWidth = 3; c.strokeRect(x + 3, y + 3, w - 6, h - 6); for (let k = 14; k < w - 10; k += 28) { c.fillStyle = '#9b4a3a'; c.fillRect(x + k, y + 10, 14, h - 20); } return; }
  if (b.kind === 'gopuram') { c.fillStyle = '#c99a50'; c.fillRect(x + 6, y + 6, w - 12, h - 12); return; }
  roofDetail(c, b, x, y, w, h, s);
}
function renderChunkFlat(cx, cy) {
  const size = Math.round(CHP * FLAT_S), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'); c.scale(FLAT_S, FLAT_S);
  const ox = cx * CHP, oy = cy * CHP;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y; if (tx >= COLS || ty >= ROWS) continue;
    paintTile(c, tx, ty, x * TS, y * TS);
  }
  drawRoadMarkings(c, ox, oy, cx, cy);
  const k = cy * 64 + cx;
  for (const d of (bucketD.get(k) || [])) if (d.type === 'runway' || d.type === 'pitch') drawDecor(c, d, ox, oy);
  for (const b of (bucketB.get(k) || [])) drawBuildingFlat(c, b, ox, oy);
  return cv;
}
