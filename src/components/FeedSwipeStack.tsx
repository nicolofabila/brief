"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { animated, useSpring, to } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import type { FeedPaper } from "@/types/paper";

const SWIPE_PX = 100;
const DRAG_ACTIVATION_PX = 10;
const VELOCITY_SWIPE = 0.45;
const DRAG_ROT_DEG_PER_PX = 0.12;
const FLY_ROT_DEG = 22;

/** Visual pose for the card waiting behind the top card */
const STACK_BACK = { scale: 0.94, stackY: 16 } as const;

const flyX = () =>
  typeof window !== "undefined" ? window.innerWidth + 80 : 520;

type Props = {
  queue: FeedPaper[];
  totalForProgress: number;
  onKeep: (paper: FeedPaper) => void | Promise<void>;
  onDiscard: (paper: FeedPaper) => void;
  renderCard: (paper: FeedPaper) => ReactNode;
};

export function FeedSwipeStack({
  queue,
  totalForProgress,
  onKeep,
  onDiscard,
  renderCard,
}: Props) {
  const current = queue[0] ?? null;
  const paperRef = useRef<FeedPaper | null>(null);
  paperRef.current = current;

  const prevPmidRef = useRef<string | null>(null);

  const processed =
    current && totalForProgress > 0
      ? totalForProgress - queue.length + 1
      : 0;

  const [{ x, rot }, api] = useSpring(() => ({
    x: 0,
    rot: 0,
    config: { tension: 320, friction: 32 },
  }));

  const [{ scale, stackY, stackOpacity }, stackApi] = useSpring(() => ({
    scale: 1,
    stackY: 0,
    stackOpacity: 1,
    config: { tension: 380, friction: 32 },
  }));

  const dragTransform = to(
    [x, rot],
    (xv, rv) => `translate3d(${xv}px,0,0) rotateZ(${rv}deg)`,
  );

  const stackTransform = to(
    [scale, stackY],
    (s, y) => `scale(${s}) translateY(${y}px)`,
  );

  /** After a swipe, drag spring still holds x ≈ ±flyX(). Reset immediately so the next card does not “fly in” from the side — only the stack spring enlarges from the back. */
  useLayoutEffect(() => {
    if (!current) return;
    api.set({ x: 0, rot: 0 });
  }, [current?.pmid, api, current]);

  useEffect(() => {
    if (!current) return;
    const prev = prevPmidRef.current;
    if (prev === null) {
      prevPmidRef.current = current.pmid;
      stackApi.set({ scale: 1, stackY: 0, stackOpacity: 1 });
      return;
    }
    if (prev !== current.pmid) {
      prevPmidRef.current = current.pmid;
      stackApi.start({
        from: {
          scale: STACK_BACK.scale,
          stackY: STACK_BACK.stackY,
          stackOpacity: 0.82,
        },
        to: { scale: 1, stackY: 0, stackOpacity: 1 },
      });
    }
  }, [current?.pmid, stackApi, current]);

  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
  }, [current?.pmid]);

  const completeSwipe = useCallback(
    (dir: "left" | "right") => {
      if (settledRef.current) return;
      const p = paperRef.current;
      if (!p) return;
      settledRef.current = true;
      if (dir === "right") onKeep(p);
      else onDiscard(p);
    },
    [onKeep, onDiscard],
  );

  const flyOut = useCallback(
    (dir: "left" | "right") => {
      settledRef.current = false;
      const sign = dir === "right" ? 1 : -1;
      api.start({
        x: sign * flyX(),
        rot: sign * FLY_ROT_DEG,
        onRest: () => {
          completeSwipe(dir);
        },
      });
    },
    [api, completeSwipe],
  );

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], last, tap }) => {
      if (tap) return;
      if (active) {
        api.start({
          x: mx,
          rot: mx * DRAG_ROT_DEG_PER_PX,
          immediate: false,
        });
        return;
      }
      if (!last) return;
      const strongFlick = Math.abs(vx) > VELOCITY_SWIPE;
      const past = Math.abs(mx) > SWIPE_PX;
      if (past || strongFlick) {
        settledRef.current = false;
        const goRight = mx > 0 || (mx === 0 && vx >= 0);
        const dir = goRight ? "right" : "left";
        api.start({
          x: goRight ? flyX() : -flyX(),
          rot: goRight ? FLY_ROT_DEG : -FLY_ROT_DEG,
          onRest: () => completeSwipe(dir),
        });
      } else {
        api.start({ x: 0, rot: 0 });
      }
    },
    {
      axis: "x",
      filterTaps: true,
      threshold: DRAG_ACTIVATION_PX,
    },
  );

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (!paperRef.current) return;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        flyOut("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        flyOut("left");
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [flyOut]);

  if (!current) return null;

  return (
    <div
      className="relative mx-auto w-full max-w-3xl outline-none"
      role="region"
      aria-label="Paper swipe feed"
    >
      <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          {processed} / {totalForProgress}
        </p>
      </div>

      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => flyOut("left")}
          className="fixed left-[max(1rem,calc(50%-27rem))] top-1/2 z-30 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container font-label text-[10px] font-bold uppercase tracking-wider text-on-surface shadow-md transition-colors hover:bg-surface-variant active:scale-95"
          aria-label="Pass — swipe left"
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => flyOut("right")}
          className="fixed right-[max(1rem,calc(50%-27rem))] top-1/2 z-30 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-primary font-label text-[10px] font-bold uppercase tracking-wider text-on-primary shadow-md transition-colors hover:opacity-90 active:scale-95"
          aria-label="Keep — swipe right"
        >
          Keep
        </button>
      </div>

      <div className="relative min-h-[min(40dvh,320px)] touch-pan-y pt-4">
        <animated.div
          style={{
            transform: stackTransform,
            transformOrigin: "50% 0%",
            opacity: stackOpacity,
          }}
          className="relative z-10 w-full rounded-lg"
        >
          <animated.div
            {...bind()}
            style={{
              transform: dragTransform,
              touchAction: "none",
            }}
            className="cursor-grab rounded-lg active:cursor-grabbing"
          >
            {renderCard(current)}
          </animated.div>
        </animated.div>
      </div>
      <div className="mt-4 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => flyOut("left")}
          className="rounded-full border border-outline-variant/40 bg-surface-container px-4 py-2 font-label text-xs font-bold uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-variant active:scale-95 md:hidden"
          aria-label="Pass — swipe left"
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => flyOut("right")}
          className="rounded-full bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-wider text-on-primary transition-colors hover:opacity-90 active:scale-95 md:hidden"
          aria-label="Keep — swipe right"
        >
          Keep
        </button>
      </div>
    </div>
  );
}
