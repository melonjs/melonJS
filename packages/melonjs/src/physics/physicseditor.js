/**
 * Reading the shape list a physics-shape editor exports.
 *
 * The format is a map of body name to that body's fixtures, and the exact
 * shape of an entry depends on which exporter template produced the file: the
 * material values are custom parameters declared by the template rather than
 * guaranteed fields, and geometry is written either as a flat vertex list or
 * as point objects.
 *
 * ```json
 * {
 *   "banana": [
 *     { "shape": [0,0, 32,0, 32,32], "density": 2, "friction": 0.5, "bounce": 0.3 }
 *   ],
 *   "wheel": {
 *     "fixtures": [
 *       { "circle": { "x": 16, "y": 16, "radius": 12 }, "density": 1 },
 *       { "vertices": [[{ "x": 0, "y": 0 }, { "x": 8, "y": 0 }, { "x": 8, "y": 8 }]] }
 *     ]
 *   }
 * }
 * ```
 *
 * Both are read. A concave outline is exported already decomposed into convex
 * pieces, so one fixture can carry several vertex sets and yields one polygon
 * each.
 *
 * Deliberately NOT exported from the package. A caller handed a
 * `BodyShape[]` would be free to reuse it across bodies, and a body takes
 * OWNERSHIP of its shapes — the builtin pushes the caller's own `Polygon`
 * into `body.shapes` and `Body#rotate` mutates it in place — so two sprites
 * sharing one array would rotate each other's hitboxes. Resolving from the
 * inert JSON at the point a body is built makes that unrepresentable: every
 * resolution mints its own polygons.
 *
 * Copyright (C) 2011 - 2026 Olivier Biot (AltByte Pte Ltd)
 * @ignore
 * @internal
 */
import { Ellipse } from "../geometries/ellipse.ts";
import { Polygon } from "../geometries/polygon.ts";
// the cache directly, not `loader.getJSON`: `loader.js` reaches the
// renderables, which reach this module, and reading the export while that
// cycle unwinds throws on the temporal dead zone. `getJSON` is a lookup in
// exactly this object.
import { jsonList } from "../loader/cache.js";
import { Vector2d } from "../math/vector2d.ts";

/**
 * Whether a value is one entry of an exported shape list.
 *
 * Keyed on `shape` being an array, which is unambiguous: no melonJS geometry
 * carries a `shape` property, so nothing that is already a collision shape can
 * be mistaken for an entry, and nothing else in the format needs sniffing.
 * @param {*} value - the thing to test
 * @returns {boolean} true when it is an exported entry
 * @ignore
 * @internal
 */
export function isShapeEntry(value) {
	// a plain literal only: `Ellipse` carries a numeric `radius` of its own, so
	// sniffing on the fields alone would read an already-built shape as an
	// entry. Everything parsed from JSON is a literal.
	if (
		typeof value !== "object" ||
		value === null ||
		Object.getPrototypeOf(value) !== Object.prototype
	) {
		return false;
	}
	const entry = /** @type {Record<string, unknown>} */ (value);
	return (
		Array.isArray(entry.shape) ||
		Array.isArray(entry.vertices) ||
		typeof entry.radius === "number" ||
		(typeof entry.circle === "object" && entry.circle !== null)
	);
}

/**
 * Whether a body definition's `shapes` needs resolving before an adapter can
 * be handed it. False for the overwhelmingly common case of an array of
 * collision shapes, which is returned untouched.
 * @param {*} shapes - a definition's `shapes` value
 * @returns {boolean} true when it holds a loader key or exported entries
 * @ignore
 * @internal
 */
export function needsShapeResolution(shapes) {
	if (typeof shapes === "string") {
		return true;
	}
	if (!Array.isArray(shapes)) {
		return false;
	}
	for (const entry of shapes) {
		if (isShapeEntry(entry) || !isCollisionShape(entry)) {
			// an exported entry, or something that is neither that nor a
			// shape — the second still needs resolving, so the converter can
			// name the offending index rather than let it fall through to
			// `addShape` and be mistaken for a shape list
			return true;
		}
	}
	return false;
}

/**
 * Whether a value is already a collision shape.
 *
 * Recognised structurally rather than by class list, so a shape type added
 * later is not silently misrouted into the converter.
 * @param {*} value - the thing to test
 * @returns {boolean} true when a body can take it as-is
 * @ignore
 * @internal
 */
