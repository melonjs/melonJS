import { Vector2d } from "../../math/vector2d.ts";
import { Bounds } from "../bounds.ts";
import ResponseObject from "../response.js";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "./sat.js";

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
};

/**
 * @import Entity from "../../renderable/entity/entity.js";
 * @import Container from "../../renderable/container.js";
 * @import Renderable from "../../renderable/renderable.js";
 * @import Sprite from "../../renderable/sprite.js";
 * @import NineSliceSprite from "../../renderable/nineslicesprite.js";
 * @import {Line} from "../../geometries/line.ts";
 */

// a dummy object when using Line for raycasting
const dummyObj = {
	pos: new Vector2d(0, 0),
	ancestor: {
		_absPos: new Vector2d(0, 0),
		getAbsolutePosition: function () {
			return this._absPos;
		},
	},
};

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
		 */
		this._activePairs = new Map();
		/**
		 * Pairs seen during the current step. Built up as the per-object
		 * `collisions()` calls run; consumed by `endFrame()`.
		 * @ignore
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
			},
			{
				a: null,
				b: null,
				overlap: 0,
				overlapN: { x: 0, y: 0 },
				overlapV: { x: 0, y: 0 },
				normal: { x: 0, y: 0 },
				depth: 0,
			},
		];
	}

	/**
	 * Populate one of the pooled symmetric views from a SAT response.
	 * `flip=false` builds the view for `response.a`'s side (legacy
	 * fields kept as-is, `normal = -overlapN` = MTV of original a).
	 * `flip=true` builds it for `response.b`'s side: `a` / `b` swap,
	 * `overlapN` / `overlapV` negated, `normal = +overlapN` (the MTV
	 * of original b).
	 * @ignore
	 */
	_fillSymView(slot, satResponse, flip) {
		const view = this._symViews[slot];
		const oN = satResponse.overlapN;
		const oV = satResponse.overlapV;
		if (flip) {
			view.a = satResponse.b;
			view.b = satResponse.a;
			view.overlapN.x = -oN.x;
			view.overlapN.y = -oN.y;
			view.overlapV.x = -oV.x;
			view.overlapV.y = -oV.y;
			// MTV of original b = +overlapN (b moves along "from a to b" to escape)
			view.normal.x = oN.x;
			view.normal.y = oN.y;
		} else {
			view.a = satResponse.a;
			view.b = satResponse.b;
			view.overlapN.x = oN.x;
			view.overlapN.y = oN.y;
			view.overlapV.x = oV.x;
			view.overlapV.y = oV.y;
			// MTV of original a = -overlapN (a moves opposite of "from a to b" to escape)
			view.normal.x = -oN.x;
			view.normal.y = -oN.y;
		}
		view.overlap = satResponse.overlap;
		view.depth = satResponse.overlap;
		return view;
	}

	/**
	 * Called by the adapter at the start of a physics step. Resets the
	 * "seen this frame" set so the end-of-step diff can fire
	 * `onCollisionEnd` for pairs that no longer overlap.
	 * @ignore
	 */
	beginFrame() {
		this._frameSeen.clear();
	}

	/**
	 * Called by the adapter at the end of a physics step. Diffs the
	 * "seen this frame" set against the previous-frame active pairs:
	 *   - pairs in active but not seen → fire onCollisionEnd
	 *   - swap active ← seen for the next step's diff
	 * @ignore
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
		const prev = this._activePairs;
		this._activePairs = this._frameSeen;
		this._frameSeen = prev;
	}

	/**
	 * Build a stable order-independent key for a pair of renderables,
	 * using their GUID. Returns undefined if either lacks a GUID (defensive
	 * — detached or pool-recycled objects mid-step).
	 * @ignore
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
	collides(bodyA, bodyB, response = this.response) {
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
				// full SAT collision check
				if (
					SAT_LOOKUP[shapeA.type + shapeB.type].call(
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
					response.indexShapeA = indexA;
					response.indexShapeB = indexB;

					return true;
				}
			}
		}
		return false;
	}

	/**
	 * find all the collisions for the specified object using a broadphase algorithm
	 * @ignore
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
					if (this.collides(objA.body, objB.body)) {
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
						const eitherSensor =
							objA.body.isSensor === true || objB.body.isSensor === true;
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
						if (!aOptsOut && objA.body.isStatic === false && !eitherSensor) {
							objA.body.respondToCollision.call(objA.body, this.response);
						}
						const bOptsOut =
							!bHasModern &&
							typeof objB.onCollision === "function" &&
							objB.onCollision(this.response, objA) === false;
						if (!bOptsOut && objB.body.isStatic === false && !eitherSensor) {
							objB.body.respondToCollision.call(objB.body, this.response);
						}

						// for multi-shape bodies (e.g. polylines), resolve remaining
						// overlaps at segment junctions
						if (objA.body.shapes.length > 1 || objB.body.shapes.length > 1) {
							let extraPasses = 3;
							while (extraPasses-- > 0 && this.collides(objA.body, objB.body)) {
								const overlap = this.response.overlapV;
								const overlapN = this.response.overlapN;

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
										objA.body.ancestor.pos.z,
									);
									// cancel velocity into this surface (no bounce)
									const projVel =
										objA.body.vel.x * overlapN.x + objA.body.vel.y * overlapN.y;
									if (projVel > 0) {
										objA.body.vel.x -= projVel * ratioA * overlapN.x;
										objA.body.vel.y -= projVel * ratioA * overlapN.y;
									}
								}
								if (objB.body.isStatic === false) {
									objB.body.ancestor.pos.set(
										objB.body.ancestor.pos.x + overlap.x * ratioB,
										objB.body.ancestor.pos.y + overlap.y * ratioB,
										objB.body.ancestor.pos.z,
									);
									const projVel =
										objB.body.vel.x * overlapN.x + objB.body.vel.y * overlapN.y;
									if (projVel > 0) {
										objB.body.vel.x -= projVel * ratioB * overlapN.x;
										objB.body.vel.y -= projVel * ratioB * overlapN.y;
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
		let collisionCounter = 0;

		// retrieve a list of potential colliding objects from the game world
		const candidates = this.world.broadphase.retrieve(line);

		for (let i = candidates.length, objB; i--, (objB = candidates[i]); ) {
			// fast AABB check if both bounding boxes are overlaping
			if (objB.body && line.getBounds().overlaps(objB.getBounds())) {
				// go trough all defined shapes in B (if any)
				const bLen = objB.body.shapes.length;
				if (objB.body.shapes.length === 0) {
					continue;
				}

				const shapeA = line;

				// go through all defined shapes in B
				let indexB = 0;
				do {
					const shapeB = objB.body.getShape(indexB);

					// full SAT collision check
					if (
						SAT_LOOKUP[shapeA.type + shapeB.type].call(
							this,
							dummyObj, // a reference to the object A
							shapeA,
							objB, // a reference to the object B
							shapeB,
						)
					) {
						// we touched something !
						result[collisionCounter] = objB;
						collisionCounter++;
					}
					indexB++;
				} while (indexB < bLen);
			}
		}

		// cap result in case it was not empty
		result.length = collisionCounter;

		// return the list of colliding objects
		return result;
	}
}
export default Detector;
