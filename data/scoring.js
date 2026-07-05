// ════════════════════════════════════════════════════════════════════
//  SCORING — tweak any value, the whole dashboard recomputes.
//
//  Points stack as a team advances ("cumulative stages"):
//    • every group-stage win/draw earns points
//    • finishing 1st in the group beats finishing 2nd
//    • each knockout-round win earns a bit more than the last
//
//  Balance note: the knockout ladder is deliberately FLAT (4→5→6→7→8, no
//  jackpot final) and the group/advancement bonuses are beefed up, so a
//  well-rounded draft with several teams reaching the knockouts can rival
//  one lucky champion instead of being blown out by it.
//
//  Wooden Spoon 🥄: once the group stage ends, the single WORST team in
//  the tournament (fewest group points → worst goal differential →
//  fewest goals scored) hands its owner a bonus.
// ════════════════════════════════════════════════════════════════════

const SCORING = {
  // Group stage (per match)
  groupWin: 4,
  groupDraw: 1,

  // Group finish bonus (awarded when the group is complete)
  groupFirst: 6,
  groupSecond: 4,
  groupThirdAdvance: 2, // a 3rd-place team that sneaks into the Round of 32

  // Knockout wins (awarded per match won) — flat ladder, no jackpot
  r32Win: 4,
  r16Win: 5,
  qfWin: 6,
  sfWin: 7,
  thirdPlaceWin: 3, // winning the bronze-medal match
  finalWin: 8,      // lifting the trophy 🏆

  // Wooden Spoon bonus 🥄
  woodenSpoon: 5,
};

globalThis.SCORING = SCORING;
