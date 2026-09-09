import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = path.join(root, "node_modules/.cache/leap-valley-tests");
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
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
if (typeof globalThis.window.devicePixelRatio !== "number") {
  globalThis.window.devicePixelRatio = 1;
}
{
  const mem = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return mem.has(String(key)) ? mem.get(String(key)) : null;
    },
    setItem(key, value) {
      mem.set(String(key), String(value));
    },
    removeItem(key) {
      mem.delete(String(key));
    },
    clear() {
      mem.clear();
    },
    key() {
      return null;
    },
    get length() {
      return mem.size;
    },
  };
}
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = () => 1;
}
if (typeof globalThis.cancelAnimationFrame !== "function") {
  globalThis.cancelAnimationFrame = () => {};
}
if (typeof globalThis.performance === "undefined") {
  globalThis.performance = { now: () => Date.now() };
}
if (typeof globalThis.AudioContext === "undefined") {
  const stubNode = () => ({
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
    type: "sine",
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} },
    buffer: null,
    onended: null,
  });
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    createGain() {
      return stubNode();
    }
    createOscillator() {
      return stubNode();
    }
    createBuffer(_ch, len) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return stubNode();
    }
    createBiquadFilter() {
      return { type: "lowpass", frequency: { value: 0 }, connect() {}, disconnect() {} };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  };
  globalThis.window.AudioContext = globalThis.AudioContext;
}

const compiled = spawnSync(process.execPath, [tsc, "-p", path.join(root, "tsconfig.test.json"), "--pretty", "false"], {
  cwd: root,
  stdio: "inherit",
});
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const require = createRequire(import.meta.url);
const files = ["gameplay.test.js", "input.test.js", "lifecycle.test.js", "save.test.js", "game.test.js"];
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
