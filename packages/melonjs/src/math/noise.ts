/**
 * Coherent value/gradient noise with fractal (fBm / ridged) layering.
 *
 * `Noise` is the renderer-free *algorithm*: a CPU-samplable field you can read
 * directly with {@link Noise#getNoise2d} / {@link Noise#getNoise3d} for gameplay
 * (heightmaps, terrain, spawn jitter, flow fields), or feed to a
 * {@link NoiseTexture2d} to bake it into a drawable texture.
 *
 * Each sample returns a value in the `[-1, 1]` range. The field is fully
 * deterministic for a given `seed`, so the same parameters always reproduce the
 * same field.
 * @category Math
 * @example
 * const noise = new me.Noise({ type: "simplex", seed: 1337, frequency: 0.02, octaves: 4 });
 * const h = noise.getNoise2d(x, y); // -1 .. 1
 */

export type NoiseType =
	| "simplex"
	| "perlin"
	| "value"
	| "valueCubic"
	| "cellular";
export type FractalType = "none" | "fbm" | "ridged" | "pingPong";

export interface NoiseSettings {
	/** the sampling algorithm (default `"simplex"`) */
	type?: NoiseType;
	/** deterministic seed — same seed ⇒ same field (default `0`) */
	seed?: number;
	/** base frequency: smaller ⇒ larger, smoother features (default `0.01`) */
	frequency?: number;
	/** convenience alias for `1 / frequency` (feature size in pixels) */
	scale?: number;
	/** fractal layering mode (default `"fbm"` when `octaves > 1`, else `"none"`) */
	fractalType?: FractalType;
	/** number of fractal octaves summed together (default `1`) */
	octaves?: number;
	/** per-octave frequency multiplier (default `2.0`) */
	lacunarity?: number;
	/** per-octave amplitude multiplier (default `0.5`) */
	gain?: number;
	/** convenience alias for `gain` */
	persistence?: number;
	/** strength of the ping-pong fold when `fractalType === "pingPong"` (default `2.0`) */
	pingPongStrength?: number;
	/** feature-point jitter for `type === "cellular"` (0..1, default `1.0`) */
	cellularJitter?: number;
	/** perturb sample coordinates by a noise vector before sampling (default `false`) */
	domainWarp?: boolean;
	/** displacement amplitude when `domainWarp` (in coordinate units, default `30`) */
	domainWarpAmp?: number;
	/** frequency of the warp field when `domainWarp` (default `0.01`) */
	domainWarpFrequency?: number;
	/** constant offset added to sample coordinates (default `0`) */
	offsetX?: number;
	/** constant offset added to sample coordinates (default `0`) */
	offsetY?: number;
	/** constant offset added to sample coordinates (default `0`) */
	offsetZ?: number;
}

// 12 gradient directions for 3D simplex/perlin (also used for 2D, ignoring z).
// prettier-ignore
const GRAD3 = [
	1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0,
	-1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

// deterministic PRNG (mulberry32): maps a 32-bit seed to a [0,1) stream.
const mulberry32 = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const smootherstep = (t: number) => {
	return t * t * t * (t * (t * 6 - 15) + 10);
};

const lerp = (a: number, b: number, t: number) => {
	return a + (b - a) * t;
};

// triangle wave in [0,1] — folds the input back and forth (ping-pong fractal)
const pingPong = (t: number) => {
	const m = t - Math.floor(t * 0.5) * 2;
	return m < 1 ? m : 2 - m;
};

// Catmull-Rom cubic interpolation through b,c at t∈[0,1] (a,d are the outer
// control points) — used by valueCubic noise
const cubic = (a: number, b: number, c: number, d: number, t: number) => {
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		a * (-0.5 * t3 + t2 - 0.5 * t) +
		b * (1.5 * t3 - 2.5 * t2 + 1) +
		c * (-1.5 * t3 + 2 * t2 + 0.5 * t) +
		d * (0.5 * t3 - 0.5 * t2)
	);
};

export class Noise {
	type: NoiseType;
	seed: number;
	frequency: number;
	fractalType: FractalType;
	octaves: number;
	lacunarity: number;
	gain: number;
	pingPongStrength: number;
	cellularJitter: number;
	domainWarp: boolean;
	domainWarpAmp: number;
	domainWarpFrequency: number;
	offsetX: number;
	offsetY: number;
	offsetZ: number;

