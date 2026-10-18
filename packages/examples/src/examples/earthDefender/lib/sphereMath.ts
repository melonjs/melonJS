import { type Matrix3d, math, Vector3d } from "melonjs";
/**
 * melonJS — Earth Defender: movement on the surface of a sphere.
 *
 * Everything in this game lives at a point on a globe, so a position is
 * not an (x, y, z) you integrate: it is a UNIT VECTOR from the planet's
 * centre, and a heading is a unit vector tangent to the surface there.
 * Moving forward is a rotation of that pair in the plane they span, and
 * turning is a rotation of the heading about the position. Both are exact
 * rotations, so nothing drifts off the sphere and nothing degenerates at
 * the poles, which is the trap every latitude/longitude formulation walks
 * into.
 *
 * Three properties fall out of that formulation rather than being coded for:
 *
 * - **The ship is locked to a shell.** Its position IS a unit vector, so
 *   there is no altitude to change and no input that could change one.
 *   Every control resolves to a rotation along the curvature.
 * - **The level wraps, everywhere.** Travelling in a straight line is
 *   travelling a great circle, which closes: hold a heading and the ship
 *   comes back to where it started, from the other side, after 2π radians.
 * - **No seams and no poles.** There is no chart to stitch and no latitude
 *   where the maths degenerates, which is the trap a longitude/latitude
 *   formulation walks into.
 *
 * Kept as free functions on plain `{x, y, z}` records rather than on
 * `Vector3d`: this file is the novel part of the prototype, and it reads
 * better as maths than as method chains. The engine boundary is one
 * function, {@link project}.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * @module
 */

/** a thing on the surface: where it is, and which way it faces */
export interface SurfaceFrame {
	/** unit vector from the planet centre — WHERE */
	pos: Vector3d;
	/** unit vector tangent to the surface at `pos` — WHICH WAY */
	heading: Vector3d;
}

export const dot = (a: Vector3d, b: Vector3d): number => a.dot(b);

export const cross = (
	a: Vector3d,
	b: Vector3d,
	out: Vector3d = new Vector3d(),
): Vector3d => out.copy(a).cross(b);

export const normalize = (
	v: Vector3d,
	out: Vector3d = new Vector3d(),
): Vector3d => out.copy(v).normalize();

/** `a * sa + b * sb`, the one combination every rotation below is built from */
const combine = (a: Vector3d, sa: number, b: Vector3d, sb: number): Vector3d =>
	new Vector3d(a.x * sa + b.x * sb, a.y * sa + b.y * sb, a.z * sa + b.z * sb);

/**
 * Move forward along the great circle the frame is facing down.
 *
 * `pos` and `heading` are perpendicular unit vectors, so they are an
 * orthonormal basis for the plane containing that great circle, and
 * travelling along it is just a rotation within that plane. Both vectors
 * turn by the same angle, which is what keeps the heading tangent.
 *
 * Because it is a rotation and not a step-and-renormalize, there is no
 * accumulating error to correct: a body can circle the planet all day and
 * still be exactly on it.
 * @param f - the frame to advance
 * @param angle - radians of arc to travel
 * @returns the advanced frame
 */
export const advance = (f: SurfaceFrame, angle: number): SurfaceFrame => {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	// Re-orthonormalized, not just rotated. The rotation is exact only while
	// `pos` and `heading` are exactly a unit pair at right angles, and they
	// drift: `turn` re-normalizes the heading without re-squaring it against
	// `pos`, and rounding does the rest over the thousands of advances a
	// single object gets in a session. Measured at `|pos| = 1.03` after a
	// couple of minutes, and since every distance here is `acos(dot(a, b))`
	// clamped to 1, a pair of over-long vectors reads as arc ZERO however far
	// apart they really are. That is one bug with three faces: rocks that
	// never separate because they look coincident, rocks that spawn on the
	// craft because the minimum spawn arc is satisfied by arithmetic, and a
	// camera basis that is not quite a rotation.
	const pos = normalize(combine(f.pos, c, f.heading, s));
	const turned = combine(f.heading, c, f.pos, -s);
	const along = dot(turned, pos);
	return {
		pos,
		heading: turned.sub(_t1.copy(pos).scale(along, along, along)).normalize(),
	};
};

/**
 * The third axis of a surface frame: the direction to the frame's RIGHT.
 *
 * Defined once and used by everything that has an opinion about left and
 * right, because the two orderings of this cross product are negations of
 * each other and mixing them is invisible in the maths and obvious at the
 * controls. `viewBasis` lays this axis along screen x, so "positive is
 * right" means the same thing to the steering as it does to the camera.
 * @param f - the frame
 * @returns the unit vector pointing right of the heading
 */
