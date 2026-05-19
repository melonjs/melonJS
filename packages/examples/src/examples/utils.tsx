/**
 * melonJS — examples shared utilities.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game } from "melonjs";
import { useEffect } from "react";

// Tracks which example currently owns the live engine instance. Lets us
// distinguish "same example remounting" (React StrictMode dev double-mount,
// canvas just needs re-parenting) from "switching to a different example"
// (the previous engine is stale and would draw the wrong scene under a
// re-parented canvas). `game.isInitialized` alone can't tell those apart.
let currentInitFn: (() => void) | null = null;

export const createExampleComponent = (createGameFn: () => void) => {
	return () => {
		useEffect(() => {
			if (currentInitFn === createGameFn) {
				// Same example remounting — engine still alive from the
				// first mount; the cleanup below detached the canvas, so
				// re-parent it back into `#screen`.
				const canvas = game.renderer?.getCanvas();
				const screen = document.getElementById("screen");
				if (canvas && screen && !screen.contains(canvas)) {
					screen.appendChild(canvas);
				}
			} else if (currentInitFn !== null) {
				// Cross-example navigation (e.g. `/lineOfSight` → `/plinko`).
				// The previous example's engine is still alive but is
				// running the wrong scene; safest reset is a full page
				// reload so the new example boots from a clean state.
				// `game.destroy()` would be cheaper, but it has known
				// issues under React StrictMode's dev double-mount
				// (`World.reset` throws after partial teardown). The
				// reload re-runs `createExampleComponent` from scratch
				// with `currentInitFn === null`, taking the init branch.
				globalThis.location.reload();
				return;
			} else {
				// First mount of any example on this page load.
				currentInitFn = createGameFn;
				createGameFn();
			}
			// Detach the canvas on unmount so a navigation back to the
			// index page (via the "← Examples" topbar link, same tab)
			// doesn't leave the engine canvas parented in `#screen`.
			// `#screen` is `position: fixed` and covers the whole window
			// beneath the 41 px topbar, so any leftover canvas sits on
			// top of the index-page link cards and silently eats every
			// click.
			return () => {
				const canvas = game.renderer?.getCanvas();
				if (canvas?.parentElement) {
					canvas.parentElement.removeChild(canvas);
				}
			};
		}, []);
		return null;
	};
};
