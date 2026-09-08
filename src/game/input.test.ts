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
