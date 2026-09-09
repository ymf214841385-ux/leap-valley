import { LeapGame } from "./game";
import { SAVE_KEY } from "./const";
import { loadSave } from "./save";

export const tests: Array<[string, () => void]> = [];

function test(name: string, fn: () => void) {
  tests.push([name, fn]);
}

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function stubCanvas(): HTMLCanvasElement {
  const ctx = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    fillStyle: "#000",
  };
  return {
    style: { width: "", height: "" },
    width: 0,
    height: 0,
    parentElement: null,
    getContext: (id: string) => (id === "2d" ? ctx : null),
  } as unknown as HTMLCanvasElement;
}

function makeGame(): LeapGame {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem("leap-valley-save-v1");
  const g = new LeapGame(stubCanvas());
  g.running = true;
  g.last = 0;
  return g;
}

function stepLoop(g: LeapGame, dt = 1 / 60) {
  const loop = (g as unknown as { loop: (now: number) => void }).loop;
  loop.call(g, g.last + dt * 1000);
}

function clearLevel(g: LeapGame) {
  const w = g.world;
  assert(w, "missing world");
  w.enemies = [];
  w.player.dead = false;
  w.died = false;
  w.won = false;
  w.deathCause = null;
  w.player.invuln = 2;
  w.spawnProtect = 2;
  w.player.vx = 0;
  w.player.vy = 0;
  w.player.x = w.goalX;
  w.player.y = w.goalY;
  w.hitstop = 0;
  g.acc = 1 / 60;
  stepLoop(g);
  assert(w.won, "expected clear");
}

test("LeapGame clear writes this-level best, not run total", () => {
  const g = makeGame();
  g.startAdventure(0);
  assert(g.world, "level 1 world");
  g.world.score = 2500;
  g.world.time = 12;
  g.runScore0 = 0;
  clearLevel(g);
  const level1Score = g.world.score;
  assert(level1Score > 2500, "finish bonus applied");
  eq(loadSave().best[0], level1Score, "level 1 best");

  g.nextLevel();
  assert(g.world, "level 2 world");
  eq(g.runScore0, level1Score, "level 2 start baseline");
  eq(g.world.score, level1Score, "score carried into level 2");
  g.world.score = level1Score + 3300;
  g.world.time = 12;
  clearLevel(g);
  const level2Score = g.world.score - g.runScore0;
  const save = loadSave();
  eq(save.best[1], level2Score, "level 2 best excludes level 1");
  eq(save.best[0], level1Score, "level 1 best unchanged");
  assert(save.best[1] !== g.world.score, "level 2 best is not the cumulative run score");
});

test("LeapGame retry keeps level baseline; game over resets it", () => {
  const g = makeGame();
  g.startAdventure(0);
  assert(g.world, "world");
  g.world.score = 2500;
  g.world.time = 12;
  g.runScore0 = 0;
  clearLevel(g);
  g.nextLevel();
  assert(g.world, "level 2");
  const baseline = g.runScore0;
  assert(baseline > 0, "carried baseline");
  g.world.score = baseline + 800;
  g.retry();
  assert(g.world, "retry world");
  eq(g.runScore0, baseline, "retry keeps level start score");
  eq(g.world.score, baseline, "retry score rolls back to baseline");

  g.world.lives = 0;
  g.retry();
  assert(g.world, "game over retry");
  eq(g.runScore0, 0, "game over baseline is zero");
  eq(g.world.score, 0, "new run score is zero");
});

test("LeapGame lower clear does not overwrite a higher level best", () => {
  const g = makeGame();
  g.startAdventure(1);
  assert(g.world, "level 2");
  g.world.score = 3300;
  g.world.time = 12;
  g.runScore0 = 0;
  clearLevel(g);
  const high = g.world.score;
  eq(loadSave().best[1], high, "first best");

  g.startAdventure(1);
  assert(g.world, "second run");
  g.world.score = 200;
  g.world.time = 12;
  g.runScore0 = 0;
  clearLevel(g);
  assert(g.world.score < high, "second run is lower");
  eq(loadSave().best[1], high, "lower score ignored");
});
