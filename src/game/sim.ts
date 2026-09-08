import {
  ACCEL_AIR,
  ACCEL_GROUND,
  APEX_WINDOW,
  COIN_LIFE,
  COYOTE,
  FRICTION,
  GLIDE_DELAY,
  GLIDE_FALL,
  GRAVITY_APEX,
  GRAVITY_DOWN,
  GRAVITY_UP,
  INVULN,
  JUMP_BUFFER,
  JUMP_CUT,
  JUMP_V,
  MAP_H,
  MAX_FALL,
  MAX_SPEED,
  PLAYER_H,
  PLAYER_W,
  SPAWN_PROTECT,
  START_LIVES,
  STOMP_BOUNCE,
  TILE,
} from "./const";
import type { Actions } from "./input";
import type { LevelDef, MoverDef } from "./levels";
import { LEVELS } from "./levels";
import { prefersReducedMotion } from "./motion";

export type EnemyKind = "beetle" | "moth" | "spiky";

export type Enemy = {
  kind: EnemyKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  alive: boolean;
  squish: number;
  phase: number;
  homeY: number;
};

export type Pickup = {
  kind: "coin" | "honey" | "life" | "secret";
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  taken: boolean;
  pop: number;
};

export type Mover = MoverDef & {
  ox: number;
  oy: number;
  t: number;
  vx: number;
  vy: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "dust" | "spark" | "leaf" | "pop";
  text?: string;
  frame: number;
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  coyote: number;
  buffer: number;
  jumpHeld: boolean;
  airJumps: number;
  maxAirJumps: number;
  invuln: number;
  squash: number;
  anim: number;
  dead: boolean;
  dropTime: number;
  riding: Mover | null;
  gliding: boolean;
  glideHold: number;
};

export type Snapshot = {
  x: number;
  y: number;
  facing: 1 | -1;
  score: number;
  coins: number;
  coinBank: number;
  secrets: number;
  hasHoney: boolean;
  maxAirJumps: number;
  time: number;
  grid: string[];
  pickups: Pickup[];
  enemies: Enemy[];
  movers: { t: number; vx: number; vy: number }[];
  nextPickupId: number;
};

export type World = {
  level: LevelDef;
  grid: string[];
  w: number;
  h: number;
  spawnX: number;
  spawnY: number;
  player: Player;
  enemies: Enemy[];
  pickups: Pickup[];
  movers: Mover[];
  particles: Particle[];
  bumps: { x: number; y: number; t: number }[];
  score: number;
  coins: number;
  coinBank: number;
  lives: number;
  time: number;
  hasHoney: boolean;
  honeySeen: boolean;
  won: boolean;
  died: boolean;
  deathCause: "fall" | "hit" | "time" | null;
  deaths: number;
  cameraX: number;
  cameraY: number;
  lookX: number;
  trauma: number;
  hitstop: number;
  goalX: number;
  goalY: number;
  toast: string;
  toastT: number;
  bannerT: number;
  spawnProtect: number;
  checkpoints: { x: number; y: number; armed: boolean }[];
  lanterns: { x: number; y: number }[];
  snap: Snapshot;
  secrets: number;
  secretTotal: number;
  coinTotal: number;
  glideSeen: boolean;
  nextPickupId: number;
  livesAwarded: number;
  livesAwardedSinceSnap: number;
};

const SOLID = new Set(["#", "=", "B", "L", "?", "!", "U", "."]);
const ONEWAY = new Set(["^"]);
const HAZARD = new Set(["S"]);

function cell(grid: string[], tx: number, ty: number): string {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= (grid[0]?.length ?? 0)) return " ";
  return grid[ty][tx] ?? " ";
}

function setCell(grid: string[], tx: number, ty: number, ch: string) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= (grid[0]?.length ?? 0)) return;
  const row = grid[ty];
  grid[ty] = row.slice(0, tx) + ch + row.slice(tx + 1);
}

function isSolid(ch: string): boolean {
  return SOLID.has(ch);
}

export function countFiniteCoins(grid: string[]): number {
  let n = 0;
  for (const row of grid) {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === "C" || ch === "?") n += 1;
    }
  }
  return n;
}

function clonePickup(p: Pickup): Pickup {
  return { ...p };
}