	// doubled permutation table (512 entries), seeded from `seed`
	/** @ignore */
	private _perm: Uint8Array;

	constructor(settings: NoiseSettings = {}) {
		this.type = settings.type ?? "simplex";
		this.seed = settings.seed ?? 0;
		this.frequency =
			settings.frequency ??
			(settings.scale ? 1 / settings.scale : undefined) ??
			0.01;
		this.octaves = settings.octaves ?? 1;
		this.fractalType =
			settings.fractalType ?? (this.octaves > 1 ? "fbm" : "none");
		this.lacunarity = settings.lacunarity ?? 2.0;
		this.gain = settings.gain ?? settings.persistence ?? 0.5;
		this.pingPongStrength = settings.pingPongStrength ?? 2.0;
		this.cellularJitter = settings.cellularJitter ?? 1.0;
		this.domainWarp = settings.domainWarp ?? false;
		this.domainWarpAmp = settings.domainWarpAmp ?? 30;
		this.domainWarpFrequency = settings.domainWarpFrequency ?? 0.01;
		this.offsetX = settings.offsetX ?? 0;
		this.offsetY = settings.offsetY ?? 0;
		this.offsetZ = settings.offsetZ ?? 0;
		this._perm = new Uint8Array(512);
		this.seedNoise(this.seed);
	}

	/**
	 * Re-seed the noise field. Same seed ⇒ same field.
	 * @param seed - the new seed value
	 * @returns this noise instance for chaining
	 */
	seedNoise(seed: number) {
		this.seed = seed;
		const rng = mulberry32(seed);
		const p = new Uint8Array(256);
		for (let i = 0; i < 256; i++) {
			p[i] = i;
		}
		// Fisher–Yates shuffle driven by the seeded PRNG
		for (let i = 255; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			const tmp = p[i];
			p[i] = p[j];
			p[j] = tmp;
		}
		for (let i = 0; i < 512; i++) {
			this._perm[i] = p[i & 255];
		}
		return this;
	}

	/**
	 * Sample the 1D noise field (a 2D slice at `y = 0`).
	 * @param x - sample coordinate
	 * @returns noise value in the `[-1, 1]` range
	 */
	getNoise1d(x: number) {
		return this.getNoise2d(x, 0);
	}

	/**
	 * Sample the 2D noise field at `(x, y)`.
	 * @param x - horizontal sample coordinate
	 * @param y - vertical sample coordinate
	 * @returns noise value in the `[-1, 1]` range
	 */
	getNoise2d(x: number, y: number) {
		let wx = x + this.offsetX;
		let wy = y + this.offsetY;
		if (this.domainWarp) {
			const wf = this.domainWarpFrequency;
			const wa = this.domainWarpAmp;
			const dx = this._simplex2d(wx * wf, wy * wf);
			const dy = this._simplex2d(wx * wf + 101.7, wy * wf + 31.4);
			wx += dx * wa;
			wy += dy * wa;
		}
		let px = wx * this.frequency;
		let py = wy * this.frequency;
		if (this.fractalType === "none" || this.octaves <= 1) {
			return this._single2d(px, py);
		}
		let amp = 1;
		let sum = 0;
		let max = 0;
		for (let o = 0; o < this.octaves; o++) {
			const n = this._applyFractalShape(this._single2d(px, py));
			sum += n * amp;
			max += amp;
			amp *= this.gain;
			px *= this.lacunarity;
			py *= this.lacunarity;
		}
		return max > 0 ? sum / max : 0;
	}

