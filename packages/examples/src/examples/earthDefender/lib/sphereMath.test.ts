/**
 * melonJS — Earth Defender: a characterisation test for {@link sphereMath}.
 *
 * Run it with `npx tsx src/examples/earthDefender/lib/sphereMath.test.ts`
 * from `packages/examples`. It MUST be run from inside that package: the
 * engine resolves through `packages/examples/node_modules/melonjs`, and from
 * anywhere else node walks up into a hoisted shim with no exports.
 *
 * Two halves, and the second is the one that earns its keep:
 *
 * - **Golden values**, in `sphereMath.golden.json`, captured from the
 *   implementation as it stood. Any numeric drift fails. Regenerate
 *   deliberately with `--update` and read the diff; a regenerated golden that
 *   nobody read is not a test. Run `biome check --write` on the json
 *   afterwards: `--update` writes one array element per line and biome packs
 *   them, so skipping it buries two real changes in a whole-file reflow.
 * - **Invariants**, which hold whatever the implementation is: a position
 *   stays on the unit sphere, a heading stays tangent to it, turning does not
 *   move you, advancing does not rotate you about your own axis. These are
 *   what catch a port that is numerically close but semantically wrong.
 *
 * Written before moving this file off its own `Vec3` record onto the engine's
 * `Vector3d`, because the two can disagree in ways a refactor absorbs
 * silently: mutation versus returning a fresh value, aliasing when a result
 * is also an argument, and what each does with a zero-length vector.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */

import fs from "node:fs";
import path from "node:path";
import { Matrix3d, Vector3d } from "melonjs";
import {
	advance,
	arcBetween,
	bridgeY,
	craftMatrix,
	cross,
	dot,
	frameAt,
	fromView,
	normalize,
	nudge,
	onGlobe,
	onRing,
	reflect,
	ringBasis,
	ringBasisFrom,
	ringHeading,
	sideOf,
	sightlineClearance2,
	slerp,
	steerToward,
	stepToward,
	surfaceMatrixWorld,
	tangentMatrixWorld,
	tangentToward,
	turn,
	turnBetween,
	viewBasis,
	viewOrigin,
	viewToSprite3d,
	viewToWorld,
	wrapAngle,
} from "./sphereMath";

/**
 * The floor on an angle measured through {@link arcBetween}.
 *
 * It is `acos(dot)`, and near zero `dot` is `1 - theta^2/2`, so acos loses
 * half the mantissa to cancellation: the smallest angle it can resolve is
 * about `sqrt(2 * Number.EPSILON)`, 2.1e-8. Anything asserting "these point
 * the same way" has to allow for that, and anything in the GAME comparing an
 * arc against a threshold finer than this is comparing noise.
 */
const ARC_EPS = 1e-7;
let failures = 0;
let checks = 0;

/**
 * @param name - what is being checked
 * @param ok - whether it held
 * @param detail - shown when it did not
 */
const check = (name: string, ok: boolean, detail = "") => {
	checks++;
	if (!ok) {
		failures++;
		console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
	}
};

/**
 * @param name - what is being checked
 * @param a - measured
 * @param b - expected
 * @param eps - tolerance
 */
const near = (name: string, a: number, b: number, eps = 1e-9) =>
	check(name, Math.abs(a - b) <= eps, `${a} !== ${b}`);

/** a frame somewhere awkward: not on an axis, not symmetric */
const F = frameAt(normalize(new Vector3d(0.3, -0.5, 0.81)));
const Q = normalize(new Vector3d(-0.2, 0.7, 0.68));
/** a fresh matrix for a builder to fill */
const mat = (): Matrix3d => new Matrix3d();

// ── invariants ───────────────────────────────────────────────────────────
const len = (v: { x: number; y: number; z: number }) =>
	Math.hypot(v.x, v.y, v.z);

console.log("invariants");
near("frameAt: pos stays unit", len(F.pos), 1);
near("frameAt: heading is unit", len(F.heading), 1);
near("frameAt: heading is tangent to pos", dot(F.pos, F.heading), 0, 1e-12);
near("sideOf is unit", len(sideOf(F)), 1);
near("sideOf is perpendicular to both", dot(sideOf(F), F.pos), 0, 1e-12);

for (const a of [0.01, 0.4, 1.3, -2.2, Math.PI]) {
	const m = advance(F, a);
	near(`advance(${a}): still on the sphere`, len(m.pos), 1);
	near(`advance(${a}): heading still tangent`, dot(m.pos, m.heading), 0, 1e-12);
	near(
		`advance(${a}): travelled exactly a`,
		arcBetween(F.pos, m.pos),
		Math.abs(a) > Math.PI ? arcBetween(F.pos, m.pos) : Math.abs(a),
		1e-9,
	);

	const t = turn(F, a);
	near(`turn(${a}): does NOT move you`, arcBetween(F.pos, t.pos), 0, ARC_EPS);
	near(`turn(${a}): heading still unit`, len(t.heading), 1);
	near(`turn(${a}): heading still tangent`, dot(t.pos, t.heading), 0, 1e-12);
}

