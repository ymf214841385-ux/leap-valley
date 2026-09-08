import type { GameImages } from "./assets";
import { PLAYER_DRAW, PLAYER_H, PLAYER_W, TILE, VIEW_H, VIEW_W } from "./const";
import { prefersReducedMotion } from "./motion";
import type { World } from "./sim";

function drawImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
) {
  if (!img) return;
  ctx.save();
  if (flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

function tileAt(world: World, tx: number, ty: number): string {
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.w) return " ";
  return world.grid[ty][tx] ?? " ";
}

function isFill(ch: string) {
  return ch === "#" || ch === "=" || ch === "L" || ch === "B" || ch === "?" || ch === "!" || ch === "U" || ch === ".";
}

function fillPat(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pw = img.width;
  const ph = img.height;
  if (pw <= 0 || ph <= 0 || w <= 0 || h <= 0) return;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + Math.ceil(w);
  const y1 = y0 + Math.ceil(h);
  const startPx = Math.floor(x0 / pw) * pw;
  const startPy = Math.floor(y0 / ph) * ph;
  for (let py = startPy; py < y1; py += ph) {
    for (let px = startPx; px < x1; px += pw) {
      const dx = Math.max(px, x0);
      const dy = Math.max(py, y0);
      const dw = Math.min(px + pw, x1) - dx;
      const dh = Math.min(py + ph, y1) - dy;
      if (dw <= 0 || dh <= 0) continue;
      ctx.drawImage(img, dx - px, dy - py, dw, dh, dx, dy, dw, dh);
    }
  }
}

function drawGinkgoLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rot: number,
  fill: string,
  stem = true,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  if (stem) {
    ctx.strokeStyle = "#6b5344";
    ctx.lineWidth = 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.quadraticCurveTo(-0.6, 5, 0, 0);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(10, -2, 16, -8, 15, -17);
  ctx.quadraticCurveTo(8, -15, 3, -20);
  ctx.lineTo(0, -13);
  ctx.lineTo(-3, -20);
  ctx.quadraticCurveTo(-8, -15, -15, -17);
  ctx.bezierCurveTo(-16, -8, -10, -2, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 58, 22, 0.38)";
  ctx.lineWidth = 0.7;
  const veins = [-0.85, -0.42, 0, 0.42, 0.85];
  for (const a of veins) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(a * 5, -8, Math.sin(a) * 13, -16.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlideCanopy(ctx: CanvasRenderingContext2D, px: number, py: number, facing: number, now: number) {
  const calm = prefersReducedMotion();
  const sway = calm ? 0 : Math.sin(now * 3.2) * 0.12;
  const bob = calm ? 0 : Math.sin(now * 4.1) * 1.2;
  const cx = px + PLAYER_W / 2;
  const cy = py - 4 + bob;
  drawGinkgoLeaf(ctx, cx + facing * 2, cy + 2, 1.05, sway * 0.4, "#d7c35a");
  drawGinkgoLeaf(ctx, cx - 7, cy + 1, 0.78, -0.55 + sway, "#c4b14a");
  drawGinkgoLeaf(ctx, cx + 7, cy + 1, 0.78, 0.55 + sway, "#e2cf6a");
}

function drawSecretLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, now: number) {
  const calm = prefersReducedMotion();
  const rot = calm ? -0.2 : Math.sin(now * 2.4) * 0.18 - 0.15;
  const glow = calm ? 0.55 : 0.45 + Math.sin(now * 3.2) * 0.12;
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = "rgba(233, 188, 74, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x + 10, y + 12, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawGinkgoLeaf(ctx, x + 10, y + 16, 1.05, rot, "#e9bc4a");
}

function drawHoneyShield(ctx: CanvasRenderingContext2D, px: number, py: number, now: number) {
  const cx = px + PLAYER_W / 2;
  const cy = py + PLAYER_H / 2;
  const calm = prefersReducedMotion();
  const pulse = calm ? 0.42 : 0.38 + Math.sin(now * 4) * 0.08;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = "rgba(196, 140, 48, 0.9)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, PLAYER_W * 0.86, PLAYER_H * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 236, 190, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, PLAYER_W * 0.7, PLAYER_H * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function parallax(ctx: CanvasRenderingContext2D, img: HTMLImageElement, camX: number, factor: number, y: number, h: number) {
  const w = VIEW_W;
  const shift = ((camX * factor) % w + w) % w;
  ctx.drawImage(img, -shift, y, w, h);
  ctx.drawImage(img, -shift + w, y, w, h);
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  images: GameImages,
  shake: { sx: number; sy: number },
  now: number,
) {
  const camX = Math.round(world.cameraX + shake.sx);
  const camY = Math.round(world.cameraY + shake.sy);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (world.level.dusk) ctx.drawImage(images.dusk, 0, 0, VIEW_W, VIEW_H);
  else ctx.drawImage(images.sky, 0, 0, VIEW_W, VIEW_H);
  parallax(ctx, images.far, camX, 0.12, 18, VIEW_H - 8);
  if (world.level.dusk) {
    ctx.fillStyle = "rgba(88, 70, 118, 0.22)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  parallax(ctx, images.mid, camX, 0.32, 28, VIEW_H - 10);

  ctx.save();
  ctx.translate(-camX, -camY);

  if (world.level.id === 2) {
    const wy = world.h * TILE - 22;
    ctx.fillStyle = "rgba(70, 130, 150, 0.35)";
    ctx.fillRect(camX - 20, wy, VIEW_W + 40, 28);
    ctx.strokeStyle = "rgba(180, 220, 230, 0.45)";
    ctx.beginPath();
    for (let i = 0; i <= VIEW_W + 40; i += 8) {
      const wx = camX - 20 + i;
      ctx.lineTo(wx, wy + Math.sin(now * 2.4 + wx * 0.08) * 2);
    }
    ctx.stroke();
  }

  const tx0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const tx1 = Math.min(world.w - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  const ty1 = Math.min(world.h - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(world, tx, ty);
      if (ch !== "#" && ch !== "=") continue;
      const x = tx * TILE;
      const y = ty * TILE;
      fillPat(ctx, images.dirtFill, x, y, TILE, TILE);
      if (!isFill(tileAt(world, tx, ty - 1))) {
        ctx.fillStyle = "rgba(126, 158, 72, 0.55)";
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillStyle = "rgba(214, 196, 96, 0.38)";
        ctx.fillRect(x, y, TILE, 2);
        fillPat(ctx, images.grassCap, x, y - 10, TILE, 22);
      }
      ctx.fillStyle = "rgba(40, 28, 20, 0.28)";
      if (!isFill(tileAt(world, tx - 1, ty))) ctx.fillRect(x, y, 3, TILE);
      if (!isFill(tileAt(world, tx + 1, ty))) ctx.fillRect(x + TILE - 3, y, 3, TILE);
    }
  }

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(world, tx, ty);
      if (ch === " " || ch === "#" || ch === "=") continue;
      let x = tx * TILE;
      let y = ty * TILE;
      const bump = world.bumps.find((b) => b.x === tx && b.y === ty);
      if (bump) y -= Math.sin((bump.t / 0.18) * Math.PI) * 6;
      if (ch === "B") drawImg(ctx, images.crate, x, y, TILE, TILE);
      else if (ch === "?" || ch === "!" || ch === "U") drawImg(ctx, images.bloom, x, y, TILE, TILE);
      else if (ch === ".") drawImg(ctx, images.used, x, y, TILE, TILE);
      else if (ch === "^") drawImg(ctx, images.plank, x, y + 10, TILE, 12);
      else if (ch === "S") drawImg(ctx, images.spike, x - 2, y + 12, TILE + 4, 20);
      else if (ch === "L") drawImg(ctx, images.log, x + 2, y - 8, TILE - 4, TILE + 8);
    }
  }

  for (const m of world.movers) {
    const mx = m.ox + (m.axis === "x" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    const my = m.oy + (m.axis === "y" ? Math.sin(m.t) * m.range * TILE * 0.5 : 0);
    drawImg(ctx, images.plank, mx, my, m.w * TILE, 14);
  }

  for (const cp of world.checkpoints) {
    const glow = cp.armed ? 1 : 0.72 + Math.sin(now * 3) * 0.12;
    ctx.globalAlpha = glow;
    drawImg(ctx, images.checkpoint, cp.x - 16, cp.y - 56, 32, 58);
    ctx.globalAlpha = 1;
  }

  for (const lamp of world.lanterns) {
    const pulse = prefersReducedMotion() ? 0.6 : 0.55 + Math.sin(now * 3 + lamp.x) * 0.15;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#E9BC4A";
    ctx.beginPath();
    ctx.ellipse(lamp.x, lamp.y - 28, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawImg(ctx, images.lantern, lamp.x - 12, lamp.y - 52, 24, 52);
  }

  drawImg(ctx, images.flag, world.goalX - 4, world.goalY, 36, 72);

  for (const item of world.pickups) {
    if (item.taken) continue;
    if (item.kind === "coin") {
      const fr = images.acorn[Math.floor(now * 8) % images.acorn.length];
      drawImg(ctx, fr, item.x, item.y, 16, 16);
    } else if (item.kind === "secret") {
      drawSecretLeaf(ctx, item.x, item.y, now);
    } else if (item.kind === "honey") {
      drawImg(ctx, images.honey, item.x, item.y, 20, 24);
    } else {
      const fr = images.pipIdle[0];
      drawImg(ctx, fr, item.x, item.y, 18, 20);
    }
  }

  for (const e of world.enemies) {
    if (!e.alive && e.squish > 0.35) continue;
    const flip = e.vx > 0;
    const sy = !e.alive ? 0.35 : 1;
    const frames = e.kind === "moth" ? images.moth : e.kind === "spiky" ? images.spiky : images.beetle;
    const fr = frames[Math.floor(e.phase * (e.kind === "moth" ? 10 : 6)) % frames.length];
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(flip ? -1 : 1, sy);
    drawImg(ctx, fr, -e.w / 2 - 6, -e.h - 8, e.w + 12, e.h + 10);
    ctx.restore();
  }

  const p = world.player;
  const blink = p.invuln > 0 && Math.floor(now * 16) % 2 === 0;
  if (!blink) {
    let frames = images.pipIdle;
    let speed = 5;
    let fr: HTMLImageElement | undefined;
    if (!p.grounded) {
      frames = images.pipJump;
      const idx = p.vy < -80 ? 1 : p.vy < 40 ? 2 : 3;
      fr = frames[Math.min(idx, frames.length - 1)];
    } else {
      if (Math.abs(p.vx) > 18) {
        frames = images.pipRun;
        speed = 10;
      }
      fr = frames[Math.floor(p.anim * speed) % frames.length];
    }
    const sw = 32 * PLAYER_DRAW * (2 - p.squash);
    const sh = 36 * PLAYER_DRAW * p.squash;
    if (world.hasHoney) drawHoneyShield(ctx, p.x, p.y, now);
    if (p.gliding) drawGlideCanopy(ctx, p.x, p.y, p.facing, now);
    drawImg(
      ctx,
      fr,
      p.x + PLAYER_W / 2 - sw / 2,
      p.y + PLAYER_H - sh + 1,
      sw,
      sh,
      p.facing < 0,
    );
  }

  for (const part of world.particles) {
    const a = Math.max(0, part.life / part.max);
    if (part.kind === "pop" && part.text) {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#FFF3DB";
      ctx.font = "700 11px 'Noto Sans SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(part.text, part.x, part.y);
      ctx.globalAlpha = 1;
    } else if (part.kind === "dust") {
      const fr = images.dust[Math.min(images.dust.length - 1, Math.floor(part.frame) % images.dust.length)];
      ctx.globalAlpha = a;
      drawImg(ctx, fr, part.x - 10, part.y - 10, 20, 20);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = part.kind === "leaf" ? "#3D674A" : "#E9BC4A";
      ctx.beginPath();
      ctx.ellipse(part.x, part.y, part.kind === "leaf" ? 3.2 : 1.8, part.kind === "leaf" ? 1.6 : 1.8, now, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

export function renderTitleIdle(ctx: CanvasRenderingContext2D, images: GameImages, t: number) {
  const calm = prefersReducedMotion();
  const drift = calm ? 0 : t;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(images.sky, 0, 0, VIEW_W, VIEW_H);
  parallax(ctx, images.far, drift * 10, 1, 16, VIEW_H);
  parallax(ctx, images.mid, drift * 22, 1, 24, VIEW_H - 8);
  fillPat(ctx, images.dirtFill, 0, VIEW_H - 40, VIEW_W, 40);
  ctx.fillStyle = "rgba(126, 158, 72, 0.5)";
  ctx.fillRect(0, VIEW_H - 40, VIEW_W, 5);
  fillPat(ctx, images.grassCap, 0, VIEW_H - 56, VIEW_W, 22);
  const bob = calm ? 0 : Math.sin(t * 2.4) * 3;
  const hat = calm ? 0 : Math.sin(t * 1.6) * 1.5;
  const fr = images.pipIdle[Math.floor((calm ? 0 : t) * 5) % images.pipIdle.length];
  const pipX = VIEW_W * 0.62 - 40;
  const pipY = VIEW_H - 56 - 78 + bob + hat;
  drawImg(ctx, fr, pipX, pipY, 80, 88);
  drawGinkgoLeaf(ctx, pipX + 48, pipY + 10, 1.15, calm ? -0.2 : Math.sin(t * 1.8) * 0.08 - 0.15, "#e2cf6a");
}
