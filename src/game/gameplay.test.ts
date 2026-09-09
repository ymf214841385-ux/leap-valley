import {
  bumpTile,
  countFiniteCoins,
  createWorld,
  emptyEvents,
  livesForLevelRetry,
  restoreCheckpoint,
  stepWorld,
  takeSnap,
  type World,
} from "./sim";
import { LEVELS } from "./levels";
import { Input } from "./input";
import type { Actions } from "./input";
import { MAX_FALL, MAX_SPEED, PLAYER_H, PLAYER_W, TILE } from "./const";

export const tests: Array<[string, () => void]> = [];

function test(name: string, fn: () => void) {
  tests.push([name, fn]);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

const idle: Actions = { moveX: 0, jumpHeld: false, jumpPressed: false, down: false, pausePressed: false };

function step(w: World, a: Actions = idle) {
  const ev = emptyEvents();
  stepWorld(w, 1 / 60, a, ev);
  return ev;
}

function collectFirstCoin(w: World) {
  const c = w.pickups.find((p) => p.kind === "coin" && !p.taken);
  assert(c, "missing coin");
  Object.assign(w.player, { x: c.x, y: c.y, vx: 0, vy: 0 });
  step(w);
}

function openFirstBox(w: World) {
  Object.assign(w.player, { x: 18 * 32 + 7, y: 11 * 32 + 1, vx: 0, vy: -200, grounded: false });
  step(w, { ...idle, jumpHeld: true });
}

test("single death debit: fall and time", () => {
  for (const cause of ["fall", "time"] as const) {
    const w = createWorld(0);
    if (cause === "fall") w.player.y = 560;
    else w.time = 0.001;
    step(w);
    step(w);
    eq(w.lives, 2, `${cause} lives`);
    eq(w.deaths, 1, `${cause} deaths`);
  }
});

test("crate scores once", () => {
  const w = createWorld(0);
  for (let i = 0; i < 3; i++) {
    Object.assign(w.player, { x: 39 * 32 + 7, y: 10 * 32 + 1, vx: 0, vy: -200, grounded: false });
    step(w, { ...idle, jumpHeld: true });
  }
  eq(w.score, 50, "crate score");
});

test("once-only question box without restore", () => {
  const w = createWorld(0);
  const n = w.pickups.length;
  bumpTile(w, 18, 10);
  eq(w.pickups.length, n + 1, "first open");
  bumpTile(w, 18, 10);
  eq(w.pickups.length, n + 1, "used box stays used");
});

test("jump event at 30/60/120/144Hz", () => {
  for (const hz of [30, 60, 120, 144]) {
    const w = createWorld(0);
    step(w);
    let acc = 0;
    let jumps = 0;
    const inp = new Input();
    for (let frame = 0; frame < hz / 5; frame++) {
      inp.setKeys(["Space"]);
      const held = inp.pollHeld();
      acc += 1 / hz;
      let consumed = false;
      while (acc >= 1 / 60) {
        const pressed = !consumed && inp.consumeJump();
        if (pressed) consumed = true;
        const ev = step(w, { ...held, jumpPressed: pressed, pausePressed: false });
        if (ev.jump) jumps += 1;
        acc -= 1 / 60;
      }
    }
    eq(jumps, 1, `refresh ${hz}`);
  }
});

test("checkpoint discards post-snapshot rewards", () => {
  const w = createWorld(0);
  const n = w.pickups.length;
  openFirstBox(w);
  eq(w.pickups.length, n + 1, "spawned");
  restoreCheckpoint(w);
  eq(w.pickups.length, n, "rolled back");
  openFirstBox(w);
  eq(w.pickups.length, n + 1, "open once after restore");
});

test("manual checkpoint cannot farm coin life", () => {
  const w = createWorld(0, { coinBank: 49 });
  collectFirstCoin(w);
  eq(w.lives, 4, "first 1UP");
  restoreCheckpoint(w);
  collectFirstCoin(w);
  eq(w.lives, 4, "no farm");
});

test("earned life does not refund spent life on death restore", () => {
  const w = createWorld(0, { coinBank: 49 });
  collectFirstCoin(w);
  w.player.y = 560;
  step(w);
  eq(w.lives, 3, "death after 1UP");
  restoreCheckpoint(w);
  eq(w.lives, 2, "award removed, death kept");
});

test("manual full-level retry strips awarded lives", () => {
  const w = createWorld(0, { coinBank: 49 });
  collectFirstCoin(w);
  eq(w.lives, 4, "awarded");
  eq(livesForLevelRetry(w), 3, "retry lives");
  w.player.y = 560;
  step(w);
  eq(livesForLevelRetry(w), 2, "retry after death");
});

test("dynamic pickup full state restores", () => {
  const w = createWorld(0);
  openFirstBox(w);
  w.snap = takeSnap(w);
  const last = w.pickups.at(-1);
  assert(last, "reward");
  const saved = { x: last.x, y: last.y, vy: last.vy, pop: last.pop };
  last.x += 20;
  last.y += 33;
  last.vy = 100;
  last.pop = 0;
  restoreCheckpoint(w);
  const restored = w.pickups.at(-1);
  assert(restored, "restored reward");
  eq(restored.x, saved.x, "x");
  eq(restored.y, saved.y, "y");
  eq(restored.vy, saved.vy, "vy");
  eq(restored.pop, saved.pop, "pop");
});

test("coin totals include question blocks in all levels", () => {
  for (let i = 0; i < 3; i++) {
    const w = createWorld(i);
    const count = w.pickups.filter((p) => p.kind === "coin").length + w.grid.join("").split("?").length - 1;
    eq(w.coinTotal, count, `level ${i + 1}`);
    eq(w.coinTotal, countFiniteCoins(LEVELS[i]!.grid), `source level ${i + 1}`);
  }
});

test("enemy gravity applies position and lands", () => {
  const w = createWorld(0);
  w.enemies = w.enemies.filter((e) => e.kind === "beetle");
  const e = w.enemies[0]!;
  e.y = 200;
  e.vx = 0;
  for (let i = 0; i < 60; i++) step(w);
  assert(e.y > 300, `fell to ${e.y}`);
  assert(e.y + e.h <= 416.01, `sank ${e.y + e.h}`);
  eq(e.vy, 0, "landed vy");
  const landed = e.y;
  e.vx = -36;
  for (let i = 0; i < 45; i++) step(w);
  assert(Math.abs(e.y - landed) < 0.5, `edge walk y ${e.y}`);
  eq(e.vy, 0, "edge walk vy");
});

function overlapSpiky(w: World) {
  const p = w.player;
  p.invuln = 0;
  p.vx = 0;
  p.vy = 0;
  w.hasHoney = false;
  w.spawnProtect = 0;
  w.enemies = [
    {
      kind: "spiky",
      x: p.x,
      y: p.y,
      w: 22,
      h: 24,
      vx: 0,
      vy: 0,
      alive: true,
      squish: 0,
      phase: 0,
      homeY: p.y,
    },
  ];
}

test("same-step lethal enemy does not arm checkpoint", () => {
  const w = createWorld(0);
  const p = w.player;
  overlapSpiky(w);
  w.checkpoints = [{ x: p.x + 9, y: p.y + 28, armed: false }];
  const previous = w.snap;
  const ev = step(w);
  assert(p.dead, "died");
  eq(ev.checkpoint, false, "no checkpoint");
  assert(w.snap === previous, "snapshot unchanged");
  eq(w.lives, 2, "one death");
  eq(w.deaths, 1, "one debit");
});

test("same-step death does not collect overlapping pickup", () => {
  const w = createWorld(0);
  const p = w.player;
  overlapSpiky(w);
  const c = w.pickups.find((it) => it.kind === "coin" && !it.taken)!;
  c.x = p.x;
  c.y = p.y;
  const ev = step(w);
  assert(p.dead, "died");
  assert(!c.taken, "coin not taken");
  eq(ev.coin, false, "no coin event");
  eq(w.lives, 2, "one death");
  eq(w.deaths, 1, "one debit");
});

test("same-step death does not win at overlapping goal", () => {
  const w = createWorld(0);
  const p = w.player;
  overlapSpiky(w);
  w.goalX = p.x;
  w.goalY = p.y;
  const ev = step(w);
  assert(p.dead, "died");
  assert(!w.won, "no win");
  eq(ev.win, false, "no win event");
  eq(w.lives, 2, "one death");
  eq(w.deaths, 1, "one debit");
});

test("hitstop does not drop queued jump", () => {
  const w = createWorld(0);
  step(w);
  w.player.grounded = true;
  w.player.vy = 0;
  w.player.buffer = 0;
  w.hitstop = 0.05;
  const ev1 = step(w, { ...idle, jumpPressed: true, jumpHeld: true });
  eq(ev1.jump, false, "no jump during hitstop");
  assert(w.player.buffer > 0, "jump buffered");
  w.hitstop = 0;
  const ev2 = step(w, { ...idle, jumpHeld: true, jumpPressed: false });
  eq(ev2.jump, true, "jump after hitstop");
});

test("stable unique ids for box rewards", () => {
  const w = createWorld(0);
  bumpTile(w, 18, 10);
  bumpTile(w, 19, 10);
  const spawned = w.pickups.filter((p) => p.id >= w.snap.nextPickupId);
  eq(spawned.length, 2, "two rewards");
  assert(spawned[0]!.id !== spawned[1]!.id, "unique ids");
});

test("high-speed fall leftover substeps do not pass through plank", () => {
  const w = createWorld(0);
  const p = w.player;
  const plankTx = 28;
  const plankTy = 11;
  const plankTop = plankTy * TILE + 10;
  p.x = plankTx * TILE + (TILE - 18) / 2;
  p.y = plankTop - PLAYER_H - 6;
  p.vx = 0;
  p.vy = MAX_FALL;
  p.grounded = false;
  p.coyote = 0;
  p.dropTime = 0;
  p.invuln = 1;
  w.spawnProtect = 1;
  for (let i = 0; i < 18; i++) step(w);
  const feet = p.y + PLAYER_H;
  assert(feet <= plankTop + 1.5, `tunneled through plank: feet ${feet} top ${plankTop} y=${p.y}`);
  assert(p.grounded, "should land on plank");
  assert(!p.dead, "should not fall to death");
});

test("airborne honey grants double jump immediately", () => {
  const w = createWorld(0);
  const honey = w.pickups.find((it) => it.kind === "honey" && !it.taken);
  assert(honey, "missing honey");
  honey.x = 200;
  honey.y = 180;
  const p = w.player;
  Object.assign(p, {
    x: honey.x,
    y: honey.y,
    vx: 0,
    vy: 80,
    grounded: false,
    coyote: 0,
    buffer: 0,
    airJumps: 0,
    maxAirJumps: 0,
    jumpHeld: false,
    gliding: false,
    dropTime: 0,
  });
  w.hasHoney = false;
  step(w);
  assert(honey.taken, "honey collected");
  eq(w.hasHoney, true, "has honey");
  eq(p.maxAirJumps, 1, "max air jumps");
  p.grounded = false;
  p.coyote = 0;
  p.buffer = 0;
  p.vy = 60;
  const ev = step(w, { ...idle, jumpPressed: true, jumpHeld: true });
  eq(ev.jump, true, "air jump available the moment honey is collected");
});

test("repeat honey does not refill a spent air jump", () => {
  const w = createWorld(0);
  const p = w.player;
  w.hasHoney = true;
  p.maxAirJumps = 1;
  p.airJumps = 0;
  const extra = {
    kind: "honey" as const,
    id: w.nextPickupId++,
    x: 200,
    y: 180,
    w: 20,
    h: 24,
    vx: 0,
    vy: 0,
    taken: false,
    pop: 0,
  };
  w.pickups.push(extra);
  Object.assign(p, {
    x: extra.x,
    y: extra.y,
    vx: 0,
    vy: 40,
    grounded: false,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
    gliding: false,
    dropTime: 0,
  });
  step(w);
  assert(extra.taken, "repeat honey collected");
  eq(p.maxAirJumps, 1, "max stays 1");
  eq(p.airJumps, 0, "spent air jump not refilled");
  p.grounded = false;
  p.coyote = 0;
  p.buffer = 0;
  p.vy = 40;
  const ev = step(w, { ...idle, jumpPressed: true, jumpHeld: true });
  eq(ev.jump, false, "no extra air jump from repeat honey");
});

test("checkpoint restore keeps snap honey air jumps", () => {
  const w = createWorld(0);
  const p = w.player;
  w.hasHoney = true;
  p.maxAirJumps = 1;
  p.airJumps = 1;
  w.snap = takeSnap(w);
  p.airJumps = 0;
  p.maxAirJumps = 0;
  w.hasHoney = false;
  restoreCheckpoint(w);
  eq(w.hasHoney, true, "honey restored");
  eq(p.maxAirJumps, 1, "max restored");
  eq(p.airJumps, 1, "air jumps restored to snap max");
});

test("checkpoint restore drops honey collected after snap", () => {
  const w = createWorld(0);
  const p = w.player;
  w.snap = takeSnap(w);
  w.hasHoney = true;
  p.maxAirJumps = 1;
  p.airJumps = 1;
  restoreCheckpoint(w);
  eq(w.hasHoney, false, "post-snap honey rolled back");
  eq(p.maxAirJumps, 0, "max rolled back");
  eq(p.airJumps, 0, "air jumps rolled back");
});

test("high-speed ceiling leftover substeps do not pass through", () => {
  const w = createWorld(0);
  const p = w.player;
  const tx = 22;
  const ty = 9;
  const tileBottom = (ty + 1) * TILE;
  p.x = tx * TILE + (TILE - PLAYER_W) / 2;
  p.y = tileBottom + 4;
  p.vx = 0;
  p.vy = -MAX_FALL;
  p.grounded = false;
  p.coyote = 0;
  p.dropTime = 0;
  p.invuln = 1;
  w.spawnProtect = 1;
  for (let i = 0; i < 10; i++) step(w);
  assert(p.y + 0.5 >= tileBottom, `went through ceiling: y=${p.y} bottom=${tileBottom}`);
  assert(p.y <= tileBottom + PLAYER_H, `fell away from ceiling: y=${p.y}`);
  assert(!p.dead, "should not die");
});

test("high-speed wall leftover substeps do not pass through", () => {
  const w = createWorld(0);
  const p = w.player;
  const tx = 18;
  const ty = 10;
  const tileX = tx * TILE;
  p.x = tileX - PLAYER_W - 2;
  p.y = ty * TILE + 6;
  p.vx = MAX_SPEED;
  p.vy = 0;
  p.grounded = false;
  p.coyote = 0;
  p.dropTime = 0;
  p.invuln = 1;
  w.spawnProtect = 1;
  const ev = emptyEvents();
  stepWorld(w, 0.08, { ...idle, moveX: 1 }, ev);
  assert(p.x + PLAYER_W <= tileX + 0.5, `went into/through wall: right=${p.x + PLAYER_W} wall=${tileX}`);
  eq(p.vx, 0, "horizontal leftover cancelled");
});
