/** Pure tic-tac-toe rules. No Workers APIs in here, so it is trivially testable. */

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export function emptyBoard(): Board {
  return Array(9).fill(null);
}

export interface Outcome {
  winner: Mark | null;
  line: readonly number[] | null;
  draw: boolean;
}

export function evaluate(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line, draw: false };
    }
  }
  const full = board.every((cell) => cell !== null);
  return { winner: null, line: null, draw: full };
}

/** Whose turn it is, derived from the board and who opened the round. */
export function turnFor(board: Board, startingMark: Mark): Mark {
  const played = board.filter((cell) => cell !== null).length;
  const other: Mark = startingMark === "X" ? "O" : "X";
  return played % 2 === 0 ? startingMark : other;
}

export function isLegalMove(board: Board, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < 9 && board[index] === null;
}
