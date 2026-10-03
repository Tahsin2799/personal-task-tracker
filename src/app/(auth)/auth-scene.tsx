"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SCENE_WIDTH = 1024;
const SCENE_HEIGHT = 1536;
const ARRIVAL_END = 3.9;

type BirdFrames = {
  up: HTMLImageElement;
  down: HTMLImageElement;
  landing: HTMLImageElement;
};

function loadFrame(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function SceneView({ isLogin }: { isLogin: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const replayRef = useRef<(() => void) | null>(null);
  const [hasLanded, setHasLanded] = useState(!isLogin);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    if (!isLogin) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    let disposed = false;
    let frameId = 0;
    let elapsed = 0;
    let lastTime = 0;
    let inView = true;
    let running = false;
    let frames: BirdFrames | null = null;

    function paint() {
      if (!canvas || !context || !frames) return;
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(bounds.width * pixelRatio);
      const pixelHeight = Math.round(bounds.height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const scale = Math.max(bounds.width / SCENE_WIDTH, bounds.height / SCENE_HEIGHT);
      const verticalFocus = window.innerWidth <= 480 ? 0.38 : window.innerWidth <= 890 ? 0.42 : 0.5;
      const offsetX = (bounds.width - SCENE_WIDTH * scale) / 2;
      const offsetY = (bounds.height - SCENE_HEIGHT * scale) * verticalFocus;
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);

      if (elapsed >= 0.6 && elapsed < 3.4) {
        const progress = (elapsed - 0.6) / 2.8;
        const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        const width = 260 + 90 * ease;
        const x = 1000 - 360 * ease;
        const y = 240 + 180 * ease - 62 * Math.sin(progress * Math.PI);
        const pose = Math.floor((elapsed - 0.6) / 0.2) % 2 === 0 ? frames.up : frames.down;
        context.drawImage(pose, x, y, width, (width * 2) / 3);
      } else if (elapsed >= 3.4 && elapsed < ARRIVAL_END) {
        const settle = (elapsed - 3.4) / 0.5;
        context.drawImage(frames.landing, 670, 386 + 14 * settle, 290, 435);
      }
    }

    function tick(time: number) {
      if (!running) return;
      if (lastTime && inView && !document.hidden) {
        elapsed += Math.min((time - lastTime) / 1000, 0.05);
      }
      lastTime = time;
      paint();
      if (elapsed < ARRIVAL_END) {
        frameId = requestAnimationFrame(tick);
      } else {
        running = false;
        setHasLanded(true);
      }
    }

    function replay() {
      if (!frames || disposed) return;
      cancelAnimationFrame(frameId);
      elapsed = 0;
      lastTime = 0;
      running = true;
      setHasLanded(false);
      paint();
      frameId = requestAnimationFrame(tick);
    }

    replayRef.current = replay;
    const resizeObserver = new ResizeObserver(() => {
      if (running) paint();
    });
    resizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    viewObserver.observe(canvas);

    Promise.all([
      loadFrame("/brand/auth/flight-up.png"),
      loadFrame("/brand/auth/flight-down.png"),
      loadFrame("/brand/auth/landing.png"),
    ])
      .then(([up, down, landing]) => {
        if (disposed) return;
        frames = { up, down, landing };
        setIsReady(true);
        replay();
      })
      .catch(() => {
        if (disposed) return;
        setHasLanded(true);
      });

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      replayRef.current = null;
    };
  }, [isLogin]);

  return (
    <>
      <div
        className={`auth-scene${hasLanded ? " auth-scene-complete" : ""}`}
        role="img"
        aria-label="A scaly-breasted munia flies in and lands on a branch while a watcher looks through binoculars."
      >
        <Image
          src="/brand/auth/scene-perched.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 890px) 100vw, 55vw"
          className="auth-scene-image auth-scene-perched"
        />
        <Image
          src="/brand/auth/scene-empty.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 890px) 100vw, 55vw"
          className="auth-scene-image auth-scene-empty"
        />
        <canvas ref={canvasRef} className="auth-scene-canvas" aria-hidden="true" />
      </div>
      {isLogin && (
        <button
          className="auth-scene-replay"
          type="button"
          disabled={!isReady}
          onClick={() => replayRef.current?.()}
          aria-label="Replay bird arrival"
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M15 7.5A6 6 0 1 0 15 11M15 3.5v4h-4" />
          </svg>
          Replay arrival
        </button>
      )}
    </>
  );
}

export default function AuthScene() {
  const pathname = usePathname();
  return <SceneView key={pathname} isLogin={pathname === "/login"} />;
}
