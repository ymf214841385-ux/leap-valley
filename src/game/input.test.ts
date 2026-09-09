import { Input } from "./input";

export const tests: Array<[string, () => void]> = [];

function test(name: string, fn: () => void) {
  tests.push([name, fn]);
}

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

test("jump queue latches once across 30/60/120/144Hz bursts", () => {
  for (const hz of [30, 60, 120, 144]) {
    const inp = new Input();
    inp.setKeys(["Space"]);
    inp.pollHeld();
    let acc = 0;
    let consumed = 0;
    for (let frame = 0; frame < hz; frame++) {
      acc += 1 / hz;
      let used = false;
      while (acc >= 1 / 60) {
        const pressed = !used && inp.consumeJump();
        if (pressed) {
          used = true;
          consumed += 1;
        }
        acc -= 1 / 60;
      }
    }
    eq(consumed, 1, `hz ${hz}`);
  }
});

test("held jump does not re-queue until release", () => {
  const inp = new Input();
  inp.setKeys(["Space"]);
  inp.pollHeld();
  eq(inp.consumeJump(), true, "edge");
  inp.pollHeld();
  eq(inp.consumeJump(), false, "held");
  inp.setKeys([]);
  inp.pollHeld();
  inp.setKeys(["Space"]);
  inp.pollHeld();
  eq(inp.consumeJump(), true, "second press");
});

test("keyboard rapid tap latches if released before poll", () => {
  const inp = new Input();
  inp.setKeys(["Space"]);
  inp.setKeys([]);
  inp.pollHeld();
  eq(inp.consumeJump(), true, "keyboard tap");
  inp.pollHeld();
  eq(inp.consumeJump(), false, "single latch");
});

function attachTarget() {
  const target = new EventTarget();
  const inp = new Input();
  inp.attach(target as unknown as Window);
  return { inp, target };
}

function fireKey(target: EventTarget, type: "keydown" | "keyup" | "blur", code = "Space", repeat = false) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  Object.defineProperty(event, "repeat", { value: repeat });
  Object.defineProperty(event, "preventDefault", { value: () => {} });
  target.dispatchEvent(event);
}

test("attach registers real keydown and keyup listeners", () => {
  const target = new EventTarget();
  const types: string[] = [];
  const add = target.addEventListener.bind(target);
  target.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    types.push(type);
    add(type, listener, options);
  }) as typeof target.addEventListener;
  const inp = new Input();
  inp.attach(target as unknown as Window);
  if (!types.includes("keydown") || !types.includes("keyup")) {
    throw new Error(`attach missed keyboard listeners: ${types.join(",")}`);
  }
  inp.detach();
});

test("keyboard keydown+keyup before poll still latches jump", () => {
  const { inp, target } = attachTarget();
  fireKey(target, "keydown", "Space");
  fireKey(target, "keyup", "Space");
  inp.pollHeld();
  eq(inp.consumeJump(), true, "tap before poll");
  inp.pollHeld();
  eq(inp.consumeJump(), false, "consumed once");
  inp.detach();
});

test("keyboard consecutive rapid taps each latch after poll", () => {
  const { inp, target } = attachTarget();
  fireKey(target, "keydown", "Space");
  fireKey(target, "keyup", "Space");
  inp.pollHeld();
  eq(inp.consumeJump(), true, "first tap");
  fireKey(target, "keydown", "Space");
  fireKey(target, "keyup", "Space");
  inp.pollHeld();
  eq(inp.consumeJump(), true, "second tap");
  inp.detach();
});

test("keyboard keydown repeat does not re-queue jump", () => {
  const { inp, target } = attachTarget();
  fireKey(target, "keydown", "Space", false);
  inp.pollHeld();
  eq(inp.consumeJump(), true, "initial press");
  fireKey(target, "keydown", "Space", true);
  inp.pollHeld();
  eq(inp.consumeJump(), false, "repeat ignored");
  fireKey(target, "keyup", "Space");
  inp.pollHeld();
  fireKey(target, "keydown", "Space", false);
  inp.pollHeld();
  eq(inp.consumeJump(), true, "new press after release");
  inp.detach();
});

test("blur reset does not ghost a jump from a cleared press", () => {
  const { inp, target } = attachTarget();
  fireKey(target, "keydown", "Space");
  fireKey(target, "blur");
  inp.pollHeld();
  eq(inp.consumeJump(), false, "blur cleared queued jump");
  fireKey(target, "keydown", "Space", true);
  inp.pollHeld();
  eq(inp.consumeJump(), false, "held repeat after blur is not a press");
  fireKey(target, "keydown", "Space", false);
  fireKey(target, "keyup", "Space");
  inp.pollHeld();
  eq(inp.consumeJump(), true, "fresh tap after blur");
  inp.detach();
});

test("touch rapid tap latches if released before poll", () => {
  const inp = new Input();
  inp.touchJump = true;
  inp.touchJump = false;
  inp.pollHeld();
  eq(inp.consumeJump(), true, "touch tap");
  inp.pollHeld();
  eq(inp.consumeJump(), false, "single latch");
});

function setPadPause(pressed: boolean) {
  const btn = (on: boolean) => ({ pressed: on, touched: on, value: on ? 1 : 0 });
  const pad = {
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => btn(i === 9 && pressed)),
  };
  navigator.getGamepads = () => [pad as unknown as Gamepad];
}

test("gamepad pause hold does not re-toggle after resetHeld", () => {
  const prev = navigator.getGamepads;
  try {
    const inp = new Input();
    setPadPause(true);
    inp.pollHeld();
    eq(inp.consumePause(), true, "first pause");
    inp.resetHeld();
    setPadPause(true);
    inp.pollHeld();
    eq(inp.consumePause(), false, "hold after pause");
    setPadPause(false);
    inp.pollHeld();
    setPadPause(true);
    inp.pollHeld();
    eq(inp.consumePause(), true, "press after release");
  } finally {
    navigator.getGamepads = prev;
  }
});
