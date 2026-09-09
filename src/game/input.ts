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

const JUMP_KEYS = new Set(["Space", "KeyZ", "KeyW", "ArrowUp"]);
const PAUSE_KEYS = new Set(["Escape", "KeyP"]);

function setHas(codes: Set<string>, keys: Set<string>) {
  for (const code of keys) {
    if (codes.has(code)) return true;
  }
  return false;
}

export class Input {
  keys = new Set<string>();
  injected = new Set<string>();
  touchLeft = false;
  touchRight = false;
  touchDown = false;
  private _touchJump = false;
  private jumpQueued = false;
  private pauseQueued = false;
  private jumpWasHeld = false;
  private pauseWasHeld = false;
  private unsub: Array<() => void> = [];

  get touchJump() {
    return this._touchJump;
  }

  set touchJump(v: boolean) {
    if (v && !this._touchJump) this.jumpQueued = true;
    this._touchJump = v;
  }

  attach(target: HTMLElement | Window = window) {
    const el = target as Window;
    const down = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (JUMP_KEYS.has(e.code)) this.jumpQueued = true;
        if (PAUSE_KEYS.has(e.code)) this.pauseQueued = true;
      } else {
        if (JUMP_KEYS.has(e.code)) this.jumpWasHeld = true;
        if (PAUSE_KEYS.has(e.code)) this.pauseWasHeld = true;
      }
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
    const next = new Set(codes);
    if (setHas(next, JUMP_KEYS) && !setHas(this.injected, JUMP_KEYS) && !setHas(this.keys, JUMP_KEYS) && !this._touchJump) {
      this.jumpQueued = true;
    }
    if (setHas(next, PAUSE_KEYS) && !setHas(this.injected, PAUSE_KEYS) && !setHas(this.keys, PAUSE_KEYS)) {
      this.pauseQueued = true;
    }
    this.injected = next;
  }

  resetHeld() {
    this.keys.clear();
    this.injected = new Set();
    this.touchLeft = false;
    this.touchRight = false;
    this._touchJump = false;
    this.touchDown = false;
    this.jumpQueued = false;
    this.pauseQueued = false;
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

  /** @deprecated edge is latched; use pollHeld + consumeJump */
  poll(): Actions {
    const held = this.pollHeld();
    return {
      ...held,
      jumpPressed: this.consumeJump(),
      pausePressed: this.consumePause(),
    };
  }
}