export const sideOf = (f: SurfaceFrame): Vector3d => cross(f.heading, f.pos);

/**
 * Fold an angle back into (-PI, PI].
 *
 * Anything that accumulates a turn rate forever needs this: the angle
 * itself is meaningless past a full circle, and left to grow it eventually
 * reaches a magnitude where the sine and cosine it feeds have lost most of
 * their significant digits.
 * @param angle - radians, any magnitude
 * @returns the same direction, in (-PI, PI]
 */
export const wrapAngle = (angle: number): number => {
	const a = angle % (Math.PI * 2);
	if (a > Math.PI) {
		return a - Math.PI * 2;
	}
	return a <= -Math.PI ? a + Math.PI * 2 : a;
};

/**
 * Turn on the spot: rotate the heading about the surface normal, which is
 * `pos` itself. That is an ordinary 2D rotation in the tangent plane,
 * spanned by the heading and {@link sideOf}.
 * @param f - the frame to turn
 * @param angle - radians; POSITIVE turns right, toward {@link sideOf}
 * @returns the turned frame
 */
export const turn = (f: SurfaceFrame, angle: number): SurfaceFrame => {
	const side = sideOf(f);
	return {
		pos: f.pos,
		heading: normalize(
			combine(f.heading, Math.cos(angle), side, Math.sin(angle)),
		),
	};
};

/**
 * The angle between two surface points, in radians. This is the distance
 * on a sphere, and it is what every proximity question here reduces to.
 * @param a - one unit surface vector
 * @param b - the other
 * @returns the angle between them, `0..π`
 */
export const arcBetween = (a: Vector3d, b: Vector3d): number =>
	Math.acos(math.clamp(dot(a, b), -1, 1));

/**
 * The SIGNED turn from `from` to `to`, measured about `axis`.
 *
 * {@link arcBetween} answers the same question without the sign, which is
 * plenty for a distance and useless for cancelling a rotation: a left turn
 * and a right turn of the same size must come out with opposite signs, or a
 * correction built from one is applied backwards and doubles the error it
 * was meant to remove.
 *
 * Both vectors are expected tangent to `axis`, as two headings at the same
 * surface point are.
 *
 * Signed the same way {@link turn} is, so the two compose:
 * `turn(f, turnBetween(f.heading, h, f.pos))` faces `h`. That is the OPPOSITE
 * of the right-hand rule about `axis`, because {@link sideOf} takes a frame's
 * positive side to be `cross(heading, pos)`, and a helper disagreeing with
 * the only other signed rotation in the file would be a trap. The sine term
 * is therefore the triple product `to . (from x axis)`, written out so the
 * call allocates nothing.
 * @param from - a unit vector tangent to `axis`
 * @param to - a unit vector tangent to `axis`
 * @param axis - the unit vector the turn is measured about
 * @returns radians in `-π..π`, signed as {@link turn} takes its angle
 */
export const turnBetween = (
	from: Vector3d,
	to: Vector3d,
	axis: Vector3d,
): number =>
	Math.atan2(
		to.x * (from.y * axis.z - from.z * axis.y) +
			to.y * (from.z * axis.x - from.x * axis.z) +
			to.z * (from.x * axis.y - from.y * axis.x),
		dot(to, from),
	);

/**
 * The unit tangent at `from` pointing along the great circle to `to`.
 *
 * `to` minus the part of it that lies along `from`: what is left is
 * perpendicular to `from`, which is what tangent means here, and it points
 * the short way round. Undefined when the two are the same point or exact
 * opposites, and the caller gets a zero vector rather than a NaN.
 * @param from - unit surface vector to start at
 * @param to - unit surface vector to aim at
 * @returns the unit tangent, or a zero vector when there is no direction
 */
export const tangentToward = (
	from: Vector3d,
	to: Vector3d,
	out: Vector3d = new Vector3d(),
): Vector3d => {
	const along = dot(from, to);
	// `out`, not scratch: this value is RETURNED, and a shared temporary
	// handed to a caller is overwritten by the next call to this function.
	const t = out.copy(to).sub(_t1.copy(from).scale(along, along, along));
	// Degenerate when `to` is the same direction as `from` (or its opposite):
	// there is no tangent and the caller is told so with a zero vector rather
	// than with a normalised rounding error.
	return t.length() < 1e-6 ? t.set(0, 0, 0) : t.normalize();
};

/**
 * Slide a frame sideways: move its POSITION along `dir` without steering
 * it, then put its heading back on the tangent plane at the new position.
 *
 * {@link advance} is the same rotation applied where `dir` IS the heading,
 * which is why a craft cannot be knocked backwards with it. A collision is
 * exactly that case: the impulse points wherever the thing that hit it came
 * from, and the craft keeps pointing the way the pilot left it.
 *
 * Re-tangenting the heading is not cosmetic. Every other operator here
 * assumes `heading` is perpendicular to `pos`, and moving one without the
 * other breaks that, after which the frame slowly stops being a frame.
 * @param f - the frame to move
 * @param dir - unit tangent at `f.pos` to move along
 * @param angle - radians of arc to move
 * @returns the moved frame
 */
