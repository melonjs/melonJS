/**
 * melonJS — Earth Defender: building one rock.
 *
 * The three factories behind every asteroid on screen, and the two caches
 * that keep them cheap. Here rather than on the controller because none of
 * them reads the state of the run: hand one a size and a shape index and it
 * hands back geometry, the same geometry every time.
 *
 * The caches are MODULE state on purpose. They were fields on the
 * controller, which meant the measured radii and the baked halo textures
 * were thrown away and rebuilt on every restart, although nothing about
 * them can change between runs: the shapes come from one glTF file and the
 * halos from one palette.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loader, Mesh, type Renderable, Sprite3d } from "melonjs";
import {
	BONUS_EMISSIVE,
	BONUS_SHININESS,
	BONUS_SPECULAR,
	HALO_ALPHA,
	HALO_BONUS_TINT,
	HALO_FALLOFF,
	HALO_ICE_TINT,
	HALO_SCALE,
	HALO_TEX,
	ICE_EMISSIVE,
	ICE_SHININESS,
	ICE_SPECULAR,
	ROCK_ALBEDO,
	ROCK_MODEL,
	ROCK_NORMAL,
	ROCK_SHININESS,
	ROCK_SPECULAR,
} from "../constants";
import { disc } from "../fx/textures";

/**
 * The worst-case radius of each shape in the rock model, measured once.
 *
 * A rock's collision sphere has to contain its WHOLE mesh however it is
 * turned, and the glTF's shapes are not spheres, so the honest radius is the
 * furthest vertex. Measuring it is a walk over every vertex, which is why it
 * happens once per shape rather than once per rock.
 */
export /**
 * The two collision hooks this game installs on a rock.
 *
 * The engine deliberately does not declare these on `Renderable`: dispatch
 * is a `typeof renderable.onCollisionX === "function"` test, and a base
 * class field would SHADOW the prototype method every subclass that
 * implements one declares. So a renderable opts in by having the property,
 * and this is the shape of that opt-in.
 */
interface RockContacts {
	onCollisionStart?: (response: object, other: Renderable) => void;
	onCollisionActive?: (response: object, other: Renderable) => void;
}

const _rockRadii: number[] = [];
/** one baked halo per rock kind, since a kind is a colour and nothing else */
const _haloTex = new Map<string, HTMLCanvasElement>();

/**
 * The radius of the sphere that contains one shape, in model units.
 *
 * The bounding SPHERE, not the height: a rock's orientation comes from the
 * surface frame at wherever it currently is, which turns as it travels,
 * so any vertex can end up the one facing the glass and the only number
 * that holds for every orientation is the distance to the furthest one.
 * Measured off the geometry once per shape and kept, since it cannot
 * change.
 * @param shape - which of the file's shapes to measure
 * @returns its bounding radius in model units
 */
export function shapeRadius(shape: number): number {
	const cached = _rockRadii[shape];
	if (cached !== undefined) {
		return cached;
	}
	const node = loader.getGLTF(ROCK_MODEL)?.nodes[shape];
	let worst = 0;
	if (node !== undefined) {
		const v = node.vertices;
		for (let i = 0; i < v.length; i += 3) {
			worst = Math.max(worst, Math.hypot(v[i], v[i + 1], v[i + 2]));
		}
	}
	_rockRadii[shape] = worst;
	return worst;
}

/**
 * One rock, at a given world size.
 *
 * The geometry comes out of the preloaded `.glb` and is handed
 * straight to a `Mesh`, rather than built as a `GLTFModel`. A
 * `GLTFModel` is a CONTAINER of nodes, so its own `width` is
 * `Infinity` and its `scale` setting multiplies whatever the node
 * transforms already carry: useful for an authored scene, useless
 * when what you want is "make this thing 30 units across". A `Mesh`
 * takes that size directly, the same way the ship and the planet do.
 *
 * Each shape is authored as its own primitive, centred on its own
 * origin with an identity node transform, which is what lets a node
 * index stand in for the whole model without folding a matrix in first.
 * @param size - the world-space size to draw it at
 * @param shape - which of the file's shapes to build, `0` to `ROCK_SHAPES - 1`
 * @returns the rock, ready to place
 */
