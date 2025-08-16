"use client";
import { Application as ReactPixiApplication } from "@pixi/react";
import { useEffect, useMemo, useState } from "react";
import type { StampDTO } from "./types";
import BoardCanvas from "./BoardCanvas";

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stamps: StampDTO[];
};

export default function PixiBoard({ containerRef, stamps }: Props) {
  // DPR (safe on SSR)
  const dpr = useMemo(
    () => (typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 2)),
    []
  );

  // 🔸 window-driven canvas size (in CSS px)
  const [screen, setScreen] = useState({ w: 1024, h: 768 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () =>
      setScreen({ w: Math.max(1, window.innerWidth), h: Math.max(1, window.innerHeight) });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    // Make sure the wrapper truly fills the viewport
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        // 🔥 fixed, non-panning radial gradient
        background:
          "radial-gradient(1200px circle at 50% -20%, rgba(46,48,99,1), rgba(46,48,99,0) 100%), " + "#14151C",
      }}
    >
      <ReactPixiApplication
        width={screen.w}
        height={screen.h}
        resizeTo={typeof window !== "undefined" ? window : undefined}
        antialias
        autoDensity
        backgroundAlpha={0}         // keep canvas transparent
        resolution={dpr}
        powerPreference="high-performance"
      >
        <BoardCanvas stamps={stamps} />
      </ReactPixiApplication>
    </div>
  );
}
