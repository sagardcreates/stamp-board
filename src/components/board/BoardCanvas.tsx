// src/components/board/BoardCanvas.tsx
"use client";
import "@/components/board/pixi-extend";
import { useApplication } from "@pixi/react";
import {
  Assets,
  Texture,
  FederatedPointerEvent,
  Sprite as PixiSprite,
  Container as PixiContainer,
  Graphics as PixiGraphics,
  TilingSprite as PixiTilingSprite,
  Ticker,
  WRAP_MODES,
  BlurFilter,
} from "pixi.js";
import { Viewport } from "pixi-viewport";
import gsap from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StampDTO } from "./types";
import { hoverIn, hoverOut, press, settle } from "./animations";

type DragSprite = PixiSprite & {
  dragging?: boolean;
  dragDX?: number;
  dragDY?: number;
  dragStartX?: number;
  dragStartY?: number;
  moved?: boolean;
  baseScale?: number;
};

const modalMeta = new WeakMap<PixiSprite, { source: DragSprite }>();

function getGlobalPose(s: PixiSprite) {
  const p = s.getGlobalPosition();
  const wt = s.worldTransform;
  const globalScale = Math.hypot(wt.a, wt.b);
  const deg = (s.rotation * 180) / Math.PI;
  return { x: p.x, y: p.y, angle: deg, scale: globalScale };
}