export const nudge = (
	f: SurfaceFrame,
	dir: Vector3d,
	angle: number,
): SurfaceFrame => {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const pos = normalize(combine(f.pos, c, dir, s));
	const along = dot(f.heading, pos);
	return {
		pos,
		heading: new Vector3d()
			.copy(f.heading)
			.sub(_t1.copy(pos).scale(along, along, along))
			.normalize(),
	};
};

/**
 * Turn `f` toward `target` by `maxAngle`, and return the new frame. Used by
 * the drifters and the hunter to home in without snapping round.
 *
 * The sign of the turn is which side of the heading the target falls on,
 * which is the dot of the target against the frame's side axis.
 *
 * By `maxAngle` and not by at most it: this is a rate limiter, not a
 * controller, and it turns the whole step whenever the target is off the
 * nose at all. A frame already pointing at its target therefore wanders
 * either side of it by one step, which at a turn rate times a frame time is
 * a fraction of a degree, and the callers are steering at things that move.
 * @param f - the frame to steer
 * @param target - the surface point to steer toward
 * @param maxAngle - how far it turns this step
 * @returns the steered frame
 */
export const steerToward = (
	f: SurfaceFrame,
	target: Vector3d,
	maxAngle: number,
): SurfaceFrame => {
	const offCourse = dot(target, sideOf(f));
	if (offCourse === 0) {
		return f;
	}
	// target to the right of the heading, turn right; same sign convention
	// as the player's controls, because it is the same axis
	return turn(f, Math.sign(offCourse) * maxAngle);
};

/**
 * A frame at `pos` facing an arbitrary but valid direction. Used at spawn,
 * where only the position is chosen and any tangent will do.
 * @param pos - unit surface vector
 * @returns a frame whose heading is tangent at `pos`
 */
export const frameAt = (pos: Vector3d): SurfaceFrame => {
	// Any vector not parallel to `pos` gives a tangent once projected;
	// picking the world axis `pos` leans on least keeps it well conditioned.
	const away =
		Math.abs(pos.y) < 0.9 ? new Vector3d(0, 1, 0) : new Vector3d(1, 0, 0);
	return { pos, heading: normalize(cross(cross(pos, away), pos)) };
};

/** a uniformly distributed point on the unit sphere */
export const randomSurfacePoint = (): Vector3d => {
	// Uniform in z and in longitude. Sampling latitude uniformly instead
	// would bunch everything around the poles.
	const z = Math.random() * 2 - 1;
	const a = Math.random() * Math.PI * 2;
	const r = Math.sqrt(1 - z * z);
	return new Vector3d(Math.cos(a) * r, Math.sin(a) * r, z);
};

/**
 * The three axes of the player's view, in world terms.
 *
 * The camera is POSED with these rather than the world being counter-rotated
 * into them: `Camera3d#setBasis` takes a basis directly, which is what a view
 * over a curved surface needs, since up here is the surface normal and differs
 * at every point on the globe.
 *
 * The basis puts the viewer's frame on the player: the player's surface
 * normal points at the camera, and the player's heading points up the
 * screen. Flying "north" therefore carries the camera over the planet rather
 * than spinning the planet under a fixed camera.
 *
 * Note these are stated the way the GAME thinks of them, with `up` the
 * direction that should read as up on screen. The camera's own +Y column
 * points DOWN the screen under this engine's Y-down render space, so
 * {@link cameraBasis} hands `setBasis` the negation. Same for `out`, which
 * points from the planet at the camera while the camera looks the other way.
 * @param viewer - the frame to render the world around
 * @returns the three view axes in world terms
 */
export const viewBasis = (viewer: SurfaceFrame) => ({
	right: sideOf(viewer),
	up: viewer.heading,
	out: viewer.pos,
});

/**
 * Where a surface point sits in the scene.
 *
 * The planet is a fixed object at a fixed place, so this is the whole of it:
 * scale the unit surface vector by the radius it lives at and offset by the
 * planet's centre. No view, no rotation, nothing per-camera. Everything that
 * used to be folded in here is now carried by the camera's own basis.
 * @param q - the unit surface vector to place
 * @param radius - planet radius plus whatever altitude this thing has
 * @param planetZ - scene depth of the planet's centre
 * @param out - written in place, `[x, y, z]`
 */