function isCollisionShape(value) {
	// Any class instance counts; a plain object literal does not. Duck-typing
	// on a method would be narrower than the truth — `Point` carries no
	// `getBounds` — and enumerating `Rect`, `Ellipse`, `Polygon`, `Line`,
	// `Point`, `Box3d` would silently misroute whichever shape is added next.
	// Everything parsed from JSON is a plain literal, so the two cannot be
	// confused.
	return (
		typeof value === "object" &&
		value !== null &&
		Object.getPrototypeOf(value) !== Object.prototype
	);
}

/**
 * Build one entry's shapes and append them.
 *
 * An entry is one fixture: a circle, or a polygon outline. A concave outline
 * is exported already decomposed, so a single fixture can carry several convex
 * vertex sets and contributes one polygon each.
 * @param {object[]} shapes - the list being built, appended to in place
 * @param {object} entry - one exported entry
 * @param {number} index - its position in the list, for error messages
 * @param {string} owner - what to name in an error
 * @ignore
 * @internal
 */
function pushEntryShapes(shapes, entry, index, owner) {
	const circle = entry.circle;
	const radius =
		typeof circle?.radius === "number" ? circle.radius : entry.radius;
	if (circle !== undefined && typeof radius !== "number") {
		// recognised as a circle, but its radius is spelled in a way this does
		// not read. Saying so beats falling through to the vertex reader and
		// dereferencing a `vertices` that was never there.
		throw new Error(
			`melonJS: ${owner} — bodyDef.shapes[${index}] is a circle with no numeric radius; expected { circle: { x, y, radius } }`,
		);
	}
	if (typeof radius === "number") {
		// a circle fixture: a centre point beside the radius rather than a
		// vertex list. `center` and a flat `x` / `y` are the other spellings.
		if (!(radius > 0)) {
			throw new Error(
				`melonJS: ${owner} — bodyDef.shapes[${index}] radius is ${radius}; expected a positive number`,
			);
		}
		const from = circle ?? entry.center ?? entry;
		const ellipse = new Ellipse(
			from.x ?? 0,
			from.y ?? 0,
			radius * 2,
			radius * 2,
		);
		applyShapeSettings(ellipse, entry);
		shapes.push(ellipse);
		return;
	}

	for (const points of entryVertexSets(entry, index, owner)) {
		// `pos` at the origin with the offset in the points, matching what the
		// builtin's own `setVertices` produces, so a body built either way
		// holds the same representation
		const polygon = new Polygon(0, 0, points);
		applyShapeSettings(polygon, entry);
		shapes.push(polygon);
	}
}

/**
 * One entry's convex outlines, as lists of points.
 *
 * Reads the two geometry spellings: a flat `shape` coordinate list, and a
 * `vertices` list of `{ x, y }` points — the latter either one outline or,
 * when the authored outline was concave, the convex pieces it decomposed into.
 * @param {object} entry - one exported entry
 * @param {number} index - its position in the list, for error messages
 * @param {string} owner - what to name in an error
 * @returns {Vector2d[][]} one list of points per convex outline
 * @ignore
 * @internal
 */
function entryVertexSets(entry, index, owner) {
	const fail = (what) => {
		throw new Error(
			`melonJS: ${owner} — bodyDef.shapes[${index}] ${what}; expected at least three vertices`,
		);
	};

	if (Array.isArray(entry.shape)) {
		const flat = entry.shape;
		if (flat.length < 6 || flat.length % 2 !== 0) {
			fail(
				`.shape has ${flat.length} coordinates, which is not an even count of six or more`,
			);
		}
		const points = [];
		for (let i = 0; i < flat.length; i += 2) {
			if (!Number.isFinite(flat[i]) || !Number.isFinite(flat[i + 1])) {
				fail(".shape holds a coordinate that is not a finite number");
			}
			points.push(new Vector2d(flat[i], flat[i + 1]));
		}
		requireArea(points, index, owner);
		return [points];
	}

	// `vertices` is a list of outlines, but a single outline written directly
	// is the other thing a template emits, so both are read
	const sets = Array.isArray(entry.vertices[0])
		? entry.vertices
		: [entry.vertices];
	return sets.map((set) => {
		if (!Array.isArray(set) || set.length < 3) {
			fail(`.vertices holds an outline of ${set?.length ?? 0} points`);
		}
		const points = set.map((point) => {
			if (
				typeof point?.x !== "number" ||
				typeof point?.y !== "number" ||
				!Number.isFinite(point.x) ||
				!Number.isFinite(point.y)
			) {
				fail(".vertices holds something that is not an { x, y } point pair");
			}
			return new Vector2d(point.x, point.y);
		});
		requireArea(points, index, owner);
		return points;
	});
}

