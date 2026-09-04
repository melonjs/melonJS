import { Bounds } from "../bounds.ts";
import ResponseObject from "../response.js";
import { raycastQuery } from "./raycast.ts";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "./sat.js";
import {
	testBox3dBox3d,
	testBox3dEllipse,
	testBox3dPolygon,
	testEllipseBox3d,
	testPolygonBox3d,
} from "./sat3d.js";

// pre-built lookup table for SAT collision tests to avoid string concatenation
// Rect and RoundRect extend Polygon, so they reuse the Polygon SAT tests
const SAT_LOOKUP = {
	PolygonPolygon: testPolygonPolygon,
	PolygonEllipse: testPolygonEllipse,
	EllipsePolygon: testEllipsePolygon,
	EllipseEllipse: testEllipseEllipse,
	RoundRectRoundRect: testPolygonPolygon,
	RoundRectPolygon: testPolygonPolygon,
	PolygonRoundRect: testPolygonPolygon,
	RoundRectEllipse: testPolygonEllipse,
	EllipseRoundRect: testEllipsePolygon,
	RectangleRectangle: testPolygonPolygon,
	RectanglePolygon: testPolygonPolygon,
	PolygonRectangle: testPolygonPolygon,
	RectangleEllipse: testPolygonEllipse,
	EllipseRectangle: testEllipsePolygon,
	RectangleRoundRect: testPolygonPolygon,
	RoundRectRectangle: testPolygonPolygon,
	// Box3d is the only shape with a depth extent, so Box3d-vs-Box3d is the
	// only pair resolved by the 3D narrowphase. Every mixed pair degrades to
	// the 2D test against the box's XY footprint, treating the planar shape
	// as unbounded along Z — see `sat3d.js` / `Box3d` for why. EVERY mixed
	// combination has to be listed: this table is looked up by string concat
	// and a missing entry is a hard crash, not a missed collision.
	Box3dBox3d: testBox3dBox3d,
	Box3dPolygon: testBox3dPolygon,
	PolygonBox3d: testPolygonBox3d,
	Box3dRectangle: testBox3dPolygon,
	RectangleBox3d: testPolygonBox3d,
	Box3dRoundRect: testBox3dPolygon,
	RoundRectBox3d: testPolygonBox3d,
	Box3dEllipse: testBox3dEllipse,
	EllipseBox3d: testEllipseBox3d,
};

/**
 * Shape-type pairs already reported as unsupported, so a mismatched pair
 * warns once instead of once per frame per pair.
 * @ignore
 * @internal
 */
const reportedMissingPairs = new Set();

/**
 * @import Entity from "../../renderable/entity/entity.js";
 * @import Container from "../../renderable/container.js";
 * @import Renderable from "../../renderable/renderable.js";
 * @import Sprite from "../../renderable/sprite.js";
 * @import NineSliceSprite from "../../renderable/nineslicesprite.js";
 * @import {Line} from "../../geometries/line.ts";
 */

// some cache bounds object used for collision detection
const boundsA = new Bounds();
const boundsB = new Bounds();

/**
 * the Detector class contains methods for detecting collisions between bodies using a broadphase algorithm.
 */