export const onGlobe = (
	q: Vector3d,
	radius: number,
	planetZ: number,
	out: [number, number, number],
): [number, number, number] => {
	out[0] = q.x * radius;
	out[1] = q.y * radius;
	out[2] = planetZ + q.z * radius;
	return out;
};

/**
 * Where the camera stands to look at `viewer` from outside the globe.
 *
 * Directly out from the player's own surface point, at `distance` from the
 * planet's centre, which puts the player at the middle of the screen at every
 * point on the sphere without a single special case.
 * @param viewer - the frame being watched
 * @param distance - from the planet's centre; the scene depth the globe sits at
 * @param planetZ - scene depth of the planet's centre
 * @param out - written in place, `[x, y, z]`
 */
export const viewOrigin = (
	viewer: SurfaceFrame,
	distance: number,
	planetZ: number,
	out: [number, number, number],
): [number, number, number] => onGlobe(viewer.pos, distance, planetZ, out);

/**
 * A point fixed in the CAMERA's frame, as a scene position.
 *
 * The craft, its exhaust, its shield and the whole starfield are placed by
 * where they sit on screen rather than by where they are on the globe. That
 * used to need no work at all, because the camera was axis aligned and the
 * world was turned instead. Now the camera turns, so a screen-fixed thing has
 * to be carried around with it, which is what this does.
 * @param basis - from {@link viewBasis}
 * @param origin - from {@link viewOrigin}, WITHOUT the pan: the pan slides the
 * camera past these, which is what makes them move on screen
 * @param cx - offset along the camera's right axis
 * @param cy - offset DOWN the screen, matching the engine's Y-down space
 * @param cz - offset away from the camera
 * @param out - written in place, `[x, y, z]`
 */
export const fromView = (
	basis: ReturnType<typeof viewBasis>,
	origin: [number, number, number],
	cx: number,
	cy: number,
	cz: number,
	out: [number, number, number],
): [number, number, number] => {
	const { right: r, up: u, out: o } = basis;
	// `-u` and `-o`: the camera's own +Y runs down the screen and its own +Z
	// runs away from it, both opposite to how the game states them
	out[0] = origin[0] + r.x * cx - u.x * cy - o.x * cz;
	out[1] = origin[1] + r.y * cx - u.y * cy - o.y * cz;
	out[2] = origin[2] + r.z * cx - u.z * cy - o.z * cz;
	return out;
};

/** the sixteen column-major components `Matrix3d.setTransform` expects */

/**
 * The view rotation itself, as a matrix, for geometry that has to TURN
 * rather than merely move.
 *
 * {@link onGlobe} is enough for anything whose orientation does not matter,
 * a point of light or a rock seen from far enough away. A globe with
 * continents on it is not that: it has to roll under the player, and a
 * sphere that only moves is a sphere standing still.
 *
 * Column-major, because that is the order `Matrix3d.setTransform` writes.
 * The matrix COLUMNS are the camera's own axes, so it takes something built
 * in the camera's frame out into the world: the craft's attitude is worked
 * out on screen, in screen terms, and this is what carries the result round
 * to wherever the camera is standing.
 * @param basis - from {@link viewBasis}
 * @param out - written in place
 */
export const viewToWorld = (
	basis: ReturnType<typeof viewBasis>,
	out: Matrix3d,
): Matrix3d => {
	const { right: r, up: u, out: o } = basis;
	// columns: right, the camera's +Y (screen-down, so `-up`), and its +Z
	// (away from the camera, so `-out`)
	out.val[0] = r.x;
	out.val[1] = r.y;
	out.val[2] = r.z;
	out.val[3] = 0;
	out.val[4] = -u.x;
	out.val[5] = -u.y;
	out.val[6] = -u.z;
	out.val[7] = 0;
	out.val[8] = -o.x;
	out.val[9] = -o.y;
	out.val[10] = -o.z;
	out.val[11] = 0;
	out.val[12] = 0;
	out.val[13] = 0;
	out.val[14] = 0;
	out.val[15] = 1;
	return out;
};

