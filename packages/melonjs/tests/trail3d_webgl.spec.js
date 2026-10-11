import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Camera3d, Matrix3d, Trail3d } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * What a static screenshot cannot show: whether the ribbon is still being
 * rebuilt.
 *
 * `Trail3d` writes new geometry every frame and signals it with
 * `needsUpdate`, which bumps the mesh's geometry version and makes the
 * retained path re-upload. Forget that one line and the first frame looks
 * perfect and every frame after it is frozen — the ribbon stays wherever the
 * craft was when it was first drawn. Counting GL traffic is the only way to
 * tell the two apart, and call counts are exact in CI where frame times are
 * meaningless.
 *
 * The other half is the claim that this class is CHEAPER than the 2D one: a
 * `Trail` fills one path per segment, so an 8-point ribbon is 7 draws. This
 * should be 1.
 *
 * Skips (visibly) when WebGL2 is unavailable.
 */
describe("Trail3d on WebGL", () => {
	let renderer;
	let camera;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		camera = new Camera3d(0, 0, 128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL2 = (ctx) => {
		requireWebGL(ctx, renderer);
	};

	/** count the traffic that distinguishes a live ribbon from a frozen one */
	const spy = () => {
		const gl = renderer.gl;
		const calls = { arrayUploads: 0, drawElements: 0 };
		const origBufferData = gl.bufferData.bind(gl);
		const origDraw = gl.drawElements.bind(gl);
		gl.bufferData = (target, ...rest) => {
			if (target === gl.ARRAY_BUFFER) {
				calls.arrayUploads++;
			}
			return origBufferData(target, ...rest);
		};
		gl.drawElements = (...args) => {
			calls.drawElements++;
			return origDraw(...args);
		};
		return {
			calls,
			restore() {
				gl.bufferData = origBufferData;
				gl.drawElements = origDraw;
			},
		};
	};

	/**
	 * A bare renderer harness leaves the projection at identity, which would
	 * put every vertex outside the frustum and draw nothing at all.
	 */
	const setupProjection = () => {
		const proj = new Matrix3d();
		proj.ortho(0, 128, 128, 0, -1000, 1000);
		renderer.setProjection(proj);
	};

	/** one frame, the way a container would draw it */
	const frame = (trail) => {
		renderer.clearColor("#000000");
		setupProjection();
		renderer.save();
		trail.preDraw(renderer);
		trail.draw(renderer, camera);
		trail.postDraw(renderer);
		renderer.restore();
		// A transparent mesh is QUEUED rather than drawn where it is met, so
		// the queue has to be drained or nothing reaches the GPU at all. A
		// camera pass does this; a bare harness has to say it.
		renderer.flushTransparent();
		renderer.flush();
	};

	const makeTrail = () => {
		const trail = new Trail3d(0, 0, {
			length: 8,
			minDistance: 0,
			width: 6,
			lifetime: 10000,
			billboard: false,
			ribbonNormal: [0, 0, -1],
		});
		trail._useWorldSpace = true;
		return trail;
	};

	it("re-uploads its geometry every frame, because it rebuilds it", (ctx) => {
		requireWebGL2(ctx);
		const trail = makeTrail();
		trail.addPoint(20, 64, 0);
		trail.addPoint(40, 64, 0);
		const { calls, restore } = spy();
		try {
			frame(trail);
			const afterFirst = calls.arrayUploads;
			expect(afterFirst).toBeGreaterThan(0);

			// the ribbon grows, which is what a moving object does to it
			for (let i = 0; i < 3; i++) {
				trail.addPoint(60 + i * 10, 64, 0);
				trail.update(0);
				const before = calls.arrayUploads;
				frame(trail);
				// Each frame uploads again. Drop `needsUpdate` and this is
				// where it shows: the count stops rising and the ribbon on
				// screen stops following its target.
				expect(calls.arrayUploads).toBeGreaterThan(before);
			}
		} finally {
			restore();
			trail.destroy();
		}
	});

	it("draws the whole ribbon in one call, not one per segment", (ctx) => {
		requireWebGL2(ctx);
		const trail = makeTrail();
		// eight points is seven segments, which a 2D trail would fill as
		// seven separate paths
		for (let i = 0; i < 8; i++) {
			trail.addPoint(16 + i * 12, 64, 0);
		}
		trail.update(0);
		const { calls, restore } = spy();
		try {
			frame(trail);
			expect(calls.drawElements).toBe(1);
		} finally {
			restore();
			trail.destroy();
		}
	});
});
