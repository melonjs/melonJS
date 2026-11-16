/**
 * melonJS — Slingshot: one round of the game, and its rules.
 *
 * It builds the field, the slingshot, the towers and the rivals, then
 * referees: it loads each pet into the pouch, launches it when the player
 * lets go, follows it until it comes to rest (`isSleeping()`), leaves the
 * field or runs out of time, knocks rivals out, keeps the score, and ends the
 * round once the rivals are all out or the pets have all flown.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import {
	type Application,
	Camera3d,
	type Mesh,
	Renderable,
	Tween,
	Vector3d,
	type World,
} from "melonjs";
import { OrbitCamera } from "../camera/OrbitCamera";
import {
	FALLEN_Y,
	FIELD_DEPTH,
	FIELD_WIDTH,
	MIN_PULL,
	PETS,
	POUCH,
	RIVAL_POINTS,
	RIVALS,
	SHOT_SECONDS,
	SPARE_PET_POINTS,
} from "../constants";
import { AimArc } from "../entities/AimArc";
import { buildField } from "../entities/field";
import { Pet } from "../entities/Pet";
import { PetLine } from "../entities/PetLine";
import { Rival, type RivalHost } from "../entities/Rival";
import { Slingshot } from "../entities/Slingshot";
import { buildTowers } from "../entities/towers";
import { AimArea, type AimHost } from "../input/AimArea";
import { EndCard } from "../ui/EndCard";
import { Hud } from "../ui/Hud";
import { popPoints } from "../ui/scorePop";
import { addTurnButtons } from "../ui/turnButtons";

export class Round extends Renderable implements RivalHost, AimHost {
	readonly adapter: Rapier3dAdapter;
	readonly ground: Mesh;
	private readonly world: World;
	private readonly camera: Camera3d;
	private readonly orbit: OrbitCamera;
	private readonly slingshot: Slingshot;
	private readonly line: PetLine;
	private readonly arc: AimArc;
	private readonly hud: Hud;
	private readonly rivals = new Set<Rival>();
	private readonly rivalCount: number;

	private score = 0;
	private shotsLeft = PETS.length;
	private over = false;
	// the pet in the pouch, and the one in flight, and for how long
	private loaded: Pet | null = null;
	private flying: Pet | null = null;
	private flightTime = 0;

	/**
	 * Build a round into the application's world.
	 * @param app - the running application
	 */
	constructor(app: Application) {
		super(0, 0, 1, 1);
		// it referees every frame, wherever the camera looks
		this.alwaysUpdate = true;

		this.world = app.world;
		this.adapter = this.world.adapter as Rapier3dAdapter;
		// the application's `cameraClass` gave the stage a Camera3d of its own
		const camera = app.viewport;
		if (!(camera instanceof Camera3d)) {
			throw new Error("the slingshot needs a Camera3d");
		}
		this.camera = camera;

		// the scenery, and what the pets are shot at
		this.ground = buildField(this.world);
		this.slingshot = new Slingshot(this.world);
		buildTowers(this.world).forEach((perch, i) => {
			const rival = new Rival(RIVALS[i % RIVALS.length], perch, this);
			this.world.addChild(rival, perch.z);
			this.rivals.add(rival);
		});
		this.rivalCount = this.rivals.size;

		// the pets, the arc they will fly along, the camera and the HUD
		this.line = new PetLine(this.world);
		this.arc = new AimArc(this.world);
		this.orbit = new OrbitCamera(camera);
		this.hud = new Hud(this.world, camera.width, camera.height);
		addTurnButtons(this.world, this.orbit, camera.height);
		// added last, with no depth given: autoDepth gives it a large one, so
		// it is drawn behind, and so asked after, the buttons and the card
		this.world.addChild(new AimArea(camera, this.orbit, this));

		this.loadNext();
		this.refreshHud();
	}

	override onActivateEvent() {
		this.orbit.bindKeys();
	}

	override onDeactivateEvent() {
		this.orbit.unbindKeys();
	}

	// ── what the aim asks (AimHost) ───────────────────────────────────────

	canAim() {
		return this.loaded !== null && !this.over;
	}

	onPull(petAt: Vector3d, pull: Vector3d, velocity: Vector3d) {
		if (this.loaded === null) {
			return;
		}
		this.adapter.setPosition(this.loaded, petAt);
		this.slingshot.holdAt(petAt, pull);
		this.arc.show(petAt, velocity);
	}

	onRelease(pull: Vector3d, velocity: Vector3d) {
		const pet = this.loaded;
		if (pet === null) {
			return;
		}
		this.arc.hide();
		if (pull.length() < MIN_PULL) {
			// barely pulled: back into the pouch
			this.adapter.setPosition(pet, POUCH);
			this.slingshot.rest();
			return;
		}
		this.loaded = null;
		this.flying = pet;
		this.flightTime = 0;
		this.shotsLeft--;
		pet.launch(this.adapter, velocity);
		// the bands go slack, out of sight, until the next pet is in
		this.slingshot.slack();
		this.hud.hideHint();
		this.refreshHud();
	}

	// ── what a rival asks (RivalHost) ─────────────────────────────────────

	knockOut(rival: Rival) {
		if (!this.rivals.delete(rival)) {
			// already out
			return;
		}
		this.score += RIVAL_POINTS;
		popPoints(this.world, this.camera, rival, RIVAL_POINTS);
		this.camera.shake(6, 250);
		rival.fadeOut();
		this.refreshHud();
	}

	// ── every frame ───────────────────────────────────────────────────────

	override update(dt: number) {
		this.orbit.update(dt);

		// a rival that fell off the field is out too
		for (const rival of this.rivals) {
			if (rival.pos.y > FALLEN_Y) {
				this.knockOut(rival);
			}
		}
		if (!this.over && this.rivals.size === 0) {
			this.endRound(true);
		}

		this.followShot(dt);
		return false;
	}

	/**
	 * Follow the pet in flight until the shot is over, then load the next
	 * one, or end the round when none is left.
	 * @param dt - the time since the last frame, in milliseconds
	 */
	private followShot(dt: number) {
		const pet = this.flying;
		if (pet === null) {
			return;
		}
		this.flightTime += dt / 1000;
		const offField =
			pet.pos.y > FALLEN_Y ||
			Math.abs(pet.pos.x) > FIELD_WIDTH ||
			Math.abs(pet.depth) > FIELD_DEPTH;
		// at rest: the physics put it to sleep
		const atRest = this.adapter.isSleeping(pet);
		if (!atRest && !offField && this.flightTime <= SHOT_SECONDS) {
			return;
		}
		this.flying = null;
		if (this.over) {
			return;
		}
		if (this.shotsLeft > 0) {
			this.loadNext();
		} else {
			this.endRound(false);
		}
	}

	/**
	 * Put the next pet in the pouch: the first straight there, the others
	 * with a hop from the front of the line, a tween along a curved path.
	 */
	private loadNext() {
		const { name, from } = this.line.next();
		const start = from ?? POUCH;
		const pet = new Pet(name, start.x, start.y);
		pet.readyForPouch();
		this.world.addChild(pet, POUCH.z);

		const ready = () => {
			this.loaded = pet;
			this.slingshot.rest();
		};
		if (from === null) {
			ready();
			return;
		}
		// one arc up out of the line and down into the pouch: the path's
		// middle point is where the curve bends toward
		const spot = new Vector3d(from.x, from.y, POUCH.z);
		new Tween(spot)
			.to(
				{ x: POUCH.x, y: [POUCH.y - 70, POUCH.y] },
				{ duration: 450, interpolation: Tween.Interpolation.Bezier },
			)
			.onUpdate(() => {
				this.adapter.setPosition(pet, spot);
			})
			.onComplete(ready)
			.start();
	}

	/**
	 * End the round, and show the card.
	 * @param cleared - every rival is out (rather than every pet flown)
	 */
	private endRound(cleared: boolean) {
		if (this.over) {
			return;
		}
		this.over = true;
		this.hud.hideHint();
		// every pet not launched is a bonus, once the towers are cleared
		const sparePets = cleared ? this.shotsLeft : 0;
		const bonus = sparePets * SPARE_PET_POINTS;
		this.score += bonus;
		this.refreshHud();
		this.world.addChild(
			new EndCard(this.camera.width, this.camera.height, {
				cleared,
				score: this.score,
				stars: this.stars(cleared),
				sparePets,
				bonus,
			}),
			0,
		);
	}

	/**
	 * The stars a round earns: none unless cleared, then up to three for the
	 * share of the best possible score.
	 * @param cleared - every rival is out
	 * @returns 0 to 3
	 */
	private stars(cleared: boolean) {
		if (!cleared) {
			return 0;
		}
		// every rival, with every pet but the first to spare
		const best =
			this.rivalCount * RIVAL_POINTS + (PETS.length - 1) * SPARE_PET_POINTS;
		if (this.score >= best * 0.7) {
			return 3;
		}
		return this.score >= best * 0.5 ? 2 : 1;
	}

	private refreshHud() {
		this.hud.show(this.score, this.rivals.size, this.rivalCount);
	}
}