	/**
	 * Sample the 3D noise field at `(x, y, z)` — useful for animating a 2D field
	 * by advancing `z` over time, or for volumetric/tiling effects.
	 * @param x - sample coordinate
	 * @param y - sample coordinate
	 * @param z - sample coordinate
	 * @returns noise value in the `[-1, 1]` range
	 */
	getNoise3d(x: number, y: number, z: number) {
		let wx = x + this.offsetX;
		let wy = y + this.offsetY;
		let wz = z + this.offsetZ;
		if (this.domainWarp) {
			const wf = this.domainWarpFrequency;
			const wa = this.domainWarpAmp;
			const dx = this._simplex3d(wx * wf, wy * wf, wz * wf);
			const dy = this._simplex3d(wx * wf + 101.7, wy * wf + 31.4, wz * wf);
			const dz = this._simplex3d(wx * wf, wy * wf + 57.1, wz * wf + 19.3);
			wx += dx * wa;
			wy += dy * wa;
			wz += dz * wa;
		}
		let px = wx * this.frequency;
		let py = wy * this.frequency;
		let pz = wz * this.frequency;
		if (this.fractalType === "none" || this.octaves <= 1) {
			return this._single3d(px, py, pz);
		}
		let amp = 1;
		let sum = 0;
		let max = 0;
		for (let o = 0; o < this.octaves; o++) {
			const n = this._applyFractalShape(this._single3d(px, py, pz));
			sum += n * amp;
			max += amp;
			amp *= this.gain;
			px *= this.lacunarity;
			py *= this.lacunarity;
			pz *= this.lacunarity;
		}
		return max > 0 ? sum / max : 0;
	}

	// per-octave fractal shaping: fbm (passthrough), ridged, or ping-pong
	/** @ignore */
	private _applyFractalShape(n: number) {
		if (this.fractalType === "ridged") {
			const r = 1 - Math.abs(n);
			return r * r * 2 - 1;
		}
		if (this.fractalType === "pingPong") {
			return pingPong((n + 1) * this.pingPongStrength) * 2 - 1;
		}
		return n;
	}

	// single-octave 2D sample dispatched on `type`
	/** @ignore */
	private _single2d(x: number, y: number) {
		if (this.type === "value") {
			return this._value2d(x, y);
		}
		if (this.type === "valueCubic") {
			return this._valueCubic2d(x, y);
		}
		if (this.type === "perlin") {
			return this._perlin2d(x, y);
		}
		if (this.type === "cellular") {
			return this._cellular2d(x, y);
		}
		return this._simplex2d(x, y);
	}

	// single-octave 3D sample dispatched on `type`
	/** @ignore */
	private _single3d(x: number, y: number, z: number) {
		if (this.type === "value") {
			return this._value3d(x, y, z);
		}
		if (this.type === "valueCubic") {
			return this._valueCubic3d(x, y, z);
		}
		if (this.type === "perlin") {
			return this._perlin3d(x, y, z);
		}
		if (this.type === "cellular") {
			return this._cellular3d(x, y, z);
		}
		return this._simplex3d(x, y, z);
	}

	// ── value noise ──────────────────────────────────────────────────────

	// hashed lattice value in [-1,1]
	/** @ignore */
	private _hash2d(ix: number, iy: number) {
		const perm = this._perm;
		return perm[(perm[ix & 255] + iy) & 255] / 127.5 - 1;
	}

	/** @ignore */
	private _value2d(x: number, y: number) {
		const ix = Math.floor(x);
		const iy = Math.floor(y);
		const fx = smootherstep(x - ix);
		const fy = smootherstep(y - iy);
		const v00 = this._hash2d(ix, iy);
		const v10 = this._hash2d(ix + 1, iy);
		const v01 = this._hash2d(ix, iy + 1);
		const v11 = this._hash2d(ix + 1, iy + 1);
		return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
	}

	// hashed lattice value in [-1,1]
	/** @ignore */
	private _hash3d(ix: number, iy: number, iz: number) {
		const perm = this._perm;
		return perm[(perm[(perm[ix & 255] + iy) & 255] + iz) & 255] / 127.5 - 1;
	}

	/** @ignore */
	private _value3d(x: number, y: number, z: number) {
		const ix = Math.floor(x);
		const iy = Math.floor(y);
		const iz = Math.floor(z);
		const fx = smootherstep(x - ix);
		const fy = smootherstep(y - iy);
		const fz = smootherstep(z - iz);
		const c000 = this._hash3d(ix, iy, iz);
		const c100 = this._hash3d(ix + 1, iy, iz);
		const c010 = this._hash3d(ix, iy + 1, iz);
		const c110 = this._hash3d(ix + 1, iy + 1, iz);
		const c001 = this._hash3d(ix, iy, iz + 1);
		const c101 = this._hash3d(ix + 1, iy, iz + 1);
		const c011 = this._hash3d(ix, iy + 1, iz + 1);
		const c111 = this._hash3d(ix + 1, iy + 1, iz + 1);
		const x00 = lerp(c000, c100, fx);
		const x10 = lerp(c010, c110, fx);
		const x01 = lerp(c001, c101, fx);
		const x11 = lerp(c011, c111, fx);
		return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
	}

