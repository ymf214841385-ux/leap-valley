import { loadAssets, type GameImages } from "./assets";
import { GameAudio } from "./audio";
import { FIXED_DT, MAX_PHYS_STEPS, RESPAWN_DELAY, START_LIVES, VIEW_H, VIEW_W } from "./const";
import { Input } from "./input";
import { LEVELS } from "./levels";
import { StartupGuard, phaseAfterPauseInput } from "./lifecycle";
import { prefersReducedMotion } from "./motion";
import {
  cameraStep,
  createWorld,
  emptyEvents,
  livesForLevelRetry,
  restoreCheckpoint,
  stepWorld,
  type World,
} from "./sim";
import { renderTitleIdle, renderWorld } from "./render";
import { levelClearScore, loadSave, recordLevelBest, writeSave } from "./save";
import { useGameUI, type Phase } from "./store";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getX: () => number;
  getVx: () => number;
  getVy: () => number;
  setKeys: (codes: string[]) => void;
  setSteer?: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export class LeapGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input = new Input();
  audio = new GameAudio();
  images: GameImages | null = null;
  world: World | null = null;
  running = false;
  raf = 0;
  acc = 0;
  last = 0;
  frameDt = FIXED_DT;
  levelIndex = 0;
  titleTime = 0;
  dpr = 1;
  hudClock = 0;
  deathTimer = 0;
  coinStreak = 0;
  coinStreakT = 0;
  runScore0 = 0;
  runBank0 = 0;
  detachRo: (() => void) | null = null;
  private bootGuard = new StartupGuard();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.resize();
  }

  async boot() {
    const { stale } = this.bootGuard.begin();
    const save = loadSave();
    useGameUI.setState({
      loading: true,
      muted: save.muted,
      shake: save.shake,
      highScore: save.highScore,
      unlocked: save.unlocked,
      lastLevel: save.lastLevel,
      best: save.best,
    });
    this.audio.setMuted(save.muted);
    try {
      const images = await loadAssets();
      if (stale()) return;
      this.images = images;
      useGameUI.setState({ loading: false, phase: "title" });
    } catch (err) {
      if (stale()) return;
      useGameUI.setState({
        loading: false,
        loadError: err instanceof Error ? err.message : "素材加载失败",
      });
      return;
    }
    if (stale()) return;
    this.input.attach(window);
    this.installProbe();
    this.running = true;
    this.last = performance.now();
    this.resize();
    const parent = this.canvas.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(parent);
      this.detachRo = () => ro.disconnect();
    }
    this.loop(this.last);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("resize", this.onResize);
  }

  destroy() {
    this.bootGuard.cancel();
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.audio.destroy();
    this.detachRo?.();
    this.detachRo = null;
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("resize", this.onResize);
    if (window.__controlsTest) delete window.__controlsTest;
  }

  private onVis = () => {
    if (document.hidden) {
      this.audio.suspendMusic();
      this.persist();
      if (useGameUI.getState().phase === "playing") this.syncUI("paused");
    } else {
      this.audio.resumeIfNeeded();
    }
  };

  private onResize = () => this.resize();

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.width = Math.floor(VIEW_W * this.dpr);
    this.canvas.height = Math.floor(VIEW_H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  pauseFromResize() {
    if (useGameUI.getState().phase === "playing") {
      this.audio.suspendMusic();
      this.input.resetHeld();
      this.syncUI("paused");
    }
  }

  unlockAudio() {
    this.audio.unlock();
  }

  startAdventure(level = 0) {
    this.unlockAudio();
    this.input.resetHeld();
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, level));
    this.world = createWorld(this.levelIndex, { lives: START_LIVES, score: 0, coinBank: 0 });
    this.runScore0 = 0;
    this.runBank0 = 0;
    this.deathTimer = 0;
    this.audio.setMusic(true, this.levelIndex);
    const save = loadSave();
    save.lastLevel = this.levelIndex + 1;
    writeSave(save);
    this.syncUI("playing");
  }

  retry() {
    this.unlockAudio();
    this.input.resetHeld();
    const w = this.world;
    const rolled = w ? livesForLevelRetry(w) : START_LIVES;
    const gameOver = !w || w.lives <= 0 || rolled <= 0;
    this.world = createWorld(this.levelIndex, {
      lives: gameOver ? START_LIVES : rolled,
      score: gameOver ? 0 : this.runScore0,
      coinBank: gameOver ? 0 : this.runBank0,
      honeySeen: w?.honeySeen,
      glideSeen: w?.glideSeen,
    });
    if (gameOver) {
      this.runScore0 = 0;
      this.runBank0 = 0;
    }
    this.deathTimer = 0;
    this.audio.setMusic(true, this.levelIndex);
    this.syncUI("playing");
  }

  retryCheckpoint() {
    this.unlockAudio();
    this.input.resetHeld();
    if (!this.world || this.world.lives <= 0) {
      this.retry();
      return;
    }
    restoreCheckpoint(this.world);
    this.deathTimer = 0;
    if (this.world.lives <= 0) {
      this.audio.setMusic(false);
      this.syncUI("dead");
      return;
    }
    this.audio.setMusic(true, this.levelIndex);
    this.syncUI("playing");
  }

  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      useGameUI.setState({ phase: "win" });
      return;
    }
    const score = this.world?.score ?? 0;
    const lives = this.world?.lives ?? START_LIVES;
    const bank = this.world?.coinBank ?? 0;
    this.levelIndex += 1;
    this.runScore0 = score;
    this.runBank0 = bank;
    const save = loadSave();
    save.unlocked = Math.max(save.unlocked, this.levelIndex + 1);
    save.lastLevel = this.levelIndex + 1;
    writeSave(save);
    this.world = createWorld(this.levelIndex, {
      lives,
      score,
      coinBank: bank,
      honeySeen: this.world?.honeySeen,
      glideSeen: this.world?.glideSeen,
    });
    this.audio.setMusic(true, this.levelIndex);
    this.syncUI("playing");
  }

  toTitle() {
    this.world = null;
    this.audio.setMusic(false);
    this.input.resetHeld();
    this.syncUI("title");
  }

  togglePause() {
    const phase = useGameUI.getState().phase;
    if (phase === "playing") {
      this.audio.suspendMusic();
      this.input.resetHeld();
      this.syncUI("paused");
    } else if (phase === "paused") {
      this.input.resetHeld();
      this.audio.setMusic(true, this.levelIndex);
      this.syncUI("playing");
    }
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
    useGameUI.setState({ muted });
    const save = loadSave();
    save.muted = muted;
    writeSave(save);
  }

  setShake(shake: boolean) {
    useGameUI.setState({ shake });
    const save = loadSave();
    save.shake = shake;
    writeSave(save);
  }

  persist() {
    const ui = useGameUI.getState();
    const save = loadSave();
    save.highScore = Math.max(save.highScore, ui.highScore, ui.score);
    save.muted = ui.muted;
    save.shake = ui.shake;
    save.unlocked = Math.max(save.unlocked, ui.unlocked);
    writeSave(save);
  }

  private installProbe() {
    window.__controlsTest = {
      getYaw: () => {
        const p = this.world?.player;
        if (!p) return 0;
        return p.facing < 0 ? Math.PI : 0;
      },
      getSpeed: () => Math.abs(this.world?.player.vx ?? 0),
      getX: () => this.world?.player.x ?? 0,
      getVx: () => this.world?.player.vx ?? 0,
      getVy: () => this.world?.player.vy ?? 0,
      setKeys: (codes: string[]) => this.input.setKeys(codes),
      setSteer: (v: number) => {
        if (v > 0.2) this.input.setKeys(["KeyA"]);
        else if (v < -0.2) this.input.setKeys(["KeyD"]);
        else this.input.setKeys([]);
      },
    };
  }

  private syncUI(phase?: Phase) {
    const w = this.world;
    const level = LEVELS[this.levelIndex]!;
    const save = loadSave();
    const score = w?.score ?? 0;
    const high = Math.max(save.highScore, score);
    if (score > save.highScore) {
      save.highScore = score;
      writeSave(save);
    }
    useGameUI.setState({
      phase: phase ?? useGameUI.getState().phase,
      score,
      coins: w?.coins ?? 0,
      coinBank: w?.coinBank ?? 0,
      lives: w?.lives ?? START_LIVES,
      time: Math.ceil(w?.time ?? level.time),
      level: this.levelIndex + 1,
      levelName: level.name,
      highScore: high,
      unlocked: save.unlocked,
      lastLevel: save.lastLevel,
      hasHoney: w?.hasHoney ?? false,
      toast: w && w.toastT > 0 ? w.toast : "",
      deathCause: w?.deathCause ?? null,
      canCheckpoint: Boolean(w && w.lives > 0),
      deaths: w?.deaths ?? 0,
      banner: w && w.bannerT > 0 ? level.name : "",
      honeyHint: Boolean(w?.hasHoney),
      secrets: w?.secrets ?? 0,
      secretTotal: w?.secretTotal ?? 0,
      coinTotal: w?.coinTotal ?? 0,
      gliding: w?.player.gliding ?? false,
      best: save.best,
    });
  }

  private loop = (now: number) => {
    if (!this.running) return;
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 0.1);
    this.frameDt = dt;
    this.titleTime += dt;

    const held = this.input.pollHeld();
    const pausePressed = this.input.consumePause();
    const prior = useGameUI.getState().phase;
    const phase = phaseAfterPauseInput(prior, pausePressed);
    if (phase !== prior) this.togglePause();

    if (phase === "playing") this.audio.tick(dt);

    if (phase === "dead" && this.world && this.world.lives > 0) {
      this.deathTimer += dt;
      if (this.deathTimer >= RESPAWN_DELAY) this.retryCheckpoint();
    }

    if (phase === "playing" && this.world) {
      this.acc += dt;
      const events = emptyEvents();
      let steps = 0;
      let jumpConsumed = false;
      while (this.acc >= FIXED_DT && steps < MAX_PHYS_STEPS) {
        const jumpPressed = !jumpConsumed && this.input.consumeJump();
        if (jumpPressed) jumpConsumed = true;
        stepWorld(this.world, FIXED_DT, { ...held, jumpPressed, pausePressed: false }, events);
        this.acc -= FIXED_DT;
        steps += 1;
      }
      if (events.jump) this.audio.jump();
      if (events.land) this.audio.land();
      if (events.coin) {
        if (this.coinStreakT <= 0) this.coinStreak = 0;
        this.coinStreak = Math.min(8, this.coinStreak + 1);
        this.coinStreakT = 0.45;
        this.audio.coin(this.coinStreak);
      }
      if (events.stomp) this.audio.stomp();
      if (events.bump) this.audio.bump();
      if (events.hurt) this.audio.hurt();
      if (events.power) this.audio.power();
      if (events.checkpoint) this.audio.checkpoint();
      if (events.glide) this.audio.glide();
      if (events.secret) this.audio.secret();
      if (events.die) {
        this.audio.death();
        this.audio.setMusic(false);
        this.deathTimer = 0;
        this.syncUI("dead");
      }
      if (events.win) {
        this.audio.win();
        this.audio.setMusic(false);
        const save = loadSave();
        save.unlocked = Math.max(save.unlocked, Math.min(3, this.levelIndex + 2));
        save.best = recordLevelBest(
          save.best,
          this.levelIndex,
          levelClearScore(this.world.score, this.runScore0),
        );
        writeSave(save);
        this.syncUI(this.levelIndex >= LEVELS.length - 1 ? "win" : "clear");
      } else {
        this.hudClock += dt;
        this.coinStreakT = Math.max(0, this.coinStreakT - dt);
        if (this.hudClock > 0.16) {
          this.hudClock = 0;
          this.syncUI();
        }
      }
    } else {
      this.acc = 0;
    }

    this.draw(now / 1000);
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(t: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (!this.images) {
      ctx.fillStyle = "#2c1810";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    const phase = useGameUI.getState().phase;
    if (!this.world || phase === "title" || phase === "boot") {
      renderTitleIdle(ctx, this.images, this.titleTime);
      return;
    }
    const shake = cameraStep(
      this.world,
      this.frameDt,
      VIEW_W,
      VIEW_H,
      useGameUI.getState().shake && phase === "playing" && !prefersReducedMotion(),
    );
    renderWorld(ctx, this.world, this.images, shake, t);
  }
}
