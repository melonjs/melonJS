/**
 * melonJS — procedural night-city geometry generator.
 *
 * Builds a small downtown of box "buildings" plus thousands of individual
 * window quads, entirely from raw vertex data — no asset file. The walls are
 * one lit mesh (shaded by the moon); the lit windows are split into a handful
 * of emissive meshes (one per glow color) so each group can carry its own
 * `Mesh.emissive` — that's what makes individual windows glow at night while
 * the wall around them stays dark. "Off" windows simply aren't emitted, so the
 * dark wall shows through and the skyline reads as a real some-windows-on city.
 *
 * Authored in a Y-up right-handed space (Y = height) so the meshes can use
 * `rightHanded: true` — matching the glTF / Camera3d convention the rest of the
 * 3D examples use.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */

/** one emissive window-glow color (added on top of a near-black quad). */
export interface GlowGroup {
	/** emissive `[r, g, b]` (may exceed 1 for a hot glow). */
	color: [number, number, number];
	vertices: number[];
	normals: number[];
	indices: number[];
}

export interface CityGeometry {
	/** merged building shells — one lit mesh, dark concrete. */
	walls: { vertices: number[]; normals: number[]; indices: number[] };
	/**
	 * the ground plane + street grid — one lit mesh. Carries per-vertex colors
	 * (`colors`, packed ARGB) so the dark asphalt and the lighter road strips
	 * are distinguished within a single mesh / draw.
	 */
	ground: {
		vertices: number[];
		normals: number[];
		indices: number[];
		colors: number[];
	};
	/** lit windows, grouped by glow color — each an emissive mesh. */
	glow: GlowGroup[];
	/** authored half-extent of the city footprint (for camera framing). */
	radius: number;
	/** authored height of the tallest tower. */
	maxHeight: number;
}

