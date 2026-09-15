/**
 * melonJS — Jungle Rabbit: the gorge, built as procedural `Mesh` geometry.
 *
 * The cross-section is a parabola — flat in the middle, climbing at the edges
 * — and it does not vary along Z. That invariance is the whole trick behind
 * the endless run: two identical tiles leapfrog each other in front of the
 * boat and the seam is invisible, because both ends of every tile have the
 * same profile.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Color, Mesh, type NoiseTexture2d } from "melonjs";
import {
	GROUND_Y,
	HALF_W,
	RIPPLE_UV,
	RIVER_FLOW,
	TERRAIN_OVERHANG,
	TILE_LEN,
	TILE_NX,
	TILE_NZ,
	WALL_H,
	WATER_BACK,
	WATER_FRONT,
	WATER_HALF_W,
	WATER_LEVEL,
	WATER_UV,
} from "./constants";

/**
 * Height of the river bed at a given X, in **world** space. Y-down, so the
 * banks are *negative* — the further from the centre line, the higher the
 * ground. Every plant and boulder is placed with this.
 */
export const valleyY = (x: number) => {
	const t = Math.min(1, Math.abs(x) / HALF_W);
	return -WALL_H * t * t;
};

/**
 * The same profile in **mesh source** space, which is Y-up.
 *
 * `Mesh` defaults `rightHanded` to `false`, and that bridge negates Y — so
 * geometry authored directly in engine coordinates arrives upside down, and a
 * valley renders as a hill. Authoring the profile flipped is the fix; the
 * alternative, `rightHanded: true`, also negates Z and would send the tile
 * behind the camera.
 */
const sourceY = (x: number) => {
	return -valleyY(x);
};

/** dy/dx of the profile above, for the surface normal */
const valleySlope = (x: number) => {
	const t = Math.min(1, Math.abs(x) / HALF_W);
	return t >= 1 ? 0 : (-2 * WALL_H * x) / (HALF_W * HALF_W);
};

/**
 * World X of a terrain column.
 *
 * The mesh reaches wider than the gorge it describes. `valleyY` clamps past
 * `HALF_W`, so the extra columns are a flat plateau at bank height — which
 * costs almost nothing and is where the palms stand anyway. Without it the
 * mesh ends at `±HALF_W`, the planting bands reach past that, and a low camera
 * sees trees standing over open sky at the bottom corners of the frame.
 */
const columnX = (ix: number) => {
	const t = ix / (TILE_NX - 1);
	return (-1 + t * 2) * HALF_W * TERRAIN_OVERHANG;
};

/**
 * One vertex colour per grid point: the bank tint, and a touch of ambient
 * occlusion down in the crease where a gorge sees less sky than its ridges do.
 *
 * The tint is what makes one texture serve as both river and bank. Vertex
 * colours MULTIPLY the texture, so they can only darken — there is no warm
 * brown to be had from teal water. Killing most of the blue while keeping the
 * green lands on a mossy bank green, which is where a jungle floor wants to be
 * anyway, and the sparse foam of the water texture reads as leaf litter once
 * it is tinted with it.
 *
 * Purely a function of the column, so it is baked once at construction.
 */
const bakeVertexTint = () => {
	const colors = new Uint32Array(TILE_NX * TILE_NZ);
	const shade = new Color();
	for (let ix = 0; ix < TILE_NX; ix++) {
		// from the real world X, not from the column index: the mesh reaches
		// past `HALF_W` and normalising against its own width would drag the
		// waterline outward with it
		const across = Math.min(1, Math.abs(columnX(ix)) / HALF_W);
		// The waterline is GEOMETRY now — where the flat surface meets the
		// parabola — so this only has to agree with it. Below it the bed is
		// silt seen through water; above it, bank.
		const shore = WATER_HALF_W / HALF_W;
		const bank = Math.min(1, Math.max(0, (across - shore) / 0.16));
		const ao = 0.88 + 0.12 * across;
		// silt is warm, the bank is green: pull the red down and leave the
		// green, which turns the sandy bed into wet undergrowth
		shade.setColor(
			255 * ao * (1 - 0.5 * bank),
			255 * ao * (1 - 0.12 * bank),
			255 * ao * (1 - 0.42 * bank),
		);
		const packed = shade.toUint32(1);
		for (let iz = 0; iz < TILE_NZ; iz++) {
			colors[iz * TILE_NX + ix] = packed;
		}
	}
	return colors;
};

