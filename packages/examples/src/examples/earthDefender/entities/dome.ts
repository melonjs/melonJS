/**
 * melonJS — Earth Defender: the glass dome, and what breaking it costs.
 *
 * The shell the whole game is about defending: where its panes are, which of
 * them are cracked, the decals that show it, and the shatter that ends a run.
 *
 * A class rather than loose functions because it owns real state — twelve
 * fields that only this code reads or writes. Pulling them out of the
 * controller is most of the point: a pane's crack count, its reach and its
 * triangle fan were sitting next to the score and the saucer's phase, and
 * nothing but the dome ever touched them.
 *
 * What it does NOT own is the five things it has to reach back for, and
 * those arrive through {@link DomeHost} rather than through a reference to
 * the controller: the blast effects it fires, whether the run has already
 * ended, and three things it has to tell the rest of the game about.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	loader,
	Mesh,
	math,
	Sprite3d,
	Vector3d,
} from "melonjs";
import {
	AXIS_Z,
	CRACK_FILL,
	CRACK_LIFT,
	CRACK_TINT,
	DOME_MODEL,
	DOME_R,
	PANE_CRACKS_MAX,
	PANE_CRITICAL,
	PANE_PULSE_MAX,
	PANE_PULSE_MIN,
	PANE_PULSE_MS,
	PANE_WARN_LIFT,
	PANE_WARN_TINT,
	PLANET_R,
	PLANET_Z,
	RUMBLE_PANE_CRACK,
	RUMBLE_PANE_SHATTER,
	SHATTER_BURST_AREA,
	SHATTER_BURST_COUNT,
	SHATTER_BURST_LIFE,
	SHATTER_BURST_SPEED,
	SHATTER_BURSTS,
	SHATTER_FIRST_BURST,
	SHATTER_FLASH_INTENSITY,
	SHATTER_FLASH_MS,
	SHATTER_FLASH_RANGE,
	SHATTER_MS,
	SHATTER_TINT,
} from "../constants";
import type { BlastFx } from "../fx/blastFx";
import { playAt, rumble, SFX } from "../fx/sfx";
import {
	bridgeY,
	dot,
	normalize,
	onGlobe,
	tangentMatrixWorld,
} from "../lib/sphereMath";

/** scratch, so placing a decal allocates nothing @ignore */
const _bridged = new Vector3d(0, 0, 0);
const _at: [number, number, number] = [0, 0, 0];
const _sfxAt: [number, number, number] = [0, 0, 0];

/**
 * What the dome needs from the rest of the game.
 *
 * Deliberately five things and not "the controller": written out, it is
 * obvious how little the dome actually depends on, and anything added here
 * later has to be argued for.
 */
export interface DomeHost {
	/** the shared blast pool, for bursts and shock rings */
	readonly blast: BlastFx;
	/** true once the run has ended, so a late hit does not re-trigger it */
	readonly gameOver: boolean;
	/** kick the screen's channel split */
	pulseAberration(): void;
	/** the HUD only redraws when something tells it to */
	refreshHud(): void;
	/**
	 * End the run: raise the game-over flag AND stamp the screen.
	 *
	 * One call rather than two, because the dome has no business knowing the
	 * flag exists. It knows the glass broke; what that means for the run is
	 * the controller's to decide.
	 */
	endRun(): void;
}

export class Dome {
	private app: Application;
	private host: DomeHost;

	/**
	 * @param app - the application the decals are added to
	 * @param host - the five things the dome reaches back for
	 */
	constructor(app: Application, host: DomeHost) {
		this.app = app;
		this.host = host;
	}

