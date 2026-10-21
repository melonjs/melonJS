/**
 * melonJS — Earth Defender: the things built once and never rebuilt.
 *
 * The backdrop and the two globes. They have one thing in common that earns
 * them a module: nothing here reads the state of the run. A nebula, a star
 * and a distant world are placed at boot and only ever slid with the camera
 * afterwards, and a globe is a pile of meshes assembled from a glTF file.
 *
 * So these are FUNCTIONS, not a class with a back-reference to the
 * controller. `buildSky` hands back the layers it made and `makeGlobe` hands
 * back its parts; what the game then does with them is the game's business.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, loader, Mesh, math, Sprite3d } from "melonjs";
import {
	FAR_PLANETS,
	NEBULA_ALPHA,
	NEBULA_NEAR_ALPHA,
	NEBULA_NEAR_DEPTH,
	NEBULA_NEAR_OFFSET_X,
	NEBULA_NEAR_OFFSET_Y,
	NEBULA_NEAR_SPAN,
	NEBULA_NEAR_TINT,
	NEBULA_PARALLAX_FAR,
	NEBULA_PARALLAX_NEAR,
	NEBULA_SPAN,
	SHIP_VIEW_Z,
	SKY_PARALLAX,
	SKY_SPREAD,
	SKY_Z,
	STAR_COUNT,
} from "../constants";
import { nebulaSky } from "./nebula";
import { disc } from "./textures";

/**
 * The preloaded glTF for a name, or a thrown error saying which one is
 * missing. Reaching into `loader.getGLTF` and finding `null` three calls
 * later is a worse way to learn the preload list is short.
 * @param name - the preloaded asset name
 * @returns the parsed glTF
 */
const gltfData = (name: string) => {
	const data = loader.getGLTF(name);
	if (data === null) {
		throw new Error(`earthDefender: glTF "${name}" was not preloaded`);
	}
	return data;
};

/**
 * One backdrop sprite and what it takes to parallax it.
 *
 * `baseZ` is kept separately because `pos` holds a WORLD position once the
 * camera is posed, so the depth the pan is derived from is not on the sprite
 * any more.
 */
export interface SkyLayer {
	sprite: Sprite3d;
	baseX: number;
	baseY: number;
	baseZ: number;
	pan: number;
}

/**
 * Scatter the backdrop: stars, and a few worlds too far away to reach.
 *
 * Fixed in world space and never rotated with the globe, which is the
 * whole point of them. They sit at `SKY_Z`, some seven times the
 * planet's own depth, so when the camera slides the near geometry swings
 * across them and the distance between the two becomes legible. Without
 * something out there to hold still, panning the camera just moves the
 * whole picture and reads as nothing at all.
 *
 * Built once: the only thing touched afterwards is their position, and
 * only to slide them with the camera. See {@link SKY_PARALLAX}.
 * @param app - the application to add them to
 */