export default function BoardCanvas({ stamps }: { stamps: StampDTO[] }) {
  const { app } = useApplication();
  const viewportRef = useRef<Viewport | null>(null);

  // fixed board/world size
  const worldW = 8000;
  const worldH = 6000;

  // overlay layer
  const overlayRef = useRef<PixiContainer | null>(null);
  const dimRef = useRef<PixiGraphics | null>(null);

  // textures
  const [tex, setTex] = useState<Record<string, Texture>>({});
  const [bgTex, setBgTex] = useState<Texture | null>(null);
  const bgRef = useRef<PixiTilingSprite | null>(null);

  // --------- window-driven CSS size (no renderer races) ----------
  const initialW = typeof window === "undefined" ? 1024 : Math.max(320, window.innerWidth);
  const initialH = typeof window === "undefined" ? 768 : Math.max(240, window.innerHeight);
  const [screen, setScreen] = useState({ w: initialW, h: initialH });

  //helper for modal centering
  const getScreen = () => {
    const r = app.renderer as any;
    // Pixi v8: CSS pixel size lives on r.screen
    return { w: r?.screen?.width ?? 1, h: r?.screen?.height ?? 1 };
  };
  

  // overlay styling knobs
  const OVERLAY = {
    color: 0x17181C, // ← change this to your color
    alpha: 1,     // ← target opacity of the dim layer
  };

  const blurRef = useRef<BlurFilter | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setScreen({ w: Math.max(1, window.innerWidth), h: Math.max(1, window.innerHeight) });
      // keep viewport in sync if it already exists
      const vp = viewportRef.current;
      if (vp) vp.resize(window.innerWidth, window.innerHeight, worldW, worldH);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [worldW, worldH]);

  // --------- overlay init ----------
  useEffect(() => {
    if (overlayRef.current) return;

    const overlay = new PixiContainer();
    overlay.sortableChildren = true;
    overlay.zIndex = 9999;
    overlay.visible = false;

    const dim = new PixiGraphics();
    dim.alpha = 0;
    dim.eventMode = "none";
    overlay.addChild(dim);

    app.stage.sortableChildren = true;
    app.stage.addChild(overlay);

    overlayRef.current = overlay;
    dimRef.current = dim;

    const redrawDim = () => {
      dim.clear();
      dim.beginFill(OVERLAY.color, 1);
      dim.drawRect(0, 0, screen.w, screen.h);
      dim.endFill();
    };

    redrawDim();

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", onKey);
    const onResize = () => redrawDim();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      overlay.destroy({ children: true });
      overlayRef.current = null;
      dimRef.current = null;
    };
  }, [app.stage, screen.w, screen.h]);

  // --------- viewport setup (pan only, clamp, no zoom) ----------
  const viewportRefCb = useCallback((vp: Viewport | null) => {
    viewportRef.current = vp;
    if (!vp) return;

    vp.drag({ pressDrag: true, mouseButtons: "left", factor: 1.25 });
    vp.decelerate({ friction: 0.965 });

    // no zoom
    vp.plugins.remove("pinch");
    vp.plugins.remove("wheel");
    vp.clampZoom({ minScale: 1, maxScale: 1 });
    vp.scale.set(1, 1);

    vp.clamp({
      left: 0, top: 0, right: worldW, bottom: worldH,
      direction: "all",
      underflow: "none",
    });

    // size from window (CSS px)
    vp.resize(screen.w, screen.h, worldW, worldH);
    vp.moveCenter(worldW / 2, worldH / 2);
  }, [worldW, worldH, screen.w, screen.h]);

  // --------- load stamps ----------
  useEffect(() => {
    let ok = true;
    (async () => {
      const pairs = await Promise.all(
        stamps.map(async (s) => {
          try { return [s.id, await Assets.load(s.url)] as const; }
          catch { console.warn("Failed to load", s.url); return null; }
        })
      );
      if (!ok) return;
      const map: Record<string, Texture> = {};
      for (const p of pairs) if (p) map[p[0]] = p[1] as Texture;
      setTex(map);
    })();
    return () => { ok = false; };
  }, [stamps]);

  // --------- load bg texture ----------
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const tex = (await Assets.load("/bg/bgtexture.png")) as Texture;
        const bt = tex.baseTexture as any;
        if ("wrapMode" in bt) bt.wrapMode = WRAP_MODES.REPEAT;
        if ("mipmap" in bt) bt.mipmap = true;
        if (ok) setBgTex(tex);
      } catch (e) {
        console.warn("Failed to load board bg texture", e);
      }
    })();
    return () => { ok = false; };
  }, []);

  // --------- modal controls ----------
  function closeModal() {
    const overlay = overlayRef.current, dim = dimRef.current;
    if (!overlay || !dim) return;
  
    const modal = overlay.children.find((c) => c instanceof PixiSprite) as PixiSprite | undefined;
    if (!modal) return;
  
    const meta = modalMeta.get(modal);
    const source = meta?.source;
  
    const tl = gsap.timeline({
      onComplete: () => {
        // ✅ cleanup resize listener
        const cb = (modal as any).__onResize as (() => void) | undefined;
        if (cb) app.renderer.off("resize", cb);
  
        overlay.removeChildren();
        overlay.addChild(dim);
        overlay.visible = false;
        dim.alpha = 0;
        dim.eventMode = "none";
        viewportRef.current?.plugins.resume("drag");
        viewportRef.current?.plugins.resume("pinch");
        viewportRef.current?.plugins.resume("wheel");
        if (source) source.visible = true;
      },
    });
  
    if (source) {
      const pose = getGlobalPose(source);
      tl.to(modal, {
        pixi: { x: pose.x, y: pose.y, angle: pose.angle, scale: pose.scale },
        duration: 0.28, ease: "power2.inOut"
      }, 0);
    } else {
      tl.to(modal, { pixi: { scale: 0.9 }, duration: 0.2, ease: "power2.inOut" }, 0);
    }
    tl.to(dim, { alpha: 0, duration: 0.25, ease: "power1.out" }, 0);
  }  

  function openModal(fromSprite: DragSprite, texture: Texture) {
    const overlay = overlayRef.current!, dim = dimRef.current!;
    overlay.visible = true;
  
    // pause viewport interactions
    viewportRef.current?.plugins.pause("drag");
    viewportRef.current?.plugins.pause("pinch");
    viewportRef.current?.plugins.pause("wheel");
  
    // start pose (global)
    const startPose = getGlobalPose(fromSprite);
    const modalSprite = new PixiSprite(texture);
    modalSprite.anchor.set(0.5);
    modalSprite.position.set(startPose.x, startPose.y);
    modalSprite.angle = startPose.angle;
    modalSprite.scale.set(startPose.scale);
  
    modalMeta.set(modalSprite, { source: fromSprite });
    fromSprite.visible = false;
  
    dim.eventMode = "static";
    dim.removeAllListeners();
    dim.on("pointerdown", () => closeModal());
  
    overlay.addChild(modalSprite);
  
    // ✅ use CSS-pixel screen size for centering & fit
    const getMargin = (w: number, h: number) => {
      if (w < 600) return 20;        // 📱 small screens
      if (w < 1200) return h / 4;    // 💻 medium screens
      return h / 2;                  // 🖥 big screens
    };
    
    const { w: appW, h: appH } = getScreen();
    const tw = texture.width, th = texture.height;
    
    const margin = getMargin(appW, appH);
    
    const scaleToFit = Math.min(
      (appW - margin) / tw,
      (appH - margin) / th
    );
  
    // fade in dim + fly to exact center
    gsap.to(dim, { alpha: OVERLAY?.alpha ?? 0.55, duration: 0.25, ease: "power1.out" });
    gsap.to(modalSprite, {
      pixi: { x: appW / 2, y: appH / 2, angle: 0, scale: scaleToFit },
      duration: 0.32,
      ease: "power2.out",
    });
  
    // ✅ keep centered if window resizes during open
    const onResize = () => {
      const { w, h } = getScreen();
      const newScale = Math.min((w - margin) / tw, (h - margin) / th);
      modalSprite.position.set(w / 2, h / 2);
      modalSprite.scale.set(newScale);
      // also redraw dim to full screen
      dim.clear();
      dim.beginFill(OVERLAY?.color ?? 0x0b0b0b, 1);
      dim.drawRect(0, 0, w, h);
      dim.endFill();
      dim.alpha = OVERLAY?.alpha ?? 0.55;
    };
    app.renderer.on("resize", onResize);
    // store cleanup on the sprite so closeModal can remove it
    (modalSprite as any).__onResize = onResize;
  }

  // --------- stamps ----------
  const makeStamp = useCallback((s: StampDTO, t: Texture) => {
    const onOver = (e: FederatedPointerEvent) => {
      const sp = e.currentTarget as unknown as DragSprite;
      sp.baseScale ??= sp.scale.x;
      hoverIn(sp as any, sp.baseScale!);
    };
    const onOut = (e: FederatedPointerEvent) => {
      const sp = e.currentTarget as unknown as DragSprite;
      hoverOut(sp as any, sp.baseScale ?? s.scale);
    };
    const onDown = (e: FederatedPointerEvent) => {
      e.stopPropagation();
      const sp = e.currentTarget as unknown as DragSprite;
      sp.baseScale ??= sp.scale.x;
      const lp = (sp.parent as any).toLocal(e.global);
      sp.dragDX = sp.x - lp.x;
      sp.dragDY = sp.y - lp.y;
      sp.dragStartX = sp.x; sp.dragStartY = sp.y;
      sp.dragging = true; sp.moved = false;
      (sp as any).cursor = "grabbing";
      press(sp as any, sp.baseScale!);
      viewportRef.current?.plugins.pause("drag");
      viewportRef.current?.plugins.pause("decelerate");
    };
    const onUp = (e: FederatedPointerEvent) => {
      e.stopPropagation();
      const sp = e.currentTarget as unknown as DragSprite;
      const moved = sp.moved;
      sp.dragging = false;
      (sp as any).cursor = "grab";
      settle(sp as any, sp.baseScale ?? s.scale);
      viewportRef.current?.plugins.resume("drag");
      viewportRef.current?.plugins.resume("decelerate");

      const dx = sp.x - (sp.dragStartX ?? sp.x);
      const dy = sp.y - (sp.dragStartY ?? sp.y);
      if (!moved && dx * dx + dy * dy <= 9) openModal(sp, t);
    };
    const onMove = (e: FederatedPointerEvent) => {
      if (!(e.buttons & 1)) return;
      const sp = e.currentTarget as unknown as DragSprite;
      if (!sp.dragging) return;
      e.stopPropagation();
      const lp = (sp.parent as any).toLocal(e.global);
      const nx = lp.x + (sp.dragDX ?? 0);
      const ny = lp.y + (sp.dragDY ?? 0);
      if (!sp.moved && (Math.abs(nx - (sp.dragStartX ?? nx)) > 2 || Math.abs(ny - (sp.dragStartY ?? ny)) > 2)) {
        sp.moved = true;
      }
      sp.position.set(nx, ny);
    };

    return (
      <pixiSprite
        key={s.id}
        texture={t as any}
        anchor={0.5}
        x={s.x}
        y={s.y}
        scale={s.scale}
        rotation={s.rotation}
        eventMode="static"
        cursor="grab"
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerUpOutside={onUp}
        onPointerMove={onMove}
      />
    );
  }, [app]);

  const nodes = useMemo(
    () => stamps.map((s) => (tex[s.id] ? makeStamp(s, tex[s.id]) : null)),
    [stamps, tex, makeStamp]
  );

  // --------- safe ticker/events ----------
  const r = app.renderer as any;
  const events = r?.events;
  const safeTicker: Ticker = (app as any)?.ticker ?? new Ticker();

  // inside BoardCanvas()
  const renderer = app.renderer as any;
  const screenW = renderer?.screen?.width ?? 1;    // DPR-aware
  const screenH = renderer?.screen?.height ?? 1;
  
  // 👇 Prevent mounting Viewport until EventSystem is ready
  if (!events) return null;

  return (
    <viewport
      ref={viewportRefCb}
      ticker={safeTicker}
      events={events as any}
      screenWidth={screen.w}   // <- window size (CSS px)
      screenHeight={screen.h}
      worldWidth={worldW}
      worldHeight={worldH}
    >
      {bgTex && (
        <pixiTilingSprite
          ref={bgRef}
          texture={bgTex as any}
          width={worldW}
          height={worldH}
          x={0}
          y={0}
          alpha={0.3}
          eventMode="none"
          roundPixels
          tileScale={{ x: 0.2, y: 0.2 }}
        />
      )}

      <pixiContainer sortableChildren>{nodes}</pixiContainer>
    </viewport>
  );
}