class Detector {
	/**
	 * @param {Container} world - the physic world this detector is bind to
	 */
	constructor(world) {
		// @ignore
		this.world = world;

		/**
		 * the default response object used for collisions
		 * (will be automatically populated by the collides functions)
		 * @type {ResponseObject}
		 */
		this.response = new ResponseObject();

		/**
		 * Pairs (key → [renderableA, renderableB]) that were colliding in
		 * the previous step. Diffed against `_frameSeen` at end of step
		 * to fire `onCollisionEnd` for pairs that just separated.
		 * @ignore
		 * @internal
		 */
		this._activePairs = new Map();
		/**
		 * Pairs seen during the current step. Built up as the per-object
		 * `collisions()` calls run; consumed by `endFrame()`.
		 * @ignore
		 * @internal
		 */
		this._frameSeen = new Map();
		/**
		 * Two-slot pool of "symmetric view" objects passed to the new
		 * collision lifecycle handlers (`onCollisionStart` /
		 * `onCollisionActive` / `onCollisionEnd`). Each view carries the
		 * receiver-symmetric form: `a` = receiver, `b` = partner,
		 * `normal` = MTV of receiver, `depth` = penetration scalar,
		 * plus the SAT-legacy `overlapN` / `overlapV` / `overlap` fields
		 * flipped to match the same convention.
		 *
		 * Two slots are needed because both views may be live at the
		 * same time (one handler can dispatch into the other through
		 * world mutation). Slot 0 is used for the original-a-side
		 * dispatch, slot 1 for the original-b-side.
		 * @ignore
		 * @internal
		 */
		this._symViews = [
			{
				a: null,
				b: null,
				overlap: 0,
				overlapN: { x: 0, y: 0 },
				overlapV: { x: 0, y: 0 },
				normal: { x: 0, y: 0 },
				depth: 0,
				// Z half of the same three vectors, as scalars — see
				// `ResponseObject.overlapNZ`. Always 0 unless both shapes
				// are a Box3d and the contact resolved along Z.
				overlapNZ: 0,
				overlapZ: 0,
				normalZ: 0,
				// which shape of `a` / `b` produced this contact (#1590), and
				// whether the contact exists only through trigger shapes.
				// Swapped alongside `a`/`b` so a receiver always reads its OWN
				// shape as `indexShapeA`.
				indexShapeA: -1,
				indexShapeB: -1,
				isTriggerContact: false,
			},
			{
				a: null,
				b: null,
				overlap: 0,
				overlapN: { x: 0, y: 0 },
				overlapV: { x: 0, y: 0 },
				normal: { x: 0, y: 0 },
				depth: 0,
				overlapNZ: 0,
				overlapZ: 0,
				normalZ: 0,
				indexShapeA: -1,
				indexShapeB: -1,
				isTriggerContact: false,
			},
		];

		/**
		 * Shape-pair contacts that were overlapping in the previous step (#1596).
		 * Keyed by `_shapePairKey`, diffed against `_frameShapeSeen` in
		 * `endFrame()` to fire `onShapeCollisionEnd`. Populated only when someone
		 * subscribes, so a game that does not use the feature keeps these empty.
		 * @ignore
		 * @internal
		 */
		this._activeShapePairs = new Map();
		/**
		 * @ignore
		 * @internal
		 */
		this._frameShapeSeen = new Map();

		/**
		 * Two-slot pool of receiver-symmetric shape-contact views, mirroring
		 * `_symViews`: `a` is the receiver, `b` the partner, and `shapeA` /
		 * `indexShapeA` are always the RECEIVER's shape. Two slots because both
		 * sides may be live at once when a handler mutates the world.
		 * @ignore
		 * @internal
		 */
		this._shapeViews = [
			{
				a: null,
				b: null,
				shapeA: null,
				shapeB: null,
				overlap: 0,
				overlapN: { x: 0, y: 0 },
				overlapV: { x: 0, y: 0 },
				normal: { x: 0, y: 0 },
				depth: 0,
				overlapNZ: 0,
				overlapZ: 0,
				normalZ: 0,
				indexShapeA: -1,
				indexShapeB: -1,
				isTrigger: false,
			},
			{
				a: null,
				b: null,
				shapeA: null,
				shapeB: null,
				overlap: 0,
				overlapN: { x: 0, y: 0 },
				overlapV: { x: 0, y: 0 },
				normal: { x: 0, y: 0 },
				depth: 0,
				overlapNZ: 0,
				overlapZ: 0,
				normalZ: 0,
				indexShapeA: -1,
				indexShapeB: -1,
				isTrigger: false,
			},
		];

		/**
		 * The pair currently being enumerated, so the contact callback can be a
		 * single pre-bound function rather than a closure allocated per body pair
		 * per frame.
		 * @ignore
		 * @internal
		 */
		this._contactObjA = null;
		/**
		 * @ignore
		 * @internal
		 */
		this._contactObjB = null;
		/**
		 * @ignore
		 * @internal
		 */
		this._onShapeContact = (shapeA, indexA, shapeB, indexB, isTrigger, res) => {
			this._dispatchShapeContact(
				shapeA,
				indexA,
				shapeB,
				indexB,
				isTrigger,
				res,
			);
		};
	}

	/**
	 * Populate one of the pooled symmetric views from a SAT response.
	 * `flip=false` builds the view for `response.a`'s side (legacy
	 * fields kept as-is, `normal = -overlapN` = MTV of original a).
	 * `flip=true` builds it for `response.b`'s side: `a` / `b` swap,
	 * `overlapN` / `overlapV` negated, `normal = +overlapN` (the MTV
	 * of original b).
	 * @ignore
	 * @internal
	 */
	_fillSymView(slot, satResponse, flip) {
		const view = this._symViews[slot];
		const oN = satResponse.overlapN;
		const oV = satResponse.overlapV;
		const oNZ = satResponse.overlapNZ;
		const oZ = satResponse.overlapZ;
		if (flip) {
			view.a = satResponse.b;
			view.b = satResponse.a;
			view.overlapN.x = -oN.x;
			view.overlapN.y = -oN.y;
			view.overlapV.x = -oV.x;
			view.overlapV.y = -oV.y;
			view.overlapNZ = -oNZ;
			view.overlapZ = -oZ;
			// MTV of original b = +overlapN (b moves along "from a to b" to escape)
			view.normal.x = oN.x;
			view.normal.y = oN.y;
			view.normalZ = oNZ;
			// the receiver is original `b`, so ITS shape is `indexShapeA`
			view.indexShapeA = satResponse.indexShapeB;
			view.indexShapeB = satResponse.indexShapeA;
		} else {
			view.a = satResponse.a;
			view.b = satResponse.b;
			view.overlapN.x = oN.x;
			view.overlapN.y = oN.y;
			view.overlapV.x = oV.x;
			view.overlapV.y = oV.y;
			view.overlapNZ = oNZ;
			view.overlapZ = oZ;
			// MTV of original a = -overlapN (a moves opposite of "from a to b" to escape)
			view.normal.x = -oN.x;
			view.normal.y = -oN.y;
			view.normalZ = -oNZ;
			view.indexShapeA = satResponse.indexShapeA;
			view.indexShapeB = satResponse.indexShapeB;
		}
		view.overlap = satResponse.overlap;
		view.depth = satResponse.overlap;
		view.isTriggerContact = satResponse.isTriggerContact === true;
		return view;
	}