function cloneEnemy(e: Enemy): Enemy {
  return { ...e };
}

export function livesForLevelRetry(world: World): number {
  return Math.max(0, world.lives - world.livesAwarded);
}

function awardLife(world: World) {
  world.lives += 1;
  world.livesAwarded += 1;
  world.livesAwardedSinceSnap += 1;
}

export type CreateOpts = {
  lives?: number;
  score?: number;
  coinBank?: number;
  honeySeen?: boolean;
  glideSeen?: boolean;
};

export function createWorld(levelIndex: number, opts: CreateOpts = {}): World {
  const lives = opts.lives ?? START_LIVES;
  const score = opts.score ?? 0;
  const coinBank = opts.coinBank ?? 0;
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex))]!;
  const grid = level.grid.map((r) => r);
  const w = grid[0]?.length ?? 0;
  const h = MAP_H;
  let spawnX = TILE * 2;
  let spawnY = TILE * 10;
  let goalX = (w - 3) * TILE;
  let goalY = 12 * TILE;
  const enemies: Enemy[] = [];
  const pickups: Pickup[] = [];
  const checkpoints: World["checkpoints"] = [];
  const lanterns: World["lanterns"] = [];
  let nextId = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = cell(grid, x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (ch === "P") {
        spawnX = px + (TILE - PLAYER_W) / 2;
        spawnY = py + TILE - PLAYER_H;
        setCell(grid, x, y, " ");
      } else if (ch === "G") {
        goalX = px;
        goalY = py + TILE - 64;
        setCell(grid, x, y, " ");
      } else if (ch === "K") {
        checkpoints.push({ x: px + TILE / 2, y: py + TILE, armed: false });
        setCell(grid, x, y, " ");
      } else if (ch === "C") {
        pickups.push({
          kind: "coin",
          id: nextId++,
          x: px + 8,
          y: py + 8,
          w: 16,
          h: 16,
          vx: 0,
          vy: 0,
          taken: false,
          pop: 0,
        });
        setCell(grid, x, y, " ");
      } else if (ch === "H") {
        pickups.push({
          kind: "honey",
          id: nextId++,
          x: px + 6,
          y: py + 4,
          w: 20,
          h: 24,
          vx: 0,
          vy: 0,
          taken: false,
          pop: 0,
        });
        setCell(grid, x, y, " ");
      } else if (ch === "E") {
        enemies.push(makeEnemy("beetle", px + 4, py + 12));
        setCell(grid, x, y, " ");
      } else if (ch === "F") {
        enemies.push(makeEnemy("moth", px + 2, py + 4));
        setCell(grid, x, y, " ");
      } else if (ch === "N") {
        enemies.push(makeEnemy("spiky", px + 4, py + 10));
        setCell(grid, x, y, " ");
      } else if (ch === "*") {
        pickups.push({
          kind: "secret",
          id: nextId++,
          x: px + 6,
          y: py + 4,
          w: 20,
          h: 22,
          vx: 0,
          vy: 0,
          taken: false,
          pop: 0,
        });
        setCell(grid, x, y, " ");
      } else if (ch === "Y") {
        lanterns.push({ x: px + TILE / 2, y: py + TILE });
        setCell(grid, x, y, " ");
      }
    }
  }

  const movers: Mover[] = level.movers.map((m) => ({
    ...m,
    ox: m.x * TILE,
    oy: m.y * TILE,
    t: 0,
    vx: 0,
    vy: 0,
  }));

  const player: Player = {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
    airJumps: 0,
    maxAirJumps: 0,
    invuln: SPAWN_PROTECT,
    squash: 1,
    anim: 0,
    dead: false,
    dropTime: 0,
    riding: null,
    gliding: false,
    glideHold: 0,
  };

  const world: World = {
    level,
    grid,
    w,
    h,
    spawnX,
    spawnY,
    player,
    enemies,
    pickups,
    movers,
    particles: [],
    bumps: [],
    score,
    coins: 0,
    coinBank,
    lives,
    time: level.time,
    hasHoney: false,
    honeySeen: opts.honeySeen ?? false,
    won: false,
    died: false,
    deathCause: null,
    deaths: 0,
    cameraX: spawnX - 120,
    cameraY: spawnY - 180,
    lookX: 0,
    trauma: 0,
    hitstop: 0,
    goalX,
    goalY,
    toast: "",
    toastT: 0,
    bannerT: 2.4,
    spawnProtect: SPAWN_PROTECT,
    checkpoints,
    lanterns,
    snap: emptySnap(),
    secrets: 0,
    secretTotal: pickups.filter((p) => p.kind === "secret").length,
    coinTotal: countFiniteCoins(level.grid),
    glideSeen: opts.glideSeen ?? false,
    nextPickupId: nextId,
    livesAwarded: 0,
    livesAwardedSinceSnap: 0,
  };
  world.snap = takeSnap(world);
  return world;
}

