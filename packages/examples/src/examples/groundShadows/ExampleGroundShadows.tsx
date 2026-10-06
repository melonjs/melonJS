/**
 * melonJS — ground shadows, every knob on one floor.
 *
 * A turntable rather than a game: a checkered studio floor with a slope cut
 * into its right-hand side, and a row of props each wired to ONE shadow
 * setting so the difference between them is the only thing moving. The sun
 * orbits, so every blob that takes its direction from a light sweeps with it,
 * and the one that does not visibly stays put.
 *
 * What it proves, station by station:
 *
 * 1. `castGroundShadow` — the plain contact blob, nothing else set.
 * 2. `shadowOpacity` — the same prop twice, 0.12 against 0.85.
 * 3. `shadowScale` — the same prop twice, 0.6 against 2.0.
 * 4. `shadowStretch` + `shadowOffset` — pulled along the light and slid out
 *    from the caster's feet, with the stretch driven live off the sun's
 *    elevation: a low sun smears, a high one does not.
 * 5. `shadowGroundY` — a bird that climbs, whose blob shrinks and fades as
 *    the gap between it and the named floor opens up.
 * 6. `shadowDirectionX`/`shadowDirectionZ` — a hand-set direction that
 *    ignores the sun entirely. The control for stations 1-5.
 * 7. `InstancedMesh` — sixty ferns, sixty blobs, one extra draw call.
 * 8. `shadowGroundNormal` — props standing on the slope, their blobs lying
 *    IN it rather than hovering through it.
 * 9. `InstancedMesh` + `shadowGroundNormal` — one tilted plane for a whole
 *    set, which is the shape the instanced path supports: one set per facet.
 *
 * The "Shadows" checkbox turns `castGroundShadow` off across the scene, which
 * is the only honest way to see what the blobs were contributing.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	InstancedMesh,
	input,
	Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	type Pointer,
	plugin,
	Renderable,
	Sprite3d,
	state,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// The props are Jungle Rabbit's: single merged primitives carrying their own
// palette strip, which is exactly what a scatter wants and saves this example
// having to agree with a palette it does not own.
const base = `${import.meta.env.BASE_URL}assets/jungleRabbit/`;

/** render-space Y of the level floor. Y is DOWN, so the floor is the ceiling of Y. */
const GROUND_Y = 0;

/** pixels per glTF unit for every prop in the scene */
const MODEL_SCALE = 80;

/** the floor's extent */
const X_MIN = -1900;
const X_MAX = 1900;
const Z_MIN = -550;
const Z_MAX = 1700;
/** one floor vertex every this many pixels; 50 puts one exactly on the break */
const FLOOR_STEP = 50;

/** where the level floor stops and the slope starts */
const RAMP_X0 = 800;
/** rise over run of the slope — 0.55 is about 29 degrees */
const RAMP_GRAD = 0.55;

/**
 * Render-space Y of the ground at a given x: level up to the break, then
 * climbing. Up is NEGATIVE y, so climbing subtracts.
 * @param x - world x
 * @returns world y of the ground surface there
 */
const groundAt = (x: number) => GROUND_Y - Math.max(0, x - RAMP_X0) * RAMP_GRAD;

/**
 * The slope's UP normal, in RENDER space — which is the space
 * `shadowGroundNormal` is read in, and where up is `(0, -1, 0)`.
 *
 * The surface is `y = -grad * x`, so a tangent along x is `(1, -grad, 0)` and
 * the perpendicular with a negative (upward) y component is `(-grad, -1, 0)`.
 * At `grad = 0` that is world up, which is the level case.
 */
const RAMP_LEN = Math.hypot(RAMP_GRAD, 1);
const RAMP_NORMAL: [number, number, number] = [
	-RAMP_GRAD / RAMP_LEN,
	-1 / RAMP_LEN,
	0,
];

/**
 * Where the slope's plane crosses x = 0, extrapolated back.
 *
 * An `InstancedMesh` gets ONE shadow plane for the whole set, and that plane
 * passes through the set's own origin in X and Z at `shadowGroundY`. The set
 * sits at the world origin, so the value it needs is the plane's height THERE,
 * not the height under any particular fern.
 */
