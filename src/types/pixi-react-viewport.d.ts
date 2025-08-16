import type { PixiReactElementProps } from "@pixi/react";
import { Viewport } from "pixi-viewport";
import { Container, Sprite, Graphics, TilingSprite } from "pixi.js";

declare module "@pixi/react" {
  interface PixiElements {
    // viewport from pixi-viewport
    viewport: PixiReactElementProps<typeof Viewport>;
    // core pixi elements we’ll use in JSX
    pixiContainer: PixiReactElementProps<typeof Container>;
    pixiSprite: PixiReactElementProps<typeof Sprite>;
    pixiGraphics: PixiReactElementProps<typeof Graphics>;
    pixiTilingSprite: PixiReactElementProps<typeof TilingSprite>;
  }
}