export function buildSky(app: Application): SkyLayer[] {
	const sky: SkyLayer[] = [];
	// The nebula: one generated tile, repeated into one bitmap, drawn as
	// ONE quad. The repeat lives inside the texture on purpose, where it
	// is a texel-aligned copy of a seamless tile; as a grid of separate
	// quads the shared edges rasterised as bright lines.
	const field = nebulaSky("far");
	// `width` / `height` are the quad's size in world units. On a plain
	// `Sprite` this was `scale`, because `resize` moves the BOUNDS and
	// leaves the geometry at the texture's pixel size; a `Sprite3d` is
	// authored at a size instead. `scale` would work too, but the cloud
	// never changes size, so saying it once here beats a transform.
	const cloud = new Sprite3d(0, 0, {
		image: field,
		width: NEBULA_SPAN,
		height: NEBULA_SPAN,
		billboard: "spherical",
		transparent: true,
		alphaCutoff: 0,
	});
	cloud.pos.set(0, 0);
	// behind the loose stars, and behind the far worlds
	cloud.depth = SKY_Z + 2600;
	cloud.setOpacity(NEBULA_ALPHA);
	cloud.blendMode = "additive";
	app.world.addChild(cloud, cloud.depth);
	// Its own rate, NOT the shared one. The default below solves for "move at
	// exactly SKY_PARALLAX of the planet's motion", which is right for the
	// stars and the far worlds: it makes them all read as one distance. For
	// two nebulae it is fatal. Both were normalised to the same 0.350 of the
	// planet's rate whatever depth they were given, so they slid together,
	// the depths did nothing, and the second layer was a second texture
	// rather than a second distance. Parallax is a DIFFERENCE in rate.
	addSky(sky, cloud, NEBULA_PARALLAX_FAR);

	// A SECOND cloud, nearer, which is what makes the first one read as
	// far away. One layer has nothing to be far away FROM: panning the
	// camera slid the whole sky together and the backdrop stayed a flat.
	// These two drift against each other, and that relative motion is
	// the depth cue. Its pan comes from its depth, through `addSky`, so
	// placing it nearer is the whole of the setup.
	const veil = new Sprite3d(0, 0, {
		image: nebulaSky("near"),
		width: NEBULA_NEAR_SPAN,
		height: NEBULA_NEAR_SPAN,
		billboard: "spherical",
		transparent: true,
		alphaCutoff: 0,
	});
	veil.pos.set(NEBULA_NEAR_OFFSET_X, NEBULA_NEAR_OFFSET_Y);
	veil.depth = NEBULA_NEAR_DEPTH;
	veil.setOpacity(NEBULA_NEAR_ALPHA);
	// the generator bakes one palette, so the second layer is separated
	// by TINT rather than by a second set of colour constants inside it
	veil.setTint(NEBULA_NEAR_TINT);
	veil.blendMode = "additive";
	app.world.addChild(veil, veil.depth);
	addSky(sky, veil, NEBULA_PARALLAX_NEAR);

	const star = disc(8, "rgba(255,255,255,0.95)", 0.25);
	for (let i = 0; i < STAR_COUNT; i++) {
		// Sized for their distance, not in absolute units. At `SKY_Z` a
		// 15-unit sprite is under a pixel across and simply never
		// appears; these work out at two to six pixels.
		const size = math.randomFloat(40, 115);
		const s = new Sprite3d(0, 0, {
			image: star,
			width: size,
			height: size,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		s.setPosition(
			math.randomFloat(-SKY_SPREAD, SKY_SPREAD),
			math.randomFloat(-SKY_SPREAD * 0.58, SKY_SPREAD * 0.58),
			SKY_Z + math.randomFloat(-1200, 1800),
		);
		s.setOpacity(math.randomFloat(0.4, 1));
		s.blendMode = "additive";
		app.world.addChild(s, s.depth);
		addSky(sky, s);
	}

	for (const fp of FAR_PLANETS) {
		// faded on purpose: a distant world that reads as bright reads as
		// near, and these have to sit behind everything
		const body = new Sprite3d(0, 0, {
			image: disc(128, fp.tint, 0.72),
			width: fp.size,
			height: fp.size,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		body.setPosition(fp.x, fp.y, fp.z);
		body.setOpacity(fp.alpha);
		app.world.addChild(body, fp.z);
		addSky(sky, body);
	}
	return sky;
}

/**
 * Record a backdrop sprite and work out how far it slides with the
 * camera.
 *
 * A sprite left alone in the world moves on screen by `f / depth` per
 * unit of camera slide, and the planet moves by `f / SHIP_VIEW_Z`. To
 * land on {@link SKY_PARALLAX} of the planet's motion the sprite has to
 * be carried along with the camera by the shortfall, which is this
 * factor: 1 leaves it stuck to the lens, 0 leaves it fixed in space.
 * @param sprite - the backdrop sprite, already placed and added
 */
function addSky(
	sky: SkyLayer[],
	sprite: Sprite3d,
	parallax = SKY_PARALLAX,
): void {
	sky.push({
		sprite,
		baseX: sprite.pos.x,
		baseY: sprite.pos.y,
		baseZ: sprite.depth,
		pan: 1 - (parallax * sprite.depth) / SHIP_VIEW_Z,
	});
}

/**
 * Build a preloaded glTF globe as one `Mesh` per material.
 *
 * Every part is scaled by the SAME factor rather than sized to its own
 * extent: the ice caps span a fraction of what the oceans do, and
 * normalising each separately would inflate the poles to the size of
 * the planet.
 * @param name - the preloaded asset name
 * @param radius - world radius to draw it at
 * @param sheen - what the solid parts and the transparent ones reflect
 * @returns the parts, in load order
 */
export function makeGlobe(
	name: string,
	radius: number,
	sheen: {
		specular: [number, number, number];
		shininess: number;
		glassSpecular: [number, number, number];
		glassShininess: number;
	},
): Mesh[] {
	const data = gltfData(name);
	const parts: Mesh[] = [];
	for (const node of data.nodes) {
		// A part the author marked transparent is drawn ADDITIVELY.
		//
		// `setOpacity` does not make a lit mesh see-through on this path,
		// which is how the dome's panes first arrived as an opaque white
		// cap over the planet. Additive is the way glass works here: the
		// pane never hides what is behind it, it only ADDS, so its colour
		// is the sheen it contributes rather than a coat of paint. The
		// panes are authored dark for exactly that reason, and glossy, so
		// the sun sitting behind the camera lands a moving highlight
		// across the shell as the world turns under it.
		const glass = (node.baseColorFactor?.[3] ?? 1) < 0.5;
		const mesh = new Mesh(0, 0, {
			vertices: node.vertices,
			normals: node.normals,
			uvs: node.uvs,
			indices: node.indices,
			normalize: false,
			scale: radius,
			lit: true,
			cullBackFaces: true,
			// A ROTATION into the engine's Y-down space, not a reflection.
			// The default bridge negates Y alone, which mirrors the scene
			// left to right: the globe then turns the opposite way to
			// everything standing on it, because the rocks are placed by
			// `project` while the globe is placed by this matrix.
			rightHanded: true,
			// and what it throws back at the sun behind the camera
			specular: glass ? sheen.glassSpecular : sheen.specular,
			shininess: glass ? sheen.glassShininess : sheen.shininess,
			// the material's own base colour, encoded from the
			// loader's LINEAR factor by the engine
			baseColorFactor: node.baseColorFactor,
		});
		if (glass) {
			// The transparent pass: blended, back to front, and crucially
			// NO DEPTH WRITE. Additive alone only changes how the colour
			// combines; the panes still wrote depth and rejected the whole
			// planet behind them, so the shell came back as a solid ball.
			mesh.transparent = true;
			mesh.blendMode = "additive";
		}
		parts.push(mesh);
	}
	return parts;
}
