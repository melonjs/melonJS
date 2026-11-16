/**
 * Asking the world what is where: the ray cast, the box and sphere queries,
 * and whether a body stands on something.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import {
	type RaycastHit3d,
	type Rect,
	type Renderable,
	Sphere,
	Vector3d,
} from "melonjs";
import { emptyFootprint, growFootprint } from "../colliders/footprint";
import type { Simulation } from "../Simulation";

/**
 * How far UP a contact normal must point for {@link isGrounded} to count the
 * contact as ground, as on the 2D adapters: the upward component (`-y`, the
 * engine being Y-down) of the unit normal the body is pushed along.
 */
const GROUND_NORMAL_Y = 0.1;

/**
 * Half the depth `queryAABB` searches through, in meters: a 2D rectangle
 * query in a 3D world finds what lies over that rectangle at any depth.
 */
const QUERY_HALF_DEPTH = 1e7;

/**
 * The first collider a segment meets, from `from` to `to`, in world pixels:
 * the exact shape, not a bounding volume. A shape the ray starts inside is
 * skipped, so a body casting from its own centre does not hit itself.
 * Sensors are hit like any other body.
 * @param sim - the simulation
 * @param from - where the ray starts
 * @param to - where it ends
 * @returns the hit, or `null`
 */
export function raycast3d(
	sim: Simulation,
	from: Vector3d,
	to: Vector3d,
): RaycastHit3d | null {
	// nothing to hit once the Rapier world is freed
	if (!sim.alive) return null;
	const { units, world } = sim;
	const origin = units.inMeters(from.x, from.y, from.z);
	const dir = units.inMeters(to.x - from.x, to.y - from.y, to.z - from.z);
	if (dir.x === 0 && dir.y === 0 && dir.z === 0) return null;
	const ray = new sim.rapier.Ray(origin, dir);
	const hit = world.castRayAndGetNormal(
		ray,
		1,
		true,
		undefined,
		undefined,
		undefined,
		undefined,
		(collider) => {
			return !collider.containsPoint(origin);
		},
	);
	if (hit === null) return null;
	const entry = sim.colliders.get(hit.collider.handle);
	if (entry === undefined) return null;
	const toi = hit.timeOfImpact;
	return {
		renderable: entry.renderable,
		point: new Vector3d(
			units.toPixels(origin.x + dir.x * toi),
			units.toPixels(origin.y + dir.y * toi),
			units.toPixels(origin.z + dir.z * toi),
		),
		normal: new Vector3d(hit.normal.x, hit.normal.y, hit.normal.z),
		fraction: toi,
	};
}

/**
 * The renderables whose colliders' boxes overlap a rectangle in XY, at any
 * depth: the boxes `getBodyAABB` reports.
 * @param sim - the simulation
 * @param rect - the rectangle, in world pixels
 * @returns the renderables, each once
 */
export function queryAABB(sim: Simulation, rect: Rect): Renderable[] {
	const { units, world } = sim;
	const { x, y } = rect.pos;
	return collect(sim, (visit) => {
		world.collidersWithAabbIntersectingAabb(
			{
				x: units.toMeters(x + rect.width / 2),
				y: units.toMeters(y + rect.height / 2),
				z: 0,
			},
			{
				x: units.toMeters(rect.width / 2),
				y: units.toMeters(rect.height / 2),
				z: QUERY_HALF_DEPTH,
			},
			(collider) => {
				// Rapier keeps its own boxes loose, more so around a body that
				// moves: those are the candidates, tested here
				const entry = sim.colliders.get(collider.handle);
				const body = collider.parent();
				if (entry === undefined || body === null) return true;
				const box = emptyFootprint();
				growFootprint(entry, body.rotation(), box);
				const t = body.translation();
				const bx = units.toPixels(t.x);
				const by = units.toPixels(t.y);
				return bx + box[0] <= x + rect.width &&
					bx + box[2] >= x &&
					by + box[1] <= y + rect.height &&
					by + box[3] >= y
					? visit(collider)
					: true;
			},
		);
	});
}

/**
 * The renderables whose colliders overlap a sphere: their exact shapes.
 * @param sim - the simulation
 * @param center - the centre in world pixels, or a {@link Sphere}
 * @param [radius] - the radius in pixels, with a centre; none, or less than
 * none, is a point
 * @returns the renderables, each once
 */
export function querySphere(
	sim: Simulation,
	center: Vector3d | Sphere,
	radius?: number,
): Renderable[] {
	const { units } = sim;
	const isSphere = center instanceof Sphere;
	const c = isSphere ? center.pos : center;
	const r = isSphere ? center.radius : (radius ?? 0);
	const ball = new sim.rapier.Ball(units.toMeters(Math.max(r, 0)));
	return collect(sim, (visit) => {
		sim.world.intersectionsWithShape(
			units.inMeters(c.x, c.y, c.z),
			{ x: 0, y: 0, z: 0, w: 1 },
			ball,
			visit,
		);
	});
}

/**
 * Whether a body stands on something: a touching contact that pushes it UP,
 * as on the 2D adapters. A sensor pushes nothing, so a sensor contact counts
 * when the other body's centre is below this one's.
 * @param sim - the simulation
 * @param renderable - the body's renderable
 * @returns true while it is grounded
 */
export function isGrounded(sim: Simulation, renderable: Renderable): boolean {
	const body = sim.bodies.get(renderable);
	if (!body) return false;
	const { world } = sim;
	const bodyY = body.translation().y;
	for (const collider of sim.collidersOf.get(renderable) ?? []) {
		let grounded = false;
		world.intersectionPairsWith(collider, (other) => {
			const parent = other.parent();
			if (
				!grounded &&
				parent !== null &&
				world.intersectionPair(collider, other) &&
				parent.translation().y > bodyY
			) {
				grounded = true;
			}
		});
		world.contactPairsWith(collider, (other) => {
			if (grounded) return;
			world.contactPair(collider, other, (manifold, flipped) => {
				if (manifold.numContacts() === 0) return;
				const ny = flipped ? -manifold.normal().y : manifold.normal().y;
				// this body is pushed along the opposite of the normal
				if (-ny < -GROUND_NORMAL_Y) {
					grounded = true;
				}
			});
		});
		if (grounded) return true;
	}
	return false;
}

/**
 * The renderables a Rapier query visits, each once.
 * @param sim - the simulation
 * @param query - runs the query with the visitor
 * @returns the renderables
 */
function collect(
	sim: Simulation,
	query: (visit: (collider: RAPIER.Collider) => boolean) => void,
): Renderable[] {
	const result: Renderable[] = [];
	// nothing to find once the Rapier world is freed
	if (!sim.alive) return result;
	const seen = new Set<Renderable>();
	query((collider) => {
		const entry = sim.colliders.get(collider.handle);
		if (entry !== undefined && !seen.has(entry.renderable)) {
			seen.add(entry.renderable);
			result.push(entry.renderable);
		}
		return true;
	});
	return result;
}