	/**
	 * The shell's panes, as unit directions from the dome's centre.
	 *
	 * Recovered from the geometry at load by {@link GameController#initPanes},
	 * because the model has no per-pane nodes to address.
	 */
	panes: Vector3d[] = [];
	/** the crack decals, with the pane each belongs to */
	cracks: { decal: Sprite3d; pane: number }[] = [];
	/** the panes one blast from the end, lit red and breathing */
	warns: { decal: Mesh; pane: number }[] = [];
	/** how far through the warning breath, milliseconds */
	panePulseMs = 0;
	/** what is left of the breach sequence, real milliseconds */
	shatterMs = 0;
	/** how many of its blasts have gone */
	shatterBursts = 0;
	/** the shared crack texture, drawn on first use */
	crackTex: HTMLCanvasElement | undefined;
	/**
	 * Each pane's own triangles, in the dome's model space.
	 *
	 * Kept because a warning has to cover the WHOLE pane, and the only shape
	 * that does that exactly is the pane's own geometry.
	 */
	paneTris: Float32Array[] = [];
	/** how many blasts each pane has taken, never healed */
	paneCracks = new Uint8Array(0);
	/**
	 * How far each pane reaches from its middle to its furthest corner, in
	 * world units. Measured off the geometry in
	 * {@link GameController#initPanes}, because it is what says how big to
	 * draw a crack that fills a pane.
	 */
	paneReach = new Float32Array(0);
	/**
	 * How far each pane's own PLANE is from the centre of the globe.
	 *
	 * Not `DOME_R`. The dome's vertices sit on that sphere but a pane is a
	 * FLAT facet strung between them, so its middle is sunk below the sphere
	 * by the sagitta — 5.6 units on a pentagon and 9.3 on a hexagon, measured
	 * against a 573 unit shell. Anything laid at `DOME_R` therefore floats
	 * above the glass it is supposed to be lying on, which shows the moment
	 * the globe turns and the pane is seen edge on.
	 */
	paneDist = new Float32Array(0);
	/** the hexagonal shell around it: glass and frame */
	domeParts: Mesh[] = [];

