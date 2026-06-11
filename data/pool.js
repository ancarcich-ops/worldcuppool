// ════════════════════════════════════════════════════════════════════
//  YOUR POOL — edit this file after the draft!
//
//  Each player gets a name, an emoji avatar, and a list of team codes
//  (see data/teams.js for all 48 codes).
//  Every team must be owned by exactly one player.
//
//  settings.sampleDraft: true  → shows a "SAMPLE DRAFT" banner so nobody
//  thinks these picks are real. Flip it to false once you enter the
//  real draft results below.
// ════════════════════════════════════════════════════════════════════

const POOL = {
  settings: {
    poolName: "World Cup Pool 2026",
    sampleDraft: true, // ← set to false after you enter the real picks
  },

  players: [
    { name: "Player 1",  avatar: "🦅", teams: ["ARG", "EGY", "PAN"] },
    { name: "Player 2",  avatar: "🐯", teams: ["FRA", "TUN", "CUW"] },
    { name: "Player 3",  avatar: "🦈", teams: ["ESP", "KOR", "JOR"] },
    { name: "Player 4",  avatar: "🐺", teams: ["ENG", "AUS", "HAI"] },
    { name: "Player 5",  avatar: "🦁", teams: ["BRA", "SUI", "NZL"] },
    { name: "Player 6",  avatar: "🐻", teams: ["POR", "MEX", "IRQ"] },
    { name: "Player 7",  avatar: "🦊", teams: ["GER", "CAN", "RSA"] },
    { name: "Player 8",  avatar: "🐙", teams: ["NED", "USA", "QAT"] },
    { name: "Player 9",  avatar: "🦂", teams: ["CRO", "SEN", "KSA"] },
    { name: "Player 10", avatar: "🐉", teams: ["BEL", "JPN", "GHA"] },
    { name: "Player 11", avatar: "🦬", teams: ["URU", "MAR", "UZB"] },
    { name: "Player 12", avatar: "🐎", teams: ["COL", "NOR", "CPV"] },
    { name: "Player 13", avatar: "🦉", teams: ["AUT", "ECU", "SCO"] },
    { name: "Player 14", avatar: "🐍", teams: ["TUR", "CIV", "BIH"] },
    { name: "Player 15", avatar: "🦜", teams: ["IRN", "PAR", "COD"] },
    { name: "Player 16", avatar: "🐊", teams: ["SWE", "ALG", "CZE"] },
  ],
};

globalThis.POOL = POOL;
