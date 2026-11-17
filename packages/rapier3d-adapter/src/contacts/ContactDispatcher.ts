/**
 * Collision events: Rapier's start and end events, and every pair still
 * touching once a frame, turned into melonJS's collision hooks.
 *
 * On each renderable of a pair it fires the shape-level hook
 * (`onShapeCollisionStart`, `…Active`, `…End`), then the body-level one
 * (`onCollisionStart`, `onCollisionActive` or the legacy `onCollision`,
 * `onCollisionEnd`). A hook may take a body out of the world, even one of the
 * pair it is told about: the bookkeeping here makes sure no one hears of an
 * end before its start, nor of anything once its body is gone.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { Renderable } from "melonjs";
import type { ColliderEntry } from "../colliders/types";
import type { Simulation } from "../Simulation";

type Phase = "start" | "active" | "end";

/** Which hooks of a pair a dispatch reaches: one bit per side and level. */
const SIDE_A = 1;
const SIDE_B = 2;
const SHAPE_A = 4;
const SHAPE_B = 8;
const EVERY_SIDE = SIDE_A | SIDE_B | SHAPE_A | SHAPE_B;

/**
 * A pair whose start or active hooks are running. When one of them takes a
 * body of the pair out, the contact's end is told in the order a hook can
 * rely on: to the side going out at once, while it is whole, and to the other
 * once the hooks are done; and only to a side that heard the start.
 */
interface Dispatch {
	key: string;
	h1: number;
	h2: number;
	e1: ColliderEntry;
	e2: ColliderEntry;
	/** the sides that may hear the end: those the start reached */
	reached: number;
	/** the sides already told the end */
	told: number;
	/** true once a body of the pair was taken out */
	ended: boolean;
}

/**
 * A key for an unordered pair of colliders.
 * @param h1 - one collider handle
 * @param h2 - the other
 * @returns the same key for (h1, h2) and (h2, h1)
 */
function pairKey(h1: number, h2: number): string {
	return h1 < h2 ? `${h1}:${h2}` : `${h2}:${h1}`;
}

export class ContactDispatcher {
	/** touching pairs, from Rapier's start events until their end */
	readonly activePairs = new Map<string, [number, number]>();
	private readonly sim: Simulation;
	private eventQueue!: RAPIER.EventQueue;
	/** a step's events, collected before any is dispatched */
	private readonly pendingEvents: number[] = [];
	/** the pairs whose start or active hooks are running, innermost last */
	private readonly dispatching: Dispatch[] = [];

	/**
	 * @param sim - the simulation it reports on
	 */
	constructor(sim: Simulation) {
		this.sim = sim;
	}

	/**
	 * The queue Rapier writes a step's start and end events to.
	 * @returns the event queue to pass to `world.step`
	 */
	get queue(): RAPIER.EventQueue {
		return this.eventQueue;
	}

	/** Make the event queue, with the Rapier world. */
	open(): void {
		this.eventQueue = new this.sim.rapier.EventQueue(true);
	}

	/** Free the event queue, and forget every pair. */
	close(): void {
		this.eventQueue.free();
		this.activePairs.clear();
		this.pendingEvents.length = 0;
		this.dispatching.length = 0;
	}

	/**
	 * Dispatch the start and end events Rapier queued during the last step.
	 * They are all read before any is dispatched, so a handler that removes a
	 * body cannot disturb the queue.
	 */
	dispatchQueuedEvents(): void {
		const events = this.pendingEvents;
		events.length = 0;
		this.eventQueue.drainCollisionEvents((h1, h2, started) => {
			events.push(h1, h2, started ? 1 : 0);
		});
		for (let i = 0; i < events.length; i += 3) {
			const h1 = events[i];
			const h2 = events[i + 1];
			const key = pairKey(h1, h2);
			if (events[i + 2] === 1) {
				// a hook earlier in this step may have taken one of them out
				if (this.sim.colliders.has(h1) && this.sim.colliders.has(h2)) {
					this.activePairs.set(key, [h1, h2]);
					this.dispatchPair(h1, h2, "start");
				}
			} else if (this.activePairs.delete(key)) {
				// a pair already ended (one of its bodies was removed) is not
				// ended twice
				this.dispatchPair(h1, h2, "end");
			}
		}
	}

	/** Once per frame: the active hooks of every pair still touching. */
	dispatchActiveContacts(): void {
		for (const [h1, h2] of this.activePairs.values()) {
			this.dispatchPair(h1, h2, "active");
		}
	}

