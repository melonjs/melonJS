import Renderer from "./../video/renderer.js";

/**
 * Ground ("blob") shadows for 3D objects — #1515.
 *
 * A soft dark ellipse painted on the ground beneath an object. This is not a
 * simulated shadow and does not try to be: for the paper-thin billboard
 * characters a 2.5D game is made of, a real shadow map both costs far more
 * than this engine wants to spend and *looks worse*, because a flat quad's
 * silhouette has to be special-cased to cast anything sensible at all. What
 * the player actually needs from a shadow here is contact — where the object
 * is standing, and how far off the ground it is mid-jump — and a blob says
 * exactly that.
 *
 * The blob is one textured quad laid flat on the ground plane, drawn through
 * the ordinary mesh path with blending on and depth writes off. Every shadow
 * in the scene shares one geometry and one texture, so a scene full of them
 * costs one draw each and no extra memory.
 * @ignore
 * @internal
 */

/**
 * Side length of the shared falloff bake. Large enough that the ramp reads
 * smooth when a shadow fills a good part of the screen, small enough that the
 * whole thing is a rounding error against any real texture.
 * @ignore
 * @internal
 */
const FALLOFF_SIZE = 128;

/**
 * The shared radial-falloff canvas, or `null` before first use.
 *
 * Kept as a **CPU canvas** for the same reason
 * {@link Renderer.getWhitePixel} is: the GPU copy lives in the renderer's
 * `TextureCache`, which is wiped and rebuilt on context loss, so keeping the
 * source on the CPU means the shadow survives a lost context for free. It is
 * also why this can be module-level while the quad below cannot.
 * @ignore
 * @internal
 */
let falloffCanvas = null;

/**
 * Bake (once) a radial alpha ramp: opaque white at the centre, fading to
 * fully transparent at the rim.
 *
 * White rather than black because the colour comes from the draw tint — that
 * way the same bake serves a black shadow, a tinted one, or a coloured pool
 * of light, and nothing has to be re-baked to change it.
 * @returns {HTMLCanvasElement|OffscreenCanvas} the shared falloff canvas
 * @ignore
 * @internal
 */
export function getShadowFalloff() {
	if (falloffCanvas !== null) {
		return falloffCanvas;
	}
	const canvas = Renderer.createCanvas(FALLOFF_SIZE, FALLOFF_SIZE, true);
	const context = canvas.getContext("2d");
	if (context === null) {
		throw new Error(
			"groundshadow: 2D context unavailable on the allocated canvas",
		);
	}
	const image = context.createImageData(FALLOFF_SIZE, FALLOFF_SIZE);
	const data = image.data;
	const centre = (FALLOFF_SIZE - 1) / 2;
	let at = 0;
	for (let y = 0; y < FALLOFF_SIZE; y++) {
		for (let x = 0; x < FALLOFF_SIZE; x++) {
			const dx = (x - centre) / centre;
			const dy = (y - centre) / centre;
			const distance = Math.sqrt(dx * dx + dy * dy);
			// smoothstep from the centre to the rim rather than a linear ramp:
			// a linear falloff leaves a visible hard disc in the middle and a
			// noticeable seam where it reaches zero
			const t = distance >= 1 ? 0 : 1 - distance;
			const alpha = t * t * (3 - 2 * t);
			data[at] = 255;
			data[at + 1] = 255;
			data[at + 2] = 255;
			data[at + 3] = Math.round(alpha * 255);
			at += 4;
		}
	}
	context.putImageData(image, 0, 0);
	falloffCanvas = canvas;
	return falloffCanvas;
}

/**
 * Drop the shared bake. Only the tests need this — the canvas is CPU-side and
 * costs 64 KB, so an application never has a reason to release it.
 * @ignore
 * @internal
 */
export function resetShadowFalloff() {
	falloffCanvas = null;
}

