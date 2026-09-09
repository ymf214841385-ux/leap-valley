import { SAVE_KEY, SAVE_VERSION } from "./const";

export type SaveData = {
  version: number;
  unlocked: number;
  lastLevel: number;
  highScore: number;
  muted: boolean;
  shake: boolean;
  best: number[];
};

const defaults: SaveData = {
  version: SAVE_VERSION,
  unlocked: 1,
  lastLevel: 1,
  highScore: 0,
  muted: false,
  shake: true,
  best: [0, 0, 0],
};

function migrate(raw: Partial<SaveData>): SaveData {
  const merged: SaveData = { ...defaults, ...raw, version: SAVE_VERSION };
  merged.unlocked = Math.min(3, Math.max(1, merged.unlocked | 0));
  merged.lastLevel = Math.min(3, Math.max(1, merged.lastLevel | 0));
  merged.highScore = Math.max(0, merged.highScore | 0);
  const best = Array.isArray(raw.best) ? raw.best : defaults.best;
  merged.best = [0, 1, 2].map((i) => Math.max(0, Number(best[i]) || 0));
  return merged;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem("leap-valley-save-v1");
    if (!raw) return { ...defaults, best: [...defaults.best] };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return migrate(parsed);
  } catch {
    return { ...defaults, best: [...defaults.best] };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    /* private mode / quota */
  }
}

/** Score stored as a single-level best: this level's points, not the run total. */
export function levelClearScore(cumulativeScore: number, scoreAtLevelStart: number): number {
  return Math.max(0, cumulativeScore - scoreAtLevelStart);
}

export function recordLevelBest(best: number[], levelIndex: number, clearScore: number): number[] {
  const next = best.slice();
  next[levelIndex] = Math.max(next[levelIndex] ?? 0, Math.max(0, clearScore));
  return next;
}
