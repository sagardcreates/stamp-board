import { extend } from "@pixi/react";
import { Container, Sprite, Graphics, TilingSprite } from "pixi.js";
import { Viewport } from "pixi-viewport";

// register all the Pixi classes we use as intrinsic JSX tags
extend({ Container, Sprite, Graphics, TilingSprite, Viewport });