/**
 * Reject an outline that encloses nothing.
 *
 * Three collinear points pass a vertex count check and then degenerate
 * differently on each backend: planck hulls them down to fewer than three and
 * silently substitutes a one-metre box, matter builds no body at all. Naming
 * the file's own body beats either.
 * @param {Vector2d[]} points - one outline
 * @param {number} index - its position in the list, for error messages
 * @param {string} owner - what to name in an error
 * @ignore
 * @internal
 */
function requireArea(points, index, owner) {
	let twiceArea = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[i + 1 < points.length ? i + 1 : 0];
		twiceArea += a.x * b.y - b.x * a.y;
	}
	if (!(Math.abs(twiceArea) >= 1e-6)) {
		// `!(x >= n)` and not `x < n`: NaN fails both comparisons, and a
		// non-finite outline must be rejected rather than slip through
		throw new Error(
			`melonJS: ${owner} — bodyDef.shapes[${index}] encloses no area; its vertices are collinear or repeated`,
		);
	}
}

/**
 * Carry an entry's collision settings onto the shape built from it.
 *
 * Box2D's `filter` block is deliberately NOT read, in any of its spellings.
 * Its `categoryBits` / `maskBits` live in the exporting tool's own number
 * space, which has nothing to do with {@link collision.types}: a template
 * writes Box2D's defaults (`categoryBits: 1`, `maskBits: 65535`) for every
 * fixture whether or not the author set anything, and `1` is melonJS's
 * `PLAYER_OBJECT`. Reading them would silently tag every imported shape as a
 * player and, because the narrowphase prefers a shape's type over its body's,
 * stop the body colliding with anything whose mask excludes players, with no
 * way to override it from the definition. Filtering stays the caller's to
 * state, through `bodyDef.collisionType` / `collisionMask`.
 *
 * melonJS's own names are read, for a file written or adjusted by hand, and so
 * is `isSensor`, which means the same thing in every engine.
 * @param {object} shape - the shape just built
 * @param {object} entry - the entry it came from
 * @ignore
 * @internal
 */
function applyShapeSettings(shape, entry) {
	if (typeof entry.collisionType === "number") {
		shape.collisionType = entry.collisionType;
	}
	if (typeof entry.collisionMask === "number") {
		shape.collisionMask = entry.collisionMask;
	}
	// `isSensor` is the body-level word and `isTrigger` the shape-level one;
	// templates use both spellings for the same idea
	if (entry.isTrigger === true || entry.isSensor === true) {
		shape.isTrigger = true;
	}
}

/**
 * Reduce the per-entry material values onto the body.
 *
 * The format carries them per shape, but only one of the three backends could
 * honour that: planck builds a fixture per shape, matter reads friction and
 * restitution off the parent body rather than the part. Shipping a per-shape
 * material that works on one backend of three would manufacture exactly the
 * portability bug this path exists to remove, so they reduce to the body and
 * a file that disagrees with itself says so.
 * @param {object[]} entries - the exported entries
 * @param {string} owner - what to name in a warning
 * @returns {object} the material fields the entries agree on
 * @ignore
 * @internal
 */
function reduceMaterial(entries, owner) {
	const out = {};
	const seen = {};
	for (const entry of entries) {
		// resolve each fixture to ONE value per field before comparing across
		// fixtures: `bounce` and `restitution` are two spellings of one idea,
		// so a fixture carrying both is not a fixture disagreeing with itself
		const values = {
			density: entry.density,
			restitution: entry.bounce ?? entry.restitution,
			friction: entry.friction,
		};
		for (const [field, value] of Object.entries(values)) {
			if (typeof value !== "number") {
				continue;
			}
			if (seen[field] === undefined) {
				seen[field] = value;
				out[field] = value;
			} else if (seen[field] !== value) {
				console.warn(
					`melonJS: ${owner} — shapes disagree on '${field}' (${seen[field]} and ${value}); using ${seen[field]} for the whole body`,
				);
			}
		}
	}
	return out;
}

