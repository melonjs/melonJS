/**
 * melonJS — examples shared utilities.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game } from "melonjs";
import { useEffect } from "react";

export const createExampleComponent = (createGameFn: () => void) => {
	return () => {
		useEffect(() => {
			if (!game.isInitialized) {
				createGameFn();
			} else {
				// Engine still alive from a previous mount of THIS
				// example (e.g. React StrictMode's dev double-mount);
				// the cleanup below detached the canvas, so re-parent
				// it back into `#screen`.
				const canvas = game.renderer?.getCanvas();
				const screen = document.getElementById("screen");
				if (canvas && screen && !screen.contains(canvas)) {
					screen.appendChild(canvas);
				}
			}
			// Detach the canvas on unmount so a navigation back to the
			// index page (via the "← Examples" topbar link, same tab)
			// doesn't leave the engine canvas parented in `#screen`.
			// `#screen` is `position: fixed` and covers the whole
			// window beneath the 41 px topbar, so any leftover canvas
			// sits on top of the index-page link cards and silently
			// eats every click. We intentionally don't call
			// `game.destroy()` here — it has known issues under
			// React StrictMode's dev double-mount (World.reset throws
			// because it's invoked after partial teardown).
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