	/**
	 * Called by the adapter at the start of a physics step. Resets the
	 * "seen this frame" set so the end-of-step diff can fire
	 * `onCollisionEnd` for pairs that no longer overlap.
	 * @ignore
	 * @internal
	 */
	beginFrame() {
		this._frameSeen.clear();
		this._frameShapeSeen.clear();
	}

	/**
	 * Called by the adapter at the end of a physics step. Diffs the
	 * "seen this frame" set against the previous-frame active pairs:
	 *   - pairs in active but not seen → fire onCollisionEnd
	 *   - swap active ← seen for the next step's diff
	 * @ignore
	 * @internal
	 */
	endFrame() {
		for (const [key, pair] of this._activePairs) {
			if (this._frameSeen.has(key)) {
				continue;
			}
			const [a, b] = pair;
			// Dispatch onCollisionEnd to whichever partner is still in the
			// scene tree. If both have been detached (level teardown), skip
			// entirely. Previously this short-circuited when *either* was
			// null/undefined, which left the survivor with an unbalanced
			// onCollisionStart / no End and they'd never learn the partner
			// left. `ancestor` is set to `undefined` on removeChild, so use
			// loose `!= null` to cover both null and undefined.
			const aAttached = a.ancestor != null;
			const bAttached = b.ancestor != null;
			if (!aAttached && !bAttached) {
				continue;
			}
			if (aAttached && typeof a.onCollisionEnd === "function") {
				a.onCollisionEnd(undefined, b);
			}
			if (bAttached && typeof b.onCollisionEnd === "function") {
				b.onCollisionEnd(undefined, a);
			}
		}
		// rotate buffers: seen becomes the new active set
		// shape-pair contacts that separated this step (#1596). Mirrors the
		// per-renderable diff above, including the detached-object rule: a
		// contact whose objects have both left the world is dropped silently
		// rather than dispatched into torn-down handlers.
		for (const [key, entry] of this._activeShapePairs) {
			if (this._frameShapeSeen.has(key)) {
				continue;
			}
			const [a, b, shapeA, shapeB] = entry;
			const aAttached = a.ancestor != null;
			const bAttached = b.ancestor != null;
			if (!aAttached && !bAttached) {
				continue;
			}
			// No geometry: the shapes have separated, so there is nothing
			// truthful to measure. The view carries identity only, which is
			// why `onCollisionEnd` passes `undefined` for its response too.
			if (aAttached && typeof a.onShapeCollisionEnd === "function") {
				a.onShapeCollisionEnd(this._fillEndedView(0, a, b, shapeA, shapeB), b);
			}
			if (bAttached && typeof b.onShapeCollisionEnd === "function") {
				b.onShapeCollisionEnd(this._fillEndedView(1, b, a, shapeB, shapeA), a);
			}
		}

		const prev = this._activePairs;
		this._activePairs = this._frameSeen;
		this._frameSeen = prev;
		const prevShapes = this._activeShapePairs;
		this._activeShapePairs = this._frameShapeSeen;
		this._frameShapeSeen = prevShapes;
		this._frameShapeSeen.clear();
	}

	/**
	 * Identity-only shape-contact view for `onShapeCollisionEnd`: the shapes
	 * have separated, so every geometric field is zeroed rather than left
	 * holding the last overlap, which would read as a live contact.
	 * @ignore
	 * @internal
	 */
	_fillEndedView(slot, receiver, partner, ownShape, otherShape) {
		const view = this._shapeViews[slot];
		view.a = receiver;
		view.b = partner;
		view.shapeA = ownShape;
		view.shapeB = otherShape;
		view.indexShapeA = receiver.body?.shapes.indexOf(ownShape) ?? -1;
		view.indexShapeB = partner.body?.shapes.indexOf(otherShape) ?? -1;
		view.isTrigger =
			ownShape?.isTrigger === true || otherShape?.isTrigger === true;
		view.overlap = 0;
		view.depth = 0;
		view.overlapN.x = 0;
		view.overlapN.y = 0;
		view.overlapV.x = 0;
		view.overlapV.y = 0;
		view.normal.x = 0;
		view.normal.y = 0;
		view.overlapNZ = 0;
		view.overlapZ = 0;
		view.normalZ = 0;
		return view;
	}

	/**
	 * Build a stable order-independent key for a pair of renderables,
	 * using their GUID. Returns undefined if either lacks a GUID (defensive
	 * — detached or pool-recycled objects mid-step).
	 * @ignore
	 * @internal
	 */
	_pairKey(a, b) {
		const ga = a.GUID;
		const gb = b.GUID;
		if (ga === undefined || gb === undefined) {
			return undefined;
		}
		return ga < gb ? `${ga}|${gb}` : `${gb}|${ga}`;
	}

