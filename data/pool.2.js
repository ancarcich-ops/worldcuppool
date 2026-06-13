// ════════════════════════════════════════════════════════════════════
//  GROUP 2 roster (10 players × 4 teams = 40 teams) — reached at  ?pool=2
//
//  Drafted June 13, 2026. 10 players means 8 teams go undrafted
//  ("out of play"): they cannot score for anyone and are excluded from
//  the Wooden Spoon.
// ════════════════════════════════════════════════════════════════════

const POOL = {
  settings: {
    poolName: "World Cup Pool 2026 — Group 2",
    sampleDraft: false,
    allowUnowned: true, // 10×4 leaves 8 teams undrafted on purpose
  },

  players: [
    { name: "Alex", avatar: "🦅", teams: ["ESP", "URU", "CIV", "IRQ"] },
    { name: "Esther", avatar: "🐯", teams: ["ENG", "KOR", "NOR", "CUW"] },
    { name: "Tim", avatar: "🦈", teams: ["FRA", "ECU", "TUR", "UZB"] },
    { name: "Mari", avatar: "🐺", teams: ["ARG", "MAR", "NZL", "CZE"] },
    { name: "Payton", avatar: "🦁", teams: ["BRA", "CRO", "SCO", "PAN"] },
    { name: "Dusan", avatar: "🐻", teams: ["POR", "CAN", "IRN", "CPV"] },
    { name: "Andrew", avatar: "🦊", teams: ["NED", "SUI", "SEN", "ALG"] },
    { name: "Pavle", avatar: "🐙", teams: ["GER", "USA", "SWE", "EGY"] },
    { name: "Brittany", avatar: "🦂", teams: ["COL", "BEL", "GHA", "HAI"] },
    { name: "Emin", avatar: "🐉", teams: ["JPN", "MEX", "AUT", "AUS"] },
  ],
};

globalThis.POOL = POOL;
