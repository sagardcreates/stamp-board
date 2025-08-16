"use client";
import { useRef } from "react";
import PixiBoard from "@/components/board/PixiBoard";
import type { StampDTO } from "@/components/board/types";

export default function BoardClient({ stamps }: { stamps: StampDTO[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        background: "#0b0b0b",
      }}
    >
      <PixiBoard containerRef={containerRef} stamps={stamps} />
    </div>
  );
}
