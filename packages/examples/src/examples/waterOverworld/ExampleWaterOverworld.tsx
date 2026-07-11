/**
 * melonJS — Water Overworld example (shader builtins showcase).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";
import { useEffect } from "react";
import { createGame } from "./game";

export const ExampleWaterOverworld = () => {
	useEffect(() => {
		if (!me.game.isInitialized) {
			createGame();
		}
	}, []);

	return (
		// float above the fixed #screen overlay (see index.css)
		<div
			style={{
				position: "absolute",
				top: 44,
				left: 16,
				zIndex: 1000,
				padding: "6px 12px",
				fontSize: 13,
				background: "rgba(26, 26, 26, 0.85)",
				color: "#e0e0e0",
				border: "1px solid #444",
				borderRadius: 4,
			}}
		>
			A/D or ←/→ move · W/↑ jump · hold Shift to run · S toggles the debug panel
			— the pond refracts the scene via <code>screen_texture</code> /{" "}
			<code>screen_uv</code> / <code>noise_uv</code>
		</div>
	);
};