	// ── value-cubic noise (Catmull-Rom interpolated lattice) ─────────────

	// cubic-interpolated row of 4 lattice values at row `cy`
	/** @ignore */
	private _cubicRow2d(xi: number, cy: number, fx: number) {
		return cubic(
			this._hash2d(xi - 1, cy),
			this._hash2d(xi, cy),
			this._hash2d(xi + 1, cy),
			this._hash2d(xi + 2, cy),
			fx,
		);
	}

	/** @ignore */
	private _valueCubic2d(x: number, y: number) {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const fx = x - xi;
		const fy = y - yi;
		// scalar locals (no per-sample array allocation)
		const r0 = this._cubicRow2d(xi, yi - 1, fx);
		const r1 = this._cubicRow2d(xi, yi, fx);
		const r2 = this._cubicRow2d(xi, yi + 1, fx);
		const r3 = this._cubicRow2d(xi, yi + 2, fx);
		return cubic(r0, r1, r2, r3, fy);
	}

	// cubic-interpolated plane of 4×4 lattice values at depth `cz`
	/** @ignore */
	private _cubicPlane3d(
		xi: number,
		yi: number,
		cz: number,
		fx: number,
		fy: number,
	) {
		const r0 = cubic(
			this._hash3d(xi - 1, yi - 1, cz),
			this._hash3d(xi, yi - 1, cz),
			this._hash3d(xi + 1, yi - 1, cz),
			this._hash3d(xi + 2, yi - 1, cz),
			fx,
		);
		const r1 = cubic(
			this._hash3d(xi - 1, yi, cz),
			this._hash3d(xi, yi, cz),
			this._hash3d(xi + 1, yi, cz),
			this._hash3d(xi + 2, yi, cz),
			fx,
		);
		const r2 = cubic(
			this._hash3d(xi - 1, yi + 1, cz),
			this._hash3d(xi, yi + 1, cz),
			this._hash3d(xi + 1, yi + 1, cz),
			this._hash3d(xi + 2, yi + 1, cz),
			fx,
		);
		const r3 = cubic(
			this._hash3d(xi - 1, yi + 2, cz),
			this._hash3d(xi, yi + 2, cz),
			this._hash3d(xi + 1, yi + 2, cz),
			this._hash3d(xi + 2, yi + 2, cz),
			fx,
		);
		return cubic(r0, r1, r2, r3, fy);
	}

	/** @ignore */
	private _valueCubic3d(x: number, y: number, z: number) {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const zi = Math.floor(z);
		const fx = x - xi;
		const fy = y - yi;
		const fz = z - zi;
		// scalar locals (no per-sample array allocation)
		const p0 = this._cubicPlane3d(xi, yi, zi - 1, fx, fy);
		const p1 = this._cubicPlane3d(xi, yi, zi, fx, fy);
		const p2 = this._cubicPlane3d(xi, yi, zi + 1, fx, fy);
		const p3 = this._cubicPlane3d(xi, yi, zi + 2, fx, fy);
		return cubic(p0, p1, p2, p3, fz);
	}

	// ── cellular (Worley F1) noise ───────────────────────────────────────

	/** @ignore */
	private _cellular2d(x: number, y: number) {
		const perm = this._perm;
		const jitter = this.cellularJitter;
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		let minDist = 8;
		for (let oy = -1; oy <= 1; oy++) {
			for (let ox = -1; ox <= 1; ox++) {
				const cx = xi + ox;
				const cy = yi + oy;
				const h = perm[(perm[cx & 255] + (cy & 255)) & 255];
				// two pseudo-independent jitter offsets in [0,1)
				const fx = cx + (h / 255) * jitter;
				const fy = cy + (perm[(h + 71) & 255] / 255) * jitter;
				const dx = fx - x;
				const dy = fy - y;
				const d = dx * dx + dy * dy;
				if (d < minDist) {
					minDist = d;
				}
			}
		}
		// map F1 distance (~[0,1]) to [-1,1]: feature cores dark, edges bright
		return Math.min(1, Math.sqrt(minDist)) * 2 - 1;
	}