	/**
	 * Tell the pairs touching colliders that are about to go that their
	 * contact ended. The colliders must still be known: forget them after.
	 * @param colliders - the colliders leaving the world
	 */
	endContacts(colliders: RAPIER.Collider[]): void {
		const handles = new Set(
			colliders.map((c) => {
				return c.handle;
			}),
		);
		// a pair whose start or active hooks are running: the side going out
		// hears the end now, the other once those hooks are done, so that no
		// one hears of an end before its start
		for (const d of this.dispatching) {
			const going =
				(handles.has(d.h1) ? SIDE_A | SHAPE_A : 0) |
				(handles.has(d.h2) ? SIDE_B | SHAPE_B : 0);
			if (going !== 0 && (this.activePairs.delete(d.key) || d.ended)) {
				d.ended = true;
				const sides = going & d.reached & ~d.told;
				d.told |= sides;
				this.dispatch(d.e1, d.e2, d.h1, d.h2, "end", sides);
			}
		}
		for (const [key, [h1, h2]] of this.activePairs) {
			if (handles.has(h1) || handles.has(h2)) {
				this.activePairs.delete(key);
				this.dispatchPair(h1, h2, "end");
			}
		}
	}

	/**
	 * Fire the hooks of one pair of colliders, on both renderables. A start or
	 * active hook may take a body of the pair out: see {@link Dispatch}.
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @param phase - which lifecycle hook to fire
	 */
	private dispatchPair(h1: number, h2: number, phase: Phase): void {
		const e1 = this.sim.colliders.get(h1);
		const e2 = this.sim.colliders.get(h2);
		if (e1 === undefined || e2 === undefined) return;
		if (phase === "end") {
			this.dispatch(e1, e2, h1, h2, phase, EVERY_SIDE);
			return;
		}
		const current: Dispatch = {
			key: pairKey(h1, h2),
			h1,
			h2,
			e1,
			e2,
			// a pair already active had its start on every side
			reached: phase === "start" ? 0 : EVERY_SIDE,
			told: 0,
			ended: false,
		};
		this.dispatching.push(current);
		try {
			this.dispatch(
				e1,
				e2,
				h1,
				h2,
				phase,
				EVERY_SIDE,
				phase === "start" ? current : undefined,
			);
		} finally {
			this.dispatching.splice(this.dispatching.indexOf(current), 1);
		}
		if (current.ended) {
			this.dispatch(e1, e2, h1, h2, "end", current.reached & ~current.told);
		}
	}