/**
 * The `currentTransform` that makes a `Sprite3d` card face the camera.
 *
 * Named for `Sprite3d` and not for `Mesh`, because the two do NOT want the
 * same matrix, and believing they did cost this example two separate bugs.
 *
 * A mesh does not apply `currentTransform` and stop. It applies a BRIDGE
 * afterwards, on the LEFT and in world space, to carry Y-up geometry into
 * this engine's Y-down world — and which bridge depends on the class.
 * A plain `Mesh` gets `diag(1, -1, 1)`; a `Sprite3d` forces
 * `rightHanded: true` on itself, so it gets `diag(1, -1, -1)`. That extra Z
 * flip is the whole difference, and it is invisible until the card is turned:
 * it works out to a reflection of screen space about an axis that depends on
 * where the player is standing, so it CANCELS at zero rotation and only
 * there. Measured before this was fixed: up to 84 degrees of error, with up
 * to 94% of a bolt pointing into the screen rather than across it, while a
 * test that forgot to turn first reported everything perfect.
 *
 * The columns below are chosen so that bridge-times-this comes to
 * `[right | up | -out]` exactly. The card's local +X then lands on the
 * camera's right and its local +Y points UP the screen, so a screen-space
 * direction `(a, b)` is aimed by `rotate(Math.atan2(-a, -b))` — note BOTH
 * arguments negated, which is the other half of the same fix.
 *
 * {@link viewToWorld} remains the right one for a plain world direction, such
 * as a light's, which never goes through any bridge.
 * @param basis - from {@link viewBasis}
 * @param out - written in place
 */
export const viewToSprite3d = (
	basis: ReturnType<typeof viewBasis>,
	out: Matrix3d,
): Matrix3d => {
	const { right: r, up: u, out: o } = basis;
	// Every y AND z term negated, which is what conjugating by
	// `diag(1, -1, -1)` comes to. The z half is the part that was missing.
	out.val[0] = r.x;
	out.val[1] = -r.y;
	out.val[2] = -r.z;
	out.val[3] = 0;
	out.val[4] = u.x;
	out.val[5] = -u.y;
	out.val[6] = -u.z;
	out.val[7] = 0;
	out.val[8] = -o.x;
	out.val[9] = o.y;
	out.val[10] = o.z;
	out.val[11] = 0;
	out.val[12] = 0;
	out.val[13] = 0;
	out.val[14] = 0;
	out.val[15] = 1;
	return out;
};

/**
 * The rotation that stands a craft on the globe, facing where it is going.
 *
 * Its own surface frame IS its orientation: the side, the outward normal and
 * the heading are the three axes of a body sitting on a sphere and pointing
 * along the ground. Nothing about the camera enters into it, which is the
 * point — everything else in this scene is placed in world terms, and the
 * craft used to be the one exception.
 *
 * Two fixed corrections are folded in. `diag(-1, -1, 1)` is the model's own
 * authored orientation, a half turn about its nose axis; and the mesh Y
 * bridge negates y AFTER `currentTransform`, so the y row is negated here to
 * come out right. Both were solved by measuring the matrix the old
 * screen-space stack produced and reading off the constant part.
 * @param f - the craft's surface frame
 * @param out - written in place
 */
export const craftMatrix = (f: SurfaceFrame, out: Matrix3d): Matrix3d => {
	const s = sideOf(f);
	const u = f.pos;
	const n = f.heading;
	out.val[0] = -s.x;
	out.val[1] = s.y;
	out.val[2] = -s.z;
	out.val[3] = 0;
	out.val[4] = -u.x;
	out.val[5] = u.y;
	out.val[6] = -u.z;
	out.val[7] = 0;
	out.val[8] = n.x;
	out.val[9] = -n.y;
	out.val[10] = n.z;
	out.val[11] = 0;
	out.val[12] = 0;
	out.val[13] = 0;
	out.val[14] = 0;
	out.val[15] = 1;
	return out;
};

/**
 * Reflect a heading about a contact direction: what a bounce is.
 *
 * `h - 2(h.n)n`, and only when the two are closing. A heading already pointing
 * away is left alone, so a pair still overlapping on the next frame is not
 * turned a second time and sent back in.
 * @param h - the unit heading, tangent to the surface
 * @param n - the unit direction toward whatever was hit, also tangent
 * @returns the reflected heading, still tangent and still unit length
 */
export const reflect = (h: Vector3d, n: Vector3d): Vector3d => {
	const along = dot(h, n);
	if (along <= 0) {
		return h;
	}
	return normalize(
		new Vector3d(
			h.x - 2 * along * n.x,
			h.y - 2 * along * n.y,
			h.z - 2 * along * n.z,
		),
	);
};

/**
 * The rotation that lays an object FLAT on the globe at `q`.
 *
 * Things standing on a planet are not all parallel: a rock on the far side
 * of the horizon leans away from one on the near side, and that lean is most
 * of what tells the eye the ground is curved. An object that merely sits at
 * the right position keeps its own orientation and reads as a sticker on a
 * backdrop rather than as something on a surface.
 *
 * The object's local +Y is taken as its up. The two tangents are arbitrary
 * but consistent, which is all a rock needs; anything that has to FACE a
 * direction along the surface wants its heading fed in instead.
 * @param q - the unit surface vector the object stands on
 * @param out - written in place
 */
