import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronUp, Pause } from "lucide-react";
import { VIEW_H, VIEW_W } from "@/game/const";
import { LeapGame } from "@/game/game";
import { LEVELS } from "@/game/levels";
import { useGameUI, type GameUI } from "@/game/store";

function detectTouchUI() {
  if (typeof window === "undefined") return false;
  const coarse =
    window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches;
  return coarse || window.innerWidth < 720 || window.innerHeight < 520;
}

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<LeapGame | null>(null);
  const layoutReady = useRef(false);
  const lastBox = useRef({ w: 0, h: 0, portrait: false });
  const ui = useGameUI();
  const [settings, setSettings] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [skipRotate, setSkipRotate] = useState(false);
  const [stage, setStage] = useState({ w: VIEW_W, h: VIEW_H });

  const inSession = ui.phase === "playing" || ui.phase === "paused" || ui.phase === "dead" || ui.phase === "clear" || ui.phase === "win";
  const showTouch = touchUI && inSession;
  const overlayTouch = showTouch && !portrait;
  const dockTouch = showTouch && portrait;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new LeapGame(canvas);
    gameRef.current = game;
    void game.boot();
    return () => {
      game.input.resetHeld();
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) gameRef.current?.persist();
    };
    const onBlur = () => gameRef.current?.input.resetHeld();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const syncFlags = () => {
      setTouchUI(detectTouchUI());
      setPortrait(window.innerHeight > window.innerWidth * 1.12);
    };
    syncFlags();
    const coarse = window.matchMedia("(pointer: coarse)");
    const anyCoarse = window.matchMedia("(any-pointer: coarse)");
    coarse.addEventListener("change", syncFlags);
    anyCoarse.addEventListener("change", syncFlags);
    window.addEventListener("resize", syncFlags);
    window.addEventListener("orientationchange", syncFlags);
    return () => {
      coarse.removeEventListener("change", syncFlags);
      anyCoarse.removeEventListener("change", syncFlags);
      window.removeEventListener("resize", syncFlags);
      window.removeEventListener("orientationchange", syncFlags);
    };
  }, []);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const measure = (pauseIfChanged: boolean) => {
      const vw = shell.clientWidth;
      const vh = shell.clientHeight;
      const isPortrait = vh > vw * 1.12;
      const banner = touchUI && isPortrait && !skipRotate ? 26 : 0;
      const dock = touchUI && isPortrait && inSession ? 96 : 0;
      const pad = 10;
      const availW = Math.max(80, vw - pad * 2);
      const availH = Math.max(80, vh - dock - banner - pad * 2);
      const scale = Math.min(availW / VIEW_W, availH / VIEW_H);
      const w = Math.max(1, Math.floor(VIEW_W * scale));
      const h = Math.max(1, Math.floor(VIEW_H * scale));
      const prev = lastBox.current;
      const sizeChanged = Math.abs(prev.w - w) > 8 || Math.abs(prev.h - h) > 8;
      const orientChanged = prev.w > 0 && prev.portrait !== isPortrait;
      lastBox.current = { w, h, portrait: isPortrait };
      setStage({ w, h });
      setPortrait(isPortrait);
      if (pauseIfChanged && layoutReady.current && (sizeChanged || orientChanged)) {
        gameRef.current?.pauseFromResize();
      }
      gameRef.current?.resize();
    };

    measure(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutReady.current = true;
      });
    });
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(shell);
    const onWinResize = () => measure(true);
    window.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", onWinResize);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      window.removeEventListener("orientationchange", onWinResize);
    };
  }, [touchUI, inSession, skipRotate]);

  const g = () => gameRef.current;
  const showHud = inSession;
  const last = LEVELS[Math.max(0, ui.lastLevel - 1)]!;
  const menusOnShell = portrait;
  const titleSplit = portrait && ui.phase === "title" && !settings;
  const roomy = portrait;

  const deathCopy =
    ui.deathCause === "hit" ? "被撞到了" : ui.deathCause === "time" ? "银杏落尽了" : "跌出了坡道";

  const menuProps = {
    ui,
    settings,
    setSettings,
    g,
    last,
    deathCopy,
    roomy,
  };

  return (
    <div
      ref={shellRef}
      className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden text-paper"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #6a5340 0%, #3c2a22 46%, #241610 100%)",
        padding:
          "max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))",
      }}
    >
      <div className="flex max-h-full w-full flex-col items-center justify-center gap-2 overflow-y-auto">
        {touchUI && portrait && !skipRotate && (
          <p className="px-3 text-center text-xs tracking-wide text-paper/80">
            横过来坡道更宽，按钮也更顺手
            <button
              className="ml-2 rounded-sm bg-ginkgo/20 px-2 py-1 text-xs text-ginkgo"
              onClick={() => setSkipRotate(true)}
            >
              竖屏继续
            </button>
          </p>
        )}

        {titleSplit && (
          <div className="shrink-0">
            <TitleBrand />
          </div>
        )}

        <div
          ref={wrapRef}
          className="relative overflow-hidden rounded-md shadow-[0_12px_40px_rgba(20,10,6,0.45)]"
          style={{ width: stage.w, height: stage.h }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onContextMenu={(e) => e.preventDefault()}
          />

          {ui.phase === "title" && !settings && !titleSplit && (
            <div className="absolute inset-0 flex flex-col">
              <div className="bg-gradient-to-b from-ink/80 to-transparent px-4 pt-3 pb-2 text-center">
                <TitleBrand compact />
              </div>
              <div className="min-h-0 flex-1" />
              <div className="bg-gradient-to-t from-ink/85 to-transparent px-4 pt-3 pb-3">
                <TitleActions {...menuProps} compact touchUI={touchUI} />
              </div>
            </div>
          )}

          {!menusOnShell && <GameMenus {...menuProps} />}

          {showHud && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex items-start justify-between gap-2 bg-gradient-to-b from-ink/70 to-transparent px-2 pt-1.5 pb-6 pr-12 text-[11px] text-paper">
              <HudChip>
                <Lives n={ui.lives} />
                <span className="tabular-nums">{ui.score}</span>
              </HudChip>
              <HudChip>
                <span className="text-paper/80">{ui.levelName}</span>
                <span className="tabular-nums">{Math.max(0, ui.time)}</span>
              </HudChip>
              <HudChip>
                <span>金果 {ui.coins}/{ui.coinTotal || ui.coins}</span>
                {ui.secretTotal > 0 && <span className="text-ginkgo">叶 {ui.secrets}/{ui.secretTotal}</span>}
                {ui.hasHoney && <span className="text-ginkgo">二段跳</span>}
                {ui.gliding && <span className="text-apricot">滑翔</span>}
              </HudChip>
            </div>
          )}

          {ui.phase === "playing" && ui.banner && (
            <div className="pointer-events-none absolute inset-x-0 top-12 z-[5] flex justify-center">
              <p className="rounded-md bg-hud px-3 py-1 font-display text-lg text-paper">{ui.banner}</p>
            </div>
          )}

          {ui.phase === "playing" && ui.toast && (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 z-[5] flex justify-center px-3">
              <p className="rounded-md bg-hud px-3 py-1.5 text-xs text-paper">{ui.toast}</p>
            </div>
          )}

          {ui.phase === "playing" && (
            <button
              className="absolute top-1.5 right-1.5 z-10 flex size-9 items-center justify-center rounded-md bg-hud text-paper hover:bg-ink/80 focus-visible:ring-2 focus-visible:ring-ginkgo"
              aria-label="暂停"
              onClick={() => g()?.togglePause()}
            >
              <Pause className="size-4" />
            </button>
          )}

          {overlayTouch && (
            <div className="pointer-events-none absolute inset-0 z-[8]">
              <TouchCluster
                className="pointer-events-auto absolute bottom-[max(8px,env(safe-area-inset-bottom))] left-[max(8px,env(safe-area-inset-left))]"
                game={g}
                side="move"
              />
              <TouchCluster
                className="pointer-events-auto absolute right-[max(8px,env(safe-area-inset-right))] bottom-[max(8px,env(safe-area-inset-bottom))]"
                game={g}
                side="action"
              />
            </div>
          )}
        </div>

        {titleSplit && (
          <div className="w-full max-w-sm shrink-0 px-3 pt-1">
            <TitleActions {...menuProps} touchUI={touchUI} />
          </div>
        )}

        {dockTouch && (
          <div className="flex w-full max-w-lg shrink-0 items-end justify-between px-2 pb-1">
            <TouchCluster game={g} side="move" dock />
            <TouchCluster game={g} side="action" dock />
          </div>
        )}
      </div>

      {menusOnShell && <GameMenus {...menuProps} shell />}
    </div>
  );
}