	/**
	 * Re-run the narrowphase for a remembered shape pair and repopulate
	 * `response` from it.
	 *
	 * The scan clears `response` on every test, so whichever pair won has to be
	 * measured again before handlers and the solver read it. Indices are looked
	 * up here rather than carried from the scan because an enumeration handler
	 * may have mutated either body in between: `removeShape()` re-indexes, and
	 * `destroy()` empties the array outright. A shape that is no longer on its
	 * body has no contact left to resolve, so this reports failure and the
	 * caller falls through instead of throwing.
	 * @ignore
	 * @internal
	 * @returns {boolean} true when the pair was re-measured
	 */
	_retest(bodyA, bodyB, shapeA, shapeB, response) {
		const indexA = bodyA.shapes.indexOf(shapeA);
		const indexB = bodyB.shapes.indexOf(shapeB);
		if (indexA < 0 || indexB < 0) {
			return false;
		}
		const test = SAT_LOOKUP[shapeA.type + shapeB.type];
		if (test === undefined) {
			return false;
		}
		test.call(
			this,
			bodyA.ancestor,
			shapeA,
			bodyB.ancestor,
			shapeB,
			response.clear(),
		);
		response.indexShapeA = indexA;
		response.indexShapeB = indexB;
		return true;
	}

	/**
	 * Stable, order-independent key for one SHAPE pair (#1596).
	 *
	 * The renderable GUIDs order the pair, exactly as `_pairKey` does, and the
	 * two shape ids MUST swap alongside them: keying `guidA|guidB|idA|idB`
	 * without that swap gives the same physical contact two different keys
	 * depending on which object the outer loop visited first, and the contact
	 * would then End and Start every step.
	 *
	 * Shape identity is `_contactId`, stamped once in `Body#addShape` and never
	 * derived from array position, because `removeShape()` re-indexes every
	 * surviving shape.
	 * @ignore
	 * @internal
	 */
	_shapePairKey(a, b, shapeA, shapeB) {
		const ga = a.GUID;
		const gb = b.GUID;
		const sa = shapeA?._contactId;
		const sb = shapeB?._contactId;
		if (
			ga === undefined ||
			gb === undefined ||
			sa === undefined ||
			sb === undefined
		) {
			return undefined;
		}
		// Order the two (renderable, shape) TUPLES, not the GUIDs alone. Sorting
		// on GUID and swapping the shape ids behind it is only canonical while
		// the GUIDs differ; if two ever tie, the same physical contact gets two
		// different keys depending on which object the outer loop visited
		// first, and the contact would End and Start on every step.
		const left = `${ga}#${sa}`;
		const right = `${gb}#${sb}`;
		return left < right ? `${left}|${right}` : `${right}|${left}`;
	}

	/**
	 * True when an object subscribes to any shape-contact event.
	 *
	 * This is the opt-in gate: `collides()` only runs the full M x N scan when
	 * this returns true for one of the two objects, so an application that
	 * never declares these handlers performs exactly the narrowphase work it
	 * did before the feature existed.
	 * @ignore
	 * @internal
	 */
	_wantsShapeContacts(obj) {
		return (
			typeof obj.onShapeCollisionStart === "function" ||
			typeof obj.onShapeCollisionActive === "function" ||
			typeof obj.onShapeCollisionEnd === "function"
		);
	}

	/**
	 * Populate a pooled shape-contact view, same flip convention as
	 * `_fillSymView`: `flip=false` builds the view for `response.a`'s side,
	 * `flip=true` for `response.b`'s, so `shapeA` is always the receiver's.
	 * @ignore
	 * @internal
	 */
	_fillShapeView(slot, satResponse, flip, shapeA, shapeB, isTrigger) {
		const view = this._shapeViews[slot];
		const oN = satResponse.overlapN;
		const oV = satResponse.overlapV;
		const oNZ = satResponse.overlapNZ;
		const oZ = satResponse.overlapZ;
		view.overlap = satResponse.overlap;
		view.depth = satResponse.overlap;
		view.isTrigger = isTrigger === true;
		if (flip) {
			view.a = satResponse.b;
			view.b = satResponse.a;
			view.shapeA = shapeB;
			view.shapeB = shapeA;
			view.indexShapeA = satResponse.indexShapeB;
			view.indexShapeB = satResponse.indexShapeA;
			view.overlapN.x = -oN.x;
			view.overlapN.y = -oN.y;
			view.overlapV.x = -oV.x;
			view.overlapV.y = -oV.y;
			view.overlapNZ = -oNZ;
			view.overlapZ = -oZ;
			view.normal.x = oN.x;
			view.normal.y = oN.y;
			view.normalZ = oNZ;
		} else {
			view.a = satResponse.a;
			view.b = satResponse.b;
			view.shapeA = shapeA;
			view.shapeB = shapeB;
			view.indexShapeA = satResponse.indexShapeA;
			view.indexShapeB = satResponse.indexShapeB;
			view.overlapN.x = oN.x;
			view.overlapN.y = oN.y;
			view.overlapV.x = oV.x;
			view.overlapV.y = oV.y;
			view.overlapNZ = oNZ;
			view.overlapZ = oZ;
			view.normal.x = -oN.x;
			view.normal.y = -oN.y;
			view.normalZ = -oNZ;
		}
		return view;
	}