export const surfaceMatrixWorld = (
	q: Vector3d,
	out: Matrix3d,
	tangent?: Vector3d,
): Matrix3d => {
	// The tangent that becomes local X. Supplied by the caller where it has a
	// continuous one, and that matters more than it looks.
	//
	// Falling back on a world axis cannot be continuous: the axis is chosen by
	// `|q.y| < 0.9`, and a body drifting across that boundary gets a COMPLETELY
	// different tangent on the next frame. Measured at the boundary, the jump
	// runs from 0 to 180 degrees depending on where around the circle it
	// crosses, so a rock would snap by up to a half turn in one frame. No fixed
	// scheme avoids this; a sphere admits no continuous non-vanishing tangent
	// field, so the singularity can only be moved, not removed.
	//
	// A caller that carries its own tangent, as anything travelling a great
	// circle does in its heading, has no singularity at all: its tangent is
	// continuous because its motion is.
	let t1: Vector3d;
	if (tangent !== undefined) {
		// orthogonalized against the normal, since a heading kept over many
		// frames drifts a little out of the tangent plane
		const d = dot(tangent, q);
		const px = tangent.x - q.x * d;
		const py = tangent.y - q.y * d;
		const pz = tangent.z - q.z * d;
		const len = Math.sqrt(px * px + py * py + pz * pz);
		t1 =
			len > 1e-6
				? new Vector3d(px / len, py / len, pz / len)
				: normalize(
						cross(
							Math.abs(q.y) < 0.9
								? new Vector3d(0, 1, 0)
								: new Vector3d(1, 0, 0),
							q,
						),
					);
	} else {
		// any tangent will do, as long as it is stable: lean on the world axis
		// that `q` is least parallel to so the cross product stays conditioned
		const away =
			Math.abs(q.y) < 0.9 ? new Vector3d(0, 1, 0) : new Vector3d(1, 0, 0);
		t1 = normalize(cross(away, q));
	}
	const t2 = cross(q, t1);

	// Q's columns are (t1, q, t2): local X to t1, Y to the surface normal,
	// Z to t2. Stated in WORLD terms, with no view folded in — the camera
	// carries its own rotation now, so a rock's orientation no longer has to
	// be recomputed when the player merely looks somewhere else.
	out.val[0] = t1.x;
	out.val[1] = t1.y;
	out.val[2] = t1.z;
	out.val[3] = 0;
	out.val[4] = q.x;
	out.val[5] = q.y;
	out.val[6] = q.z;
	out.val[7] = 0;
	out.val[8] = t2.x;
	out.val[9] = t2.y;
	out.val[10] = t2.z;
	out.val[11] = 0;
	out.val[12] = 0;
	out.val[13] = 0;
	out.val[14] = 0;
	out.val[15] = 1;
	return out;
};

/**
 * A point on the SMALL circle at `polar` radians from `axis`.
 *
 * The great circles everywhere else in this file are what a thing travelling
 * over the surface follows. This is the other kind: a ring held at a fixed
 * angle from a pole, which is what something circling a place travels, and
 * what `advance` cannot express at all.
 *
 * Evaluated from the angle rather than integrated, so it neither drifts nor
 * needs re-orthonormalizing however long it runs: the saucer can ring a pole
 * for the whole session and still be exactly on its circle.
 * @param axis - the pole the ring is centred on, unit
 * @param b - one unit vector perpendicular to `axis` (see {@link ringBasis})
 * @param c - the other, perpendicular to both
 * @param polar - how far the ring sits from the pole, radians
 * @param phase - how far round the ring, radians
 * @returns the unit surface vector at that point
 */
export const onRing = (
	axis: Vector3d,
	b: Vector3d,
	c: Vector3d,
	polar: number,
	phase: number,
): Vector3d => {
	const ca = Math.cos(polar);
	const sa = Math.sin(polar);
	const cp = Math.cos(phase);
	const sp = Math.sin(phase);
	return combine(axis, ca, combine(b, cp, c, sp), sa);
};

/**
 * The direction of travel along {@link onRing} at `phase`.
 *
 * The derivative of the ring with respect to phase, which comes out unit
 * already because `b` and `c` are a unit pair: the `sin(polar)` the position
 * carries drops out of the normalization.
 * @param b - the ring basis vector used by {@link onRing}
 * @param c - the other one
 * @param phase - how far round the ring, radians
 * @returns the unit tangent, in the direction of increasing phase
 */
export const ringHeading = (
	b: Vector3d,
	c: Vector3d,
	phase: number,
): Vector3d => {
	const cp = Math.cos(phase);
	const sp = Math.sin(phase);
	return combine(b, -sp, c, cp).normalize();
};