	/** @ignore */
	private _cellular3d(x: number, y: number, z: number) {
		const perm = this._perm;
		const jitter = this.cellularJitter;
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const zi = Math.floor(z);
		let minDist = 16;
		for (let oz = -1; oz <= 1; oz++) {
			for (let oy = -1; oy <= 1; oy++) {
				for (let ox = -1; ox <= 1; ox++) {
					const cx = xi + ox;
					const cy = yi + oy;
					const cz = zi + oz;
					const h =
						perm[
							(perm[(perm[cx & 255] + (cy & 255)) & 255] + (cz & 255)) & 255
						];
					const fx = cx + (h / 255) * jitter;
					const fy = cy + (perm[(h + 71) & 255] / 255) * jitter;
					const fz = cz + (perm[(h + 157) & 255] / 255) * jitter;
					const dx = fx - x;
					const dy = fy - y;
					const dz = fz - z;
					const d = dx * dx + dy * dy + dz * dz;
					if (d < minDist) {
						minDist = d;
					}
				}
			}
		}
		return Math.min(1, Math.sqrt(minDist)) * 2 - 1;
	}

	// ── perlin (improved) noise ──────────────────────────────────────────

	/** @ignore */
	private _grad2(hash: number, x: number, y: number) {
		const h = (hash & 7) * 3;
		return GRAD3[h] * x + GRAD3[h + 1] * y;
	}

	/** @ignore */
	private _perlin2d(x: number, y: number) {
		const perm = this._perm;
		const xi = Math.floor(x) & 255;
		const yi = Math.floor(y) & 255;
		const xf = x - Math.floor(x);
		const yf = y - Math.floor(y);
		const u = smootherstep(xf);
		const v = smootherstep(yf);
		const aa = perm[perm[xi] + yi];
		const ab = perm[perm[xi] + yi + 1];
		const ba = perm[perm[xi + 1] + yi];
		const bb = perm[perm[xi + 1] + yi + 1];
		const x1 = lerp(this._grad2(aa, xf, yf), this._grad2(ba, xf - 1, yf), u);
		const x2 = lerp(
			this._grad2(ab, xf, yf - 1),
			this._grad2(bb, xf - 1, yf - 1),
			u,
		);
		// scale ~[-1,1]
		return lerp(x1, x2, v) * 1.4;
	}

	/** @ignore */
	private _grad3(hash: number, x: number, y: number, z: number) {
		const h = (hash % 12) * 3;
		return GRAD3[h] * x + GRAD3[h + 1] * y + GRAD3[h + 2] * z;
	}

	/** @ignore */
	private _perlin3d(x: number, y: number, z: number) {
		const perm = this._perm;
		const xi = Math.floor(x) & 255;
		const yi = Math.floor(y) & 255;
		const zi = Math.floor(z) & 255;
		const xf = x - Math.floor(x);
		const yf = y - Math.floor(y);
		const zf = z - Math.floor(z);
		const u = smootherstep(xf);
		const v = smootherstep(yf);
		const w = smootherstep(zf);
		const aaa = perm[perm[perm[xi] + yi] + zi];
		const aba = perm[perm[perm[xi] + yi + 1] + zi];
		const aab = perm[perm[perm[xi] + yi] + zi + 1];
		const abb = perm[perm[perm[xi] + yi + 1] + zi + 1];
		const baa = perm[perm[perm[xi + 1] + yi] + zi];
		const bba = perm[perm[perm[xi + 1] + yi + 1] + zi];
		const bab = perm[perm[perm[xi + 1] + yi] + zi + 1];
		const bbb = perm[perm[perm[xi + 1] + yi + 1] + zi + 1];
		const x1 = lerp(
			this._grad3(aaa, xf, yf, zf),
			this._grad3(baa, xf - 1, yf, zf),
			u,
		);
		const x2 = lerp(
			this._grad3(aba, xf, yf - 1, zf),
			this._grad3(bba, xf - 1, yf - 1, zf),
			u,
		);
		const y1 = lerp(x1, x2, v);
		const x3 = lerp(
			this._grad3(aab, xf, yf, zf - 1),
			this._grad3(bab, xf - 1, yf, zf - 1),
			u,
		);
		const x4 = lerp(
			this._grad3(abb, xf, yf - 1, zf - 1),
			this._grad3(bbb, xf - 1, yf - 1, zf - 1),
			u,
		);
		const y2 = lerp(x3, x4, v);
		return lerp(y1, y2, w) * 1.4;
	}