/**
 * Whether a mesh's geometry has any vertical extent at all.
 *
 * The test a **blanket** opt-in needs: a ground shadow says "this object is
 * standing above the floor", and a flat plane lying in the floor is the floor.
 * Shadowing it with itself smears a blob the size of the whole ground across
 * it, which is what a scene-wide `castGroundShadow` would otherwise do to
 * every glTF scene that ships one. A per-object opt-in bypasses this — that
 * one is an explicit instruction.
 *
 * Deliberately model-space and unrotated: the caller asks about the geometry,
 * not about where it currently sits.
 * @param {Float32Array} vertices - model-space vertex positions (x, y, z)
 * @param {number} vertexCount - how many vertices to read
 * @returns {boolean} true when the geometry is not flat in Y
 * @ignore
 * @internal
 */
export function hasVerticalExtent(vertices, vertexCount) {
	if (vertices === undefined || vertexCount === 0) {
		return false;
	}
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < vertexCount; i++) {
		const y = vertices[i * 3 + 1];
		if (y < min) {
			min = y;
		}
		if (y > max) {
			max = y;
		}
	}
	// relative to the horizontal size, so the answer does not depend on the
	// units a model happens to be authored in
	let spread = 0;
	for (let i = 0; i < vertexCount; i++) {
		const x = Math.abs(vertices[i * 3]);
		const z = Math.abs(vertices[i * 3 + 2]);
		const wider = x > z ? x : z;
		if (wider > spread) {
			spread = wider;
		}
	}
	return max - min > spread * 1e-3;
}

/**
 * The shadow quad: a 1×1 square lying in the ground plane, centred on the
 * origin, facing up.
 *
 * Render space is Y-DOWN, so the ground plane is XZ and "up" is `-Y` — the
 * same convention `Sprite3d.WORLD_UP` states.
 * @ignore
 * @internal
 */
const QUAD_VERTICES = new Float32Array([
	-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
]);
const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);
const QUAD_NORMALS = new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]);

/**
 * Borrow the shadow quad for a renderer, building it on first use.
 *
 * Cached **on the renderer**, not at module level, for two reasons: a `Mesh`
 * resolves its texture through the active renderer's texture cache, so a
 * module-level one would bind itself to whichever application happened to
 * construct it first; and hanging it off the renderer means it dies with the
 * renderer instead of outliving it.
 *
 * Two are kept — lit and unlit — so the shadow can be drawn through whichever
 * mesh batcher its owner is already using. Sharing one unlit quad between lit
 * owners would force a `litMesh → mesh → litMesh` batcher transition per
 * shadowed object, each costing a bind/unbind pair and a flush: far more than
 * the single draw the shadow is supposed to be.
 *
 * Retained geometry is keyed per mesh object, so one quad uploads once and
 * every shadow in the scene redraws it at a different matrix for free.
 * @param {object} renderer - the active renderer
 * @param {boolean} lit - whether the owning mesh draws lit
 * @param {Function} MeshClass - the `Mesh` constructor (passed in to avoid a
 * circular import: `Mesh` owns the shadow, not the other way round)
 * @returns {object} the shared shadow quad for that tier
 * @ignore
 * @internal
 */
export function getShadowQuad(renderer, lit, MeshClass) {
	let quads = renderer._shadowQuads;
	if (quads === undefined) {
		quads = renderer._shadowQuads = {};
	}
	const key = lit === true ? "lit" : "unlit";
	let quad = quads[key];
	if (quad === undefined) {
		quad = new MeshClass(0, 0, {
			vertices: QUAD_VERTICES,
			uvs: QUAD_UVS,
			indices: QUAD_INDICES,
			normals: QUAD_NORMALS,
			texture: getShadowFalloff(),
			// the geometry is already unit-sized; placement rides the matrix
			width: 1,
			normalize: false,
			lit: lit === true,
			// a ground quad is seen from above and, on a mirrored bridge, from
			// whichever side the winding lands on — never cull it
			cullBackFaces: false,
		});
		// Internal: this mesh draws with blending on and depth writes off.
		// Deliberately NOT a public `Mesh` option (#1516): a public blended
		// mesh axis means owning back-to-front sorting for arbitrary
		// translucent geometry, which a flat ground-hugging blob does not need.
		quad._blendedDraw = true;
		quads[key] = quad;
	}
	return quad;
}

