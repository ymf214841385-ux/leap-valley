export type Actions = {
  moveX: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  down: boolean;
  pausePressed: boolean;
};

export type HeldActions = {
  moveX: number;
  jumpHeld: boolean;
  down: boolean;
};

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "Space",
  "KeyZ",
  "KeyX",
  "KeyP",
  "Escape",
  "KeyK",
]);

export class Input {
  keys = new Set<string>();
  injected = new Set<string>();
  touchLeft = false;
  touchRight = false;
  touchJump = false;
  touchDown = false;
  private jumpQueued = false;
  private pauseQueued = false;
  private jumpWasHeld = false;
  private pauseWasHeld = false;
  private unsub: Array<() => void> = [];

  attach(target: HTMLElement | Window = window) {
    const el = target as Window;
    const down = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const clear = () => this.resetHeld();
    const onVis = () => {
      if (document.hidden) this.resetHeld();
    };
    el.addEventListener("keydown", down);
    el.addEventListener("keyup", up);
    el.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVis);
    this.unsub.push(() => {
      el.removeEventListener("keydown", down);
      el.removeEventListener("keyup", up);
      el.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
    });
  }

  detach() {
    for (const fn of this.unsub) fn();
    this.unsub = [];
    this.resetHeld();
  }

  setKeys(codes: string[]) {
    this.injected = new Set(codes);
  }

  resetHeld() {
    this.keys.clear();
    this.injected = new Set();
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchDown = false;
    this.jumpQueued = false;
    this.pauseQueued = false;
    this.jumpWasHeld = false;
    this.pauseWasHeld = false;
  }

  pollHeld(): HeldActions {
    const held = (code: string) => this.keys.has(code) || this.injected.has(code);
    let moveX = 0;
    if (held("KeyA") || held("ArrowLeft") || this.touchLeft) moveX -= 1;
    if (held("KeyD") || held("ArrowRight") || this.touchRight) moveX += 1;

    const pad = navigator.getGamepads?.()[0];
    if (pad && pad.mapping === "standard") {
      const ax = pad.axes[0] ?? 0;
      const mag = Math.abs(ax);
      if (mag > 0.18) {
        const scaled = ((mag - 0.18) / 0.82) * Math.sign(ax);
        moveX = Math.max(-1, Math.min(1, moveX + scaled));
      }
      if (pad.buttons[14]?.pressed) moveX -= 1;
      if (pad.buttons[15]?.pressed) moveX += 1;
    }

    moveX = Math.max(-1, Math.min(1, moveX));

    const jumpHeld =
      held("Space") ||
      held("KeyZ") ||
      held("KeyW") ||
      held("ArrowUp") ||
      this.touchJump ||
      Boolean(pad?.buttons[0]?.pressed);

    const down =
      held("KeyS") ||
      held("ArrowDown") ||
      this.touchDown ||
      Boolean(pad?.buttons[13]?.pressed);

    const pauseHeld = held("Escape") || held("KeyP") || Boolean(pad?.buttons[9]?.pressed);

    if (jumpHeld && !this.jumpWasHeld) this.jumpQueued = true;
    if (pauseHeld && !this.pauseWasHeld) this.pauseQueued = true;
    this.jumpWasHeld = jumpHeld;
    this.pauseWasHeld = pauseHeld;

    return { moveX, jumpHeld, down };
  }

  consumeJump(): boolean {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  consumePause(): boolean {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  poll(): Actions {
    const held = this.pollHeld();
    return {
      ...held,
      jumpPressed: this.consumeJump(),
      pausePressed: this.consumePause(),
    };
  }
}
