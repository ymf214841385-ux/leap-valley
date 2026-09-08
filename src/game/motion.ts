let cached: boolean | null = null;
let hooked = false;

function hook() {
  if (hooked || typeof matchMedia === "undefined") return;
  hooked = true;
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  cached = mq.matches;
  const sync = () => {
    cached = mq.matches;
  };
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", sync);
  else mq.addListener(sync);
}

export function prefersReducedMotion(): boolean {
  if (cached !== null) return cached;
  hook();
  if (typeof matchMedia === "undefined") return false;
  cached = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return cached;
}