/**
 * Rotation taking the world up axis onto `n`, applied to a vector lying in
 * the horizontal plane.
 *
 * The blob is ROTATED onto the receiving plane rather than projected onto it.
 * A vertical projection would lengthen it by `1 / cos(tilt)` along the slope
 * and an orthogonal one would shrink it by `cos(tilt)`, and either way the
 * blob would change size for no reason the game asked for, by more and more
 * exactly where the feature is used. A rotation preserves its shape.
 *
 * Derived rather than composed from a general axis-angle: the source axis is
 * always world up, so the usual `k x p` terms collapse and this is the
 * Rodrigues matrix with `ky = 0` written out.
 * @param {number} nx - x of the unit surface normal
 * @param {number} ny - y of it
 * @param {number} nz - z of it
 * @param {number} px - x of the horizontal vector to rotate
 * @param {number} pz - z of it
 * @param {Float64Array} out - receives the rotated vector
 * @ignore
 * @internal
 */
export function tiltOntoPlane(nx, ny, nz, px, pz, out) {
	const horizontal = nx * nx + nz * nz;
	if (horizontal < 1e-12) {
		// parallel to world up: nothing to do, or a half turn for a ceiling
		const flip = ny <= 0 ? 1 : -1;
		out[0] = px * flip;
		out[1] = 0;
		out[2] = pz;
		return;
	}
	// `cos` of the rotation is `WORLD_UP . n`, and WORLD_UP is (0, -1, 0)
	const cos = -ny;
	const w = (1 + ny) / horizontal;
	out[0] = (cos + w * nz * nz) * px - w * nx * nz * pz;
	out[1] = nx * px + nz * pz;
	out[2] = -w * nx * nz * px + (cos + w * nx * nx) * pz;
}

/**
 * How far from vertical a ground shadow's floor may tilt the blob, as the
 * cosine of the angle. Shared by the per-object and the instanced tiers.
 *
 * A blob is a flat quad with no thickness and no contact with what it lies
 * on, and the further it is tilted toward the viewer's line of sight the less
 * of it there is to see: at ninety degrees it is edge-on and gone. Past about
 * seventy-five degrees there is nothing left worth drawing, so the tilt stops
 * there rather than letting a game dial in a shadow standing on its rim.
 * @ignore
 * @internal
 */
export const SHADOW_MAX_TILT_COS = Math.cos((75 * Math.PI) / 180);

/**
 * Clamp a floor normal to the tilt ceiling, keeping it unit length.
 *
 * Clamped toward up rather than refused: a game sliding a normal off a
 * curved surface should get a shadow that stops tilting, not one that
 * vanishes at some threshold. A normal that points down, or sideways, is
 * the same case taken to its limit and lands on the ceiling too, so the
 * result always faces up and its `y` is never zero.
 * @param {number} nx - x of the unit up normal
 * @param {number} ny - y of it (negative is up: render space is Y-down)
 * @param {number} nz - z of it
 * @param {Float64Array} out - receives the clamped normal
 * @ignore
 * @internal
 */
export function clampShadowTilt(nx, ny, nz, out) {
	if (-ny < SHADOW_MAX_TILT_COS) {
		const flat = Math.hypot(nx, nz);
		const wanted = Math.sqrt(1 - SHADOW_MAX_TILT_COS * SHADOW_MAX_TILT_COS);
		const scale = flat > 1e-6 ? wanted / flat : 0;
		nx *= scale;
		nz *= scale;
		ny = -SHADOW_MAX_TILT_COS;
	}
	out[0] = nx;
	out[1] = ny;
	out[2] = nz;
}

/** scratch for the vectors `tiltOntoPlane` turns */
/**
 * Ceiling on `shadowStretch`, shared by both tiers.
 *
 * A blob is a round smudge standing in for a shape nobody traced; the further
 * it is pulled the more plainly it is a smear rather than a shadow. Past about
 * three times its own length it stops reading as one at all.
 * @ignore
 * @internal
 */