function emptySnap(): Snapshot {
  return {
    x: 0,
    y: 0,
    facing: 1,
    score: 0,
    coins: 0,
    coinBank: 0,
    secrets: 0,
    hasHoney: false,
    maxAirJumps: 0,
    time: 0,
    grid: [],
    pickups: [],
    enemies: [],
    movers: [],
    nextPickupId: 1,
  };
}

export function takeSnap(world: World): Snapshot {
  const p = world.player;
  return {
    x: p.x,
    y: p.y,
    facing: p.facing,
    score: world.score,
    coins: world.coins,
    coinBank: world.coinBank,
    secrets: world.secrets,
    hasHoney: world.hasHoney,
    maxAirJumps: p.maxAirJumps,
    time: world.time,
    grid: world.grid.map((r) => r),
    pickups: world.pickups.map(clonePickup),
    enemies: world.enemies.map(cloneEnemy),
    movers: world.movers.map((m) => ({ t: m.t, vx: m.vx, vy: m.vy })),
    nextPickupId: world.nextPickupId,
  };
}

export function restoreCheckpoint(world: World): void {
  const s = world.snap;
  const awarded = world.livesAwardedSinceSnap;
  world.lives = Math.max(0, world.lives - awarded);
  world.livesAwarded = Math.max(0, world.livesAwarded - awarded);
  world.livesAwardedSinceSnap = 0;

  const p = world.player;
  p.x = s.x;
  p.y = s.y;
  p.vx = 0;
  p.vy = 0;
  p.facing = s.facing;
  p.dead = world.lives <= 0;
  p.grounded = false;
  p.coyote = 0;
  p.buffer = 0;
  p.jumpHeld = false;
  p.dropTime = 0;
  p.riding = null;
  p.gliding = false;
  p.glideHold = 0;
  p.invuln = SPAWN_PROTECT;
  p.maxAirJumps = s.maxAirJumps;
  p.airJumps = s.maxAirJumps;
  p.squash = 1;
  p.anim = 0;
  world.hasHoney = s.hasHoney;
  world.score = s.score;
  world.coins = s.coins;
  world.coinBank = s.coinBank;
  world.secrets = s.secrets;
  world.time = s.time;
  world.grid = s.grid.map((r) => r);
  world.pickups = s.pickups.map(clonePickup);
  world.enemies = s.enemies.map(cloneEnemy);
  world.nextPickupId = s.nextPickupId;
  for (let i = 0; i < world.movers.length; i++) {
    const m = world.movers[i]!;
    const sm = s.movers[i];
    if (!sm) continue;
    m.t = sm.t;
    m.vx = sm.vx;
    m.vy = sm.vy;
  }
  world.died = world.lives <= 0;
  world.deathCause = world.lives <= 0 ? (world.deathCause ?? "hit") : null;
  world.won = false;
  world.spawnProtect = SPAWN_PROTECT;
  world.hitstop = 0;
  world.trauma = 0;
  world.particles = [];
  world.bumps = [];
  world.toast = "";
  world.toastT = 0;
  world.cameraX = p.x - 120;
  world.cameraY = p.y - 180;
}