	/**
	 * Fire one phase of a pair's hooks: the shape-level ones, then the
	 * renderables' own. A renderable whose body is gone hears nothing.
	 * @param e1 - the first collider's entry
	 * @param e2 - the second collider's entry
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @param phase - which lifecycle hook to fire
	 * @param sides - the sides and levels to fire it on, as bits
	 * @param [record] - where to note each side reached, before its hook runs
	 */
	private dispatch(
		e1: ColliderEntry,
		e2: ColliderEntry,
		h1: number,
		h2: number,
		phase: Phase,
		sides: number,
		record?: Dispatch,
	): void {
		const rA = e1.renderable;
		const rB = e2.renderable;
		// skip start/active when either side has left the world; an end still
		// reaches the side that remains
		const ancA = (rA as Renderable & { ancestor?: object | null }).ancestor;
		const ancB = (rB as Renderable & { ancestor?: object | null }).ancestor;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild
		const aDetached = ancA === null;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: ancestor is set to null by Container on removeChild
		const bDetached = ancB === null;
		if (phase === "end") {
			if (aDetached && bDetached) return;
		} else if (aDetached || bDetached) {
			return;
		}
		// a hook earlier in this dispatch may have removed a body: its
		// renderable hears nothing from then on
		const reaches = (side: number, receiver: Renderable, detached: boolean) => {
			if ((sides & side) === 0 || detached || !this.sim.bodies.has(receiver)) {
				return false;
			}
			if (record !== undefined) {
				record.reached |= side;
			}
			return true;
		};

		// a separated pair has no contact: identity only
		const { nx, ny, nz, depth } =
			phase === "end"
				? { nx: 0, ny: 0, nz: 0, depth: 0 }
				: this.contact(h1, h2);

		// each melonJS shape is one collider, so Rapier's events name the
		// shapes: the shape-level hooks first
		const shapeMethod =
			phase === "start"
				? "onShapeCollisionStart"
				: phase === "end"
					? "onShapeCollisionEnd"
					: "onShapeCollisionActive";
		const isTrigger =
			(e1.shape as { isTrigger?: boolean }).isTrigger === true ||
			(e2.shape as { isTrigger?: boolean }).isTrigger === true;
		const emitShape = (
			own: ColliderEntry,
			other: ColliderEntry,
			sign: number,
		): void => {
			const receiver = own.renderable;
			const fn = (receiver as Renderable & Record<string, unknown>)[
				shapeMethod
			];
			if (typeof fn !== "function") return;
			// (`+ 0` keeps a zero normal from reading as -0)
			const ownNx = sign * nx + 0;
			const ownNy = sign * ny + 0;
			const ownNz = sign * nz + 0;
			(fn as (contact: unknown, other: Renderable) => unknown).call(
				receiver,
				{
					a: receiver,
					b: other.renderable,
					shapeA: own.shape,
					shapeB: other.shape,
					indexShapeA: own.index,
					indexShapeB: other.index,
					isTrigger,
					depth,
					overlap: depth,
					normal: { x: ownNx, y: ownNy },
					normalZ: ownNz,
					// the SAT fields, in the builtin's convention
					overlapN: { x: -ownNx + 0, y: -ownNy + 0 },
					overlapNZ: -ownNz + 0,
					overlapV: { x: -ownNx * depth + 0, y: -ownNy * depth + 0 },
					overlapZ: -ownNz * depth + 0,
				},
				other.renderable,
			);
		};
		// the normal points from A to B: A escapes along its opposite, B
		// along it
		if (reaches(SHAPE_A, rA, aDetached)) {
			emitShape(e1, e2, -1);
		}
		if (reaches(SHAPE_B, rB, bDetached)) {
			emitShape(e2, e1, 1);
		}

		// then the renderables' own hooks
		const bodyMethod = (receiver: Renderable): string => {
			if (phase === "start") return "onCollisionStart";
			if (phase === "end") return "onCollisionEnd";
			return typeof (receiver as Renderable & { onCollisionActive?: unknown })
				.onCollisionActive === "function"
				? "onCollisionActive"
				: "onCollision";
		};
		const pair = { collider1: h1, collider2: h2 };
		const emit = (receiver: Renderable, other: Renderable, sign: number) => {
			const fn = (receiver as Renderable & Record<string, unknown>)[
				bodyMethod(receiver)
			];
			if (typeof fn !== "function") return;
			(fn as (response: unknown, other: Renderable) => unknown).call(
				receiver,
				{
					a: receiver,
					b: other,
					normal: { x: sign * nx + 0, y: sign * ny + 0, z: sign * nz + 0 },
					depth,
					pair,
				},
				other,
			);
		};
		if (reaches(SIDE_A, rA, aDetached)) {
			emit(rA, rB, -1);
		}
		if (reaches(SIDE_B, rB, bDetached)) {
			emit(rB, rA, 1);
		}
	}

	/**
	 * The contact between two colliders: the normal from the first to the
	 * second, and how deep they overlap, in pixels. Zero for a sensor pair,
	 * which Rapier computes no contact for.
	 * @param h1 - the first collider handle
	 * @param h2 - the second
	 * @returns the normal and the depth
	 */
	private contact(
		h1: number,
		h2: number,
	): { nx: number; ny: number; nz: number; depth: number } {
		const { world, units } = this.sim;
		const c1 = world.getCollider(h1);
		const c2 = world.getCollider(h2);
		let nx = 0;
		let ny = 0;
		let nz = 0;
		let depth = 0;
		if (c1.isSensor() || c2.isSensor()) {
			return { nx, ny, nz, depth };
		}
		world.contactPair(c1, c2, (manifold, flipped) => {
			const count = manifold.numContacts();
			if (count === 0) return;
			const n = manifold.normal();
			let deepest = 0;
			for (let i = 0; i < count; i++) {
				const d = -manifold.contactDist(i);
				if (d > deepest) deepest = d;
			}
			if (deepest >= depth) {
				depth = deepest;
				const s = flipped ? -1 : 1;
				nx = s * n.x;
				ny = s * n.y;
				nz = s * n.z;
			}
		});
		return { nx, ny, nz, depth: units.toPixels(depth) };
	}
}