	/**
	 * Work out where the dome's panes are, from the dome's own geometry.
	 *
	 * The model is ONE mesh with no per-pane nodes and no UVs, so there is
	 * nothing to address a pane by and nothing to paint one with. What it does
	 * have is flatness: each pane is a few coplanar triangles, so grouping the
	 * glass by face normal recovers the panes exactly as modelled. It comes
	 * out as 12 pentagons and 150 hexagons, which is a geodesic sphere and a
	 * good sign the grouping found the real thing rather than an artefact.
	 *
	 * Doing it this way rather than re-authoring the model keeps one mesh and
	 * one draw call, and it cannot drift from what is on screen, because it IS
	 * what is on screen.
	 *
	 * Each pane is kept as the unit direction from the dome's centre to its
	 * middle, which for a sphere is also its outward normal. That is all a
	 * lookup needs: the pane a point landed on is the one whose direction it
	 * is most aligned with.
	 */
	initPanes(): void {
		const data = loader.getGLTF(DOME_MODEL);
		if (!data) {
			throw new Error(`earthDefender: glTF "${DOME_MODEL}" was not preloaded`);
		}
		// the glass, which is the pane the player loses; the frame between
		// them is structure and takes no damage
		const glass = data.nodes.find((n) => (n.baseColorFactor?.[3] ?? 1) < 0.5);
		if (!glass) {
			throw new Error("earthDefender: the dome has no glass primitive");
		}
		const v = glass.vertices;
		const idx = glass.indices;
		const normals: Vector3d[] = [];
		const sums: Vector3d[] = [];
		const counts: number[] = [];
		// the triangles themselves, kept per pane: a warning has to cover the
		// WHOLE pane, and the only shape that does that exactly is the pane's
		// own geometry
		const tris: number[][] = [];
		for (let i = 0; i < idx.length; i += 3) {
			const a = idx[i] * 3;
			const b = idx[i + 1] * 3;
			const c = idx[i + 2] * 3;
			const ux = v[b] - v[a];
			const uy = v[b + 1] - v[a + 1];
			const uz = v[b + 2] - v[a + 2];
			const wx = v[c] - v[a];
			const wy = v[c + 1] - v[a + 1];
			const wz = v[c + 2] - v[a + 2];
			const nx = uy * wz - uz * wy;
			const ny = uz * wx - ux * wz;
			const nz = ux * wy - uy * wx;
			const len = Math.hypot(nx, ny, nz) || 1;
			const n = new Vector3d(nx / len, ny / len, nz / len);
			const mid = new Vector3d(
				(v[a] + v[b] + v[c]) / 3,
				(v[a + 1] + v[b + 1] + v[c + 1]) / 3,
				(v[a + 2] + v[b + 2] + v[c + 2]) / 3,
			);
			// same plane as one already seen? a pane's triangles share a
			// normal to well within this, and neighbouring panes on a sphere
			// this size are a long way outside it
			let found = -1;
			for (let k = 0; k < normals.length; k++) {
				if (dot(normals[k], n) > 0.999) {
					found = k;
					break;
				}
			}
			if (found < 0) {
				found = normals.length;
				normals.push(n);
				sums.push(new Vector3d(0, 0, 0));
				counts.push(0);
				tris.push([]);
			}
			tris[found].push(v[a], v[a + 1], v[a + 2]);
			tris[found].push(v[b], v[b + 1], v[b + 2]);
			tris[found].push(v[c], v[c + 1], v[c + 2]);
			sums[found].x += mid.x;
			sums[found].y += mid.y;
			sums[found].z += mid.z;
			counts[found] += 1;
		}
		// the direction to each pane's middle, which on a sphere is the
		// outward normal and is what a lookup compares against
		// Bridged into GAME space as they are built, which is the whole of two
		// bugs at once.
		//
		// These come off the dome's MODEL vertices, and the dome is drawn
		// `rightHanded`, so `Mesh` renders it through `diag(1, -1, -1)`. Left
		// in model space the list was the MIRROR of where the panes actually
		// are: `paneAt` compared a game-space bomb against model-space normals
		// and returned the pane on the opposite side of the globe, and the
		// crack was then laid at that opposite place. Hence a crack that
		// appeared nowhere near the bomb that caused it.
		this.panes = sums.map((sum, i) =>
			normalize(
				new Vector3d(
					sum.x / counts[i],
					-(sum.y / counts[i]),
					-(sum.z / counts[i]),
				),
			),
		);
		this.paneTris = tris.map((t) => new Float32Array(t));
		this.paneCracks = new Uint8Array(this.panes.length);

		// How big each pane actually is, measured rather than guessed: how far
		// it reaches from its own middle out to its furthest corner. A crack
		// is meant to FILL the pane it is on, and this is the only number that
		// says how big to draw it. Per pane and not one figure for the shell,
		// because the twelve pentagons are smaller than the hundred and fifty
		// hexagons and a single number would either leave them unfilled or
		// spill every hexagon's crack onto its neighbours.
		//
		// Scaled by the same `PLANET_R` the dome is drawn with, so the result
		// is in world units and can be handed straight to a decal's width.
		this.paneReach = new Float32Array(this.paneTris.length);
		this.paneDist = new Float32Array(this.paneTris.length);
		for (let i = 0; i < this.paneTris.length; i++) {
			const t = this.paneTris[i];
			const n = t.length / 3;
			let cx = 0;
			let cy = 0;
			let cz = 0;
			for (let k = 0; k < t.length; k += 3) {
				cx += t[k];
				cy += t[k + 1];
				cz += t[k + 2];
			}
			cx /= n;
			cy /= n;
			cz /= n;
			let reach = 0;
			for (let k = 0; k < t.length; k += 3) {
				reach = Math.max(
					reach,
					Math.hypot(t[k] - cx, t[k + 1] - cy, t[k + 2] - cz),
				);
			}
			this.paneReach[i] = reach * PLANET_R;
			// The centroid of a facet whose corners are all on the sphere is
			// the closest point of its plane to the centre, so its length IS
			// the plane's distance. Taken from the geometry rather than from
			// `DOME_R` and a trig identity, so it stays true if the model
			// changes.
			this.paneDist[i] = Math.hypot(cx, cy, cz) * PLANET_R;
		}
	}