function Lives({ n }: { n: number }) {
  const shown = Math.min(3, Math.max(0, n));
  return (
    <span className="flex items-center gap-1" aria-label={`生命 ${n}`}>
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={`size-2 rounded-full ${i < shown ? "bg-apricot" : "bg-paper/25"}`} />
      ))}
      <span className="tabular-nums text-paper">×{n}</span>
    </span>
  );
}

type MenuProps = {
  ui: GameUI;
  settings: boolean;
  setSettings: (v: boolean) => void;
  g: () => LeapGame | null;
  last: (typeof LEVELS)[number];
  deathCopy: string;
  roomy?: boolean;
  shell?: boolean;
};

function TitleBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "" : "px-3 pt-1"}`}>
      <p className={`font-display leading-none tracking-tight text-paper ${compact ? "text-4xl" : "text-5xl"}`}>
        跳跳谷
      </p>
      <p className={`mt-1 tracking-[0.28em] text-ginkgo ${compact ? "text-[10px]" : "text-xs"}`}>LEAP VALLEY</p>
      <p className={`mx-auto mt-2 max-w-sm text-center leading-relaxed text-paper/90 ${compact ? "text-xs" : "text-sm"}`}>
        皮皮整理好银杏叶帽。踩甲虫、捡金果，把丰收风筝送到坡顶。
      </p>
    </div>
  );
}

function TitleActions({
  ui,
  g,
  last,
  setSettings,
  roomy,
  compact,
  touchUI,
}: MenuProps & { compact?: boolean; touchUI: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <Primary roomy={roomy && !compact} disabled={ui.loading} onClick={() => g()?.startAdventure(0)}>
        {ui.loading ? "正在铺开银杏坡…" : "开始冒险"}
      </Primary>
      {ui.unlocked > 1 && (
        <Ghost roomy={roomy && !compact} onClick={() => g()?.startAdventure(Math.max(0, ui.lastLevel - 1))}>
          回到第{ui.lastLevel}关：{last.name}
        </Ghost>
      )}
      <div className="relative py-1">
        <div className="absolute top-4 right-6 left-6 h-px bg-ginkgo/35" />
        <div className="relative flex justify-between">
          {LEVELS.map((lv, i) => {
            const locked = i + 1 > ui.unlocked;
            const best = ui.best[i] ?? 0;
            const current = ui.lastLevel === i + 1;
            return (
              <button
                key={lv.id}
                disabled={locked || ui.loading}
                onClick={() => g()?.startAdventure(i)}
                className={`flex w-20 flex-col items-center gap-1 disabled:opacity-40 ${current ? "text-ginkgo" : ""}`}
              >
                <span
                  className={`size-3.5 rounded-full ${locked ? "bg-paper/30" : current ? "bg-ginkgo ring-2 ring-paper/70" : "bg-leaf"}`}
                />
                <span className={`font-medium text-paper ${compact ? "text-[11px]" : "text-xs"}`}>
                  {locked ? "未开启" : lv.name}
                </span>
                {best > 0 && <span className="text-[11px] tabular-nums text-ginkgo">{best}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <Ghost roomy={roomy && !compact} onClick={() => setSettings(true)}>
        设置
      </Ghost>
      <p className={`text-center text-paper/70 ${compact ? "text-[10px]" : "text-xs"}`}>
        {touchUI
          ? "左移 · 右移 · 跳跃 · 下落穿过木板 · 下落按住可滑翔"
          : "A / D 移动 · 空格跳跃 · ↓ 落下 · 下落按住滑翔 · P 暂停"}
      </p>
      {ui.highScore > 0 && (
        <p className={`text-center tabular-nums text-paper/70 ${compact ? "text-[10px]" : "text-xs"}`}>
          最高分 {ui.highScore}
        </p>
      )}
    </div>
  );
}

function GameMenus({ ui, settings, setSettings, g, deathCopy, roomy, shell }: MenuProps) {
  const wrap = (children: ReactNode) => (
    <Panel shell={shell} roomy={roomy}>
      {children}
    </Panel>
  );

  if (ui.loadError) {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-2xl" : "text-xl"}`}>没能打开地图</p>
        <p className="mt-2 text-sm text-paper/70">{ui.loadError}</p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Primary roomy={roomy} onClick={() => window.location.reload()}>
            再试一次
          </Primary>
        </div>
      </>,
    );
  }

  if (ui.phase === "title" && settings) {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-2xl" : "text-xl"}`}>设置</p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Ghost roomy={roomy} onClick={() => g()?.setMuted(!ui.muted)}>
            {ui.muted ? "声音：关" : "声音：开"}
          </Ghost>
          <Ghost roomy={roomy} onClick={() => g()?.setShake(!ui.shake)}>
            {ui.shake ? "画面震动：开" : "画面震动：关"}
          </Ghost>
          <a
            href="https://github.com/ymf214841385-ux/leap-valley"
            target="_blank"
            rel="noreferrer"
            className={`block w-full rounded-md bg-paper/90 text-center font-medium text-ink hover:bg-paper focus-visible:ring-2 focus-visible:ring-ginkgo ${roomy ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"}`}
          >
            打开源码仓库
          </a>
          <Primary roomy={roomy} onClick={() => setSettings(false)}>
            返回
          </Primary>
        </div>
      </>,
    );
  }

  if (ui.phase === "paused" && settings) {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-2xl" : "text-xl"}`}>设置</p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Ghost roomy={roomy} onClick={() => g()?.setMuted(!ui.muted)}>
            {ui.muted ? "声音：关" : "声音：开"}
          </Ghost>
          <Ghost roomy={roomy} onClick={() => g()?.setShake(!ui.shake)}>
            {ui.shake ? "画面震动：开" : "画面震动：关"}
          </Ghost>
          <Primary roomy={roomy} onClick={() => setSettings(false)}>
            返回暂停
          </Primary>
        </div>
      </>,
    );
  }

  if (ui.phase === "paused" && !settings) {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-3xl" : "text-2xl"}`}>暂停</p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Primary roomy={roomy} onClick={() => g()?.togglePause()}>
            继续
          </Primary>
          <Ghost roomy={roomy} onClick={() => g()?.retryCheckpoint()}>
            重试落脚处
          </Ghost>
          <Ghost roomy={roomy} onClick={() => g()?.retry()}>
            重开本关
          </Ghost>
          <Ghost roomy={roomy} onClick={() => setSettings(true)}>
            设置
          </Ghost>
          <Ghost roomy={roomy} onClick={() => g()?.toTitle()}>
            返回标题
          </Ghost>
        </div>
      </>,
    );
  }

  if (ui.phase === "dead") {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-3xl" : "text-2xl"}`}>{deathCopy}</p>
        <p className="mt-2 text-sm text-paper/75">
          {ui.canCheckpoint ? "很快回到落脚处" : "冒险结束"} · {ui.score} 分
        </p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          {ui.canCheckpoint ? (
            <Primary roomy={roomy} onClick={() => g()?.retryCheckpoint()}>
              立刻重试
            </Primary>
          ) : (
            <Primary roomy={roomy} onClick={() => g()?.retry()}>
              再试一次
            </Primary>
          )}
          <Ghost roomy={roomy} onClick={() => g()?.toTitle()}>
            返回标题
          </Ghost>
        </div>
      </>,
    );
  }

  if (ui.phase === "clear") {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-3xl" : "text-2xl"}`}>风筝升起</p>
        <p className="mt-2 text-sm text-paper/75">
          {ui.levelName} · 金果 {ui.coins}/{ui.coinTotal} · 秘叶 {ui.secrets}/{ui.secretTotal} · {ui.score} 分
        </p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Primary roomy={roomy} onClick={() => g()?.nextLevel()}>
            下一关
          </Primary>
          <Ghost roomy={roomy} onClick={() => g()?.toTitle()}>
            返回标题
          </Ghost>
        </div>
      </>,
    );
  }

  if (ui.phase === "win") {
    return wrap(
      <>
        <p className={`font-display ${roomy ? "text-3xl" : "text-2xl"}`}>丰收到顶</p>
        <p className="mt-2 text-sm text-paper/75">皮皮把风筝送到了暮色林尽头</p>
        <p className="mt-1 text-sm tabular-nums text-paper/80">总分 {ui.score}</p>
        <div className={`mt-4 flex w-56 flex-col ${roomy ? "gap-3" : "gap-2"}`}>
          <Primary roomy={roomy} onClick={() => g()?.startAdventure(0)}>
            再走一遍
          </Primary>
          <Ghost roomy={roomy} onClick={() => g()?.toTitle()}>
            返回标题
          </Ghost>
        </div>
      </>,
    );
  }

  return null;
}

