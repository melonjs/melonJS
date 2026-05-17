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
			}
		}, []);
		return null;
	};
};
