/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { createExampleComponent } from "../utils";
import { createGame } from "./createGame";

const Game = createExampleComponent(createGame);

export const ExampleLDtkPlatformer = () => {
	return (
		<>
			<Game />
			<div
				style={{
					position: "absolute",
					bottom: 12,
					left: 0,
					right: 0,
					textAlign: "center",
					color: "#e0e0e0",
					fontSize: 13,
					pointerEvents: "none",
					zIndex: 1000,
					textShadow: "0 1px 2px #000",
				}}
			>
				Arrows or WASD to move and climb · Space or X to jump (again in the air)
				and swim · Up in front of a teleport to take it
			</div>
		</>
	);
};
