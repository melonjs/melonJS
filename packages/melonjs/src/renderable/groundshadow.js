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
 */

/**
 * Side length of the shared falloff bake. Large enough that the ramp reads
 * smooth when a shadow fills a good part of the screen, small enough that the
 * whole thing is a rounding error against any real texture.
 * @ignore
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
 */
export function getInstancedShadowQuad(mesh, MeshClass, halfX, halfZ, version) {
	const key = `${mesh.lit === true}:${version}:${halfX}:${halfZ}`;
	let quad = mesh._shadowQuad;
	if (quad !== undefined && quad._shadowKey === key) {
		return quad;
	}
	quad?.destroy();
	quad = new MeshClass(0, 0, {
		vertices: new Float32Array([
			-halfX,
			0,
			-halfZ,
			halfX,
			0,
			-halfZ,
			halfX,
			0,
			halfZ,
			-halfX,
			0,
			halfZ,
		]),
		uvs: QUAD_UVS,
		indices: QUAD_INDICES,
		normals: QUAD_NORMALS,
		texture: getShadowFalloff(),
		width: 1,
		normalize: false,
		lit: mesh.lit === true,
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
 */
export function releaseShadowQuads(renderer) {
	const quads = renderer._shadowQuads;
	if (quads !== undefined) {
		quads.lit?.destroy();
		quads.unlit?.destroy();
		renderer._shadowQuads = undefined;
	}
}