function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const sizes = {
    beetle: { w: 22, h: 18, vx: -36 },
    moth: { w: 24, h: 18, vx: 28 },
    spiky: { w: 22, h: 22, vx: -28 },
  }[kind];
  return {
    kind,
    x,
    y,
    w: sizes.w,
    h: sizes.h,
    vx: sizes.vx,
    vy: 0,
    alive: true,
    squish: 0,
    phase: Math.random() * Math.PI * 2,
    homeY: y,
  };
}

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function emit(world: World, p: Omit<Particle, "max" | "frame"> & { max?: number }) {
  if (world.particles.length > 90) world.particles.shift();
  world.particles.push({
    ...p,
    max: p.max ?? p.life,
    frame: 0,
  });
}

function burst(world: World, x: number, y: number, kind: Particle["kind"], n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 90;
    emit(world, {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      life: 0.25 + Math.random() * 0.35,
      kind,
    });
  }
}

function popText(world: World, x: number, y: number, text: string) {
  emit(world, { x, y, vx: 0, vy: -40, life: 0.7, kind: "pop", text, max: 0.7 });
}

function tilesOverlapping(x: number, y: number, w: number, h: number) {
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  const x1 = Math.floor((x + w - 0.001) / TILE);
  const y1 = Math.floor((y + h - 0.001) / TILE);
  const out: { tx: number; ty: number; ch: string }[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      out.push({ tx, ty, ch: "" });
    }
  }
  return out;
}

function resolveAxis(
  world: World,
  body: { x: number; y: number; w: number; h: number },
  vx: number,
  vy: number,
  axis: "x" | "y",
  prevBottom: number,
  dropThrough: boolean,
): { hit: boolean; grounded: boolean; bump: { tx: number; ty: number; ch: string } | null; hazard: boolean } {
  let hit = false;
  let grounded = false;
  let bump: { tx: number; ty: number; ch: string } | null = null;
  let hazard = false;
  const list = tilesOverlapping(body.x, body.y, body.w, body.h);
  for (const t of list) {
    t.ch = cell(world.grid, t.tx, t.ty);
    const tileX = t.tx * TILE;
    const tileY = t.ty * TILE;
    if (HAZARD.has(t.ch) && aabb(body.x, body.y, body.w, body.h, tileX, tileY + 10, TILE, TILE - 10)) {
      hazard = true;
    }
    const oneWay = ONEWAY.has(t.ch);
    const solid = isSolid(t.ch) || oneWay;
    if (!solid) continue;
    const tileTop = oneWay ? tileY + 10 : tileY;
    if (oneWay) {
      if (axis !== "y") continue;
      if (dropThrough) continue;
      if (vy < 0) continue;
      if (prevBottom > tileTop + 4) continue;
    }
    if (axis === "x") {
      const leftNeighbor = isSolid(cell(world.grid, t.tx - 1, t.ty));
      const rightNeighbor = isSolid(cell(world.grid, t.tx + 1, t.ty));
      if (vx > 0) {
        if (rightNeighbor && body.x + body.w > tileX + TILE) continue;
        body.x = tileX - body.w;
        hit = true;
      } else if (vx < 0) {
        if (leftNeighbor && body.x < tileX) continue;
        body.x = tileX + TILE;
        hit = true;
      }
    } else {
      if (vy > 0) {
        body.y = tileTop - body.h;
        hit = true;
        grounded = true;
      } else if (vy < 0) {
        body.y = tileY + TILE;
        hit = true;
        if (t.ch === "?" || t.ch === "!" || t.ch === "U" || t.ch === "B") bump = t;
      }
    }
  }
  return { hit, grounded, bump, hazard };
}

function hitBlock(world: World, t: { tx: number; ty: number; ch: string }) {
  if (t.ch === ".") return;
  world.bumps.push({ x: t.tx, y: t.ty, t: 0.18 });
  const px = t.tx * TILE + 8;
  const py = t.ty * TILE - 8;
  setCell(world.grid, t.tx, t.ty, ".");
  burst(world, px + 8, py + 16, "spark", t.ch === "B" ? 6 : 8);
  if (t.ch === "B") {
    world.score += 50;
    popText(world, px, py, "+50");
    return;
  }
  if (t.ch === "!") {
    world.pickups.push({
      kind: "honey",
      id: world.nextPickupId++,
      x: t.tx * TILE + 6,
      y: t.ty * TILE - 24,
      w: 20,
      h: 24,
      vx: 0,
      vy: -160,
      taken: false,
      pop: 0.35,
    });
  } else if (t.ch === "U") {
    world.pickups.push({
      kind: "life",
      id: world.nextPickupId++,
      x: t.tx * TILE + 6,
      y: t.ty * TILE - 24,
      w: 20,
      h: 24,
      vx: 0,
      vy: -140,
      taken: false,
      pop: 0.35,
    });
  } else {
    world.pickups.push({
      kind: "coin",
      id: world.nextPickupId++,
      x: t.tx * TILE + 8,
      y: t.ty * TILE - 20,
      w: 16,
      h: 16,
      vx: 0,
      vy: -180,
      taken: false,
      pop: 0.28,
    });
  }
}

