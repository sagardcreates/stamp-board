// src/components/board/animations.ts
import gsap from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";

let registered = false;
export function ensureGsap() {
  if (registered) return;
  gsap.registerPlugin(PixiPlugin);
  PixiPlugin.registerPIXI(PIXI);
  registered = true;
}

// helpers that animate to an absolute scale (not += / -=)
export function toScale(target: any, scale: number, duration = 0.18, ease = "power2.out") {
  ensureGsap();
  return gsap.to(target, { pixi: { scale }, duration, ease });
}

export function toProps(target: any, props: any, duration = 0.3, ease = "power2.out") {
  ensureGsap();
  return gsap.to(target, { pixi: props, duration, ease });
}

// use these, passing the sprite's baseScale
export function hoverIn(target: any, baseScale: number) {
  return toScale(target, baseScale * 1.04, 0.16);
}
export function hoverOut(target: any, baseScale: number) {
  return toScale(target, baseScale, 0.18);
}
export function press(target: any, baseScale: number) {
  return toScale(target, baseScale * 1.06, 0.08, "power1.out");
}
export function settle(target: any, baseScale: number) {
  return toScale(target, baseScale, 0.22);
}
