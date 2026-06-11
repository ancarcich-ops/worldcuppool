// FIFA World Cup 2026 — all 48 qualified teams (final field, post-March 2026 playoffs).
// code: FIFA 3-letter code | iso: flag image code (flagcdn.com) | colors: [primary, secondary]
// group: official group letter from the Dec 5, 2025 draw.
// The live sync only reads scores/results — team identity & groups come from this file.

const TEAMS = {
  // ── Group A ──────────────────────────────────────────────
  MEX: { name: "Mexico",        iso: "mx",     group: "A", colors: ["#046A38", "#C8102E"] },
  RSA: { name: "South Africa",  iso: "za",     group: "A", colors: ["#007749", "#FFB81C"] },
  KOR: { name: "South Korea",   iso: "kr",     group: "A", colors: ["#CD2E3A", "#0047A0"] },
  CZE: { name: "Czechia",       iso: "cz",     group: "A", colors: ["#D7141A", "#11457E"] },
  // ── Group B ──────────────────────────────────────────────
  CAN: { name: "Canada",        iso: "ca",     group: "B", colors: ["#C8102E", "#F5F5F5"] },
  SUI: { name: "Switzerland",   iso: "ch",     group: "B", colors: ["#DA291C", "#F5F5F5"] },
  QAT: { name: "Qatar",         iso: "qa",     group: "B", colors: ["#8A1538", "#F5F5F5"] },
  BIH: { name: "Bosnia & Herz.",iso: "ba",     group: "B", colors: ["#002F6C", "#FECB00"] },
  // ── Group C ──────────────────────────────────────────────
  BRA: { name: "Brazil",        iso: "br",     group: "C", colors: ["#FFDC02", "#009739"] },
  MAR: { name: "Morocco",       iso: "ma",     group: "C", colors: ["#C1272D", "#006233"] },
  SCO: { name: "Scotland",      iso: "gb-sct", group: "C", colors: ["#0065BF", "#F5F5F5"] },
  HAI: { name: "Haiti",         iso: "ht",     group: "C", colors: ["#00209F", "#D21034"] },
  // ── Group D ──────────────────────────────────────────────
  USA: { name: "United States", iso: "us",     group: "D", colors: ["#002868", "#BF0A30"] },
  TUR: { name: "Türkiye",       iso: "tr",     group: "D", colors: ["#E30A17", "#F5F5F5"] },
  AUS: { name: "Australia",     iso: "au",     group: "D", colors: ["#FFCD00", "#00843D"] },
  PAR: { name: "Paraguay",      iso: "py",     group: "D", colors: ["#D52B1E", "#0038A8"] },
  // ── Group E ──────────────────────────────────────────────
  GER: { name: "Germany",       iso: "de",     group: "E", colors: ["#1A1A1A", "#FFCC00"] },
  ECU: { name: "Ecuador",       iso: "ec",     group: "E", colors: ["#FFD100", "#0033A0"] },
  CIV: { name: "Ivory Coast",   iso: "ci",     group: "E", colors: ["#FF8200", "#009A44"] },
  CUW: { name: "Curaçao",       iso: "cw",     group: "E", colors: ["#002B7F", "#F9E814"] },
  // ── Group F ──────────────────────────────────────────────
  NED: { name: "Netherlands",   iso: "nl",     group: "F", colors: ["#FF6C00", "#21468B"] },
  JPN: { name: "Japan",         iso: "jp",     group: "F", colors: ["#003DA5", "#E60012"] },
  SWE: { name: "Sweden",        iso: "se",     group: "F", colors: ["#006AA7", "#FECC02"] },
  TUN: { name: "Tunisia",       iso: "tn",     group: "F", colors: ["#E70013", "#F5F5F5"] },
  // ── Group G ──────────────────────────────────────────────
  BEL: { name: "Belgium",       iso: "be",     group: "G", colors: ["#EF3340", "#FDDA24"] },
  IRN: { name: "Iran",          iso: "ir",     group: "G", colors: ["#239F40", "#DA0000"] },
  EGY: { name: "Egypt",         iso: "eg",     group: "G", colors: ["#CE1126", "#1A1A1A"] },
  NZL: { name: "New Zealand",   iso: "nz",     group: "G", colors: ["#1A1A1A", "#F5F5F5"] },
  // ── Group H ──────────────────────────────────────────────
  ESP: { name: "Spain",         iso: "es",     group: "H", colors: ["#AA151B", "#F1BF00"] },
  URU: { name: "Uruguay",       iso: "uy",     group: "H", colors: ["#55B5E5", "#0A2342"] },
  KSA: { name: "Saudi Arabia",  iso: "sa",     group: "H", colors: ["#006C35", "#F5F5F5"] },
  CPV: { name: "Cape Verde",    iso: "cv",     group: "H", colors: ["#003893", "#CF2027"] },
  // ── Group I ──────────────────────────────────────────────
  FRA: { name: "France",        iso: "fr",     group: "I", colors: ["#002395", "#ED2939"] },
  NOR: { name: "Norway",        iso: "no",     group: "I", colors: ["#BA0C2F", "#00205B"] },
  SEN: { name: "Senegal",       iso: "sn",     group: "I", colors: ["#00853F", "#FDEF42"] },
  IRQ: { name: "Iraq",          iso: "iq",     group: "I", colors: ["#CE1126", "#007A3D"] },
  // ── Group J ──────────────────────────────────────────────
  ARG: { name: "Argentina",     iso: "ar",     group: "J", colors: ["#6CACE4", "#FFD100"] },
  AUT: { name: "Austria",       iso: "at",     group: "J", colors: ["#ED2939", "#F5F5F5"] },
  ALG: { name: "Algeria",       iso: "dz",     group: "J", colors: ["#006233", "#D21034"] },
  JOR: { name: "Jordan",        iso: "jo",     group: "J", colors: ["#CE1126", "#007A3D"] },
  // ── Group K ──────────────────────────────────────────────
  POR: { name: "Portugal",      iso: "pt",     group: "K", colors: ["#DA291C", "#046A38"] },
  COL: { name: "Colombia",      iso: "co",     group: "K", colors: ["#FCD116", "#003893"] },
  UZB: { name: "Uzbekistan",    iso: "uz",     group: "K", colors: ["#0099B5", "#CE1126"] },
  COD: { name: "DR Congo",      iso: "cd",     group: "K", colors: ["#007FFF", "#F7D618"] },
  // ── Group L ──────────────────────────────────────────────
  ENG: { name: "England",       iso: "gb-eng", group: "L", colors: ["#F5F5F5", "#CE1124"] },
  CRO: { name: "Croatia",       iso: "hr",     group: "L", colors: ["#ED1C24", "#0093DD"] },
  GHA: { name: "Ghana",         iso: "gh",     group: "L", colors: ["#006B3F", "#FCD116"] },
  PAN: { name: "Panama",        iso: "pa",     group: "L", colors: ["#DA121A", "#005293"] },
};

const GROUPS = "ABCDEFGHIJKL".split("");

globalThis.TEAMS = TEAMS;
globalThis.GROUPS = GROUPS;