export function bumpTile(world: World, tx: number, ty: number) {
  const ch = cell(world.grid, tx, ty);
  hitBlock(world, { tx, ty, ch });
}

function collectPickup(world: World, p: Pickup, events: SimEvents) {
  if (p.taken) return;
  p.taken = true;
  if (p.kind === "coin") {
    world.coins += 1;
    world.coinBank += 1;
    world.score += 100;
    popText(world, p.x, p.y, "+100");
    burst(world, p.x + 8, p.y + 8, "spark", 5);
    events.coin = true;
    if (world.coinBank >= COIN_LIFE) {
      world.coinBank -= COIN_LIFE;
      awardLife(world);
      popText(world, p.x, p.y - 12, "1UP");
      events.power = true;
    }
  } else if (p.kind === "honey") {
    world.hasHoney = true;
    world.player.maxAirJumps = 1;
    world.score += 500;
    popText(world, p.x, p.y, "二段跳");
    burst(world, p.x + 8, p.y + 8, "spark", 10);
    events.power = true;
    if (!world.honeySeen) {
      world.honeySeen = true;
      world.toast = "再按跳跃，空中可再跳一次";
      world.toastT = 2.6;
    }
  } else if (p.kind === "secret") {
    world.secrets += 1;
    world.score += 400;
    popText(world, p.x, p.y, "秘叶");
    burst(world, p.x + 8, p.y + 8, "leaf", 10);
    events.secret = true;
  } else {
    awardLife(world);
    popText(world, p.x, p.y, "1UP");
    events.power = true;
  }
}

export type SimEvents = {
  jump: boolean;
  land: boolean;
  coin: boolean;
  stomp: boolean;
  bump: boolean;
  hurt: boolean;
  power: boolean;
  die: boolean;
  win: boolean;
  checkpoint: boolean;
  glide: boolean;
  secret: boolean;
};

export function emptyEvents(): SimEvents {
  return {
    jump: false,
    land: false,
    coin: false,
    stomp: false,
    bump: false,
    hurt: false,
    power: false,
    die: false,
    win: false,
    checkpoint: false,
    glide: false,
    secret: false,
  };
}

function doJump(p: Player, world: World, events: SimEvents, strength = JUMP_V) {
  p.vy = strength;
  p.grounded = false;
  p.coyote = 0;
  p.buffer = 0;
  p.squash = 1.22;
  p.riding = null;
  events.jump = true;
  burst(world, p.x, p.y + PLAYER_H, "dust", 4);
}

function killPlayer(world: World, events: SimEvents, cause: "fall" | "hit" | "time") {
  const p = world.player;
  if (p.dead || world.won || world.died) return;
  world.lives = Math.max(0, world.lives - 1);
  world.deaths += 1;
  p.dead = true;
  world.died = true;
  world.deathCause = cause;
  events.die = true;
  burst(world, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, "leaf", 10);
}

function hurtPlayer(world: World, events: SimEvents) {
  const p = world.player;
  if (p.invuln > 0 || p.dead || world.won || world.died) return;
  if (world.hasHoney) {
    world.hasHoney = false;
    p.maxAirJumps = 0;
    p.airJumps = 0;
    p.invuln = INVULN;
    p.vy = -220;
    p.vx *= -0.4;
    world.trauma = Math.min(1, world.trauma + 0.45);
    events.hurt = true;
    world.toast = "叶子护盾碎了";
    world.toastT = 1.4;
    burst(world, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, "spark", 8);
    return;
  }
  killPlayer(world, events, "hit");
}