/**
 * The material values written on the body itself.
 *
 * A template that groups fixtures under a key writes the body's own values
 * beside them, where a template that exports a bare fixture list has nowhere
 * to put them and repeats them on every fixture instead.
 * @param {object} body - the body object from the file
 * @returns {object} the material fields it carries
 * @ignore
 * @internal
 */
function bodyMaterial(body) {
	const out = {};
	const values = {
		density: body.density,
		restitution: body.bounce ?? body.restitution,
		friction: body.friction,
	};
	for (const [field, value] of Object.entries(values)) {
		if (typeof value === "number") {
			out[field] = value;
		}
	}
	if (body.isSensor === true) {
		out.isSensor = true;
	}
	return out;
}

/**
 * Resolve a body definition whose `shapes` names a loaded JSON asset, or holds
 * exported entries, into one an adapter can consume.
 *
 * Returns a SHALLOW COPY. Writing the resolved shapes back into the caller's
 * definition would hand the second body built from a shared definition literal
 * the first body's polygon instances, which is the aliasing this module exists
 * to prevent.
 * @param {object} def - the body definition as authored
 * @param {string} owner - what to name in errors, usually the renderable
 * @returns {object} a definition carrying real collision shapes
 * @ignore
 * @internal
 */
export function resolveBodyDefinition(def, owner) {
	let entries = def.shapes;
	let material = {};

	if (typeof entries === "string") {
		const json = Object.hasOwn(jsonList, entries)
			? jsonList[entries]
			: undefined;
		if (!json) {
			throw new Error(
				`melonJS: ${owner} — bodyDef.shapes: '${entries}' is not loaded; preload it with { name: "${entries}", type: "json", src: … }`,
			);
		}
		if (Array.isArray(json)) {
			// a single-body export: the file IS the fixture list, with no map
			// of names above it, so there is nothing for an id to name
			entries = json;
		} else {
			const names = Object.keys(json).join(", ");
			if (typeof def.id === "undefined") {
				throw new Error(
					`melonJS: ${owner} — bodyDef.shapes names the asset '${entries}', so bodyDef.id must name a body inside it. Available: ${names}`,
				);
			}
			if (!Object.hasOwn(json, def.id)) {
				throw new Error(
					`melonJS: ${owner} — bodyDef.id '${def.id}' is not in '${entries}'. Available: ${names}`,
				);
			}
			entries = json[def.id];
		}
		// a body is written three ways across the templates: its fixture list
		// directly, an object holding that list under `fixtures`, or an object
		// that IS one fixture. The latter two carry body-level values beside
		// the geometry, which sit under whatever the fixtures agree on.
		if (!Array.isArray(entries) && typeof entries === "object" && entries) {
			material = bodyMaterial(entries);
			if (Array.isArray(entries.fixtures)) {
				entries = entries.fixtures;
			} else if (isShapeEntry(entries)) {
				entries = [entries];
			}
		}
		if (!Array.isArray(entries)) {
			// the id is present, so the problem is the shape of what it names
			throw new Error(
				`melonJS: ${owner} — bodyDef.id '${def.id}' names something in '${def.shapes}' that is not a list of fixtures; expected an array, or an object carrying one under 'fixtures'`,
			);
		}
		if (entries.length === 0) {
			throw new Error(
				`melonJS: ${owner} — bodyDef.id '${def.id}' in '${def.shapes}' carries no fixtures, so the body would have no shapes at all`,
			);
		}
	}

	const shapes = [];
	const materialEntries = [];
	entries.forEach((entry, index) => {
		if (isCollisionShape(entry)) {
			// already a collision shape — an authored shape and an imported one
			// may sit in the same list
			shapes.push(entry);
			return;
		}
		if (!isShapeEntry(entry)) {
			throw new Error(
				`melonJS: ${owner} — bodyDef.shapes[${index}] is neither a collision shape nor an exported entry ({ shape: [x0, y0, …] })`,
			);
		}
		pushEntryShapes(shapes, entry, index, owner);
		materialEntries.push(entry);
	});

	if (materialEntries.length > 0) {
		// a fixture states more specifically than the body it belongs to
		material = { ...material, ...reduceMaterial(materialEntries, owner) };
	}

	// an explicit value on the definition states exactly what was wanted,
	// where the file only describes how the shapes were authored
	return { ...material, ...def, shapes };
}