/** pack an 8-bit RGB triple into the ARGB Uint32 `Mesh.vertexColors` wants. */
function packRGB(r: number, g: number, b: number): number {
	return ((255 << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

// the window-glow palette: mostly warm interior light, a few cool
// fluorescent-office and white penthouse accents. The last entry is the
// (hotter, >1 for an HDR pop) street-lamp color — used only by the streetlights
// below, never picked by a window.
const GLOW_COLORS: Array<[number, number, number]> = [
	[1.0, 0.74, 0.36], // 0 warm
	[1.0, 0.58, 0.22], // 1 amber
	[0.62, 0.4, 0.18], // 2 dim warm
	[0.55, 0.8, 1.0], // 3 cool office
	[0.3, 0.45, 0.62], // 4 dim cool
	[0.95, 0.97, 1.0], // 5 white penthouse
	[1.5, 1.02, 0.46], // 6 street lamp (hot sodium-warm)
];
const STREETLAMP_GROUP = 6;

// deterministic PRNG (mulberry32) so the city looks identical every run —
// no Math.random, so re-runs and screenshots are reproducible.
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Push one axis-aligned quad (4 verts, 2 tris) into a target buffer set.
 * `o` is a corner; `du` / `dv` are the two edge vectors from it; `n` is the
 * outward normal. Winding is left for `cullBackFaces: false` (interior never
 * shown), so order doesn't matter here.
 */
function quad(
	t: { vertices: number[]; normals: number[]; indices: number[] },
	ox: number,
	oy: number,
	oz: number,
	dux: number,
	duy: number,
	duz: number,
	dvx: number,
	dvy: number,
	dvz: number,
	nx: number,
	ny: number,
	nz: number,
) {
	const base = t.vertices.length / 3;
	// p0 = o, p1 = o+du, p2 = o+du+dv, p3 = o+dv
	t.vertices.push(
		ox,
		oy,
		oz,
		ox + dux,
		oy + duy,
		oz + duz,
		ox + dux + dvx,
		oy + duy + dvy,
		oz + duz + dvz,
		ox + dvx,
		oy + dvy,
		oz + dvz,
	);
	for (let i = 0; i < 4; i++) {
		t.normals.push(nx, ny, nz);
	}
	t.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Push an axis-aligned box centered at `(cx, ·, cz)`, spanning `y0..y1`, with
 * footprint `sx × sz`. `top` / `bottom` toggle the cap faces (a thin pole skips
 * both; a lamp head keeps them). Reuses {@link quad} per face.
 */
function box(
	t: { vertices: number[]; normals: number[]; indices: number[] },
	cx: number,
	cz: number,
	y0: number,
	y1: number,
	sx: number,
	sz: number,
	top = false,
	bottom = false,
) {
	const x0 = cx - sx / 2;
	const x1 = cx + sx / 2;
	const z0 = cz - sz / 2;
	const z1 = cz + sz / 2;
	const h = y1 - y0;
	quad(t, x0, y0, z1, sx, 0, 0, 0, h, 0, 0, 0, 1); // +Z
	quad(t, x1, y0, z0, -sx, 0, 0, 0, h, 0, 0, 0, -1); // -Z
	quad(t, x1, y0, z1, 0, 0, -sz, 0, h, 0, 1, 0, 0); // +X
	quad(t, x0, y0, z0, 0, 0, sz, 0, h, 0, -1, 0, 0); // -X
	if (top) {
		quad(t, x0, y1, z0, sx, 0, 0, 0, 0, sz, 0, 1, 0);
	}
	if (bottom) {
		quad(t, x0, y0, z0, sx, 0, 0, 0, 0, sz, 0, -1, 0);
	}
}

/**
 * Generate the city geometry.
 * @param grid - buildings per side (grid × grid plots, minus a few gaps)
 * @param seed - PRNG seed (same seed → same city)
 */
export function generateCity(grid = 10, seed = 1337): CityGeometry {
	const rand = rng(seed);
	const CELL = 5; // plot pitch (building + street)
	const half = ((grid - 1) * CELL) / 2;

	const walls = {
		vertices: [] as number[],
		normals: [] as number[],
		indices: [] as number[],
	};
	const ground = {
		vertices: [] as number[],
		normals: [] as number[],
		indices: [] as number[],
		colors: [] as number[],
	};
	const glow: GlowGroup[] = GLOW_COLORS.map((color) => ({
		color,
		vertices: [],
		normals: [],
		indices: [],
	}));

	// a flat, upward-facing quad with a single vertex color — for the ground
	// plane and road strips (which all live in the y=0 plane).
	const flatQuad = (
		x0: number,
		z0: number,
		x1: number,
		z1: number,
		y: number,
		color: number,
	) => {
		const base = ground.vertices.length / 3;
		ground.vertices.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
		for (let i = 0; i < 4; i++) {
			ground.normals.push(0, 1, 0);
			ground.colors.push(color);
		}
		ground.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
	};

	let maxHeight = 0;

	for (let gx = 0; gx < grid; gx++) {
		for (let gz = 0; gz < grid; gz++) {
			// leave occasional plots empty (plazas / parks)
			if (rand() < 0.12) {
				continue;
			}
			const cx = -half + gx * CELL;
			const cz = -half + gz * CELL;
			// footprint, with a little jitter
			const sx = 2.6 + rand() * 1.0;
			const sz = 2.6 + rand() * 1.0;
			// downtown bias: taller toward the center. `dist` can exceed 1 at the
			// corners (diagonal > per-axis half), so clamp before the fractional
			// power — a negative base raised to 1.6 is NaN and would poison the
			// height, the camera framing, and the whole view matrix.
			const dist = Math.hypot(cx, cz) / half; // 0 center … >1 corners
			const tall = Math.max(0, 1 - dist) ** 1.6;
			const sy = 3 + rand() * 4 + tall * 16;
			maxHeight = Math.max(maxHeight, sy);

			const x0 = cx - sx / 2;
			const x1 = cx + sx / 2;
			const z0 = cz - sz / 2;
			const z1 = cz + sz / 2;

			// ── walls (4 sides + flat roof) ────────────────────────────────────
			quad(walls, x0, 0, z1, sx, 0, 0, 0, sy, 0, 0, 0, 1); // +Z
			quad(walls, x1, 0, z0, -sx, 0, 0, 0, sy, 0, 0, 0, -1); // -Z
			quad(walls, x1, 0, z1, 0, 0, -sz, 0, sy, 0, 1, 0, 0); // +X
			quad(walls, x0, 0, z0, 0, 0, sz, 0, sy, 0, -1, 0, 0); // -X
			quad(walls, x0, sy, z0, sx, 0, 0, 0, 0, sz, 0, 1, 0); // roof

			// ── windows on each of the 4 side faces ────────────────────────────
			// a faint per-building tint bias so a tower trends warm OR cool
			// rather than random confetti
			const coolBias = rand() < 0.35;
			const faces: Array<{
				ox: number;
				oz: number;
				ux: number;
				uz: number;
				nx: number;
				nz: number;
				width: number;
			}> = [
				{ ox: x0, oz: z1, ux: 1, uz: 0, nx: 0, nz: 1, width: sx }, // +Z
				{ ox: x1, oz: z0, ux: -1, uz: 0, nx: 0, nz: -1, width: sx }, // -Z
				{ ox: x1, oz: z1, ux: 0, uz: -1, nx: 1, nz: 0, width: sz }, // +X
				{ ox: x0, oz: z0, ux: 0, uz: 1, nx: -1, nz: 0, width: sz }, // -X
			];
			const PITCH = 0.85; // window cell size
			const WIN = 0.5; // lit pane size within the cell
			const margin = (PITCH - WIN) / 2;
			const eps = 0.02; // outset so the pane sits proud of the wall
			for (const f of faces) {
				const cols = Math.max(1, Math.floor(f.width / PITCH));
				const rows = Math.max(1, Math.floor((sy - 1) / PITCH));
				// center the window band horizontally on the face
				const used = cols * PITCH;
				const pad = (f.width - used) / 2;
				for (let r = 0; r < rows; r++) {
					// whole floors sometimes dark
					if (rand() < 0.28) {
						continue;
					}
					for (let c = 0; c < cols; c++) {
						if (rand() < 0.45) {
							continue; // this pane is unlit → dark wall shows
						}
						// pick a glow group (warm-biased, or cool-biased tower)
						let gi: number;
						const rr = rand();
						if (coolBias) {
							gi = rr < 0.6 ? 3 : rr < 0.85 ? 4 : 5;
						} else {
							gi = rr < 0.45 ? 0 : rr < 0.72 ? 1 : rr < 0.9 ? 2 : 5;
						}
						const u = pad + c * PITCH + margin;
						const v = 0.6 + r * PITCH + margin;
						// pane origin in world, outset along the face normal
						const ox = f.ox + f.ux * u + f.nx * eps;
						const oz = f.oz + f.uz * u + f.nz * eps;
						quad(
							glow[gi],
							ox,
							v,
							oz,
							f.ux * WIN,
							0,
							f.uz * WIN, // du (horizontal)
							0,
							WIN,
							0, // dv (up)
							f.nx,
							0,
							f.nz,
						);
					}
				}
			}
		}
	}

	// ── ground: asphalt plane + street grid + streetlights ─────────────────
	const ext = half + CELL * 1.4; // plane reaches a bit past the outer plots
	const ASPHALT = packRGB(16, 18, 26); // near-black ground
	const ROAD = packRGB(40, 43, 54); // lighter road strips
	const ROAD_W = 1.7; // street width (fits the gap between footprints)

	// base plane, just below the building bases so there's no z-fight at y=0
	flatQuad(-ext, -ext, ext, ext, -0.03, ASPHALT);

	// road grid: one strip on each line BETWEEN plot rows (and the outer ring).
	// Plot centers sit at -half + k·CELL, so the streets run at the half-steps.
	for (let k = 0; k <= grid; k++) {
		const line = -half - CELL / 2 + k * CELL;
		// road running along Z (constant x = line)
		flatQuad(line - ROAD_W / 2, -ext, line + ROAD_W / 2, ext, 0.0, ROAD);
		// road running along X (constant z = line)
		flatQuad(-ext, line - ROAD_W / 2, ext, line + ROAD_W / 2, 0.01, ROAD);
	}

	// streetlights lining every road, one per block (mid-block, between
	// intersections). Each is a real (if low-poly) lamp: a thin dark POLE (added
	// to the lit walls mesh so the moon catches it) topped by a small glowing
	// HEAD (its own hot-warm emissive group, so the lamps pop and trace the
	// streets from the air), plus a faint cast-light POOL on the asphalt below.
	const lamp = glow[STREETLAMP_GROUP];
	const pool = glow[2]; // dim-warm group → subtle light cast on the road
	const POLE_H = 2.6; // pole height (authored units)
	const POLE_W = 0.12; // pole thickness
	const HEAD = 0.34; // glowing lamp-head size
	const POOL = 0.9; // cast-light pool diameter
	const dropLamp = (x: number, z: number) => {
		// pole (dark, lit) — no caps, it's thin
		box(walls, x, z, 0, POLE_H, POLE_W, POLE_W);
		// glowing head (emissive cube at the top, all faces so it reads from the
		// air and the street)
		box(
			lamp,
			x,
			z,
			POLE_H - HEAD * 0.5,
			POLE_H + HEAD * 0.5,
			HEAD,
			HEAD,
			true,
			true,
		);
		// faint pool of cast light on the road
		quad(
			pool,
			x - POOL / 2,
			0.03,
			z - POOL / 2,
			POOL,
			0,
			0,
			0,
			0,
			POOL,
			0,
			1,
			0,
		);
	};
	for (let k = 0; k <= grid; k++) {
		const line = -half - CELL / 2 + k * CELL;
		for (let j = 0; j < grid; j++) {
			const along = -half + j * CELL; // mid-block points
			dropLamp(line, along); // along the Z-running road at x = line
			dropLamp(along, line); // along the X-running road at z = line
		}
	}

	return { walls, ground, glow, radius: half + CELL, maxHeight };
}
