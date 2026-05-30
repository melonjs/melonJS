/**
 * SkyboxStage — thin lifecycle wrapper that spawns the
 * {@link BackdropContainer} (sky / mountains / ground grid as floating
 * Renderables) into the world and forwards a couple of game-state
 * signals to it.
 *
 * Previously this class inlined all of the backdrop rendering in its
 * `draw()` override — that ballooned the stage's draw cost into the
 * single-digit ms range because the sky + ground gradients were
 * re-rasterized every frame inside `renderer.createLinearGradient`.
 * The actual visual layers now live in `./backdrop/`, each as its
 * own `Renderable` with its own bake / cache strategy.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { type Application, Stage } from "melonjs";
import {
	BACKDROP_DEPTH,
	BackdropContainer,
} from "./backdrop/BackdropContainer";

export class SkyboxStage extends Stage {
	private backdrop: BackdropContainer | null = null;

	override onResetEvent(app: Application): void {
		this.backdrop = new BackdropContainer(app);
		// `addChild(child, z)` — without the second arg the world's
		// `autoDepth = true` would overwrite the backdrop's depth
		// with the running child-count, landing us at z = 1 and
		// painting the backdrop ON TOP of every gameplay element.
		app.world.addChild(this.backdrop, BACKDROP_DEPTH);
	}

	/**
	 * Freeze / unfreeze the ground-grid scroll. Called by
	 * `GameController` on death + restart so the world visibly stops
	 * with the player. (Engine-level pause already freezes the grid
	 * via `state.isPaused()` inside `GroundGrid.update`; this flag
	 * covers the game-over case where the engine isn't paused.)
	 */
	setScrollPaused(paused: boolean): void {
		if (this.backdrop) {
			this.backdrop.grid.scrollPaused = paused;
		}
	}
}
