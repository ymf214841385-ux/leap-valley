import { levelClearScore, recordLevelBest } from "./save";

export const tests: Array<[string, () => void]> = [];

function test(name: string, fn: () => void) {
  tests.push([name, fn]);
}

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

test("single-level best excludes previous levels' cumulative score", () => {
  const level1Clear = 2500;
  const scoreAtLevel2Start = level1Clear;
  const cumulativeAtLevel2Clear = 5800;
  const level2Only = levelClearScore(cumulativeAtLevel2Clear, scoreAtLevel2Start);
  eq(level2Only, 3300, "level 2 best is this-level points only");

  const after1 = recordLevelBest([0, 0, 0], 0, levelClearScore(level1Clear, 0));
  eq(after1[0], 2500, "level 1 best");
  const after2 = recordLevelBest(after1, 1, level2Only);
  eq(after2[1], 3300, "level 2 best does not include level 1");
  eq(after2[0], 2500, "level 1 best unchanged");
});

test("level clear score keeps fractional points", () => {
  eq(levelClearScore(2500.7, 100.2), 2400.5, "no int32 truncation");
});

test("lower this-level score does not overwrite a higher best", () => {
  const afterHigh = recordLevelBest([0, 3300, 0], 1, 3300);
  eq(afterHigh[1], 3300, "high best kept");
  const afterLow = recordLevelBest(afterHigh, 1, 200);
  eq(afterLow[1], 3300, "lower run ignored");
  eq(afterLow[0], 0, "other levels untouched");
});
