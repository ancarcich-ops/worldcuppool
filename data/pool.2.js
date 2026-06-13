// ════════════════════════════════════════════════════════════════════
//  GROUP 2 roster (10 players × 4 teams = 40 teams) — reached at  ?pool=2
//
//  10 players means 8 teams go undrafted ("out of play"): they cannot
//  score for anyone and are excluded from the Wooden Spoon.
//  PLACEHOLDER picks until this group drafts. After their draft, paste
//  the Export block from draft.html?pool=2 over this file.
// ════════════════════════════════════════════════════════════════════

const POOL = {
  settings: {
    poolName: "World Cup Pool 2026 — Group 2",
    sampleDraft: true,
    allowUnowned: true, // 10×4 leaves 8 teams undrafted on purpose
  },

  players: [
    { name: "Player 1", avatar: "🦁", teams: ["MEX","RSA","KOR","CZE"] },
    { name: "Player 2", avatar: "🐯", teams: ["CAN","SUI","QAT","BIH"] },
    { name: "Player 3", avatar: "🦅", teams: ["BRA","MAR","SCO","HAI"] },
    { name: "Player 4", avatar: "🐺", teams: ["USA","TUR","AUS","PAR"] },
    { name: "Player 5", avatar: "🦊", teams: ["GER","ECU","CIV","CUW"] },
    { name: "Player 6", avatar: "🐻", teams: ["NED","JPN","SWE","TUN"] },
    { name: "Player 7", avatar: "🐙", teams: ["BEL","IRN","EGY","NZL"] },
    { name: "Player 8", avatar: "🦈", teams: ["ESP","URU","KSA","CPV"] },
    { name: "Player 9", avatar: "🐲", teams: ["FRA","NOR","SEN","IRQ"] },
    { name: "Player 10", avatar: "🦂", teams: ["ARG","AUT","ALG","JOR"] },
  ],
};

globalThis.POOL = POOL;
