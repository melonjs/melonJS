/**
 * melonJS — Plinko (Planck) example: shared entity helpers.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

import type { Container, Renderable } from "melonjs";

/**
 * Walk up the renderable's ancestor chain until the top-level world
 * Container is reached, and return it. Used by entities that need to
 * spawn children at world scope (score-flies, win flashes, sibling
 * shockwaves) without being parented to a transformed sub-container.
 *
 * Returns `null` if the node is not currently attached to any
 * ancestor — callers should bail in that case rather than crash.
 *
 * @param node a renderable currently attached to the scene graph
 */
export const findWorld = (node: Renderable): Container | null => {
	let anc: Container | null = node.ancestor as Container | null;
	while (anc?.ancestor) {
		anc = anc.ancestor as Container;
	}
	return anc;
};
