export type GameImages = {
  pipIdle: HTMLImageElement[];
  pipRun: HTMLImageElement[];
  pipJump: HTMLImageElement[];
  beetle: HTMLImageElement[];
  moth: HTMLImageElement[];
  spiky: HTMLImageElement[];
  acorn: HTMLImageElement[];
  dust: HTMLImageElement[];
  grass: HTMLImageElement;
  dirt: HTMLImageElement;
  crate: HTMLImageElement;
  bloom: HTMLImageElement;
  used: HTMLImageElement;
  spike: HTMLImageElement;
  honey: HTMLImageElement;
  flag: HTMLImageElement;
  plank: HTMLImageElement;
  log: HTMLImageElement;
  checkpoint: HTMLImageElement;
  grassCap: HTMLImageElement;
  dirtFill: HTMLImageElement;
  lantern: HTMLImageElement;
  sky: HTMLImageElement;
  far: HTMLImageElement;
  mid: HTMLImageElement;
  dusk: HTMLImageElement;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function seq(prefix: string, n: number): Promise<HTMLImageElement[]> {
  const out: HTMLImageElement[] = [];
  for (let i = 1; i <= n; i++) out.push(await loadImage(`${prefix}-${i}.png`));
  return out;
}

export async function loadAssets(): Promise<GameImages> {
  const [
    pipIdle, pipRun, pipJump, beetle, moth, spiky, acorn, dust,
    grass, dirt, crate, bloom, used, spike, honey, flag, plank, log,
    checkpoint, grassCap, dirtFill, lantern, sky, far, mid, dusk,
  ] = await Promise.all([
    seq("/game/sprites/pip-idle", 4),
    seq("/game/sprites/pip-run", 6),
    seq("/game/sprites/pip-jump", 4),
    seq("/game/sprites/beetle", 4),
    seq("/game/sprites/moth", 4),
    seq("/game/sprites/spiky", 4),
    seq("/game/sprites/acorn", 4),
    seq("/game/sprites/dust", 4),
    loadImage("/game/tiles/grass.png"),
    loadImage("/game/tiles/dirt.png"),
    loadImage("/game/tiles/crate.png"),
    loadImage("/game/tiles/bloom.png"),
    loadImage("/game/tiles/used.png"),
    loadImage("/game/tiles/spike.png"),
    loadImage("/game/tiles/honey.png"),
    loadImage("/game/tiles/flag.png"),
    loadImage("/game/tiles/plank.png"),
    loadImage("/game/tiles/log.png"),
    loadImage("/game/tiles/checkpoint.png"),
    loadImage("/game/tiles/grass-cap.png"),
    loadImage("/game/tiles/dirt-fill.png"),
    loadImage("/game/tiles/lantern.png"),
    loadImage("/game/bg/sky.jpg"),
    loadImage("/game/bg/far.png"),
    loadImage("/game/bg/mid.png"),
    loadImage("/game/bg/dusk.jpg"),
  ]);
  return {
    pipIdle, pipRun, pipJump, beetle, moth, spiky, acorn, dust,
    grass, dirt, crate, bloom, used, spike, honey, flag, plank, log,
    checkpoint, grassCap, dirtFill, lantern, sky, far, mid, dusk,
  };
}