	/**
	 * Fire Start / Active for one overlapping shape pair. Called back from
	 * `collides()` once per pair, in scan order.
	 * @ignore
	 * @internal
	 */
	_dispatchShapeContact(shapeA, shapeB, isTrigger, response) {
		const objA = this._contactObjA;
		const objB = this._contactObjB;
		const key = this._shapePairKey(objA, objB, shapeA, shapeB);
		if (key === undefined || this._frameShapeSeen.has(key)) {
			// a dynamic-dynamic pair is visited twice per step (once per outer
			// loop object); the second visit must not re-fire
			return;
		}
		this._frameShapeSeen.set(key, [objA, objB, shapeA, shapeB]);
		const isEntry = !this._activeShapePairs.has(key);
		const viewA = this._fillShapeView(
			0,
			response,
			false,
			shapeA,
			shapeB,
			isTrigger,
		);
		const viewB = this._fillShapeView(
			1,
			response,
			true,
			shapeA,
			shapeB,
			isTrigger,
		);
		if (isEntry) {
			if (typeof objA.onShapeCollisionStart === "function") {
				objA.onShapeCollisionStart(viewA, objB);
			}
			if (typeof objB.onShapeCollisionStart === "function") {
				objB.onShapeCollisionStart(viewB, objA);
			}
		}
		if (typeof objA.onShapeCollisionActive === "function") {
			objA.onShapeCollisionActive(viewA, objB);
		}
		if (typeof objB.onShapeCollisionActive === "function") {
			objB.onShapeCollisionActive(viewB, objA);
		}
	}

	/**
	 * Drop the references the enumeration callback reads.
	 *
	 * They are plain fields rather than a per-pair closure so the hot path
	 * allocates nothing, which means they outlive the pair unless cleared, and
	 * would hold two renderables (and everything they reach) against garbage
	 * collection until the next subscribed pair happened to overwrite them.
	 * @ignore
	 * @internal
	 */
	_clearContactPair() {
		this._contactObjA = null;
		this._contactObjB = null;
	}

	/**
	 * determine if two objects should collide (based on both respective objects body collision mask and type).<br>
	 * you can redefine this function if you need any specific rules over what should collide with what.
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} a - a reference to the object A.
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} b - a reference to the object B.
	 * @returns {boolean} true if they should collide, false otherwise
	 */
	shouldCollide(a, b) {
		const bodyA = a.body;
		const bodyB = b.body;
		return (
			typeof bodyA === "object" &&
			typeof bodyB === "object" &&
			a !== b &&
			a.isKinematic !== true &&
			b.isKinematic !== true &&
			bodyA.shapes.length > 0 &&
			bodyB.shapes.length > 0 &&
			!(bodyA.isStatic === true && bodyB.isStatic === true) &&
			(bodyA.collisionMask & bodyB.collisionType) !== 0 &&
			(bodyA.collisionType & bodyB.collisionMask) !== 0
		);
	}

