import { beforeAll, describe, expect, it } from "vitest";
import { boot, event, Sprite, video } from "../src/index.js";

/**
 * Video sprite frame sync via requestVideoFrameCallback (rVFC).
 *
 * A detached (never-in-DOM) video element only gets fresh frames from the
 * browser while the page compositor is active — Chromium parks it on a
 * ~250ms background timer otherwise (e.g. fullscreen direct scanout). The
 * Sprite keeps an rVFC pending on the element to force full-rate delivery,
 * and uses the callback to stamp a monotonic `version` counter so update()
 * only repaints when a frame was actually presented.
 *
 * The rVFC surface and the media playback state are stubbed as INSTANCE
 * properties on a real `<video>` element (shadowing the prototype) so the
 * specs can drive frame presentation deterministically — real playback in
 * a headless runner is not reliable.
 */

function makeVideoStub() {
	const el = document.createElement("video");
	const state = {
		paused: true,
		playCalls: 0,
		pauseCalls: 0,
		pending: new Map(),
		nextHandle: 1,
		cancelled: [],
	};
	Object.defineProperty(el, "paused", {
		get: () => {
			return state.paused;
		},
		configurable: true,
	});
	el.play = () => {
		state.paused = false;
		state.playCalls++;
		return Promise.resolve();
	};
	el.pause = () => {
		state.paused = true;
		state.pauseCalls++;
	};
	el.requestVideoFrameCallback = (cb) => {
		const handle = state.nextHandle++;
		state.pending.set(handle, cb);
		return handle;
	};
	el.cancelVideoFrameCallback = (handle) => {
		state.cancelled.push(handle);
		state.pending.delete(handle);
	};
	// deliver "a new frame was presented" to every pending callback; the
	// engine's callback re-registers itself, so drain a snapshot first
	state.presentFrame = () => {
		const callbacks = [...state.pending.values()];
		state.pending.clear();
		for (const cb of callbacks) {
			cb(performance.now(), {});
		}
	};
	return { el, state };
}

function makeVideoSprite(el) {
	return new Sprite(0, 0, {
		image: el,
		framewidth: 64,
		frameheight: 64,
	});
}

describe("Video Sprite (rVFC frame sync)", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("registers a video-frame callback and stamps version 0 on construction", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		expect(sprite.isVideo).toBe(true);
		expect(el.version).toBe(0);
		expect(state.pending.size).toBe(1);
		sprite.destroy();
	});

	it("each presented frame bumps the version and re-registers", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		state.presentFrame();
		expect(el.version).toBe(1);
		expect(state.pending.size).toBe(1);
		state.presentFrame();
		expect(el.version).toBe(2);
		expect(state.pending.size).toBe(1);
		sprite.destroy();
	});

	it("update() marks dirty only when a new frame was presented", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);

		// first update consumes the initial stamp (paints the poster frame)
		sprite.isDirty = false;
		sprite.update(16);
		expect(sprite.isDirty).toBe(true);

		// no new frame → stays clean
		sprite.isDirty = false;
		sprite.update(16);
		expect(sprite.isDirty).toBe(false);

		// new frame presented → dirty again
		state.presentFrame();
		sprite.update(16);
		expect(sprite.isDirty).toBe(true);

		sprite.destroy();
	});

	it("a frame presented while paused (seek) still repaints", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		sprite.isDirty = false;
		sprite.update(16); // consume the initial stamp
		sprite.isDirty = false;

		expect(el.paused).toBe(true);
		state.presentFrame(); // e.g. a stop() rewind presenting frame 0
		sprite.update(16);
		expect(sprite.isDirty).toBe(true);

		sprite.destroy();
	});

	it("a paused video no longer clears an externally-set dirty flag", () => {
		const { el } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		sprite.isDirty = false;
		sprite.update(16); // consume the initial stamp
		expect(el.paused).toBe(true);

		// e.g. a tween moved the sprite earlier in the tick
		sprite.isDirty = true;
		sprite.update(16);
		expect(sprite.isDirty).toBe(true);

		sprite.destroy();
	});

	it("falls back to repaint-while-playing without rVFC support", () => {
		const { el, state } = makeVideoStub();
		// simulate an old browser: no rVFC on this instance
		el.requestVideoFrameCallback = undefined;
		const sprite = makeVideoSprite(el);
		expect(el.version).toBe(undefined);

		// paused → not dirty
		sprite.isDirty = false;
		sprite.update(16);
		expect(sprite.isDirty).toBe(false);

		// playing → dirty every update
		sprite.animationpause = false;
		sprite.update(16);
		expect(state.playCalls).toBe(1);
		expect(sprite.isDirty).toBe(true);
		sprite.isDirty = false;
		sprite.update(16);
		expect(sprite.isDirty).toBe(true);

		sprite.destroy();
	});

	it("destroy() cancels the pending callback and removes the version stamp", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		expect(state.pending.size).toBe(1);
		const [pendingHandle] = state.pending.keys();

		sprite.destroy();
		expect(state.cancelled).toContain(pendingHandle);
		expect(state.pending.size).toBe(0);
		expect("version" in el).toBe(false);
	});

	it("destroying one of two sprites sharing a video keeps the survivor healthy", () => {
		const { el, state } = makeVideoStub();
		const spriteA = makeVideoSprite(el);
		const spriteB = makeVideoSprite(el);

		state.presentFrame();
		spriteA.destroy(); // cancels A's callback and deletes the stamp

		// B's next presented frame must SELF-HEAL the counter — a bare
		// `version++` on the deleted stamp would produce NaN, leaving B
		// permanently dirty (NaN !== NaN) and re-uploading every draw
		state.presentFrame();
		expect(Number.isFinite(el.version)).toBe(true);

		spriteB.isDirty = false;
		spriteB.update(16);
		expect(spriteB.isDirty).toBe(true); // the new frame repaints once

		spriteB.isDirty = false;
		spriteB.update(16);
		expect(spriteB.isDirty).toBe(false); // ...and then settles

		spriteB.destroy();
	});

	it("pauses the video on STATE_PAUSE (regression: listener used a wrong event name)", () => {
		const { el, state } = makeVideoStub();
		const sprite = makeVideoSprite(el);
		const baseline = state.pauseCalls;

		event.emit(event.STATE_PAUSE);
		expect(state.pauseCalls).toBe(baseline + 1);

		sprite.destroy();
	});
});