export function stepWorld(world: World, dt: number, actions: Actions, events: SimEvents) {
  if (world.hitstop > 0) {
    world.hitstop -= dt;
    if (actions.jumpPressed && !world.player.dead && !world.won) {
      world.player.buffer = JUMP_BUFFER;
    }
    return;
  }
  if (world.toastT > 0) world.toastT = Math.max(0, world.toastT - dt);
  if (world.bannerT > 0) world.bannerT = Math.max(0, world.bannerT - dt);
  if (world.spawnProtect > 0) world.spawnProtect = Math.max(0, world.spawnProtect - dt);

  if (world.won || world.player.dead) {
    world.player.vy = Math.min(MAX_FALL, world.player.vy + GRAVITY_DOWN * dt);
    world.player.y += world.player.vy * dt;
    return;
  }

  world.time = Math.max(0, world.time - dt);
  if (world.time <= 0) {
    killPlayer(world, events, "time");
    return;
  }

  const p = world.player;
  p.anim += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dropTime = Math.max(0, p.dropTime - dt);
  p.squash += (1 - p.squash) * Math.min(1, dt * 12);

  if (actions.down && p.grounded) p.dropTime = 0.18;

  for (const m of world.movers) {
    const prevX = m.ox + (m.axis === "x" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    const prevY = m.oy + (m.axis === "y" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    m.t += (m.speed / Math.max(40, m.range * TILE)) * dt * 2;
    const nx = m.ox + (m.axis === "x" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    const ny = m.oy + (m.axis === "y" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    m.vx = (nx - prevX) / dt;
    m.vy = (ny - prevY) / dt;
  }

  const accel = p.grounded ? ACCEL_GROUND : ACCEL_AIR;
  if (actions.moveX !== 0) {
    p.vx += actions.moveX * accel * dt;
    p.facing = actions.moveX > 0 ? 1 : -1;
  } else if (p.grounded) {
    const s = Math.sign(p.vx);
    p.vx -= s * FRICTION * dt;
    if (Math.sign(p.vx) !== s) p.vx = 0;
  } else {
    p.vx *= 1 - Math.min(1, dt * 1.2);
  }
  p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));

  if (p.grounded) {
    p.coyote = COYOTE;
    p.airJumps = p.maxAirJumps;
  } else {
    p.coyote = Math.max(0, p.coyote - dt);
  }
  if (actions.jumpPressed) p.buffer = JUMP_BUFFER;
  else p.buffer = Math.max(0, p.buffer - dt);

  const canGroundJump = p.buffer > 0 && (p.grounded || p.coyote > 0);
  const canAirJump = p.buffer > 0 && !p.grounded && p.airJumps > 0 && p.coyote <= 0;
  if (canGroundJump) {
    doJump(p, world, events);
  } else if (canAirJump) {
    p.airJumps -= 1;
    doJump(p, world, events, JUMP_V * 0.92);
  }

  if (!actions.jumpHeld && p.vy < 0 && p.jumpHeld) {
    p.vy *= JUMP_CUT;
  }
  p.jumpHeld = actions.jumpHeld;

  let g = GRAVITY_DOWN;
  if (p.vy < 0) g = GRAVITY_UP;
  if (Math.abs(p.vy) < APEX_WINDOW) g = GRAVITY_APEX;
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);

  if (p.grounded) {
    p.gliding = false;
    p.glideHold = 0;
  } else if (p.vy > 28 && actions.jumpHeld) {
    p.glideHold += dt;
    if (p.glideHold >= GLIDE_DELAY) {
      if (!p.gliding) {
        events.glide = true;
        if (!world.glideSeen) {
          world.glideSeen = true;
          world.toast = "叶帽展开了，按住可滑翔";
          world.toastT = 2.2;
        }
      }
      p.gliding = true;
      p.vy = Math.min(p.vy, GLIDE_FALL);
    }
  } else {
    p.gliding = false;
    if (!actions.jumpHeld) p.glideHold = 0;
  }

  const wasGrounded = p.grounded;
  p.grounded = false;
  p.riding = null;

  const prevBottom = p.y + PLAYER_H;
  const moveX = p.vx * dt;
  const moveY = p.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)) / 8));
  const sx = moveX / steps;
  const sy = moveY / steps;
  const body = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
  let hazard = false;

  for (let i = 0; i < steps; i++) {
    body.x += sx;
    const rx = resolveAxis(world, body, p.vx, 0, "x", prevBottom, p.dropTime > 0);
    if (rx.hit) p.vx = 0;
    if (rx.hazard) hazard = true;

    body.y += sy;
    const ry = resolveAxis(world, body, 0, p.vy, "y", prevBottom, p.dropTime > 0);
    if (ry.hit) {
      if (p.vy > 80 && ry.grounded) {
        p.squash = 0.78;
        events.land = true;
        burst(world, body.x + PLAYER_W / 2, body.y + PLAYER_H, "dust", 3);
      }
      if (ry.bump && p.vy < 0) {
        hitBlock(world, ry.bump);
        events.bump = true;
        world.trauma = Math.min(1, world.trauma + 0.18);
      }
      if (ry.grounded) {
        p.grounded = true;
        p.vy = 0;
      } else if (p.vy < 0) {
        p.vy = 0;
      }
    }
    if (ry.hazard) hazard = true;
  }

  for (const m of world.movers) {
    const mx = m.ox + (m.axis === "x" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    const my = m.oy + (m.axis === "y" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    const mw = m.w * TILE;
    const mh = 12;
    if (p.dropTime > 0) continue;
    if (p.vy >= 0 && aabb(body.x, body.y, PLAYER_W, PLAYER_H, mx, my, mw, mh)) {
      const feet = body.y + PLAYER_H;
      if (feet <= my + 10 && prevBottom <= my + 8) {
        body.y = my - PLAYER_H;
        p.grounded = true;
        p.vy = 0;
        p.riding = m;
        body.x += m.vx * dt;
        const wall = resolveAxis(world, body, m.vx, 0, "x", body.y + PLAYER_H, false);
        if (wall.hit) p.vx = 0;
      }
    }
  }

  p.x = body.x;
  p.y = body.y;
  if (p.x < 0) {
    p.x = 0;
    p.vx = 0;
  }
  if (p.x > world.w * TILE - PLAYER_W) {
    p.x = world.w * TILE - PLAYER_W;
    p.vx = 0;
  }

  if (!wasGrounded && p.grounded) p.squash = Math.min(p.squash, 0.82);

  if (hazard && p.invuln <= 0) hurtPlayer(world, events);
  if (p.y > world.h * TILE + 40) killPlayer(world, events, "fall");

  for (const e of world.enemies) {
    if (!e.alive) {
      e.squish += dt;
      continue;
    }
    e.phase += dt;
    if (e.kind === "moth") {
      e.x += e.vx * dt;
      e.y = e.homeY + Math.sin(e.phase * 2.2) * 22;
      const ahead = cell(world.grid, Math.floor((e.x + (e.vx > 0 ? e.w + 2 : -2)) / TILE), Math.floor(e.y / TILE));
      if (isSolid(ahead) || e.x < 8 || e.x > world.w * TILE - e.w - 8) e.vx *= -1;
    } else {
      e.x += e.vx * dt;
      e.vy = Math.min(MAX_FALL, e.vy + GRAVITY_DOWN * dt);
      const prevBottom = e.y + e.h;
      e.y += e.vy * dt;
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      const r = resolveAxis(world, eb, 0, e.vy, "y", prevBottom, false);
      e.y = eb.y;
      if (r.grounded) {
        e.vy = 0;
        const footX = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
        const footY = e.y + e.h + 2;
        const groundAhead =
          isSolid(cell(world.grid, Math.floor(footX / TILE), Math.floor(footY / TILE))) ||
          ONEWAY.has(cell(world.grid, Math.floor(footX / TILE), Math.floor(footY / TILE)));
        const wall = isSolid(cell(world.grid, Math.floor(footX / TILE), Math.floor((e.y + e.h / 2) / TILE)));
        if (wall || !groundAhead) e.vx *= -1;
      } else {
        const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const wall = isSolid(cell(world.grid, Math.floor(aheadX / TILE), Math.floor((e.y + e.h / 2) / TILE)));
        if (wall) e.vx *= -1;
      }
    }

    if (p.invuln > 0 || p.dead || world.died) continue;
    if (!aabb(p.x, p.y, PLAYER_W, PLAYER_H, e.x, e.y, e.w, e.h)) continue;
    const stomp = p.vy > 40 && p.y + PLAYER_H - e.y < 14;
    if (stomp && e.kind !== "spiky") {
      e.alive = false;
      e.squish = 0;
      p.vy = actions.jumpHeld ? JUMP_V * 0.72 : STOMP_BOUNCE;
      world.score += 200;
      popText(world, e.x, e.y, "+200");
      burst(world, e.x + e.w / 2, e.y + e.h / 2, "dust", 8);
      events.stomp = true;
      world.hitstop = 0.04;
      world.trauma = Math.min(1, world.trauma + 0.28);
    } else {
      hurtPlayer(world, events);
    }
  }

  if (!(p.dead || world.died || world.won)) {
    for (const cp of world.checkpoints) {
      if (cp.armed) continue;
      if (aabb(p.x, p.y, PLAYER_W, PLAYER_H, cp.x - 14, cp.y - 48, 28, 52)) {
        cp.armed = true;
        world.snap = takeSnap(world);
        world.livesAwardedSinceSnap = 0;
        world.toast = "已记录";
        world.toastT = 1.5;
        events.checkpoint = true;
        burst(world, cp.x, cp.y - 28, "leaf", 8);
      }
    }

    for (const item of world.pickups) {
      if (item.taken) continue;
      if (item.pop > 0) {
        item.pop -= dt;
        item.y += item.vy * dt;
        item.vy += GRAVITY_DOWN * dt * 0.6;
      }
      if (aabb(p.x, p.y, PLAYER_W, PLAYER_H, item.x, item.y, item.w, item.h)) {
        collectPickup(world, item, events);
      }
    }

    if (aabb(p.x, p.y, PLAYER_W, PLAYER_H, world.goalX, world.goalY, 28, 64)) {
      world.won = true;
      const bonus = Math.floor(world.time) * 10;
      world.score += 1000 + bonus;
      popText(world, p.x, p.y - 10, "FINISH");
      events.win = true;
    }
  }

  if (!prefersReducedMotion() && Math.random() < dt * 0.35) {
    emit(world, {
      x: p.x + (Math.random() * 220 - 40),
      y: p.y - 40 - Math.random() * 80,
      vx: -18 - Math.random() * 24,
      vy: 20 + Math.random() * 18,
      life: 1.6,
      kind: "leaf",
    });
  }

  for (const b of world.bumps) b.t -= dt;
  world.bumps = world.bumps.filter((b) => b.t > 0);

  for (const part of world.particles) {
    part.life -= dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vy += 180 * dt;
    part.frame += dt * 12;
  }
  world.particles = world.particles.filter((part) => part.life > 0);

  world.trauma = Math.max(0, world.trauma - dt * 1.6);
}

export function cameraStep(world: World, dt: number, viewW: number, viewH: number, shakeOn: boolean) {
  const p = world.player;
  const targetLook = p.facing * 64;
  world.lookX += (targetLook - world.lookX) * (1 - Math.exp(-5 * dt));
  const destX = p.x + PLAYER_W / 2 - viewW * 0.4 + world.lookX;
  const destY = p.y + PLAYER_H / 2 - viewH * 0.62;
  const k = 1 - Math.exp(-6.5 * dt);
  const dx = destX - world.cameraX;
  const dy = destY - world.cameraY;
  if (Math.abs(dx) > 22) world.cameraX += dx * k;
  if (Math.abs(dy) > 28) world.cameraY += dy * k;
  else world.cameraY += dy * k * 0.35;
  const maxX = Math.max(0, world.w * TILE - viewW);
  const maxY = Math.max(0, world.h * TILE - viewH);
  world.cameraX = Math.max(0, Math.min(maxX, world.cameraX));
  world.cameraY = Math.max(0, Math.min(maxY, world.cameraY));
  if (!shakeOn) return { sx: 0, sy: 0 };
  const shake = world.trauma * world.trauma;
  return {
    sx: (Math.random() * 2 - 1) * 6 * shake,
    sy: (Math.random() * 2 - 1) * 4 * shake,
  };
}