	/**
	 * detect collision between two bodies.
	 * @param {Body} bodyA - a reference to body A.
	 * @param {Body} bodyB - a reference to body B.
	 * @returns {boolean} true if colliding
	 */
	collides(bodyA, bodyB, response = this.response, onContact = undefined) {
		// Shape-contact ENUMERATION is opt-in (#1596). With no `onContact` this
		// stays undefined, the loop below early-returns on the first solid pair,
		// and the number of SAT tests is exactly what it was before the feature
		// existed. Only a caller that actually subscribes pays for the full
		// M x N scan.
		const enumerate = onContact !== undefined;
		// first solid pair seen. Without enumeration the loop returns there and
		// this is unused; with it, the scan continues and this remembers which
		// pair physical resolution gets, so the CHOSEN contact is identical
		// either way.
		//
		// Shape REFERENCES, not indices: on the enumerate path user handlers run
		// inside this scan, and a handler is free to call `removeShape()` (a
		// "drop my hurtbox when it is hit" reaction is entirely reasonable),
		// which splices and re-indexes the array. An index captured mid-scan
		// then names a different shape, or none at all, and the re-run below
		// would throw on `undefined.type` and take the whole world update with
		// it. Indices are recovered from the live arrays at re-run time.
		let solidShapeA = null;
		let solidShapeB = null;
		// first trigger-only contact seen, used only when NO solid pair overlaps
		let triggerShapeA = null;
		let triggerShapeB = null;
		// for each shape in body A
		for (
			let indexA = bodyA.shapes.length, shapeA;
			indexA--, (shapeA = bodyA.shapes[indexA]);
		) {
			// for each shape in body B
			for (
				let indexB = bodyB.shapes.length, shapeB;
				indexB--, (shapeB = bodyB.shapes[indexB]);
			) {
				// Per-shape gate (#1590), before any geometry work. A body's
				// `collisionType`/`collisionMask` still decide whether the pair
				// reaches this loop at all; these refine it per shape, so a
				// shape can narrow what its body allows but never widen it.
				//
				// `isActive === false` removes a shape from the simulation
				// entirely — no test, no contact, no events — without the cost
				// of removing and re-adding it.
				if (shapeA.isActive === false || shapeB.isActive === false) {
					continue;
				}
				// `??` and not `||`: 0 is a legitimate collision type, so an
				// unset field must fall through to the body while a deliberate
				// zero must not.
				const typeA = shapeA.collisionType ?? bodyA.collisionType;
				const maskA = shapeA.collisionMask ?? bodyA.collisionMask;
				const typeB = shapeB.collisionType ?? bodyB.collisionType;
				const maskB = shapeB.collisionMask ?? bodyB.collisionMask;
				if ((maskA & typeB) === 0 || (typeA & maskB) === 0) {
					continue;
				}

				// Resolve the narrowphase for this shape pair. An unlisted
				// combination used to index straight into `.call(...)` and
				// throw a TypeError mid-step, taking the whole world update
				// with it — reachable today with any user-defined shape type,
				// and newly reachable via `Box3d`. Warn once per pair and
				// treat it as "no collision" instead: a missed contact is
				// recoverable, a thrown physics step is not.
				const test = SAT_LOOKUP[shapeA.type + shapeB.type];
				if (test === undefined) {
					const pair = `${shapeA.type} / ${shapeB.type}`;
					if (!reportedMissingPairs.has(pair)) {
						reportedMissingPairs.add(pair);
						console.warn(
							`melonJS: no collision test for shape pair ${pair}; treating as no collision`,
						);
					}
					continue;
				}
				// full SAT collision check
				if (
					test.call(
						this,
						bodyA.ancestor, // a reference to the object A
						shapeA,
						bodyB.ancestor, // a reference to the object B
						shapeB,
						// clear response object before reusing
						response.clear(),
					) === true
				) {
					// set the shape index
					// A TRIGGER pair must not end the search. `collides` reports
					// one contact per body pair, and push-out is decided from
					// it — so returning here would let a trigger shape suppress
					// a solid sibling's push-out, and which one won would come
					// down to `shapes` array order. Remember the first trigger
					// contact and keep scanning for a solid pair, which wins if
					// one exists (#1590).
					const pairIsTrigger =
						shapeA.isTrigger === true || shapeB.isTrigger === true;
					if (enumerate === true) {
						// Every overlapping pair is reported, solid and trigger
						// alike, in the order the scan finds them. `response`
						// currently holds THIS pair's SAT result, which is what
						// the contact is describing; it is reused on the next
						// iteration, so handlers must not retain it.
						response.indexShapeA = indexA;
						response.indexShapeB = indexB;
						response.isTriggerContact = pairIsTrigger;
						onContact(shapeA, shapeB, pairIsTrigger, response);
					}
					if (pairIsTrigger) {
						if (triggerShapeA === null) {
							triggerShapeA = shapeA;
							triggerShapeB = shapeB;
						}
						continue;
					}
					if (enumerate === true) {
						// keep scanning so the remaining pairs are enumerated;
						// the first solid still wins resolution, as below
						if (solidShapeA === null) {
							solidShapeA = shapeA;
							solidShapeB = shapeB;
						}
						continue;
					}
					response.indexShapeA = indexA;
					response.indexShapeB = indexB;

					return true;
				}
			}
		}

		if (
			solidShapeA !== null &&
			this._retest(bodyA, bodyB, solidShapeA, solidShapeB, response)
		) {
			return true;
		}

		if (triggerShapeA !== null) {
			// No solid pair overlaps, so the contact is real but non-solid.
			// Re-run the remembered pair to repopulate the response: the loop
			// above cleared it on every subsequent test, and the handlers still
			// need a truthful overlap to read.
			if (this._retest(bodyA, bodyB, triggerShapeA, triggerShapeB, response)) {
				// consumed at the push-out sites — the contact reports normally
				// and simply contributes no position correction
				response.isTriggerContact = true;
				return true;
			}
		}
		return false;
	}