	/**
	 * Which pane a point on the shell belongs to.
	 *
	 * The most-aligned pane direction, which is exact for a convex shell:
	 * every point on a pane is closer in angle to its own centre than to any
	 * neighbour's, so there is no boundary case to get wrong.
	 * @param q - a unit direction from the dome's centre
	 * @returns the pane index
	 */
	paneAt(q: Vector3d): number {
		let best = 0;
		let bestDot = -2;
		for (let i = 0; i < this.panes.length; i++) {
			const d = dot(this.panes[i], q);
			if (d > bestDot) {
				bestDot = d;
				best = i;
			}
		}
		return best;
	}

	/**
	 * Crack a pane, and end the run if that was its last.
	 *
	 * Cracks never heal, so the pane with the most on it is the one closest
	 * to ending the game, and it is visibly so. Spreading the damage is
	 * survivable; ignoring one pane is not.
	 * @param at - where on the shell the blast was, which is where the mark
	 * goes. The pane is what is COUNTED, but a crack drawn at the pane's
	 * CENTRE sits up to a pane radius from the bomb that caused it, which
	 * reads as the damage appearing somewhere else entirely.
	 * @param pane - which pane took it
	 */
	crackPane(at: Vector3d, pane: number): void {
		// Nothing damages the dome once the run is over. The saucer and its
		// bombs deliberately keep going — they are part of the sky rather than
		// part of the fight, and freezing them would read as the scene having
		// stopped — but a blast landing after the end must be spectacle only.
		//
		// Without this the raid already in the air went on cracking a dome
		// nobody was defending any more, drawing fresh cracks and red warning
		// panes over glass that `tickShatter` had already faded to nothing.
		// Worse, a fourth crack on some pane re-entered `beginShatter`, which
		// sets `shatterMs` again: the shattered dome faded back IN and came
		// apart a second time, with a second slow motion and a second
		// aberration pulse over the first. After a shield death, with the dome
		// still whole, that played an entire second ending.
		if (this.host.gameOver) {
			return;
		}
		if (this.paneCracks[pane] >= PANE_CRACKS_MAX) {
			return;
		}
		this.paneCracks[pane] += 1;
		// the glass answering the blast, from the pane that took it
		onGlobe(at, DOME_R, PLANET_Z, _sfxAt);
		playAt(SFX.paneCrack, _sfxAt[0], _sfxAt[1], _sfxAt[2]);
		rumble(RUMBLE_PANE_CRACK);
		this.addCrack(pane, this.paneCracks[pane]);
		if (this.paneCracks[pane] === PANE_CRITICAL) {
			// one blast from the end, and saying so
			this.warnPane(pane);
		}
		if (this.paneCracks[pane] >= PANE_CRACKS_MAX) {
			this.beginShatter(pane);
		}
	}