const RAMP_INTERCEPT = GROUND_Y + RAMP_X0 * RAMP_GRAD;

/** how far out the sun marker orbits */
const SUN_RADIUS = 4600;
/** radians per millisecond — a full turn in about 24 seconds */
const SUN_SPEED = 0.00026;

const AXIS_Y = new Vector3d(0, 1, 0);

/* ------------------------------------------------------------------ *\
   Baked textures. Nothing here is loaded: the floor, the labels and
   the sun are all drawn once into a canvas at boot.
\* ------------------------------------------------------------------ */

/** A dusk sky, drawn screen-fixed behind the scene. */
function bakeSky() {
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 512;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 512);
		g.addColorStop(0, "#0e1d33");
		g.addColorStop(0.5, "#3f6286");
		g.addColorStop(0.82, "#9fb4c6");
		g.addColorStop(1, "#dcd2c0");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 1, 512);
	}
	return c;
}

class SkyBackdrop extends Renderable {
	private sky = bakeSky();

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true; // screen-space — exempt from the perspective camera
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.drawImage(
			this.sky,
			0,
			0,
			1,
			512,
			0,
			0,
			renderer.width,
			renderer.height,
		);
	}
}

/**
 * A pale checkerboard. The point of a check rather than a flat wash is that a
 * soft dark ellipse on a flat colour is hard to read as lying ON something,
 * and the squares also make the slope's foreshortening visible.
 * @returns a tiling 2x2 check
 */
function bakeChecker() {
	const CELL = 128;
	const c = document.createElement("canvas");
	c.width = CELL * 2;
	c.height = CELL * 2;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#cfcabd";
		ctx.fillRect(0, 0, CELL * 2, CELL * 2);
		ctx.fillStyle = "#b9b3a4";
		ctx.fillRect(0, 0, CELL, CELL);
		ctx.fillRect(CELL, CELL, CELL, CELL);
		// a hairline grid on top, so a single cell still reads at a grazing angle
		ctx.strokeStyle = "rgba(255,255,255,0.35)";
		ctx.lineWidth = 2;
		ctx.strokeRect(0, 0, CELL, CELL);
		ctx.strokeRect(CELL, CELL, CELL, CELL);
	}
	return c;
}
/** world pixels covered by one full repeat of the check */
const CHECK_SPAN = 512;

/**
 * A caption, baked at twice its drawn size so it stays crisp when the camera
 * comes in close.
 * @param title - the setting being shown
 * @param detail - what to look at
 * @returns the label canvas
 */
function bakeLabel(title: string, detail: string) {
	const W = 1024;
	const H = 256;
	const c = document.createElement("canvas");
	c.width = W;
	c.height = H;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "rgba(12, 18, 28, 0.74)";
		ctx.beginPath();
		ctx.roundRect(8, 8, W - 16, H - 16, 28);
		ctx.fill();
		ctx.strokeStyle = "rgba(255, 228, 160, 0.55)";
		ctx.lineWidth = 4;
		ctx.stroke();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#ffe4a0";
		ctx.font = "600 62px ui-monospace, monospace";
		ctx.fillText(title, W / 2, 92, W - 72);
		ctx.fillStyle = "#e8eef5";
		ctx.font = "400 44px system-ui, sans-serif";
		ctx.fillText(detail, W / 2, 168, W - 72);
	}
	return c;
}

/**
 * The sun itself: a radial falloff, so the marker reads as a light source
 * rather than a white disc pasted on the sky.
 * @returns the glow canvas
 */
function bakeGlow() {
	const S = 256;
	const c = document.createElement("canvas");
	c.width = S;
	c.height = S;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
		g.addColorStop(0, "rgba(255, 252, 232, 1)");
		g.addColorStop(0.28, "rgba(255, 228, 150, 0.92)");
		g.addColorStop(0.62, "rgba(255, 176, 72, 0.34)");
		g.addColorStop(1, "rgba(255, 150, 60, 0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, S, S);
	}
	return c;
}