	/**
	 * find all the collisions for the specified object using a broadphase algorithm
	 * @ignore
	 * @internal
	 * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} objA - object to be tested for collision
	 * @returns {boolean} in case of collision, false otherwise
	 */
	collisions(objA) {
		let collisionCounter = 0;
		// retreive a list of potential colliding objects from the game world
		const candidates = this.world.broadphase.retrieve(objA);

		boundsA.addBounds(objA.getBounds(), true);
		boundsA.addBounds(objA.body.getBounds());

		for (let i = 0, len = candidates.length; i < len; i++) {
			const objB = candidates[i];
			// check if both objects "should" collide
			if (this.shouldCollide(objA, objB)) {
				boundsB.addBounds(objB.getBounds(), true);
				boundsB.addBounds(objB.body.getBounds());

				// fast AABB check if both bounding boxes are overlaping
				if (boundsA.overlaps(boundsB)) {
					// Opt-in shape-contact enumeration (#1596). Resolved once
					// per candidate pair, and when neither side subscribes the
					// callback stays undefined so `collides()` takes exactly the
					// path it took before this feature existed.
					const wantsContacts =
						this._wantsShapeContacts(objA) || this._wantsShapeContacts(objB);
					let onContact;
					if (wantsContacts === true) {
						this._contactObjA = objA;
						this._contactObjB = objB;
						onContact = this._onShapeContact;
					}
					const didCollide = this.collides(
						objA.body,
						objB.body,
						this.response,
						onContact,
					);
					if (wantsContacts === true) {
						this._clearContactPair();
					}
					if (didCollide) {
						// we touched something !
						collisionCounter++;

						// Frame-diff bookkeeping for the modern lifecycle
						// handlers (`onCollisionStart` / `onCollisionActive` /
						// `onCollisionEnd`). Each pair is dispatched at most
						// once per frame to these handlers (regardless of
						// the SAT detector visiting it twice across the two
						// outer iterations — once with objA as outer, once
						// with objB as outer). `_frameSeen` is the per-frame
						// dedup; `_activePairs` carries pair state across
						// frames so we can fire onCollisionStart on entry and
						// onCollisionEnd on separation.
						//
						// IMPORTANT: the new handlers receive a
						// receiver-symmetric view (response.a === this,
						// response.b === other, response.normal is the MTV
						// of `this`). The legacy `onCollision` dispatch
						// below uses the unmodified SAT response (fixed
						// a/b, fixed sign) for 19.4 backward compatibility.
						const pairKey = this._pairKey(objA, objB);
						const firstVisitThisFrame =
							pairKey !== undefined && !this._frameSeen.has(pairKey);
						if (firstVisitThisFrame) {
							this._frameSeen.set(pairKey, [objA, objB]);
							const isEntry = !this._activePairs.has(pairKey);
							const viewA = this._fillSymView(0, this.response, false);
							const viewB = this._fillSymView(1, this.response, true);
							if (isEntry) {
								if (typeof objA.onCollisionStart === "function") {
									objA.onCollisionStart(viewA, objB);
								}
								if (typeof objB.onCollisionStart === "function") {
									objB.onCollisionStart(viewB, objA);
								}
							}
							if (typeof objA.onCollisionActive === "function") {
								objA.onCollisionActive(viewA, objB);
							}
							if (typeof objB.onCollisionActive === "function") {
								objB.onCollisionActive(viewB, objA);
							}
						}

						// Legacy `onCollision` dispatch + SAT push-out.
						//
						// Two contracts coexist on this branch, gated by
						// whether the renderable defines an `onCollision`
						// handler at all:
						//
						//  - **Legacy gate (19.4 contract)** — if
						//    `onCollision` IS defined, push-out is gated on
						//    its return value. `return false` opts out;
						//    anything else (true / undefined / no return)
						//    applies push-out. `onCollision` itself fires
						//    twice per frame for dynamic-dynamic pairs (one
						//    per outer-loop visit), receives the unmodified
						//    SAT response. Bit-for-bit compatible with
						//    pre-19.5 behavior.
						//
						//  - **Modern default (matter-aligned)** — if
						//    `onCollision` is NOT defined, push-out happens
						//    by default for dynamic non-sensor bodies. This
						//    matches matter-js's "the solver always
						//    resolves contacts unless you flag the body as
						//    a sensor" model and removes the migration
						//    footgun for users who drop `onCollision` in
						//    favor of `onCollisionActive`.
						//
						// Sensor (`body.isSensor === true`) and static
						// (`body.isStatic === true`) bodies skip push-out
						// in both contracts, matching matter.
						// A trigger shape collides and reports normally; only the
						// position correction is skipped. `isTriggerContact` is
						// set by `collides` and means "this contact exists ONLY
						// through trigger shapes" — it is false whenever any
						// solid pair overlaps, so a trigger can never suppress
						// a solid sibling's push-out.
						// The Start / Active dispatch above is user code too, and may
						// have destroyed either object before the solver reads `body`.
						if (objA.body === undefined || objB.body === undefined) {
							continue;
						}
						const eitherSensor =
							objA.body.isSensor === true ||
							objB.body.isSensor === true ||
							this.response.isTriggerContact === true;
						// "supersedes" rule: if a renderable defines the
						// modern `onCollisionActive`, suppress its legacy
						// `onCollision` dispatch entirely. They are the
						// same every-frame contact handler in two API
						// styles; firing both would invoke two handlers
						// for one overlap with different response shapes.
						// Per-side so A and B can migrate independently.
						const aHasModern = typeof objA.onCollisionActive === "function";
						const bHasModern = typeof objB.onCollisionActive === "function";
						const aOptsOut =
							!aHasModern &&
							typeof objA.onCollision === "function" &&
							objA.onCollision(this.response, objB) === false;
						// `onCollision` is user code and may have torn either object
						// down: "remove it on pickup" is the commonest reaction there
						// is, and `Renderable.destroy()` sets `body = undefined`.
						// Everything below reads `body`, so a destroyed pair has no
						// collision left to resolve and the step moves on rather than
						// throwing out of `world.update()`. The deferred
						// `removeChild()` was always safe; `removeChildNow()` was not.
						if (objA.body === undefined || objB.body === undefined) {
							continue;
						}
						if (!aOptsOut && objA.body.isStatic === false && !eitherSensor) {
							objA.body.respondToCollision.call(objA.body, this.response);
						}
						const bOptsOut =
							!bHasModern &&
							typeof objB.onCollision === "function" &&
							objB.onCollision(this.response, objA) === false;
						// B's handler carries the same exposure as A's above
						if (objA.body === undefined || objB.body === undefined) {
							continue;
						}
						if (!bOptsOut && objB.body.isStatic === false && !eitherSensor) {
							objB.body.respondToCollision.call(objB.body, this.response);
						}

						// for multi-shape bodies (e.g. polylines), resolve remaining
						// overlaps at segment junctions.
						//
						// `!eitherSensor` matters as much here as it does above: this
						// loop writes positions DIRECTLY (`ancestor.pos.set(...)`)
						// rather than going through `respondToCollision`, and it used
						// to gate only on `isStatic`. A sensor with a single shape was
						// therefore held in place correctly, and the same sensor with
						// a second shape was pushed out anyway — the flag silently
						// stopped working the moment a body became compound.
						if (
							!eitherSensor &&
							(objA.body.shapes.length > 1 || objB.body.shapes.length > 1)
						) {
							let extraPasses = 3;
							while (extraPasses-- > 0 && this.collides(objA.body, objB.body)) {
								// Defence in depth. The `!eitherSensor` gate on this
								// loop already covers the common case, since it is
								// computed from the first reported pair. But
								// `collides` runs again each iteration and may report
								// a DIFFERENT pair — one involving a trigger — after
								// an earlier pass moved things. Cheap to re-check,
								// and the alternative is a trigger being repositioned
								// by a later pass having been correctly skipped by
								// the first.
								const passShapeA = objA.body.shapes[this.response.indexShapeA];
								const passShapeB = objB.body.shapes[this.response.indexShapeB];
								if (
									passShapeA?.isTrigger === true ||
									passShapeB?.isTrigger === true
								) {
									break;
								}
								const overlap = this.response.overlapV;
								const overlapN = this.response.overlapN;
								// Z half of the same two vectors. Both are 0 for
								// every planar shape pair, so the arithmetic below
								// is bit-for-bit inert for a 2D body — no branch
								// needed to keep the legacy path unchanged.
								const overlapZ = this.response.overlapZ;
								const overlapNZ = this.response.overlapNZ;

								// mass ratio for proportional response
								const bothDynamic = !objA.body.isStatic && !objB.body.isStatic;
								const totalMass = bothDynamic
									? objA.body.mass + objB.body.mass
									: 0;
								const ratioA = bothDynamic
									? totalMass > 0
										? objB.body.mass / totalMass
										: 0.5
									: 1;
								const ratioB = bothDynamic
									? totalMass > 0
										? objA.body.mass / totalMass
										: 0.5
									: 1;

								// correct position
								if (objA.body.isStatic === false) {
									objA.body.ancestor.pos.set(
										objA.body.ancestor.pos.x - overlap.x * ratioA,
										objA.body.ancestor.pos.y - overlap.y * ratioA,
										objA.body.ancestor.pos.z - overlapZ * ratioA,
									);
									// cancel velocity into this surface (no bounce)
									const projVel =
										objA.body.vel.x * overlapN.x +
										objA.body.vel.y * overlapN.y +
										objA.body.velZ * overlapNZ;
									if (projVel > 0) {
										objA.body.vel.x -= projVel * ratioA * overlapN.x;
										objA.body.vel.y -= projVel * ratioA * overlapN.y;
										objA.body.velZ -= projVel * ratioA * overlapNZ;
									}
								}
								if (objB.body.isStatic === false) {
									objB.body.ancestor.pos.set(
										objB.body.ancestor.pos.x + overlap.x * ratioB,
										objB.body.ancestor.pos.y + overlap.y * ratioB,
										objB.body.ancestor.pos.z + overlapZ * ratioB,
									);
									const projVel =
										objB.body.vel.x * overlapN.x +
										objB.body.vel.y * overlapN.y +
										objB.body.velZ * overlapNZ;
									if (projVel > 0) {
										objB.body.vel.x -= projVel * ratioB * overlapN.x;
										objB.body.vel.y -= projVel * ratioB * overlapN.y;
										objB.body.velZ -= projVel * ratioB * overlapNZ;
									}
								}
								// update bounds after position changed
								boundsA.addBounds(objA.getBounds(), true);
								boundsA.addBounds(objA.body.getBounds());
							}
						}
					}
				}
			}
		}
		// we could return the amount of objects we collided with ?
		return collisionCounter > 0;
	}