function Panel({ children, shell, roomy }: { children: ReactNode; shell?: boolean; roomy?: boolean }) {
  return (
    <div
      className={`${shell ? "absolute inset-0 z-30" : "absolute inset-0 z-20"} flex items-center justify-center bg-ink/50 px-4 py-4`}
    >
      <div
        className={`flex w-full max-w-sm flex-col items-center overflow-y-auto rounded-lg border border-ginkgo/30 bg-hud text-center text-paper shadow-lg ${
          roomy ? "max-h-[min(92dvh,720px)] px-5 py-5" : "max-h-full px-4 py-3"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
  roomy,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  roomy?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-md bg-leaf font-medium text-paper transition-transform duration-150 hover:bg-leaf-deep disabled:opacity-60 active:translate-y-px focus-visible:ring-2 focus-visible:ring-ginkgo ${
        roomy ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Ghost({
  children,
  onClick,
  roomy,
}: {
  children: ReactNode;
  onClick: () => void;
  roomy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md bg-paper/90 font-medium text-ink transition-transform duration-150 hover:bg-paper active:translate-y-px focus-visible:ring-2 focus-visible:ring-ginkgo ${
        roomy ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

function HudChip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none flex min-w-0 flex-wrap items-center gap-1.5 rounded-sm bg-hud/90 px-2 py-1 text-[11px] font-medium tracking-wide">
      {children}
    </div>
  );
}

function TouchCluster({
  game,
  side,
  className = "",
  dock = false,
}: {
  game: () => LeapGame | null;
  side: "move" | "action";
  className?: string;
  dock?: boolean;
}) {
  const set = (key: "touchLeft" | "touchRight" | "touchDown" | "touchJump", v: boolean) => {
    const inst = game();
    if (inst) inst.input[key] = v;
  };
  return (
    <div className={`flex gap-2 ${className}`}>
      {side === "move" ? (
        <>
          <TouchBtn label="左" dock={dock} onHold={(v) => set("touchLeft", v)}>
            <ArrowLeft className="size-6" />
          </TouchBtn>
          <TouchBtn label="右" dock={dock} onHold={(v) => set("touchRight", v)}>
            <ArrowRight className="size-6" />
          </TouchBtn>
        </>
      ) : (
        <>
          <TouchBtn label="下落" dock={dock} onHold={(v) => set("touchDown", v)}>
            <ArrowDown className="size-6" />
          </TouchBtn>
          <TouchBtn label="跳" wide dock={dock} onHold={(v) => set("touchJump", v)}>
            <ChevronUp className="size-7" />
          </TouchBtn>
        </>
      )}
    </div>
  );
}

function TouchBtn({
  children,
  label,
  onHold,
  wide,
  dock,
}: {
  children: ReactNode;
  label: string;
  onHold: (held: boolean) => void;
  wide?: boolean;
  dock?: boolean;
}) {
  const hold = useRef(onHold);
  hold.current = onHold;

  useEffect(() => {
    const clear = () => hold.current(false);
    window.addEventListener("blur", clear);
    return () => {
      clear();
      window.removeEventListener("blur", clear);
    };
  }, []);

  const size = dock ? (wide ? "h-16 w-20" : "size-14") : wide ? "h-14 w-[4.5rem]" : "size-12";

  return (
    <button
      aria-label={label}
      className={`flex ${size} items-center justify-center rounded-lg bg-ink/40 text-paper shadow-sm backdrop-blur-[2px] select-none hover:bg-ink/55 active:bg-leaf/70 focus-visible:ring-2 focus-visible:ring-ginkgo`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
    >
      {children}
    </button>
  );
}
