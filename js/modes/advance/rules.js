// =========================================================
// ADVANCE — shared rules (host + phones)
// A checkerboard; chickens start on the bottom row, turkeys on the top.
// Right answer = move 1 square (forward, forward-diagonal or sideways)
// or, on small teams, drop a hay-bale block next to you for 2 questions.
// First team to get EVERYONE to the far side wins the round; otherwise
// after the time limit the team that is further on average wins.
// =========================================================

export const MIN_SIZE = 10;
/** Board is square: as wide as the bigger team, at least 10. */
export const boardSize = (nChicken, nTurkey) => Math.max(MIN_SIZE, nChicken, nTurkey);
export const BLOCK_LIMIT = 10;      // blocks only allowed when your team has fewer than this many players
export const BLOCK_QUESTIONS = 2;   // a block lasts for the placer's next 2 answers

export const PIECES = [
  { id: 'k', name: 'King', glyph: '♚' },
  { id: 'q', name: 'Queen', glyph: '♛' },
  { id: 'r', name: 'Rook', glyph: '♜' },
  { id: 'b', name: 'Bishop', glyph: '♝' },
  { id: 'n', name: 'Knight', glyph: '♞' },
  { id: 'p', name: 'Pawn', glyph: '♟' },
];
/** 4 colour sets per team (the 4th is the team colour). */
export const COLOURS = {
  chicken: [
    { id: 'w', name: 'White', fill: '#f4f1e8', ink: '#222' },
    { id: 'k', name: 'Black', fill: '#2a2a33', ink: '#fff' },
    { id: 'g', name: 'Gold', fill: '#f2c230', ink: '#222' },
    { id: 't', name: 'Blue', fill: '#2c7cf0', ink: '#fff' },
  ],
  turkey: [
    { id: 'w', name: 'White', fill: '#f4f1e8', ink: '#222' },
    { id: 'k', name: 'Black', fill: '#2a2a33', ink: '#fff' },
    { id: 'g', name: 'Gold', fill: '#f2c230', ink: '#222' },
    { id: 't', name: 'Red', fill: '#e0402a', ink: '#fff' },
  ],
};
export const allCombos = (team) => PIECES.flatMap((p) => COLOURS[team].map((c) => `${p.id}${c.id}`));
export const pieceOf = (pc) => PIECES.find((p) => p.id === String(pc || 'p')[0]) || PIECES[5];
export const colourOf = (team, pc) => COLOURS[team === 'turkey' ? 'turkey' : 'chicken'].find((c) => c.id === String(pc || 'pw')[1]) || COLOURS.chicken[0];
/** Sprite name for the dedicated art (ADVANCE_IMAGE_PROMPTS.md), e.g. adv_c_k_w */
export const pieceSprite = (team, pc) => `adv_${team === 'turkey' ? 't' : 'c'}_${String(pc || 'pw')[0]}_${String(pc || 'pw')[1]}`;
/** Dedicated piece sprites that exist (filled in when the art is sliced). */
export const ADV_ART = new Set([]);

/** Rows run 0 (top) … L-1 (bottom). Chickens start at the bottom and head up. */
export const dirOf = (team) => (team === 'turkey' ? 1 : -1);
export const startRow = (team, L) => (team === 'turkey' ? 0 : L - 1);
export const goalRow = (team, L) => (team === 'turkey' ? L - 1 : 0);
export const progressOf = (team, r, L) => (team === 'turkey' ? r : L - 1 - r); // squares advanced

/** Squares a piece may move to: ahead, ahead-diagonal, sideways (free + no block). */
export function legalMoves(board, p) {
  const { W, L } = board; const f = dirOf(p.team);
  const cand = [[p.r + f, p.c], [p.r + f, p.c - 1], [p.r + f, p.c + 1], [p.r, p.c - 1], [p.r, p.c + 1]];
  return cand.filter(([r, c]) => r >= 0 && r < L && c >= 0 && c < W && isFree(board, r, c));
}
/** Squares around a piece where a block could go (all 8 neighbours, free). */
export function blockSpots(board, p) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = p.r + dr; const c = p.c + dc;
    if (r >= 0 && r < board.L && c >= 0 && c < board.W && isFree(board, r, c)) out.push([r, c]);
  }
  return out;
}
export function isFree(board, r, c) {
  return !board.pieces.some((q) => q.r === r && q.c === c) && !board.blocks.some((b) => b.r === r && b.c === c);
}