	/**
	 * Checks for object colliding with the given line
	 * @ignore
	 * @internal
	 * @param {Line} line - line to be tested for collision
	 * @param {Array.<Renderable>} [result] - a user defined array that will be populated with intersecting physic objects.
	 * @returns {Array.<Renderable>} an array of intersecting physic objects
	 * @example
	 *    // define a line accross the viewport
	 *    let ray = new Line(
	 *        // absolute position of the line
	 *        0, 0, [
	 *        // starting point relative to the initial position
	 *        new Vector2d(0, 0),
	 *        // ending point
	 *        new Vector2d(app.viewport.width, app.viewport.height)
	 *    ]);
	 *
	 *    // check for collition
	 *    result = me.collision.rayCast(ray);
	 *
	 *    if (result.length > 0) {
	 *        // ...
	 *    }
	 */
	rayCast(line, result = []) {
		// Thin wrapper over the shared `raycastQuery` (in `./raycast.ts`),
		// which is also used by `BuiltinAdapter.raycast` to expose the
		// portable adapter API. We drop the per-hit `{ point, normal,
		// fraction }` info and keep just the renderable array, preserving
		// the legacy `collision.rayCast` return shape. Note that hits are
		// now sorted nearest-first (was unspecified-order previously);
		// callers that depended on the unsorted order need to re-sort.
		const fromX = line.pos.x + line.points[0].x;
		const fromY = line.pos.y + line.points[0].y;
		const toX = line.pos.x + line.points[1].x;
		const toY = line.pos.y + line.points[1].y;
		const hits = raycastQuery(this.world, fromX, fromY, toX, toY);
		for (let i = 0; i < hits.length; i++) {
			result[i] = hits[i].renderable;
		}
		result.length = hits.length;
		return result;
	}
}
export default Detector;