export const SHADOW_MAX_STRETCH = 3;

/**
 * The usable stretch for a given setting: 1 for anything below it or not a
 * number, and never past {@link SHADOW_MAX_STRETCH}.
 *
 * Shared so the per-object and instanced tiers cannot drift apart — the same
 * asset has to draw the same blob whichever one happens to carry it.
 * @param {number} value - the requested `shadowStretch`
 * @returns {number} the stretch to apply, in `[1, SHADOW_MAX_STRETCH]`
 * @ignore
 * @internal
 */
export function resolveShadowStretch(value) {
	if (!Number.isFinite(value) || value < 1) {
		return 1;
	}
	return value > SHADOW_MAX_STRETCH ? SHADOW_MAX_STRETCH : value;
}

/**
 * Lengthen a ground-plane vector along a ground direction.
 *
 * The anisotropic scale both tiers stretch a blob with:
 *
 *     S = I + (stretch - 1) · d ⊗ d        (d unit, in the ground plane)
 *     S·v = v + (stretch - 1) · (v · d) · d
 *
 * which leaves anything perpendicular to `d` exactly as it was, so the blob
 * grows along the light and keeps its width across it.
 * @param {number} vx - x of the vector to stretch
 * @param {number} vz - z of the vector to stretch
 * @param {number} dx - x of the unit ground direction
 * @param {number} dz - z of the unit ground direction
 * @param {number} gain - `stretch - 1`
 * @param {Float64Array|number[]} out - receives `[x, z]`
 * @returns {Float64Array|number[]} `out`
 * @ignore
 * @internal
 */
export function stretchAlong(vx, vz, dx, dz, gain, out) {
	const dot = vx * dx + vz * dz;
	out[0] = vx + gain * dot * dx;
	out[1] = vz + gain * dot * dz;
	return out;
}

const _axis = new Float64Array(3);

/**
 * The blob quad an `InstancedMesh` draws from — sized to the prototype's own
 * footprint (#1515).
 *
 * The shared quad is a unit square, and the instanced vertex stage scales it by
 * each record's horizontal scale alone. That silently assumes the prototype
 * geometry is exactly 1 unit across, which is true of almost nothing: glTF
 * meshes load with `normalize: false` and keep their authored size, so a tree
 * 3 units wide got a blob sized for a 1-unit tree. It also skipped the contact
 * spread and the minor-axis floor the per-object tier applies, so the SAME
 * asset drew a different shadow depending on whether it was instanced.
 *
 * Baking the extents into four vertices fixes it with no shader change and no
 * per-draw uniform: retained geometry is keyed per mesh object, so this uploads
 * once per `InstancedMesh` and is redrawn for free.
 * @param {object} mesh - the InstancedMesh casting the shadows
 * @param {Function} MeshClass - the `Mesh` constructor (avoids a circular import)
 * @param {number} halfX - model-space half-extent along X, spread applied
 * @param {number} halfZ - model-space half-extent along Z, spread applied
 * @param {number} version - the prototype's geometry version
 * @returns {object} the quad to draw this scatter's blobs from
 * @ignore
 * @internal
 */
/**
 * Write the quad's four corners as `±u ±v` into a 12-float array.
 * @param {Float32Array} out - the vertex array to fill
 * @param {number} ux - x of the first axis
 * @param {number} uy - y of the first axis
 * @param {number} uz - z of the first axis
 * @param {number} vx - x of the second axis
 * @param {number} vy - y of the second axis
 * @param {number} vz - z of the second axis
 * @ignore
 * @internal
 */
function writeQuadCorners(out, ux, uy, uz, vx, vy, vz) {
	out[0] = -ux - vx;
	out[1] = -uy - vy;
	out[2] = -uz - vz;
	out[3] = ux - vx;
	out[4] = uy - vy;
	out[5] = uz - vz;
	out[6] = ux + vx;
	out[7] = uy + vy;
	out[8] = uz + vz;
	out[9] = -ux + vx;
	out[10] = -uy + vy;
	out[11] = -uz + vz;
}

