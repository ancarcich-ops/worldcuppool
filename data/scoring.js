// ════════════════════════════════════════════════════════════════════
//  SCORING — tweak any value, the whole dashboard recomputes.
//
//  Points stack as a team advances ("cumulative stages"):
//    • every group-stage win/draw earns points
//    • finishing 1st in the group beats finishing 2nd
//    • each knockout-round win earns more than the last
//
//  Wooden Spoon 🥄: once the group stage ends, the single WORST team in
//  the tournament (fewest group points → worst goal differential →
//  fewest goals scored) hands its owner a bonus.
// ════════════════════════════════════════════════════════════════════

const SCORING = {
  // Group stage (per match)
  groupWin: 3,
  groupDraw: 1,

  // Group finish bonus (awarded when the group is complete)
  groupFirst: 5,
  groupSecond: 3,
  groupThirdAdvance: 1, // a 3rd-place team that sneaks into the Round of 32

  // Knockout wins (awarded per match won)
  r32Win: 4,
  r16Win: 6,
  qfWin: 8,
  sfWin: 10,
  thirdPlaceWin: 3, // winning the bronze-medal match
  finalWin: 15,     // lifting the trophy 🏆

  // Wooden Spoon bonus 🥄
  woodenSpoon: 5,
};

globalThis.SCORING = SCORING;
