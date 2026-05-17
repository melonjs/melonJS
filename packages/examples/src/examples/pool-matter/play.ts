/**
 * melonJS — Pool (Matter) example: PlayScreen + rack assembly.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, Stage } from "melonjs";
import { BALL_RADIUS, PLAY_LEFT, PLAY_W, VIEWPORT_H } from "./constants";
import { Ball } from "./entities/ball";
import { CUE_SPAWN_X, CUE_SPAWN_Y, CueBall } from "./entities/cue";
import { HUDContainer } from "./entities/hud";
import { buildPockets } from "./entities/pocket";
import { buildTable } from "./entities/table";
import { gameState } from "./gameState";

/**
 * Build the 15-ball triangle rack. Apex points toward the cue (left
 * side of the table); foot row is on the right. The 8-ball sits at
 * the center of the third row, the standard "8 in the middle" layout.
 *
 * Geometry: triangular close-packing of equal circles. Within a
 * column balls touch vertically (`dy = 2 * BALL_RADIUS`). Between
 * adjacent columns the horizontal step is `BALL_RADIUS * √3` — the
 * value that makes a ball in column N tangent to the two balls of
 * column N+1 that flank it (sqrt(dx² + R²) = 2R ⇒ dx = R·√3). A tiny
 * 0.01-px margin avoids exact-tangent overlap that matter's narrow
 * phase resolves with an immediate push-apart impulse on the first
 * step, which visually scatters the rack before it ever gets hit.
 */
const buildRack = (): Ball[] => {
	const balls: Ball[] = [];
	const apexX = PLAY_LEFT + PLAY_W * 0.7;
	const apexY = VIEWPORT_H / 2;
	const dx = BALL_RADIUS * Math.sqrt(3) + 0.01; // column-to-column step
	const dy = BALL_RADIUS * 2 + 0.01; // within-column step
	// numbering: apex = 1, then row 2 = (2,3), row 3 = (4,8,5),
	// row 4 = (6,7,9,10), row 5 = (11,12,13,14,15)
	const rackOrder: number[][] = [
		[1],
		[2, 3],
		[4, 8, 5],
		[6, 7, 9, 10],
		[11, 12, 13, 14, 15],
	];
	for (let row = 0; row < rackOrder.length; row++) {
		const cols = rackOrder[row];
		const rowX = apexX + row * dx;
		const startY = apexY - ((cols.length - 1) * dy) / 2;
		for (let col = 0; col < cols.length; col++) {
			const num = cols[col];
			balls.push(
				new Ball(rowX - BALL_RADIUS, startY + col * dy - BALL_RADIUS, num),
			);
		}
	}
	return balls;
};

export class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		// reset state
		gameState.score = 0;
		gameState.ballsRemaining = 15;
		gameState.aiming = false;
		gameState.gameOver = false;

		// table sprite + invisible rail collision bodies
		for (const r of buildTable()) {
			app.world.addChild(r);
		}
		// pocket sensors (no visuals — table sprite shows the holes)
		for (const p of buildPockets()) {
			app.world.addChild(p);
		}
		// rack + cue
		for (const b of buildRack()) {
			app.world.addChild(b);
		}
		app.world.addChild(new CueBall(CUE_SPAWN_X, CUE_SPAWN_Y));
		// HUD on top
		app.world.addChild(new HUDContainer());
	}
}