export function getInstancedShadowQuad(
	mesh,
	MeshClass,
	axX,
	axZ,
	azX,
	azZ,
	version,
	nx = 0,
	ny = 1,
	nz = 0,
) {
	const lit = mesh.lit === true;
	const key = `${lit}:${version}:${axX}:${axZ}:${azX}:${azZ}:${nx}:${ny}:${nz}`;
	let quad = mesh._shadowQuad;
	if (quad !== undefined && quad._shadowKey === key) {
		return quad;
	}
	// The tilt is BAKED into the four vertices rather than applied by the
	// group matrix. The instanced shadow reaches the GPU as
	// `uModelMatrix * (instancePosition + quadOffset)`, one matrix for the
	// whole set, so a rotation put there would turn the instance POSITIONS
	// too and slide the whole scatter. Baked here it rides on the offsets
	// alone, and the matrix does the other half: its Y row is the plane's
	// equation, a VERTICAL projection onto the plane, and a vector already
	// in the plane projects onto itself. So the two compose, and the blob
	// lands with the rotated quad's true shape rather than stretched by
	// `1 / cos(tilt)` the way a flat quad projected vertically would be.
	//
	// That also makes the vertex stage dropping `aVertex.y` harmless: the
	// projection reads only the vertex's own X and Z, which are exactly what
	// survive. Nothing about the slope rides on the Y it throws away.
	//
	// `nx/ny/nz` is the plane's normal in GROUP-LOCAL space: the caller pulls
	// the world normal back through the axis bridge, because these vertices
	// are in the space the bridge starts from.
	// The two axes arrive as ground-plane vectors rather than half-widths,
	// because `shadowStretch` turns them: the stretched blob's axes are no
	// longer along local X and local Z. Anything the whole set shares belongs
	// here — the quad is the one thing in this path that is NOT multiplied
	// into the instance positions.
	tiltOntoPlane(-nx, -ny, -nz, axX, axZ, _axis);
	const ux = _axis[0];
	const uy = _axis[1];
	const uz = _axis[2];
	tiltOntoPlane(-nx, -ny, -nz, azX, azZ, _axis);
	const vx = _axis[0];
	const vy = _axis[1];
	const vz = _axis[2];

	// Only four corners moved. A sun that sweeps changes them every frame, and
	// rebuilding a mesh and its GPU buffers at that rate to move twelve floats
	// is the kind of cost that makes a feature not worth having — so when a
	// quad is already here and still wants the same shader, the geometry is
	// written in place and the version bumped, which is exactly what the
	// retained path re-uploads on.
	if (quad !== undefined && quad.lit === lit) {
		writeQuadCorners(quad.originalVertices, ux, uy, uz, vx, vy, vz);
		quad.needsUpdate = true;
		quad._shadowKey = key;
		return quad;
	}
	quad?.destroy();
	const vertices = new Float32Array(12);
	writeQuadCorners(vertices, ux, uy, uz, vx, vy, vz);
	quad = new MeshClass(0, 0, {
		vertices,
		uvs: QUAD_UVS,
		indices: QUAD_INDICES,
		normals: QUAD_NORMALS,
		texture: getShadowFalloff(),
		width: 1,
		normalize: false,
		lit,
		cullBackFaces: false,
	});
	quad._blendedDraw = true;
	quad._shadowKey = key;
	mesh._shadowQuad = quad;
	return quad;
}

/**
 * Release the shadow quads a renderer built, if any. Called from renderer
 * teardown so the retained GPU geometry goes with it.
 * @param {object} renderer - the renderer being torn down
 * @ignore
 * @internal
 */
export function releaseShadowQuads(renderer) {
	const quads = renderer._shadowQuads;
	if (quads !== undefined) {
		quads.lit?.destroy();
		quads.unlit?.destroy();
		renderer._shadowQuads = undefined;
	}
}
