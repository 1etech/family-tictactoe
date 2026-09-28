import { describe, expect, it } from "vitest";
import { emptyBoard, evaluate, isLegalMove, turnFor, type Board } from "../src/game.ts";

/** Builds a board from a 9-character sketch, e.g. "XX.OO...." */
function sketch(pattern: string): Board {
  return [...pattern].map((char) => (char === "X" || char === "O" ? char : null));
}

describe("evaluate", () => {
  it("finds a win on every row", () => {
    for (const pattern of ["XXX......", "...XXX...", "......XXX"]) {
      const outcome = evaluate(sketch(pattern));
      expect(outcome.winner).toBe("X");
      expect(outcome.draw).toBe(false);
    }
  });

  it("finds a win on every column", () => {
    for (const pattern of ["O..O..O..", ".O..O..O.", "..O..O..O"]) {
      expect(evaluate(sketch(pattern)).winner).toBe("O");
    }
  });

  it("finds a win on both diagonals", () => {
    expect(evaluate(sketch("X...X...X")).line).toEqual([0, 4, 8]);
    expect(evaluate(sketch("..X.X.X..")).line).toEqual([2, 4, 6]);
  });

  it("reports an unfinished board as neither win nor draw", () => {
    expect(evaluate(sketch("XO.......")))
      .toEqual({ winner: null, line: null, draw: false });
  });

  it("reports a full board with no line as a draw", () => {
    const outcome = evaluate(sketch("XXOOOXXOX"));
    expect(outcome.winner).toBeNull();
    expect(outcome.draw).toBe(true);
  });

  it("does not treat three empty squares as a win", () => {
    expect(evaluate(emptyBoard()).winner).toBeNull();
  });
});

describe("turnFor", () => {
  it("gives the first move to whoever opens the round", () => {
    expect(turnFor(emptyBoard(), "X")).toBe("X");
    expect(turnFor(emptyBoard(), "O")).toBe("O");
  });

  it("alternates as the board fills", () => {
    expect(turnFor(sketch("X........"), "X")).toBe("O");
    expect(turnFor(sketch("XO......."), "X")).toBe("X");
    expect(turnFor(sketch("O........"), "O")).toBe("X");
  });
});

describe("isLegalMove", () => {
  it("accepts an empty square in range", () => {
    expect(isLegalMove(emptyBoard(), 0)).toBe(true);
    expect(isLegalMove(emptyBoard(), 8)).toBe(true);
  });

  it("rejects an occupied square", () => {
    expect(isLegalMove(sketch("X........"), 0)).toBe(false);
  });

  it("rejects indexes outside the board", () => {
    expect(isLegalMove(emptyBoard(), -1)).toBe(false);
    expect(isLegalMove(emptyBoard(), 9)).toBe(false);
    expect(isLegalMove(emptyBoard(), 1.5)).toBe(false);
  });
});