	/**
	 * Mark a pane as the one about to end the run.
	 *
	 * The whole pane lights rather than a tint on the cracks: the cracks are
	 * thin, and a thin thing pulsing is easy to miss against a shell that
	 * already has highlights moving over it. A pane lit edge to edge is
	 * unmistakable from across the globe, which is the point of a warning.
	 * @param pane - the pane that just went critical
	 */
	warnPane(pane: number): void {
		// The PANE ITSELF, built from its own triangles, not a disc laid over
		// it. A disc is round and a pane is a hexagon, so a disc big enough to
		// reach the corners spills onto the neighbours and one that does not
		// reads as a blob in the middle. The geometry is already to hand from
		// `initPanes`, and using it means the warning lights exactly the shape
		// the player is being warned about, edge for edge.
		const tris = this.paneTris[pane];
		const count = tris.length / 3;
		const indices = new Uint16Array(count);
		for (let i = 0; i < count; i++) {
			indices[i] = i;
		}
		const glow = new Mesh(0, 0, {
			vertices: tris,
			uvs: new Float32Array(count * 2),
			indices,
			normalize: false,
			// The same handedness the dome is built with, and the same scale
			// nudged outward by `PANE_WARN_LIFT`, so it lands ON its pane
			// rather than near it and a hair clear of the glass. A vertex at
			// model radius `r` renders at `r * scale`, and the dome's own
			// vertices put `r * PLANET_R` at `DOME_R`, so multiplying the
			// scale by `1 + lift / DOME_R` adds exactly `lift` world units.
			scale: PLANET_R * (1 + PANE_WARN_LIFT / DOME_R),
			rightHanded: true,
			lit: false,
			// Culled and depth-tested like the glass it is lying on. Both were
			// off at first, to stop the pane tearing against a surface it
			// coincided with exactly — which worked, and cost far more than it
			// bought: with no depth test the planet stopped hiding it, so a
			// warned pane on the FAR side of the globe showed through the
			// world, and a near one drew over the craft and over any rock in
			// front of it. The lift above is what stops the tearing now, which
			// leaves the test free to do its job.
			cullBackFaces: true,
			transparent: true,
		});
		glow.blendMode = "additive";
		glow.tint.setColor(
			PANE_WARN_TINT[0] * 255,
			PANE_WARN_TINT[1] * 255,
			PANE_WARN_TINT[2] * 255,
			1,
		);
		// added before placing: `addChild`'s second argument is the DEPTH and
		// it overwrites `pos.z`
		this.app?.world.addChild(glow, PLANET_Z);
		glow.setPosition(0, 0, PLANET_Z);
		this.warns.push({ decal: glow, pane });
	}

	/**
	 * Breathe the warning panes.
	 *
	 * A sine rather than a switch, and that distinction is the whole reading
	 * of it: the bomb lamp blinks because it is a countdown and wants to be
	 * read as urgency, while this is a standing condition and wants to be read
	 * as a wound. Hard edges here would say "about to go off", which is the
	 * bomb's job.
	 * @param dt - milliseconds since the last frame
	 */
	tickPanes(dt: number): void {
		if (this.warns.length === 0) {
			return;
		}
		this.panePulseMs = (this.panePulseMs + dt) % PANE_PULSE_MS;
		const phase = (this.panePulseMs / PANE_PULSE_MS) * Math.PI * 2;
		const k =
			PANE_PULSE_MIN +
			(PANE_PULSE_MAX - PANE_PULSE_MIN) * (0.5 - 0.5 * Math.cos(phase));
		for (const { decal } of this.warns) {
			decal.setOpacity(k);
		}
	}

	/**
	 * The dome goes.
	 *
	 * Not a model swap: the shell is one mesh with no shards to throw, so the
	 * break is told rather than simulated. Blasts walk round the whole shell
	 * while the glass fades out from under them, which reads as the thing
	 * coming apart everywhere at once, and the slow motion gives it the weight
	 * a single frame of it would not have.
	 * @param pane - the pane that finally went
	 */
	beginShatter(pane: number): void {
		this.host.endRun();
		// same reason as in `defuse`: the HUD only redraws when something
		// tells it to, and nothing else in this path does, so the breach
		// would have ended the run with the multiplier still showing
		this.host.refreshHud();
		this.shatterMs = SHATTER_MS;
		this.host.pulseAberration();
		// the one that did it, first and biggest
		onGlobe(this.panes[pane], DOME_R, PLANET_Z, _at);
		playAt(SFX.paneShatter, _at[0], _at[1], _at[2]);
		rumble(RUMBLE_PANE_SHATTER);
		this.host.blast.burst(
			_at[0],
			_at[1],
			_at[2],
			SHATTER_TINT,
			SHATTER_FIRST_BURST,
			this.panes[pane],
			SHATTER_BURST_SPEED,
			SHATTER_BURST_LIFE,
			SHATTER_BURST_AREA,
		);
		this.host.blast.flash(
			_at[0],
			_at[1],
			_at[2],
			SHATTER_TINT,
			SHATTER_FLASH_INTENSITY * 2,
			SHATTER_FLASH_RANGE,
			SHATTER_FLASH_MS,
		);
	}