/* ------------------------------------------------------------------ *\
   Geometry
\* ------------------------------------------------------------------ */

/**
 * Raw geometry plus the material image for one preloaded prop.
 *
 * Every asset here is a single merged primitive with an identity node
 * transform, so `nodes[0]` is the whole model and its vertices can be used
 * without folding a node matrix in first. `image` is the base-color texture
 * the glTF carried, which is what lets the example stay out of the business of
 * owning a palette.
 * @param name - the preloaded asset name
 * @returns settings ready to spread into a `Mesh` or an `InstancedMesh`
 */
const propGeometry = (name: string) => {
	const node = loader.getGLTF(name)?.nodes[0];
	if (node === undefined) {
		throw new Error(`Ground shadows: "${name}" did not preload.`);
	}
	return {
		vertices: node.vertices,
		uvs: node.uvs,
		normals: node.normals,
		indices: node.indices,
		// Spread conditionally, not passed as possibly-undefined: under
		// `exactOptionalPropertyTypes` an explicit `undefined` is not the same
		// as leaving the key out, and a material with no base-color texture
		// leaves `image` null and `textureFilter` unset.
		...(node.image !== null ? { texture: node.image } : {}),
		...(node.textureFilter !== undefined
			? { textureFilter: node.textureFilter }
			: {}),
	};
};

/**
 * The studio floor: one mesh, level to `RAMP_X0` and climbing after it.
 *
 * Authored Y-UP like any other mesh geometry — the mesh bridge negates y on
 * the way in — so the slope's vertices rise with a POSITIVE local y, and its
 * authored normal is `(-grad, 1, 0)`. Negated, that is `RAMP_NORMAL`, which is
 * the value the props on it hand to `shadowGroundNormal`: the floor and the
 * blobs lying on it are then guaranteed to be talking about the same plane.
 * @param checker - the tiling floor texture
 * @returns the floor mesh
 */
const createFloor = (checker: HTMLCanvasElement) => {
	const nx = Math.round((X_MAX - X_MIN) / FLOOR_STEP) + 1;
	const nz = Math.round((Z_MAX - Z_MIN) / FLOOR_STEP) + 1;
	const verts = new Float32Array(nx * nz * 3);
	const uvs = new Float32Array(nx * nz * 2);
	const norms = new Float32Array(nx * nz * 3);
	// 16 bits tops out at 65 535; this grid is 69 x 51, so the indices fit,
	// but the assertion is cheap and the grid is a constant away from not.
	const indices = new Uint32Array((nx - 1) * (nz - 1) * 6);

	let v = 0;
	let t = 0;
	for (let iz = 0; iz < nz; iz++) {
		const z = Z_MIN + iz * FLOOR_STEP;
		for (let ix = 0; ix < nx; ix++) {
			const x = X_MIN + ix * FLOOR_STEP;
			// authored up, so the slope's height is positive
			const up = GROUND_Y - groundAt(x);
			verts[v] = x;
			verts[v + 1] = up;
			verts[v + 2] = z;
			// the surface is y = f(x), constant in z, so the normal lies in XY
			const grad = x > RAMP_X0 ? RAMP_GRAD : 0;
			const len = Math.hypot(grad, 1);
			norms[v] = -grad / len;
			norms[v + 1] = 1 / len;
			norms[v + 2] = 0;
			v += 3;
			uvs[t] = x / CHECK_SPAN;
			uvs[t + 1] = z / CHECK_SPAN;
			t += 2;
		}
	}

	let i = 0;
	for (let iz = 0; iz < nz - 1; iz++) {
		for (let ix = 0; ix < nx - 1; ix++) {
			const a = iz * nx + ix;
			const b = a + 1;
			const c = a + nx;
			const d = c + 1;
			indices[i] = a;
			indices[i + 1] = c;
			indices[i + 2] = b;
			indices[i + 3] = b;
			indices[i + 4] = c;
			indices[i + 5] = d;
			i += 6;
		}
	}

	return new Mesh(0, GROUND_Y, {
		vertices: verts,
		uvs,
		normals: norms,
		indices,
		texture: checker,
		// raw world coordinates: no unit-cube fit, no rescale
		normalize: false,
		scale: 1,
		width: X_MAX - X_MIN,
		height: Z_MAX - Z_MIN,
		// the UVs run well past 1, and without this the check clamps to its
		// edge texels and the whole floor reads as one flat wash
		textureRepeat: "repeat",
		textureFilter: "linear",
		cullBackFaces: false,
		// lit, so the floor itself darkens as the sun goes down: the blobs are
		// not the only thing in the scene that knows where the light is
		lit: true,
		// A flat plane lying on the floor IS the floor. Shadowing it with a
		// blob of its own puts a dark ellipse under the whole scene.
		castGroundShadow: false,
	});
};