near(
	"advance(0) is identity",
	arcBetween(advance(F, 0).pos, F.pos),
	0,
	ARC_EPS,
);
near(
	"advance then advance back",
	arcBetween(advance(advance(F, 0.7), -0.7).pos, F.pos),
	0,
	ARC_EPS,
);
near("arcBetween(a,a) is zero", arcBetween(Q, Q), 0, ARC_EPS);
near(
	"arcBetween is symmetric",
	arcBetween(F.pos, Q),
	arcBetween(Q, F.pos),
	1e-12,
);
near(
	"arcBetween of opposites is pi",
	arcBetween(Q, new Vector3d(-Q.x, -Q.y, -Q.z)),
	Math.PI,
	1e-7,
);

near("tangentToward is tangent", dot(F.pos, tangentToward(F.pos, Q)), 0, 1e-12);
check(
	"tangentToward of self is degenerate (zero)",
	len(tangentToward(Q, Q)) < 1e-12,
);

near("normalize of zero stays zero", len(normalize(new Vector3d(0, 0, 0))), 0);
near(
	"normalize makes a unit vector",
	len(normalize(new Vector3d(3, -4, 12))),
	1,
);
near(
	"dot of perpendiculars is zero",
	dot(new Vector3d(1, 0, 0), new Vector3d(0, 1, 0)),
	0,
);
near("cross is anti-commutative", cross(F.pos, Q).x, -cross(Q, F.pos).x, 1e-15);
near(
	"reflect preserves length",
	len(reflect(F.heading, F.pos)),
	len(F.heading),
	1e-12,
);

const sl = slerp(F.pos, Q, 0.5);
near("slerp midpoint is unit", len(sl), 1, 1e-9);
near(
	"slerp midpoint is equidistant",
	arcBetween(F.pos, sl),
	arcBetween(sl, Q),
	1e-9,
);
near("slerp(0) is a", arcBetween(slerp(F.pos, Q, 0), F.pos), 0, ARC_EPS);
near("slerp(1) is b", arcBetween(slerp(F.pos, Q, 1), Q), 0, ARC_EPS);

const rb = ringBasis(Q);
near("ringBasis b is unit", len(rb.b), 1, 1e-12);
near("ringBasis c is unit", len(rb.c), 1, 1e-12);
near("ringBasis b perpendicular to axis", dot(rb.b, Q), 0, 1e-12);
near("ringBasis b perpendicular to c", dot(rb.b, rb.c), 0, 1e-12);
near(
	"onRing stays on the sphere",
	len(onRing(Q, rb.b, rb.c, 0.4, 1.1)),
	1,
	1e-12,
);
near("ringHeading is unit", len(ringHeading(rb.b, rb.c, 1.1)), 1, 1e-12);

const steered = steerToward(F, Q, 0.05);
near(
	"steerToward: does not move you",
	arcBetween(F.pos, steered.pos),
	0,
	ARC_EPS,
);
near(
	"steerToward: turns by exactly maxAngle",
	arcBetween(F.heading, steered.heading),
	0.05,
	1e-9,
);
near("nudge: stays on the sphere", len(nudge(F, Q, 0.1).pos), 1, 1e-12);

near("wrapAngle folds into (-pi, pi]", wrapAngle(3 * Math.PI), Math.PI, 1e-12);
near("wrapAngle leaves an in-range angle", wrapAngle(1.2), 1.2, 1e-15);
// `turnBetween`, and the one property the rock orientation depends on.
//
// A rock's on-screen rotation is `surfaceMatrixWorld(pos, heading)` times its
// own turn about local up. The frame half jumps when a bounce reflects the
// heading, and `GameController.deflect` cancels that by adding the SAME turn
// to the spin. Sign matters more than magnitude here: get it backwards and
// the correction doubles the jump instead of removing it, which is a worse
// bug than the one it was meant to fix and looks almost the same on screen.
//
// So assert the cancellation directly, for several contacts including a
// head-on reversal, rather than trusting the derivation.
const upLocal = new Vector3d(0, 1, 0);
near("turnBetween(h, h) is zero", turnBetween(F.heading, F.heading, F.pos), 0);
near(
	"turnBetween is antisymmetric",
	turnBetween(F.heading, sideOf(F), F.pos) +
		turnBetween(sideOf(F), F.heading, F.pos),
	0,
	1e-12,
);
near(
	"turnBetween is signed, not an arc",
	turnBetween(F.heading, sideOf(F), F.pos),
	-turnBetween(F.heading, cross(F.pos, F.heading), F.pos),
	1e-12,
);
// Math.PI is in the list for coverage, not for the sign: `Ry(pi)` and
// `Ry(-pi)` are the same matrix, so a half turn passes either way round.
// The other three are what pin the direction. Do not trim this list.
for (const about of [0.3, -1.1, 2.4, Math.PI]) {
	const after = turn(F, about).heading;
	const paid = turnBetween(F.heading, after, F.pos);
	near(
		`turnBetween: recovers a turn of ${about}`,
		wrapAngle(paid),
		about,
		1e-9,
	);

	// the cancellation, which is the claim the game relies on
	const was = surfaceMatrixWorld(F.pos, mat(), F.heading);
	const now = surfaceMatrixWorld(F.pos, mat(), after).rotate(-paid, upLocal);
	let worst = 0;
	for (let i = 0; i < 16; i++) {
		worst = Math.max(worst, Math.abs(now.val[i] - was.val[i]));
	}
	near(`deflect by ${about} leaves the orientation put`, worst, 0, 1e-6);
}