	/**
	 * Carry the breach along.
	 *
	 * Driven by the REAL frame delta rather than the slowed one, so the
	 * sequence lasts the wall-clock time it says it does while everything it
	 * is watching hangs.
	 * @param dt - real milliseconds since the last frame
	 */
	tickShatter(dt: number): void {
		if (this.shatterMs <= 0) {
			return;
		}
		const before = this.shatterMs;
		this.shatterMs -= dt;
		const total = SHATTER_MS;
		// how many blasts should have gone by now, against how many have
		const wanted = Math.floor(
			((total - Math.max(0, this.shatterMs)) / total) * SHATTER_BURSTS,
		);
		while (this.shatterBursts < wanted) {
			this.shatterBursts += 1;
			// anywhere on the shell: the whole thing is failing, not one side
			const q = this.panes[math.random(0, this.panes.length)];
			onGlobe(q, DOME_R, PLANET_Z, _at);
			this.host.blast.burst(
				_at[0],
				_at[1],
				_at[2],
				SHATTER_TINT,
				SHATTER_BURST_COUNT,
				q,
				SHATTER_BURST_SPEED,
				SHATTER_BURST_LIFE,
				SHATTER_BURST_AREA,
			);
			if (this.shatterBursts % 3 === 0) {
				this.host.blast.flash(
					_at[0],
					_at[1],
					_at[2],
					SHATTER_TINT,
					SHATTER_FLASH_INTENSITY,
					SHATTER_FLASH_RANGE,
					SHATTER_FLASH_MS,
				);
			}
		}
		// and the glass going with them
		const left = Math.max(0, this.shatterMs) / total;
		for (const part of this.domeParts) {
			part.setOpacity(left);
		}
		for (const { decal } of this.cracks) {
			decal.setOpacity(left);
		}
		for (const { decal } of this.warns) {
			decal.setOpacity(left);
		}
		if (before > 0 && this.shatterMs <= 0) {
			// gone, and the HUD's GAME OVER is what is left on screen
			for (const part of this.domeParts) {
				part.setOpacity(0);
			}
		}
	}