/**
 * Put a surface point into the frame a mesh's own matrix is built in.
 *
 * The scene is Y-down and `onGlobe` places things with no flip, but the
 * ORIENTATION matrices are another matter: `Mesh` composes its model matrix
 * as `diag(1, -1, -1) * transform` when `rightHanded`, applied on the LEFT,
 * so whatever a surface matrix puts on local Y comes back reflected in Y and
 * Z. Feeding the raw point to `surfaceMatrixWorld` therefore stands the mesh
 * on `(q.x, -q.y, -q.z)`, which is `q` turned a half circle about X: the
 * error is `acos(2*q.x^2 - 1)`, so anything near the `x = 0` meridian is
 * simply upside down. Hard to catch by eye on an irregular lump, which is
 * why it survived in three places at once.
 *
 * There are exactly two answers and this is the only place that should know
 * which is which: a `rightHanded` `Mesh` or a `Sprite3d` undoes both
 * negations, a plain `Mesh` only the Y.
 * @param q - the unit surface point
 * @param rightHanded - whether the target mesh renders right-handed
 * @param out - written in place
 * @returns `out`
 */
export const bridgeY = (
	q: Vector3d,
	rightHanded: boolean,
	out: Vector3d,
): Vector3d => {
	out.x = q.x;
	out.y = -q.y;
	out.z = rightHanded ? -q.z : q.z;
	return out;
};

/**
 * Two unit vectors perpendicular to `axis` and to each other.
 *
 * The seed is chosen against the axis rather than fixed, because crossing
 * with a constant collapses to zero when the axis happens to be parallel to
 * it, and "happens to be" is a thing that occurs about once a session and
 * looks like the saucer vanishing.
 * @param axis - the pole, unit
 * @returns the pair, as `b` and `c`
 */
export const ringBasis = (axis: Vector3d): { b: Vector3d; c: Vector3d } => {
	const seed =
		Math.abs(axis.x) < 0.8 ? new Vector3d(1, 0, 0) : new Vector3d(0, 1, 0);
	const b = normalize(cross(seed, axis));
	return { b, c: cross(axis, b) };
};

/**
 * The same ring frame, carried forward from the previous one.
 *
 * {@link ringBasis} picks its seed by a THRESHOLD on `axis.x`, so an axis
 * that drifts across `0.8` gets a different seed from one frame to the next
 * and `b` and `c` swing round. A ring is a circle, so a caller that
 * re-derives its angle survives a pure reseed: the trouble is that the axis
 * is usually moving too, and the point is then forced onto a cone about a
 * new axis from an angle measured in a frame that also jumped. Measured on
 * the saucer's bombing approach, that was a single frame of up to two
 * radians: a teleport, right before the bombs fell.
 *
 * This has no threshold to cross. The previous `b` is projected back onto
 * the plane at right angles to the new axis and renormalised, which is a
 * Gram-Schmidt step: for a small change of axis it barely moves, and it can
 * only fail if the axis swings a full quarter turn in one frame, where the
 * seeded version is the honest fallback.
 * @param axis - the ring's new pole, unit
 * @param prev - the `b` of the frame before
 * @returns the ring frame, continuous with `prev`
 */
export const ringBasisFrom = (
	axis: Vector3d,
	prev: Vector3d,
): { b: Vector3d; c: Vector3d } => {
	const along = dot(prev, axis);
	const flat = new Vector3d(
		prev.x - axis.x * along,
		prev.y - axis.y * along,
		prev.z - axis.z * along,
	);
	// too close to the axis to say which way "round" is: reseed rather than
	// normalise something that is almost nothing
	if (Math.hypot(flat.x, flat.y, flat.z) < 1e-4) {
		return ringBasis(axis);
	}
	const b = normalize(flat);
	return { b, c: cross(axis, b) };
};

/**
 * Scratch vectors for the temporaries the maths below needs.
 *
 * Private and reused: a value that never leaves this module does not need to
 * be allocated per call. NOT `clone()`, which takes from the engine's pool
 * and is only cheap if the caller gives it back; nothing here can, because
 * these are intermediates with no owner. A clone that is dropped costs a full
 * construction plus two registry writes, measured at roughly 400ns against
 * 1.5ns for a plain `new Vector3d`.
 *
 * Used inside ONE function and never across a call boundary, which is what
 * makes sharing safe. A value that is RETURNED can never be one of these: the
 * next call would overwrite something the caller still holds, which the
 * golden test caught when `tangentToward` tried it.
 */
const _t1 = new Vector3d();
const _slerpA = new Vector3d();
const _slerpB = new Vector3d();

/**
 * Spherically interpolate between two unit directions.
 *
 * A thin shell over {@link Vector3d#slerp}, which the engine grew for exactly
 * this: the great circle, the two degenerate cases, and the stable choice of
 * axis when the two ends are opposite. The hand-rolled version this replaces
 * handled the near-parallel case and not the antipodal one, where it returned
 * a zero vector and then divided by its length.
 *
 * Still allocating and still returning a new value, because every caller here
 * treats a `Vector3d` as immutable.
 * @param a - the direction at `t = 0`, unit
 * @param b - the direction at `t = 1`, unit
 * @param t - how far along
 * @returns a new unit direction
 */
