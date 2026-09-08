import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronUp, Pause } from "lucide-react";
import { LeapGame } from "@/game/game";
import { LEVELS } from "@/game/levels";
import { useGameUI } from "@/game/store";

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<LeapGame | null>(null);
  const ui = useGameUI();
  const [settings, setSettings] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [skipRotate, setSkipRotate] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new LeapGame(canvas);
    gameRef.current = game;
    void game.boot();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) gameRef.current?.persist();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => {
      const isCoarse = mq.matches || window.innerWidth < 720;
      setCoarse(isCoarse);
      setPortrait(window.innerHeight > window.innerWidth * 1.12);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  const g = () => gameRef.current;
  const playing = ui.phase === "playing";
  const showHud = playing || ui.phase === "paused";
  const showTouch = playing && coarse;
  const showRotate = coarse && portrait && !skipRotate && (playing || ui.phase === "title");

  const deathCopy =
    ui.deathCause === "hit" ? "被撞到了" : ui.deathCause === "time" ? "银杏落尽了" : "跌出了坡道";

  return (
    <div className="relative flex h-dvh w-full flex-col bg-ink text-paper">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={wrapRef}
          className="relative aspect-video h-auto max-h-full w-full max-w-screen-2xl touch-none overflow-hidden bg-ink"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>

      {ui.loadError && (
        <Panel>
          <p className="font-display text-2xl">没能打开地图</p>
          <p className="mt-2 text-sm text-paper/70">{ui.loadError}</p>
          <Primary onClick={() => window.location.reload()}>再试一次</Primary>
        </Panel>
      )}

      {ui.phase === "title" && !settings && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/55 px-4 pt-8 pb-10">
          <p className="font-display text-display leading-none tracking-tight text-paper drop-shadow-md">
            跳跳谷
          </p>
          <p className="mt-2 text-xs tracking-widest text-ginkgo">LEAP VALLEY</p>
          <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-paper/90">
            皮皮整理好银杏叶帽。踩甲虫、捡金果，把丰收风筝送到坡顶。
          </p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <Primary disabled={ui.loading} onClick={() => g()?.startAdventure(0)}>
              {ui.loading ? "正在铺开银杏坡…" : "开始冒险"}
            </Primary>
            {ui.unlocked > 1 && (
              <Ghost onClick={() => g()?.startAdventure(Math.max(0, ui.lastLevel - 1))}>继续冒险</Ghost>
            )}
            <div className="relative pt-2 pb-1">
              <div className="absolute top-6 right-6 left-6 h-0.5 bg-ginkgo/40" />
              <div className="relative flex justify-between">
                {LEVELS.map((lv, i) => {
                  const locked = i + 1 > ui.unlocked;
                  const best = ui.best[i] ?? 0;
                  return (
                    <button
                      key={lv.id}
                      disabled={locked || ui.loading}
                      onClick={() => g()?.startAdventure(i)}
                      className="flex w-20 flex-col items-center gap-1 disabled:opacity-40"
                    >
                      <span className={`size-4 rounded-full ${locked ? "bg-paper/30" : "bg-ginkgo"}`} />
                      <span className="text-xs font-medium text-paper">{locked ? "未开启" : lv.name}</span>
                      {best > 0 && <span className="text-xs tabular-nums text-ginkgo">{best}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <Ghost onClick={() => setSettings(true)}>设置</Ghost>
          </div>
          <p className="mt-6 text-center text-xs text-paper/70">
            {coarse ? "左移 · 右移 · 跳跃 · 下落穿过木板 · 下落按住可滑翔" : "A / D 移动 · 空格跳跃 · ↓ 落下 · 下落按住滑翔 · P 暂停"}
          </p>
          {ui.highScore > 0 && (
            <p className="mt-2 text-xs tabular-nums text-paper/70">最高分 {ui.highScore}</p>
          )}
        </div>
      )}

      {ui.phase === "title" && settings && (
        <Panel>
          <p className="font-display text-2xl">设置</p>
          <div className="mt-5 flex w-64 flex-col gap-3">
            <Ghost onClick={() => g()?.setMuted(!ui.muted)}>{ui.muted ? "声音：关" : "声音：开"}</Ghost>
            <Ghost onClick={() => g()?.setShake(!ui.shake)}>{ui.shake ? "画面震动：开" : "画面震动：关"}</Ghost>
            <a
              href="https://github.com/ymf214841385-ux/leap-valley"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-md bg-paper/90 px-4 py-3 text-center text-sm font-medium text-ink"
            >
              打开源码仓库
            </a>
            <Primary onClick={() => setSettings(false)}>返回</Primary>
          </div>
        </Panel>
      )}

      {ui.phase === "paused" && settings && (
        <Panel>
          <p className="font-display text-2xl">设置</p>
          <div className="mt-5 flex w-64 flex-col gap-3">
            <Ghost onClick={() => g()?.setMuted(!ui.muted)}>{ui.muted ? "声音：关" : "声音：开"}</Ghost>
            <Ghost onClick={() => g()?.setShake(!ui.shake)}>{ui.shake ? "画面震动：开" : "画面震动：关"}</Ghost>
            <Primary onClick={() => setSettings(false)}>返回暂停</Primary>
          </div>
        </Panel>
      )}

      {showHud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pr-16 text-paper">
          <HudChip>
            <Lives n={ui.lives} />
            <span className="tabular-nums">{ui.score}</span>
          </HudChip>
          <HudChip>
            <span className="opacity-70">{ui.levelName}</span>
            <span className="tabular-nums">{Math.max(0, ui.time)}</span>
          </HudChip>
          <HudChip>
            <span className="opacity-70">金果 {ui.coins}/{ui.coinTotal || ui.coins}</span>
            {ui.secretTotal > 0 && <span className="text-ginkgo">叶 {ui.secrets}/{ui.secretTotal}</span>}
            {ui.hasHoney && <span className="text-ginkgo">二段跳</span>}
            {ui.gliding && <span className="text-apricot">滑翔</span>}
          </HudChip>
        </div>
      )}

      {playing && ui.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <p className="rounded-md bg-hud px-4 py-2 font-display text-xl text-paper">{ui.banner}</p>
        </div>
      )}

      {playing && ui.toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-4">
          <p className="rounded-md bg-hud px-3 py-2 text-sm text-paper">{ui.toast}</p>
        </div>
      )}

      {playing && (
        <button
          className="absolute top-[max(12px,env(safe-area-inset-top))] right-3 z-10 flex size-11 items-center justify-center rounded-md bg-hud text-paper"
          aria-label="暂停"
          onClick={() => g()?.togglePause()}
        >
          <Pause className="size-5" />
        </button>
      )}

      {ui.phase === "paused" && !settings && (
        <Panel>
          <p className="font-display text-3xl">暂停</p>
          <div className="mt-5 flex w-56 flex-col gap-3">
            <Primary onClick={() => g()?.togglePause()}>继续</Primary>
            <Ghost onClick={() => g()?.retryCheckpoint()}>重试落脚处</Ghost>
            <Ghost onClick={() => g()?.retry()}>重开本关</Ghost>
            <Ghost onClick={() => setSettings(true)}>设置</Ghost>
            <Ghost onClick={() => g()?.toTitle()}>返回标题</Ghost>
          </div>
        </Panel>
      )}

      {ui.phase === "dead" && (
        <Panel>
          <p className="font-display text-3xl">{deathCopy}</p>
          <p className="mt-2 text-sm text-paper/75">
            {ui.canCheckpoint ? "很快回到落脚处" : "冒险结束"} · {ui.score} 分
          </p>
          <div className="mt-5 flex w-56 flex-col gap-3">
            {ui.canCheckpoint ? (
              <Primary onClick={() => g()?.retryCheckpoint()}>立刻重试</Primary>
            ) : (
              <Primary onClick={() => g()?.retry()}>再试一次</Primary>
            )}
            <Ghost onClick={() => g()?.toTitle()}>返回标题</Ghost>
          </div>
        </Panel>
      )}

      {ui.phase === "clear" && (
        <Panel>
          <p className="font-display text-3xl">风筝升起</p>
          <p className="mt-2 text-sm text-paper/75">
            {ui.levelName} · 金果 {ui.coins}/{ui.coinTotal} · 秘叶 {ui.secrets}/{ui.secretTotal} · {ui.score} 分
          </p>
          <div className="mt-5 flex w-56 flex-col gap-3">
            <Primary onClick={() => g()?.nextLevel()}>下一关</Primary>
            <Ghost onClick={() => g()?.toTitle()}>返回标题</Ghost>
          </div>
        </Panel>
      )}

      {ui.phase === "win" && (
        <Panel>
          <p className="font-display text-3xl">丰收到顶</p>
          <p className="mt-2 text-sm text-paper/75">皮皮把风筝送到了暮色林尽头</p>
          <p className="mt-1 text-sm tabular-nums text-paper/80">总分 {ui.score}</p>
          <div className="mt-5 flex w-56 flex-col gap-3">
            <Primary onClick={() => g()?.startAdventure(0)}>再走一遍</Primary>
            <Ghost onClick={() => g()?.toTitle()}>返回标题</Ghost>
          </div>
        </Panel>
      )}

      {showRotate && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/80 px-6">
          <div className="max-w-xs rounded-xl bg-hud px-6 py-7 text-center">
            <p className="font-display text-2xl">横过来更好跳</p>
            <p className="mt-2 text-sm text-paper/75">把手机横放，坡道会更宽，按钮也更顺手。</p>
            <div className="mt-5 flex flex-col gap-3">
              <Primary onClick={() => setSkipRotate(true)}>继续竖屏玩</Primary>
            </div>
          </div>
        </div>
      )}

      {showTouch && (
        <div className="flex shrink-0 items-end justify-between px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <TouchBtn
              label="左"
              onHold={(v) => {
                const game = g();
                if (game) game.input.touchLeft = v;
              }}
            >
              <ArrowLeft className="size-7" />
            </TouchBtn>
            <TouchBtn
              label="右"
              onHold={(v) => {
                const game = g();
                if (game) game.input.touchRight = v;
              }}
            >
              <ArrowRight className="size-7" />
            </TouchBtn>
          </div>
          <div className="flex gap-3">
            <TouchBtn
              label="下落"
              onHold={(v) => {
                const game = g();
                if (game) game.input.touchDown = v;
              }}
            >
              <ArrowDown className="size-7" />
            </TouchBtn>
            <TouchBtn
              label="跳"
              wide
              onHold={(v) => {
                const game = g();
                if (game) game.input.touchJump = v;
              }}
            >
              <ChevronUp className="size-8" />
            </TouchBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function Lives({ n }: { n: number }) {
  const count = Math.max(0, Math.min(6, n));
  return (
    <span className="flex items-center gap-1" aria-label={`生命 ${n}`}>
      {Array.from({ length: Math.max(count, 1) }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full ${i < count ? "bg-apricot" : "bg-paper/30"}`}
        />
      ))}
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/45 px-4">
      <div className="flex flex-col items-center rounded-xl border border-ginkgo/30 bg-hud px-8 py-7 text-center text-paper shadow-lg">
        {children}
      </div>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-leaf px-4 py-3 text-base font-medium text-paper transition-transform duration-200 hover:bg-leaf-deep disabled:opacity-60 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md bg-paper/90 px-4 py-3 text-sm font-medium text-ink transition-transform duration-200 hover:bg-paper active:scale-[0.98]"
    >
      {children}
    </button>
  );
}


function HudChip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-sm bg-hud px-3 py-1.5 text-xs font-medium tracking-wide">
      {children}
    </div>
  );
}

function TouchBtn({
  children,
  label,
  onHold,
  wide,
}: {
  children: ReactNode;
  label: string;
  onHold: (held: boolean) => void;
  wide?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`flex ${wide ? "h-20 w-24" : "size-16"} items-center justify-center rounded-lg bg-hud text-paper select-none`}
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
