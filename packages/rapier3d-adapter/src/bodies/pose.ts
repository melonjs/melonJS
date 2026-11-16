/**
 * Writing a body's place and turn back onto its renderable: its position to
 * `pos` / `depth`, its turn onto `currentTransform`, from the transform the
 * renderable had when the body was made.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import { Mesh, type Renderable } from "melonjs";
import type { Units } from "../math/units";

/**
 * How a renderable draws its `currentTransform`, so the body's turn can be
 * written onto it: `bridge` is the sign of each axis between the space the
 * transform turns in and the engine's (a {@link Mesh} turns in its source's
 * Y-up space), and `base` the transform it had when the body was made.
 */
export interface Pose {
	base: Float64Array;
	bridge: [number, number, number];
}

/**
 * A renderable's pose as it stands, to turn from.
 * @param renderable - the renderable a body is made for
 * @returns its pose
 */
export function poseOf(renderable: Renderable): Pose {
	return {
		base: Float64Array.from(renderable.currentTransform.val),
		bridge:
			renderable instanceof Mesh
				? // a mesh turns in its source's Y-up space (see Mesh)
					[1, -1, renderable.rightHanded ? -1 : 1]
				: [1, 1, 1],
	};
}

/**
 * Write a body's position onto its renderable's `pos` / `depth` and, given a
 * pose, its turn onto its `currentTransform`.
 * @param renderable - the renderable
 * @param body - its body
 * @param pose - its pose, or undefined to write the position only
 * @param units - the scale between pixels and meters
 */
export function writePose(
	renderable: Renderable,
	body: RAPIER.RigidBody,
	pose: Pose | undefined,
	units: Units,
): void {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
	if (!renderable.pos) {
		return;
	}
	const p = body.translation();
	renderable.pos.x = units.toPixels(p.x);
	renderable.pos.y = units.toPixels(p.y);
	renderable.depth = units.toPixels(p.z);
	if (pose === undefined) {
		return;
	}
	const { x, y, z, w } = body.rotation();
	// the turn as a matrix, R[row][col]
	const r00 = 1 - 2 * (y * y + z * z);
	const r01 = 2 * (x * y - z * w);
	const r02 = 2 * (x * z + y * w);
	const r10 = 2 * (x * y + z * w);
	const r11 = 1 - 2 * (x * x + z * z);
	const r12 = 2 * (y * z - x * w);
	const r20 = 2 * (x * z - y * w);
	const r21 = 2 * (y * z + x * w);
	const r22 = 1 - 2 * (x * x + y * y);
	// carried into the space the transform turns in: D · R · D, with the
	// bridge D its own inverse
	const [d0, d1, d2] = pose.bridge;
	const m = [
		r00,
		r01 * d0 * d1,
		r02 * d0 * d2,
		r10 * d1 * d0,
		r11,
		r12 * d1 * d2,
		r20 * d2 * d0,
		r21 * d2 * d1,
		r22,
	];
	// currentTransform = R' · base, column by column (column-major)
	const out = renderable.currentTransform.val;
	const base = pose.base;
	for (let col = 0; col < 4; col++) {
		const o = col * 4;
		const b0 = base[o];
		const b1 = base[o + 1];
		const b2 = base[o + 2];
		out[o] = m[0] * b0 + m[1] * b1 + m[2] * b2;
		out[o + 1] = m[3] * b0 + m[4] * b1 + m[5] * b2;
		out[o + 2] = m[6] * b0 + m[7] * b1 + m[8] * b2;
		out[o + 3] = base[o + 3];
	}
	renderable.isDirty = true;
}