/**
 * One tile of river BED, spanning the full width and `TILE_LEN` along Z.
 * @param ground - the tiling bed texture
 * @returns a lit mesh whose geometry starts at local z = 0
 */
export const createTerrainTile = (ground: HTMLCanvasElement) => {
	const verts: number[] = [];
	const uvs: number[] = [];
	const norms: number[] = [];
	const indices: number[] = [];

	for (let iz = 0; iz < TILE_NZ; iz++) {
		const z = (iz / (TILE_NZ - 1)) * TILE_LEN;
		for (let ix = 0; ix < TILE_NX; ix++) {
			const x = columnX(ix);
			verts.push(x, sourceY(x), z);
			uvs.push((x + HALF_W) / WATER_UV, z / WATER_UV);

			// surface is y = f(x), constant in z, so the normal lies in the XY
			// plane. Authored Y-up like the positions above, and negated by the
			// same bridge on the way in.
			const slope = -valleySlope(x);
			const len = Math.hypot(slope, 1);
			norms.push(-slope / len, 1 / len, 0);
		}
	}

	for (let iz = 0; iz < TILE_NZ - 1; iz++) {
		for (let ix = 0; ix < TILE_NX - 1; ix++) {
			const a = iz * TILE_NX + ix;
			const b = a + 1;
			const c = a + TILE_NX;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}

	const tile = new Mesh(0, GROUND_Y, {
		// The bank tint and a little ambient occlusion, baked once. The
		// distance haze that used to be written here every frame is the
		// camera's `setFog` now, so these never change after construction.
		vertexColors: bakeVertexTint(),
		vertices: new Float32Array(verts),
		uvs: new Float32Array(uvs),
		normals: new Float32Array(norms),
		indices: new Uint16Array(indices),
		// `texture`, not `image`: the latter is a Sprite3d alias that Mesh does
		// not read, and passing it leaves the mesh on the white-pixel fallback
		texture: ground,
		// raw world coordinates: no unit-cube fit, no rescale
		normalize: false,
		scale: 1,
		width: HALF_W * 2 * TERRAIN_OVERHANG,
		height: TILE_LEN,
		// the UVs run well past 1 — without this the texture clamps to its
		// edge texels and the whole river reads as one flat wash
		textureRepeat: "repeat",
		// linear, unlike the props: the river is seen at a grazing angle, so
		// its texture is compressed along Z into far less than a texel per
		// pixel. "nearest" opts out of mipmaps and anisotropy, and the foam
		// aliases into an even wash exactly where the camera looks most.
		textureFilter: "linear",
		cullBackFaces: false,
		lit: true,
	});
	return tile;
};

/**
 * The river surface: ONE plane that travels with the boat.
 *
 * Not tiled and not recycled, unlike the bed. A recycled surface has a seam
 * every tile length and, worse, each tile has to pass a visibility test of its
 * own — so the one the camera happens to be standing in can wink out and show
 * dry bed in front of you, in a rhythm that follows the tile spacing. A single
 * plane that follows the camera has no seams to misalign and no boundary to
 * cross. It is the same trick a racing game plays with its road.
 *
 * The plane moves with the boat; the water drifts. `scrollWaterPlane` offsets
 * the UVs by the part of the journey the river does not carry downstream with
 * it, so the surface slides past gently instead of either rushing past or
 * being dragged along rigidly.
 *
 * `transparent: true` is required, not decorative: the mesh pass is opaque and
 * disables blending, so without it the surface composites as a solid sheet and
 * hides the bed entirely.
 * @param ripples - the seamless `NoiseTexture2d` standing in for the surface
 * @returns a mesh spanning from behind the camera to past the fog
 */
/**
 * Rows of vertices along the plane.
 *
 * Not one long quad. Fog depth is computed PER VERTEX and interpolated, so a
 * quad spanning the whole visible run interpolates between one point behind
 * the camera and one past the horizon — and every fragment between them comes
 * out uniformly hazed, whatever its real distance. The symptom is a river the
 * colour of the fog from the boat to the skyline, which looks like a texture
 * or lighting fault and is neither. The bed never showed it because its tiles
 * carry rows every twelve hundred units.
 */
const WATER_ROWS = 14;

/** world z of a row, from behind the camera to past the haze */
const rowZ = (iz: number) => {
	return WATER_BACK + (iz / (WATER_ROWS - 1)) * (WATER_FRONT - WATER_BACK);
};

export const createWaterPlane = (ripples: NoiseTexture2d) => {
	// Four columns, not two. The outer pair drops below the surface so the
	// water tucks under the bank rather than ending on it — and, less
	// obviously, so the mesh has THICKNESS. A perfectly flat plane has a
	// degenerate bounding volume and fails the visibility test exactly when
	// the camera is inside it, which for a river is every frame.
	const halfW = WATER_HALF_W * 1.06;
	const inner = WATER_HALF_W * 0.99;
	const EDGE_DROP = 60;
	const columns: [number, number][] = [
		[-halfW, -EDGE_DROP],
		[-inner, 0],
		[inner, 0],
		[halfW, -EDGE_DROP],
	];
	const verts: number[] = [];
	const uvs: number[] = [];
	const norms: number[] = [];
	const indices: number[] = [];

	for (let iz = 0; iz < WATER_ROWS; iz++) {
		const z = rowZ(iz);
		for (const [x, y] of columns) {
			verts.push(x, y, z);
			uvs.push((x + halfW) / RIPPLE_UV, z / RIPPLE_UV);
			norms.push(0, 1, 0);
		}
	}
	for (let iz = 0; iz < WATER_ROWS - 1; iz++) {
		for (let ix = 0; ix < columns.length - 1; ix++) {
			const a = iz * columns.length + ix;
			const b = a + 1;
			const c = a + columns.length;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}

	return new Mesh(0, WATER_LEVEL, {
		vertices: new Float32Array(verts),
		uvs: new Float32Array(uvs),
		normals: new Float32Array(norms),
		indices: new Uint16Array(indices),
		texture: ripples,
		normalize: false,
		scale: 1,
		width: halfW * 2,
		height: WATER_FRONT - WATER_BACK,
		textureRepeat: "repeat",
		textureFilter: "linear",
		cullBackFaces: false,
		lit: true,
		transparent: true,
	});
};

/**
 * Keep the surface under the boat, with the water itself anchored to the
 * world.
 *
 * The plane's depth follows the run, so it is always beneath the camera; the
 * UVs are offset by the same distance in the opposite sense, which pins the
 * texture to world space. Without the second half the pattern would ride along
 * with the boat and the river would look frozen.
 *
 * Eight vertices, so rewriting the UV array per frame is free — but the GPU
 * copy only refreshes when `needsUpdate` says so.
 * @param plane - the mesh from {@link createWaterPlane}
 * @param travelled - how far down the course the boat has come
 */
export const scrollWaterPlane = (plane: Mesh, travelled: number) => {
	plane.depth = travelled;
	driftWaterPlane(plane, travelled);
};

/**
 * Scroll the surface WITHOUT moving the plane.
 *
 * The two halves of `scrollWaterPlane` are separable, and the menu needs only
 * one of them: nothing travels there, so the plane must stay put while the
 * water still flows past. Passing a growing distance to the full version
 * sails the plane off up the river — after a minute on the title screen it is
 * thousands of units away and the shot is left showing the bare riverbed.
 * @param plane - the water surface
 * @param distance - how far the water has flowed, in world units
 */
export const driftWaterPlane = (plane: Mesh, distance: number) => {
	const travelled = distance;
	const uvs = plane.uvs;
	const columns = 4;
	for (let iz = 0; iz < WATER_ROWS; iz++) {
		// only the part of the travel the river does NOT carry with it
		const v = (rowZ(iz) + travelled * (1 - RIVER_FLOW)) / RIPPLE_UV;
		for (let ix = 0; ix < columns; ix++) {
			uvs[(iz * columns + ix) * 2 + 1] = v;
		}
	}
	plane.needsUpdate = true;
};
