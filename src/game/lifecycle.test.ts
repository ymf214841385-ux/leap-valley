import { StartupGuard, phaseAfterPauseInput } from "./lifecycle";

export const tests: Array<[string, () => void | Promise<void>]> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push([name, fn]);
}

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

test("pause input is applied before simulation phase", () => {
  eq(phaseAfterPauseInput("playing", true), "paused", "pause");
  eq(phaseAfterPauseInput("paused", true), "playing", "unpause");
  eq(phaseAfterPauseInput("playing", false), "playing", "keep playing");
  eq(phaseAfterPauseInput("dead", true), "dead", "ignore on dead");
});

test("stale async boot is cancelled by destroy", async () => {
  const guard = new StartupGuard();
  const first = guard.begin();
  let finished = false;
  const pending = Promise.resolve().then(() => {
    if (!first.stale()) finished = true;
  });
  guard.cancel();
  const second = guard.begin();
  await pending;
  eq(first.stale(), true, "destroyed boot is stale");
  eq(second.stale(), false, "new boot is live");
  eq(finished, false, "stale boot did not finish");
});