export const slerp = (a: Vector3d, b: Vector3d, t: number): Vector3d => {
	_slerpA.set(a.x, a.y, a.z);
	_slerpB.set(b.x, b.y, b.z);
	return new Vector3d().copy(_slerpA.slerp(_slerpB, t));
};

/**
 * A frame for something lying FLAT on the surface, rather than standing on it.
 *
 * {@link surfaceMatrixWorld} puts the normal on local Y, which is what a thing
 * standing up wants: a bomb, a rock, a saucer. A quad is the other case. It
 * lies in its own local XY plane and faces local +Z, so handing it a frame
 * with the normal on Y stands it on edge, buried in the surface rather than
 * laid on it.
 *
 * So the columns are ordered `(t1, t2, q)`: two tangents to span the quad, and
 * the normal as the direction it faces.
 * @param q - the unit surface direction, already bridged by the caller if the
 * mesh is `rightHanded`
 * @param out - written in place
 * @returns `out`, for chaining
 */
export const tangentMatrixWorld = (q: Vector3d, out: Matrix3d): Matrix3d => {
	// same conditioning as `surfaceMatrixWorld`: lean on the world axis `q` is
	// least parallel to, so the cross product never collapses
	const away =
		Math.abs(q.y) < 0.9 ? new Vector3d(0, 1, 0) : new Vector3d(1, 0, 0);
	const t1 = normalize(cross(away, q));
	const t2 = cross(q, t1);

	out.val[0] = t1.x;
	out.val[1] = t1.y;
	out.val[2] = t1.z;
	out.val[3] = 0;
	out.val[4] = t2.x;
	out.val[5] = t2.y;
	out.val[6] = t2.z;
	out.val[7] = 0;
	out.val[8] = q.x;
	out.val[9] = q.y;
	out.val[10] = q.z;
	out.val[11] = 0;
	out.val[12] = 0;
	out.val[13] = 0;
	out.val[14] = 0;
	out.val[15] = 1;
	return out;
};

/**
 * Move a world point a fixed distance toward another one.
 *
 * Used to lift a billboard off what it wraps, toward the camera. That has to
 * be along the LINE OF SIGHT and not along any world axis: under a
 * perspective projection two points share a screen position only when they
 * share a ray from the eye, so a shell raised straight out from the planet,
 * or straight toward the screen plane, slides off the hull it belongs to
 * everywhere except dead centre.
 * @param from - the point to move
 * @param to - the point to move toward, usually the camera
 * @param dist - how far to move, world units
 * @param out - written in place
 * @returns `out`
 */
export const stepToward = (
	from: readonly [number, number, number],
	to: readonly [number, number, number],
	dist: number,
	out: [number, number, number],
): [number, number, number] => {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const dz = to[2] - from[2];
	// a zero length means the two coincide and there is no direction to go
	const len = Math.hypot(dx, dy, dz) || 1;
	const k = dist / len;
	out[0] = from[0] + dx * k;
	out[1] = from[1] + dy * k;
	out[2] = from[2] + dz * k;
	return out;
};

/**
 * How near the planet's centre a camera's line of sight to a point passes.
 *
 * Both arguments are given RELATIVE to that centre, which is what lets the
 * same maths serve a caller working in globe space, where the centre is the
 * origin, and one working in scene space, where it sits at `PLANET_Z`.
 *
 * It is the closest approach to the centre of the SEGMENT, not the infinite
 * line: clamping to the segment is what distinguishes a thing hidden behind
 * the globe from one in front of it, since both lie on the same line.
 * @param cx - camera x, from the planet's centre
 * @param cy - camera y
 * @param cz - camera z
 * @param tx - target x, from the planet's centre
 * @param ty - target y
 * @param tz - target z
 * @returns the squared distance, so callers compare against a squared radius
 */
export const sightlineClearance2 = (
	cx: number,
	cy: number,
	cz: number,
	tx: number,
	ty: number,
	tz: number,
): number => {
	const dx = tx - cx;
	const dy = ty - cy;
	const dz = tz - cz;
	const len2 = dx * dx + dy * dy + dz * dz;
	if (len2 < 1e-6) {
		return cx * cx + cy * cy + cz * cz;
	}
	const t = math.clamp(-(cx * dx + cy * dy + cz * dz) / len2, 0, 1);
	const nx = cx + dx * t;
	const ny = cy + dy * t;
	const nz = cz + dz * t;
	return nx * nx + ny * ny + nz * nz;
};
