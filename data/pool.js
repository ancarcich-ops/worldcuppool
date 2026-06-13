// ════════════════════════════════════════════════════════════════════
//  YOUR POOL — the real draft (drafted June 12, 2026)
//
//  Each player gets a name, an emoji avatar, and a list of team codes
//  (see data/teams.js for all 48 codes).
//  Every team is owned by exactly one player.
//
//  settings.sampleDraft: false → these are the real picks.
// ════════════════════════════════════════════════════════════════════

const POOL = {
  settings: {
    poolName: "World Cup Pool 2026",
    sampleDraft: false,
  },

  players: [
    { name: "Chazz", avatar: "🎲", teams: ["ESP", "BIH", "PAR"] },
    { name: "Zach", avatar: "👷🏻‍♂️", teams: ["FRA", "ALG", "SCO"] },
    { name: "Trevor", avatar: "🍝", teams: ["ARG", "AUS", "NZL"] },
    { name: "Corbin", avatar: "🥜", teams: ["ENG", "CZE", "GHA"] },
    { name: "Parker", avatar: "🦑", teams: ["BRA", "EGY", "PAN"] },
    { name: "Ryan", avatar: "🙏", teams: ["GER", "SEN", "KSA"] },
    { name: "Petey", avatar: "🦅", teams: ["POR", "AUT", "TUN"] },
    { name: "Brett", avatar: "🦠", teams: ["NED", "SWE", "RSA"] },
    { name: "Kranz", avatar: "🎎", teams: ["BEL", "TUR", "IRQ"] },
    { name: "Grant", avatar: "🍣", teams: ["USA", "ECU", "QAT"] },
    { name: "Heacock", avatar: "🍆", teams: ["NOR", "CIV", "UZB"] },
    { name: "Matt", avatar: "🐍", teams: ["COL", "URU", "JOR"] },
    { name: "Adam", avatar: "🐀", teams: ["KOR", "CAN", "COD"] },
    { name: "Andrew", avatar: "🐧", teams: ["SUI", "CRO", "CPV"] },
    { name: "Ari", avatar: "👳🏽‍♂️", teams: ["MEX", "IRN", "HAI"] },
    { name: "Bako", avatar: "👽", teams: ["MAR", "JPN", "CUW"] },
  ],
};

globalThis.POOL = POOL;
