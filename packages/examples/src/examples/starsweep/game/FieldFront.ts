/**
 * melonJS — Starsweep: the field's front layer.
 *
 * What the field draws over the characters: the panel behind a message.
 * A `Renderable` of its own, so the screen can put it above the
 * characters' container.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Renderable } from "melonjs";
import { HEIGHT, WIDTH } from "../config/layout";
import type { Renderer } from "../utils/draw";
import type { Field } from "./Field";

/** draws the field's front layer, over the characters */
export class FieldFront extends Renderable {
	constructor(private readonly field: Field) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.isPersistent = true;
	}

	override draw(r: Renderer) {
		this.field.drawFront(r);
	}
}