/* ------------------------------------------------------------------ *\
   The sun
\* ------------------------------------------------------------------ */

/**
 * The sun's TRAVEL direction, which is the way its shadows go.
 *
 * Render space is Y-down, so a sun above the scene travels with a POSITIVE y.
 * Azimuth turns the horizontal part; elevation tips it over. At 90 degrees the
 * light is straight down and the horizontal part vanishes, which is why the
 * stretch and offset stations go quiet at the top of the slider.
 * @param out - vector to write
 * @param azimuth - radians around Y
 * @param elevation - radians above the horizon
 * @returns `out`, normalized
 */
const sunDirection = (out: Vector3d, azimuth: number, elevation: number) => {
	const horizontal = Math.cos(elevation);
	return out
		.set(
			horizontal * Math.sin(azimuth),
			Math.sin(elevation),
			horizontal * Math.cos(azimuth),
		)
		.normalize();
};

/* ------------------------------------------------------------------ *\
   The scene
\* ------------------------------------------------------------------ */

const createGame = async () => {
	let app: Application;
	try {
		// 1920 x 1080 and `scale: "auto"`: the whole point of the example is
		// reading a soft edge against a check, so it is authored at a size
		// where that edge has pixels to be soft in.
		app = new Application(1920, 1080, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			cameraClass: Camera3dClass,
			antiAlias: true,
		});
		await app.init();
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: no GPU renderer is available.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	let torndown = false;
	let pointerCleanup: (() => void) | null = null;
	let domCleanup: (() => void) | null = null;

	const setupScene = () => {
		if (torndown) {
			return;
		}
		const world = app.world;

		// The sky is a screen-space backdrop, so it has to be drawn BEFORE the
		// meshes. Under `Camera3d` the world sorts on depth and this camera
		// looks along +Z, so "behind everything" is the LARGEST depth.
		world.addChild(new SkyBackdrop(), 100000);

		/* -- lights ------------------------------------------------------- */

		// The sun every station but #6 takes its direction from. One light,
		// shared: `shadowLight` is read every draw, so moving this vector
		// moves every blob that points at it.
		const sun = new Light3d({
			type: "directional",
			direction: [0, 1, 0],
			color: "#fff3d6",
			intensity: 1.25,
		});
		world.addChild(sun);
		// a cool fill, so the unlit sides are not black and the blobs stay the
		// darkest thing on screen
		world.addChild(
			new Light3d({ type: "ambient", color: "#9db4cf", intensity: 0.52 }),
		);

		// where the light is COMING FROM, which is back along its travel
		const sunMarker = new Sprite3d(0, 0, {
			image: bakeGlow(),
			width: 560,
			height: 560,
			billboard: "spherical",
			lit: false,
			transparent: true,
			// nothing in the scene should be able to slice the sun along a
			// hard straight line, and it has no surface to be occluded on
			depthTest: false,
			castGroundShadow: false,
		});
		world.addChild(sunMarker, -100);

		/* -- the floor ---------------------------------------------------- */

		world.addChild(createFloor(bakeChecker()), 0);

		/* -- stations ----------------------------------------------------- */

		// Every caster collected here, so the "Shadows" checkbox has one list
		// to walk and nothing can be left out of it by accident.
		const casters: (Mesh | InstancedMesh)[] = [];

		/**
		 * One prop, standing on the ground at (x, z).
		 * @param model - preloaded asset name
		 * @param x - world x
		 * @param z - world z
		 * @param scale - pixels per glTF unit
		 * @param shadow - the shadow settings this station is demonstrating
		 * @returns the mesh, already added to the world
		 */
		const station = (
			model: string,
			x: number,
			z: number,
			scale: number,
			shadow: Record<string, unknown>,
		) => {
			const ground = groundAt(x);
			const mesh = new Mesh(x, ground, {
				...propGeometry(model),
				normalize: false,
				scale,
				width: 120,
				height: 200,
				cullBackFaces: false,
				lit: true,
				castGroundShadow: true,
				// Where the floor IS. Left unset the blob falls back to the
				// caster's own base at full strength, which is right for a
				// thing that never leaves the ground and wrong for everything
				// else — and `shadowOffset` is only honoured once the game has
				// named a plane to slide along.
				shadowGroundY: ground,
				...shadow,
			});
			// `addChild(child, z)`, not a `depth` write afterwards: the second
			// argument IS the child's z, and it overwrites whatever `pos.z`
			// already held.
			world.addChild(mesh, z);
			casters.push(mesh);
			return mesh;
		};

		/**
		 * The caption above a station. Placed by HEIGHT ABOVE THE GROUND
		 * rather than by world y, so a station on the slope needs no second
		 * set of hand-picked numbers.
		 * @param title - the setting
		 * @param detail - what to watch
		 * @param x - world x
		 * @param z - world z
		 * @param height - pixels above the ground at that x
		 */
		const caption = (
			title: string,
			detail: string,
			x: number,
			z: number,
			height: number,
		) => {
			const label = new Sprite3d(x, groundAt(x) - height, {
				image: bakeLabel(title, detail),
				width: 640,
				height: 160,
				billboard: "spherical",
				lit: false,
				transparent: true,
				// a caption has no ground to make contact with, and nothing
				// should be able to cut it in half
				depthTest: false,
				castGroundShadow: false,
			});
			world.addChild(label, z);
		};

		// Two rows well apart in Z, so neighbouring captions separate on
		// screen instead of stacking into one unreadable pile.
		const ROW_A = -200;
		const ROW_B = 900;

		/* 1 — the plain contact blob. */
		station("palm", -1600, ROW_A, MODEL_SCALE, { shadowLight: sun });
		caption("castGroundShadow", "the contact blob", -1600, ROW_A, 400);

		/* 2 — opacity, the same prop twice. */
		station("bigleaf", -1150, ROW_A, MODEL_SCALE * 1.2, {
			shadowLight: sun,
			shadowOpacity: 0.12,
		});
		station("bigleaf", -800, ROW_A, MODEL_SCALE * 1.2, {
			shadowLight: sun,
			shadowOpacity: 0.85,
		});
		caption("shadowOpacity", "0.12  vs  0.85", -975, ROW_A, 760);

		/* 3 — footprint, independent of the caster. */
		station("palm", -330, ROW_A, MODEL_SCALE, {
			shadowLight: sun,
			shadowScale: 0.5,
		});
		station("palm", 60, ROW_A, MODEL_SCALE, {
			shadowLight: sun,
			shadowScale: 2,
		});
		caption("shadowScale", "0.5  vs  2.0", -135, ROW_A, 400);

		/* 4 — pulled and slid along the light. The stretch is driven off the
		   sun's elevation below, which is the whole reason the pair exists:
		   a low sun smears, a high one does not. */
		const smear = station("palm", 560, ROW_A, MODEL_SCALE, {
			shadowLight: sun,
			shadowStretch: 2.4,
			shadowOffset: 0.9,
			shadowOpacity: 0.5,
		});
		caption("shadowStretch + shadowOffset", "follows the sun", 560, ROW_A, 760);

		/* 5 — the height fade. `shadowGroundY` is what makes it possible to
		   be above the floor at all: without a named plane the blob rides the
		   caster's own base and never leaves it. */
		const flier = station("carrot", -1500, ROW_B, MODEL_SCALE * 1.8, {
			shadowLight: sun,
			shadowOpacity: 0.6,
		});
		caption("shadowGroundY", "fades as it climbs", -1500, ROW_B, 1000);

		/* 6 — the control. A hand-set direction, no `shadowLight`, so this one
		   blob stays put while every other one sweeps. */
		station("rock", -1230, ROW_B - 260, MODEL_SCALE * 1.4, {
			shadowLight: sun,
		});
		station("rock", -600, ROW_B - 310, MODEL_SCALE * 1.2, { shadowLight: sun });
		station("log", -950, ROW_B, MODEL_SCALE * 1.5, {
			shadowDirectionX: 1,
			shadowDirectionZ: 0.35,
			shadowStretch: 2,
			shadowOffset: 0.8,
		});
		caption("shadowDirectionX / Z", "fixed, ignores the sun", -950, ROW_B, 170);

		/* 7 — a scatter. Seventy ferns, one draw call, and one more for the
		   seventy blobs: the shadow quad is shared and the instance buffer is
		   the same one the meshes are drawn from. */
		const placement = new Matrix3d();
		const scatter = (
			model: string,
			count: number,
			xLo: number,
			xHi: number,
			zLo: number,
			zHi: number,
			scale: number,
			shadow: Record<string, unknown>,
		) => {
			const mesh = new InstancedMesh(0, GROUND_Y, {
				...propGeometry(model),
				normalize: false,
				scale,
				width: 120,
				height: 200,
				cullBackFaces: false,
				lit: true,
				instanceCount: count,
				castGroundShadow: true,
				...shadow,
			});
			world.addChild(mesh, 0);
			casters.push(mesh);
			for (let i = 0; i < count; i++) {
				const x = math.randomFloat(xLo, xHi);
				const z = math.randomFloat(zLo, zHi);
				// instance transforms are MODEL units relative to the set's
				// origin, and authored y-up, so a render-space height below
				// the origin is a negative local y
				placement
					.identity()
					.translate(x / scale, -(groundAt(x) - GROUND_Y) / scale, z / scale)
					// each plant faces its own way, so one model does not read
					// as one plant copied sixty times
					.rotate(math.randomFloat(0, Math.PI * 2), AXIS_Y);
				const jitter = math.randomFloat(0.8, 1.2);
				placement.scale(jitter, jitter, jitter);
				mesh.setInstance(i, placement);
			}
			return mesh;
		};

		const flat = scatter("fern", 70, -420, 460, 600, 1340, MODEL_SCALE, {
			shadowLight: sun,
			shadowGroundY: GROUND_Y,
			shadowOpacity: 0.55,
			shadowOffset: 0.7,
		});
		caption("InstancedMesh", "70 blobs, one extra call", 20, 1520, 420);

		/* 8 — the slope. Each prop stands on it, so each blob's plane is the
		   facet under that prop: `shadowGroundY` says where it is, and
		   `shadowGroundNormal` says which way it faces. */
		for (const x of [1120, 1430, 1740]) {
			station("palm", x, ROW_A, MODEL_SCALE, {
				shadowLight: sun,
				shadowGroundNormal: RAMP_NORMAL,
				shadowOffset: 0.8,
				shadowStretch: 1.6,
			});
		}
		caption("shadowGroundNormal", "blobs lie IN the slope", 1430, ROW_A, 760);

		/* 9 — one tilted plane for a whole set, which is the shape the
		   instanced path supports: the plane passes through the SET's origin,
		   so what it wants is the intercept at x = 0, not the height under any
		   one fern. Curved ground is one set per facet. */
		const sloped = scatter("fern", 45, 1010, 1840, 600, 1340, MODEL_SCALE, {
			shadowLight: sun,
			shadowGroundY: RAMP_INTERCEPT,
			shadowGroundNormal: RAMP_NORMAL,
			shadowOpacity: 0.55,
			shadowOffset: 0.7,
		});
		caption("InstancedMesh + normal", "one plane for the set", 1420, 1520, 420);

		/* -- camera ------------------------------------------------------- */

		const camera = app.viewport as InstanceType<typeof Camera3dClass>;
		// the scene runs to about 2 400 px across its diagonal and the camera
		// pulls back past 4 000, so the far plane has to clear both
		camera.setClipPlanes(20, 24000);

		const CENTRE_X = 0;
		const CENTRE_Z = 520;
		// Looking back down the row from the far side, which is the view that
		// puts the slope and both scatters broadside to the camera: their blobs
		// are the widest thing on screen rather than the most foreshortened.
		let yaw = Math.PI + 0.18;
		let tilt = 0.42; // radians above the floor — low enough to see under things
		let distance = 3250;
		const clamp = (v: number, lo: number, hi: number) =>
			Math.max(lo, Math.min(hi, v));

		const updateCam = () => {
			distance = clamp(distance, 1400, 9000);
			tilt = clamp(tilt, 0.12, 1.35);
			const flat = Math.cos(tilt) * distance;
			// up is -Y in render space
			camera.pos.set(
				CENTRE_X + Math.sin(yaw) * flat,
				GROUND_Y - Math.sin(tilt) * distance,
			);
			camera.depth = CENTRE_Z - Math.cos(yaw) * flat;
			camera.lookAt(CENTRE_X, GROUND_Y - 480, CENTRE_Z);
		};
		updateCam();

		// drag to orbit — screen coordinates, not world ones: orbiting moves
		// the camera every frame, so a world-projected pixel would map
		// somewhere new on each move and the drag would jump
		let dragging = false;
		let lastX = 0;
		let lastY = 0;
		input.registerPointerEvent("pointerdown", camera, (ev: Pointer) => {
			dragging = true;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
		});
		input.registerPointerEvent("pointerup", camera, () => {
			dragging = false;
		});
		input.registerPointerEvent("pointermove", camera, (ev: Pointer) => {
			if (!dragging) {
				return;
			}
			yaw += (ev.gameScreenX - lastX) * 0.0036;
			tilt += (ev.gameScreenY - lastY) * -0.0022;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
			updateCam();
		});
		pointerCleanup = () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
		};

		/* -- the clock ---------------------------------------------------- */

		let azimuth = 0.9;
		let elevation = 0.52;
		let running = true;
		let clock = 0;
		const dir = new Vector3d();
		let readout: HTMLDivElement | null = null;

		/**
		 * Drives the sun, the marker, the bird and the one stretch that is
		 * computed rather than set. Nothing drawn: `update` is the only reason
		 * it is in the world.
		 */
		class Director extends Renderable {
			constructor() {
				super(0, 0, 1, 1);
				// the scene is static, so nothing else would tick this
				this.alwaysUpdate = true;
			}

			override update(dt: number) {
				clock += dt;
				if (running) {
					azimuth += dt * SUN_SPEED;
				}
				sunDirection(sun.direction, azimuth, elevation);

				// the marker sits back along the travel direction: with a
				// positive (downward) y, -y is up
				sunMarker.pos.set(
					CENTRE_X - sun.direction.x * SUN_RADIUS,
					GROUND_Y - sun.direction.y * SUN_RADIUS,
				);
				sunMarker.depth = CENTRE_Z - sun.direction.z * SUN_RADIUS;

				// A low sun throws a long shadow. Set live rather than once,
				// because `shadowStretch` is read every draw like the rest of
				// them — and it fades as it pulls, so an extreme value
				// degrades into nothing instead of into a smear.
				const lift = Math.max(Math.sin(elevation), 0.18);
				const pull = clamp(0.85 / lift, 1, 3);
				smear.shadowStretch = pull;
				// ...and the scatters take the same pull. One stretch, one
				// direction and one offset serve a whole instanced set, which
				// is what lets a scatter sit next to loose props without
				// looking lit from somewhere else.
				flat.shadowStretch = pull;
				sloped.shadowStretch = pull;

				// the bird climbs and sinks over six seconds, which is the
				// height fade: the blob shrinks and thins as the gap opens
				const bob = 0.5 - 0.5 * Math.cos(clock * 0.00105);
				flier.pos.y = GROUND_Y - 60 - bob * 660;

				if (readout !== null) {
					dir.copy(sun.direction);
					readout.textContent =
						`azimuth ${(((azimuth * 180) / Math.PI) % 360) | 0}°  ` +
						`elevation ${((elevation * 180) / Math.PI) | 0}°\n` +
						`direction  ${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)}`;
				}
				return true;
			}

			override draw() {
				// nothing to draw
			}
		}
		world.addChild(new Director(), -1000);

		/* -- controls ----------------------------------------------------- */

		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:56px;left:16px;z-index:1000;" +
			"font-family:ui-monospace,monospace;font-size:12px;color:#f3ecdf;" +
			"background:rgba(10,16,26,0.66);padding:10px 12px;border-radius:8px;" +
			"line-height:1.7;text-shadow:0 1px 2px rgba(0,0,0,0.8);";

		const pause = document.createElement("button");
		pause.textContent = "pause sun";
		pause.style.cssText =
			"font:inherit;color:inherit;background:rgba(255,255,255,0.12);" +
			"border:1px solid rgba(255,255,255,0.3);border-radius:5px;" +
			"padding:3px 9px;cursor:pointer;";
		pause.onclick = () => {
			running = !running;
			pause.textContent = running ? "pause sun" : "resume sun";
		};

		const elevationRow = document.createElement("label");
		elevationRow.style.cssText = "display:flex;gap:8px;align-items:center;";
		const elevationSlider = document.createElement("input");
		elevationSlider.type = "range";
		elevationSlider.min = "8";
		elevationSlider.max = "88";
		elevationSlider.value = String(Math.round((elevation * 180) / Math.PI));
		elevationSlider.oninput = () => {
			elevation = (Number(elevationSlider.value) * Math.PI) / 180;
		};
		elevationRow.append(document.createTextNode("sun height"), elevationSlider);

		const shadowRow = document.createElement("label");
		shadowRow.style.cssText = "display:flex;gap:8px;align-items:center;";
		const shadowToggle = document.createElement("input");
		shadowToggle.type = "checkbox";
		shadowToggle.checked = true;
		shadowToggle.oninput = () => {
			// the honest A/B: the blobs are the ONLY difference between the
			// two states, so whatever changes on screen is what they were
			// contributing
			for (const caster of casters) {
				caster.castGroundShadow = shadowToggle.checked;
			}
		};
		shadowRow.append(shadowToggle, document.createTextNode("shadows"));

		readout = document.createElement("div");
		readout.style.cssText = "white-space:pre;opacity:0.8;margin-top:4px;";

		const hint = document.createElement("div");
		hint.style.cssText = "opacity:0.65;margin-top:4px;";
		hint.textContent = "drag to orbit";

		panel.append(pause, elevationRow, shadowRow, readout, hint);
		const parent = app.renderer.getCanvas().parentElement ?? document.body;
		parent.appendChild(panel);
		domCleanup = () => {
			panel.remove();
		};
	};

	loader.preload(
		[
			{ name: "palm", type: "glb", src: `${base}palm.glb` },
			{ name: "fern", type: "glb", src: `${base}fern.glb` },
			{ name: "bigleaf", type: "glb", src: `${base}bigleaf.glb` },
			{ name: "rock", type: "glb", src: `${base}rock.glb` },
			{ name: "log", type: "glb", src: `${base}log.glb` },
			{ name: "carrot", type: "glb", src: `${base}carrot.glb` },
		],
		() => {
			// Leave `state.LOADING`, or the loading screen stays pinned over
			// the running scene for good — the loader does not change state on
			// its own.
			state.change(state.DEFAULT, true);
			setupScene();
		},
	);

	return () => {
		torndown = true;
		pointerCleanup?.();
		domCleanup?.();
	};
};

export const ExampleGroundShadows = createExampleComponent(createGame);
