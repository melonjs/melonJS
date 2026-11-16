/**
 * melonJS — Slingshot: the slingshot itself.
 *
 * A post and two prongs, one in front of the pouch and one behind, and the
 * two bands, which run from each prong's tip to the pet and are turned in 3D
 * with a `Quaternion` every time the pet moves.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Mesh, Quaternion, Vector3d, type World } from "melonjs";
import { AXIS_X, AXIS_Y, DECK_TOP, PET_SIZE, POUCH, WOOD } from "../constants";
import { createBox } from "../meshes/box";

const NO_PULL = new Vector3d(0, 0, 0);

export class Slingshot {
	private readonly bands: Mesh[];
	// where the bands start, at the top of the prongs
	private readonly tipY = POUCH.y - 20;
	// scratch vectors, so that nothing is allocated while the pet is pulled
	private readonly turn = new Quaternion();
	private readonly turnAxis = new Vector3d();
	private readonly along = new Vector3d();
	private readonly heldAt = new Vector3d();

	/**
	 * Build the slingshot into the world, on the deck under the pouch.
	 * @param world - the game world
	 */
	constructor(world: World) {
		// the post, from the deck up to just inside the prongs
		const postTop = this.tipY + 60;
		const post = createBox(18, DECK_TOP - postTop, 18, WOOD);
		post.pos.set(POUCH.x, (DECK_TOP + postTop) / 2);
		world.addChild(post, 0);

		// a prong in front of the pouch and one behind it, each with its band
		this.bands = [-40, 40].map((z) => {
			const prong = createBox(14, 70, 14, WOOD);
			prong.pos.set(POUCH.x, this.tipY + 35);
			world.addChild(prong, z);

			const band = createBox(1, 6, 6, WOOD);
			band.tint.setColor(90, 40, 30);
			band.castGroundShadow = false;
			world.addChild(band, z);
			return band;
		});
	}

	/**
	 * Stretch both bands to a pet pulled back to `petAt`.
	 * @param petAt - where the pet is
	 * @param pull - how far, and which way, it is pulled from the pouch
	 */
	holdAt(petAt: Vector3d, pull: Vector3d) {
		const back = this.backOf(petAt, pull);
		for (const band of this.bands) {
			this.stretch(band, back);
		}
	}

	/** Show the bands holding a pet at rest in the pouch. */
	rest() {
		for (const band of this.bands) {
			band.alpha = 1;
		}
		this.holdAt(POUCH, NO_PULL);
	}

	/** Hide the bands: they go slack once a pet is launched. */
	slack() {
		for (const band of this.bands) {
			band.alpha = 0;
		}
	}

	/**
	 * Where the bands hold the pet: half a pet behind it, away from the shot.
	 * @param petAt - where the pet is
	 * @param pull - how it is pulled
	 * @returns the point, in a scratch vector
	 */
	private backOf(petAt: Vector3d, pull: Vector3d) {
		if (pull.length2() < 1e-12) {
			// no pull: held from straight behind
			this.heldAt.set(-1, 0, 0);
		} else {
			this.heldAt.copy(pull).normalize();
		}
		const half = PET_SIZE / 2;
		return this.heldAt.scale(half, half, half).add(petAt);
	}

	/**
	 * Lay a band from its prong's tip to `to`: a unit box along X, turned
	 * onto the band and stretched to its length.
	 * @param band - the band's mesh
	 * @param to - the point it runs to
	 */
	private stretch(band: Mesh, to: Vector3d) {
		const along = this.along.set(
			to.x - POUCH.x,
			to.y - this.tipY,
			to.z - band.depth,
		);
		band.pos.set(POUCH.x + along.x / 2, this.tipY + along.y / 2);
		const length = Math.max(along.length(), 1);
		// the mesh turns in its model's Y-up space: Y the other way
		along.y = -along.y;
		// the turn that takes +X onto the band: about X × band, by the angle
		// between the two
		this.turnAxis.copy(AXIS_X).cross(along);
		if (this.turnAxis.length2() < 1e-12) {
			// the band lies along X already, one way or the other
			this.turn.setFromAxisAngle(AXIS_Y, along.x < 0 ? Math.PI : 0);
		} else {
			this.turn.setFromAxisAngle(
				this.turnAxis.normalize(),
				AXIS_X.angle(along),
			);
		}
		band.currentTransform.identity();
		this.turn.toMatrix3d(band.currentTransform);
		band.currentTransform.scale(length, 1, 1);
	}
}