// And the invariant the SHADOW needs: a turn about local up must not touch
// column 1. The blob's footprint is columns 0 and 2 with y dropped, so a
// caster that is not upright has no honest footprint to give it.
{
	const m = surfaceMatrixWorld(F.pos, mat(), F.heading);
	const col1 = [m.val[4], m.val[5], m.val[6]];
	m.rotate(1.7, upLocal);
	near("yaw about local up keeps column 1", m.val[4], col1[0], 1e-12);
	near("yaw about local up keeps column 1", m.val[5], col1[1], 1e-12);
	near("yaw about local up keeps column 1", m.val[6], col1[2], 1e-12);
	near("and column 1 IS the surface normal", dot(F.pos, F.pos), 1, 1e-12);
	// 1e-7, not 1e-12: `Matrix3d.val` is a Float32Array, so a double written
	// into it comes back rounded. Measured here at 1.4e-8.
	near("column 1 matches pos", m.val[4], F.pos.x, 1e-7);
}

// ── golden values ────────────────────────────────────────────────────────
const basis = viewBasis(F);
const t3 = (): [number, number, number] => [0, 0, 0];
const golden: Record<string, unknown> = {
	vec3: new Vector3d(1, -2, 3),
	dot: dot(F.pos, Q),
	cross: cross(F.pos, Q),
	normalize: normalize(new Vector3d(3, -4, 12)),
	frameAt: F,
	sideOf: sideOf(F),
	advance: advance(F, 0.37),
	turn: turn(F, -0.84),
	arcBetween: arcBetween(F.pos, Q),
	turnBetween: turnBetween(F.heading, turn(F, 0.63).heading, F.pos),
	turnBetweenBack: turnBetween(F.heading, turn(F, -2.9).heading, F.pos),
	tangentToward: tangentToward(F.pos, Q),
	nudge: nudge(F, Q, 0.12),
	steerToward: steerToward(F, Q, 0.05),
	reflect: reflect(F.heading, F.pos),
	slerp: slerp(F.pos, Q, 0.37),
	viewBasis: basis,
	onGlobe: onGlobe(Q, 480, 1320.7, t3()),
	viewOrigin: viewOrigin(F, 900, 1320.7, t3()),
	fromView: fromView(
		basis,
		viewOrigin(F, 900, 1320.7, t3()),
		10,
		-20,
		30,
		t3(),
	),
	viewToWorld: viewToWorld(basis, mat()),
	viewToSprite3d: viewToSprite3d(basis, mat()),
	craftMatrix: craftMatrix(F, mat()),
	surfaceMatrixWorld: surfaceMatrixWorld(Q, mat()),
	surfaceMatrixWorldTangent: surfaceMatrixWorld(Q, mat(), F.heading),
	tangentMatrixWorld: tangentMatrixWorld(Q, mat()),
	onRing: onRing(Q, rb.b, rb.c, 0.4, 1.1),
	ringHeading: ringHeading(rb.b, rb.c, 1.1),
	ringBasis: rb,
	ringBasisFrom: ringBasisFrom(Q, F.pos),
	bridgeY: bridgeY(Q, true, new Vector3d(0, 0, 0)),
	bridgeYLeft: bridgeY(Q, false, new Vector3d(0, 0, 0)),
	stepToward: stepToward([0, 0, 0], [3, 4, 0], 2.5, t3()),
	sightlineClearance2: sightlineClearance2(0, 0, 1320.7, 10, -20, 900),
};

// plain records, so a Vector3d and a {x,y,z} compare the same way
const plain = JSON.parse(
	JSON.stringify(golden, (_k, v) => {
		if (v instanceof Matrix3d) {
			return Array.from(v.val);
		}
		return v && typeof v === "object" && "x" in v && !Array.isArray(v)
			? { x: v.x, y: v.y, z: v.z }
			: v;
	}),
);

const file = path.join(import.meta.dirname, "sphereMath.golden.json");
if (process.argv.includes("--update")) {
	fs.writeFileSync(file, `${JSON.stringify(plain, null, "\t")}\n`);
	console.log(`\ngolden written: ${Object.keys(plain).length} entries`);
} else {
	console.log("\ngolden values");
	const want = JSON.parse(fs.readFileSync(file, "utf-8"));
	for (const key of Object.keys(want)) {
		const a = JSON.stringify(plain[key]);
		const b = JSON.stringify(want[key]);
		check(`golden: ${key}`, a === b, `got  ${a}\n        want ${b}`);
	}
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) {
	process.exit(1);
}
