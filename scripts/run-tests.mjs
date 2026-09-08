import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = "/tmp/leap-valley-tests";
const tsc = path.join(root, "node_modules/typescript/bin/tsc");

if (typeof globalThis.matchMedia !== "function") {
  globalThis.matchMedia = () => ({
    matches: false,
    media: "",
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}
if (typeof globalThis.navigator === "undefined") {
  globalThis.navigator = { getGamepads: () => [] };
} else if (typeof globalThis.navigator.getGamepads !== "function") {
  globalThis.navigator.getGamepads = () => [];
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
}

const compiled = spawnSync(process.execPath, [tsc, "-p", path.join(root, "tsconfig.test.json"), "--pretty", "false"], {
  cwd: root,
  stdio: "inherit",
});
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const require = createRequire(import.meta.url);
const files = ["gameplay.test.js", "input.test.js", "lifecycle.test.js"];
let failed = 0;
let passed = 0;

for (const file of files) {
  const mod = require(path.join(outDir, file));
  const list = mod.tests ?? [];
  for (const [name, fn] of list) {
    try {
      await fn();
      passed += 1;
      console.log(`ok  ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok  ${name}`);
      console.error(err instanceof Error ? err.stack : err);
    }
  }
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