	// ── simplex noise (Gustavson) ────────────────────────────────────────

	/** @ignore */
	private _simplex2d(xin: number, yin: number) {
		const perm = this._perm;
		let n0 = 0;
		let n1 = 0;
		let n2 = 0;
		const s = (xin + yin) * F2;
		const i = Math.floor(xin + s);
		const j = Math.floor(yin + s);
		const t = (i + j) * G2;
		const x0 = xin - (i - t);
		const y0 = yin - (j - t);
		let i1: number;
		let j1: number;
		if (x0 > y0) {
			i1 = 1;
			j1 = 0;
		} else {
			i1 = 0;
			j1 = 1;
		}
		const x1 = x0 - i1 + G2;
		const y1 = y0 - j1 + G2;
		const x2 = x0 - 1 + 2 * G2;
		const y2 = y0 - 1 + 2 * G2;
		const ii = i & 255;
		const jj = j & 255;
		let t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 >= 0) {
			t0 *= t0;
			const gi0 = (perm[ii + perm[jj]] % 12) * 3;
			n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0);
		}
		let t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 >= 0) {
			t1 *= t1;
			const gi1 = (perm[ii + i1 + perm[jj + j1]] % 12) * 3;
			n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1);
		}
		let t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 >= 0) {
			t2 *= t2;
			const gi2 = (perm[ii + 1 + perm[jj + 1]] % 12) * 3;
			n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2);
		}
		return 70 * (n0 + n1 + n2);
	}

	/** @ignore */
	private _simplex3d(xin: number, yin: number, zin: number) {
		const perm = this._perm;
		let n0 = 0;
		let n1 = 0;
		let n2 = 0;
		let n3 = 0;
		const s = (xin + yin + zin) * F3;
		const i = Math.floor(xin + s);
		const j = Math.floor(yin + s);
		const k = Math.floor(zin + s);
		const t = (i + j + k) * G3;
		const x0 = xin - (i - t);
		const y0 = yin - (j - t);
		const z0 = zin - (k - t);
		let i1: number;
		let j1: number;
		let k1: number;
		let i2: number;
		let j2: number;
		let k2: number;
		if (x0 >= y0) {
			if (y0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			} else if (x0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			}
		} else {
			if (y0 < z0) {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else if (x0 < z0) {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			}
		}
		const x1 = x0 - i1 + G3;
		const y1 = y0 - j1 + G3;
		const z1 = z0 - k1 + G3;
		const x2 = x0 - i2 + 2 * G3;
		const y2 = y0 - j2 + 2 * G3;
		const z2 = z0 - k2 + 2 * G3;
		const x3 = x0 - 1 + 3 * G3;
		const y3 = y0 - 1 + 3 * G3;
		const z3 = z0 - 1 + 3 * G3;
		const ii = i & 255;
		const jj = j & 255;
		const kk = k & 255;
		let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
		if (t0 >= 0) {
			t0 *= t0;
			const gi0 = (perm[ii + perm[jj + perm[kk]]] % 12) * 3;
			n0 =
				t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0 + GRAD3[gi0 + 2] * z0);
		}
		let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
		if (t1 >= 0) {
			t1 *= t1;
			const gi1 = (perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12) * 3;
			n1 =
				t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1 + GRAD3[gi1 + 2] * z1);
		}
		let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
		if (t2 >= 0) {
			t2 *= t2;
			const gi2 = (perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12) * 3;
			n2 =
				t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2 + GRAD3[gi2 + 2] * z2);
		}
		let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
		if (t3 >= 0) {
			t3 *= t3;
			const gi3 = (perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12) * 3;
			n3 =
				t3 * t3 * (GRAD3[gi3] * x3 + GRAD3[gi3 + 1] * y3 + GRAD3[gi3 + 2] * z3);
		}
		return 32 * (n0 + n1 + n2 + n3);
	}
}
