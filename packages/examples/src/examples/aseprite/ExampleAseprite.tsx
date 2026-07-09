/**
 * melonJS — Aseprite animation playback example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";
import { useEffect } from "react";
import { createGame } from "./game";
import { paladin } from "./play";

export const ExampleAseprite = () => {
	useEffect(() => {
		if (!me.game.isInitialized) {
			createGame();
		}
	}, []);

	return (
		// float above the fixed #screen overlay (see index.css), like the
		// tiledMapLoader / spine selectors — in normal flow the game surface
		// paints over the controls
		<div
			style={{
				position: "absolute",
				top: 44,
				left: 16,
				zIndex: 1000,
				display: "flex",
				alignItems: "center",
				gap: 8,
			}}
		>
			<div>Animation:</div>
			<select
				name="animation_name"
				id="animation_name"
				defaultValue="run front"
				style={{
					padding: "6px 12px",
					fontSize: 14,
					background: "#1a1a1a",
					color: "#e0e0e0",
					border: "1px solid #444",
					borderRadius: 4,
				}}
				onChange={(event) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					(paladin.renderable as me.Sprite).setCurrentAnimation(
						event.target.value,
					);
				}}
			>
				<option value="step">step</option>
				<option value="idle defesa">idle defesa</option>
				<option value="SHit">SHit</option>
				<option value="Delay">Delay</option>
				<option value="release">release</option>
				<option value="Idle fight">Idle fight</option>
				<option value="run front">run front</option>
				<option value="run back">run back</option>
				<option value="morte">morte</option>
				<option value="Skill 1 - Trust-dash">Skill 1 - Trust-dash</option>
				<option value="Hurt">Hurt</option>
				<option value="Delay c">Delay c</option>
				<option value="Delay Front atk">Delay Front atk</option>
				<option value="CF1">CF1</option>
				<option value="RF1">RF1</option>
				<option value="Sit">Sit</option>
				<option value="standup">standup</option>
				<option value="idle back">idle back</option>
				<option value="skill back">skill back</option>
				<option value="skill front">skill front</option>
				<option value="War Cry">War Cry</option>
				<option value="slide">slide</option>
				<option value="Magnum Break">Magnum Break</option>
				<option value="fallen">fallen</option>
				<option value="Ress">Ress</option>
			</select>
		</div>
	);
};