	/**
	 * Lay a crack on a pane.
	 *
	 * A quad lying ON the glass rather than a billboard: a crack is in the
	 * surface, so it has to turn with the pane as the globe rolls under the
	 * camera. Oriented by the same bridged normal everything else on the
	 * shell uses.
	 *
	 * Each crack on a pane is laid at its own angle, so a pane taking its
	 * second and third reads as accumulating damage rather than as the first
	 * one getting brighter.
	 * @param at - the point on the shell the blast happened at
	 * @param pane - which pane it belongs to, for the record
	 * @param level - how many cracks that pane now has, `1` upward
	 */
	addCrack(pane: number, level: number): void {
		// THE PANE'S MIDDLE, not the blast.
		//
		// It used to be laid where the bomb went off, and a bomb lands
		// anywhere on a pane. A decal sized to fill the whole pane and
		// centred near one of its edges spills across the two or three
		// neighbours behind it, which is what a crack straddling several
		// panes was. Centring on the pane is also what lets the quad lie
		// FLAT: the frame below is built from this direction, and the blast
		// point's own direction is tilted off the facet's plane.
		const q = this.panes[pane];
		const decal = new Sprite3d(0, 0, {
			image: this.crackTexture(),
			// Sized to THIS pane, so the fracture reaches the frame on every
			// side instead of sitting as a scorch mark in the middle of it.
			// `CRACK_FILL` is a multiple of the pane's corner reach, so 2
			// spans corner to corner exactly and anything over that lets the
			// cracks run into the frame.
			width: this.paneReach[pane] * CRACK_FILL,
			height: this.paneReach[pane] * CRACK_FILL,
			// flat ON the pane, so `billboard` off and oriented by hand
			billboard: false,
			transparent: true,
			alphaCutoff: 0,
		});
		decal.blendMode = "additive";
		decal.tint.setColor(
			CRACK_TINT[0] * 255,
			CRACK_TINT[1] * 255,
			CRACK_TINT[2] * 255,
			1,
		);
		// Added to the world BEFORE it is placed, and that order is the whole
		// of it: `addChild`'s second argument is the DEPTH, and it overwrites
		// `pos.z`. Placed first, the decal was dragged from the shell back to
		// the planet's centre depth, which is why a crack sat on the planet
		// rather than on the pane, 170 units nearer the middle than the bomb
		// that caused it. The bombs only avoid this because `placeBomb` runs
		// after their own `addChild`.
		this.app?.world.addChild(decal, PLANET_Z);
		onGlobe(q, this.paneDist[pane] + CRACK_LIFT, PLANET_Z, _at);
		decal.setPosition(_at[0], _at[1], _at[2]);
		// LYING on the pane, so the tangent frame rather than the standing
		// one: `surfaceMatrixWorld` puts the normal on local Y, which is what
		// a bomb or a rock wants, but a quad lies in its local XY plane and
		// faces local +Z, so that frame stands it on edge in the glass. This
		// one spans the quad with two tangents and faces it along the normal.
		//
		// Bridged first, as everything on this shell is: `Sprite3d` is
		// right-handed, so `Mesh` composes `diag(1, -1, -1) * transform` and
		// an un-bridged frame comes out reflected.
		bridgeY(q, true, _bridged);
		tangentMatrixWorld(_bridged, decal.currentTransform);
		// Spun in its OWN plane, about the axis it faces along, so each crack
		// on a pane lands at its own angle and three read as three fractures
		// rather than one getting brighter. Tied to the maximum rather than a
		// hardcoded third, or two levels would coincide the moment that
		// maximum changed.
		decal.currentTransform.rotate(
			(level / PANE_CRACKS_MAX) * Math.PI * 2,
			AXIS_Z,
		);
		this.cracks.push({ decal, pane });
	}

	/**
	 * The crack texture, drawn once and shared.
	 *
	 * Drawn rather than loaded: it is a few strokes, and generating it keeps
	 * the example to the assets it actually needs.
	 * @returns the canvas, cached after the first call
	 */
	crackTexture(): HTMLCanvasElement {
		if (this.crackTex !== undefined) {
			return this.crackTex;
		}
		const size = 128;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		this.crackTex = canvas;
		if (ctx === null) {
			return canvas;
		}
		const mid = size / 2;
		ctx.lineCap = "round";
		// a few forks out of the middle, each splitting once
		for (let arm = 0; arm < 5; arm++) {
			const base = (arm / 5) * Math.PI * 2 + Math.random() * 0.6;
			let x = mid;
			let y = mid;
			let angle = base;
			ctx.strokeStyle = "rgba(255,255,255,0.95)";
			ctx.lineWidth = 3.2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			for (let seg = 0; seg < 4; seg++) {
				angle += (Math.random() - 0.5) * 0.8;
				const step = size * 0.11;
				x += Math.cos(angle) * step;
				y += Math.sin(angle) * step;
				ctx.lineTo(x, y);
			}
			ctx.stroke();
			// one branch off it, thinner
			ctx.strokeStyle = "rgba(255,255,255,0.6)";
			ctx.lineWidth = 1.8;
			ctx.beginPath();
			ctx.moveTo(x, y);
			const off = angle + (Math.random() - 0.5) * 1.6;
			ctx.lineTo(
				x + Math.cos(off) * size * 0.12,
				y + Math.sin(off) * size * 0.12,
			);
			ctx.stroke();
		}
		return canvas;
	}
}