export function makeRock(size: number, shape: number, kind: string): Mesh {
	const node = loader.getGLTF(ROCK_MODEL)?.nodes[shape];
	if (node === undefined) {
		throw new Error(`earthDefender: glTF "${ROCK_MODEL}" was not preloaded`);
	}
	const mesh = new Mesh(0, 0, {
		vertices: node.vertices,
		uvs: node.uvs,
		normals: node.normals,
		indices: node.indices,
		// `normalize` would fit each shape into the same cube and throw
		// away the very thing they were modelled for: the slab would come
		// back as round as the round one. Keeping the authored coordinates
		// and scaling them uniformly is what preserves the proportions.
		normalize: false,
		scale: size,
		lit: true,
		cullBackFaces: true,
		rightHanded: true,
		// 320 triangles carry the silhouette; the surface is these two.
		// The normal map needs `lit` and a `Camera3d`, and it derives its
		// tangent frame per fragment, so the UVs off the exporter are all
		// it asks for.
		texture: ROCK_ALBEDO,
		normalMap: ROCK_NORMAL,
		// Ice takes the same colour map and the same relief and answers
		// the sun completely differently: a hard, near-white highlight
		// instead of the rock's dull sheen. That, with the pale tint the
		// caller applies, is the whole read.
		specular:
			kind === "ice"
				? ICE_SPECULAR
				: kind === "bonus"
					? BONUS_SPECULAR
					: ROCK_SPECULAR,
		shininess:
			kind === "ice"
				? ICE_SHININESS
				: kind === "bonus"
					? BONUS_SHININESS
					: ROCK_SHININESS,
		// colour the map cannot give them: see ICE_EMISSIVE. A fresh
		// array per rock, because the pulse writes into it. Spread rather
		// than set to `undefined`, so a plain rock OMITS the key: under
		// `exactOptionalPropertyTypes` an optional setting may be left
		// out but not handed an explicit `undefined`.
		...(kind === "ice"
			? { emissive: new Float32Array(ICE_EMISSIVE) }
			: kind === "bonus"
				? { emissive: new Float32Array(BONUS_EMISSIVE) }
				: {}),
	});
	return mesh;
}

/**
 * The soft glow a radioactive rock carries.
 *
 * A separate emitter rather than a brighter rock, and that separation is
 * the whole point: this scene has no tone curve, so there is only the gap
 * between BLOOM_THRESHOLD and full scale to work in. A rock bright enough
 * to bloom is a rock with no surface left, which is what happened when
 * this was folded into the mesh's emissive.
 * @param kind - which rock, for the tint
 * @param radius - the rock's own radius, so the glow is sized to it
 * @returns the halo billboard, ready to place
 */
export function makeHalo(kind: string, radius: number): Sprite3d {
	let tex = _haloTex.get(kind);
	if (tex === undefined) {
		tex = disc(
			HALO_TEX,
			kind === "ice" ? HALO_ICE_TINT : HALO_BONUS_TINT,
			HALO_FALLOFF,
		);
		_haloTex.set(kind, tex);
	}
	// Sized HERE, from the rock, because a rock's radius is fixed for
	// its lifetime: one authored size, no per-frame transform. `scale`
	// is the call to reach for if a halo ever has to pulse.
	//
	// `transparent` AND `alphaCutoff: 0`: the first puts it in the
	// blended pass, without which a full-opacity quad stays in the opaque
	// one and its soft texels come out black; the second stops
	// `Sprite3d`'s own 0.5 default from cutting the falloff off at a hard
	// contour.
	const halo = new Sprite3d(0, 0, {
		image: tex,
		width: radius * 2 * HALO_SCALE,
		height: radius * 2 * HALO_SCALE,
		billboard: "spherical",
		transparent: true,
		alphaCutoff: 0,
		// and not occluded: it is a glow, not a surface. A flat billboard
		// left depth tested is sliced along a hard straight line whenever
		// a rock drifts near the limb and the globe is nearer at some
		// pixel, and no offset escapes that — the planet bulges further
		// toward the camera than any offset worth applying.
		depthTest: false,
	});
	halo.blendMode = "additive";
	halo.setOpacity(HALO_ALPHA);
	return halo;
}
