import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { Application, boot, event, Sprite, video } from "../src/index.js";

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
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
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

	/**
	 * Browsers refuse to start a video before the user has interacted with
	 * the page. `update()` used to call `play()` again on every frame and
	 * leave each refusal unhandled: one uncaught console error per frame
	 * until the first click. The refusal is now handled once, and the next
	 * gesture starts playback from inside its own handler, where the browser
	 * allows it.
	 */
	describe("playback refused until a user gesture", () => {
		const GESTURES = ["touchstart", "touchend", "click", "keydown"];
		let unhandled;
		const onUnhandled = (e) => {
			unhandled.push(e.reason);
		};
		// the gesture listeners currently left on the document
		let tracked;
		const listening = () => {
			return tracked.length;
		};

		beforeEach(() => {
			unhandled = [];
			window.addEventListener("unhandledrejection", onUnhandled);
			tracked = [];
			const add = document.addEventListener;
			const remove = document.removeEventListener;
			vi.spyOn(document, "addEventListener").mockImplementation(
				(type, listener, options) => {
					if (GESTURES.includes(type)) {
						tracked.push([type, listener]);
					}
					add.call(document, type, listener, options);
				},
			);
			vi.spyOn(document, "removeEventListener").mockImplementation(
				(type, listener, options) => {
					const i = tracked.findIndex(([t, l]) => {
						return t === type && l === listener;
					});
					if (i !== -1) {
						tracked.splice(i, 1);
					}
					remove.call(document, type, listener, options);
				},
			);
		});

		afterEach(() => {
			window.removeEventListener("unhandledrejection", onUnhandled);
			vi.restoreAllMocks();
		});

		// a rejection's handler runs as a microtask, `unhandledrejection` as a task
		const settle = () => {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		};

		const refuse = (el, state, name = "NotAllowedError") => {
			el.play = () => {
				state.playCalls++;
				return Promise.reject(new DOMException("refused", name));
			};
		};

		const allow = (el, state) => {
			el.play = () => {
				state.paused = false;
				state.playCalls++;
				return Promise.resolve();
			};
		};

		const gesture = (type) => {
			document.dispatchEvent(new Event(type, { bubbles: true }));
		};

		it("a refused play() is tried once, not on every frame", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			for (let i = 0; i < 10; i++) {
				sprite.update(16);
				await settle();
			}
			expect(state.playCalls).toBe(1);
			expect(listening()).toBe(GESTURES.length);
			sprite.destroy();
		});

		it("the refusal is handled, so it never reaches the console", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();
			expect(unhandled).toHaveLength(0);
			sprite.destroy();
		});

		it.for(GESTURES)(
			"a %s starts playback from inside the gesture",
			async (type) => {
				const { el, state } = makeVideoStub();
				refuse(el, state);
				const sprite = makeVideoSprite(el);
				sprite.play();
				sprite.update(16);
				await settle();

				allow(el, state);
				gesture(type);
				// synchronously, inside the handler: no update() in between
				expect(state.playCalls).toBe(2);
				expect(el.paused).toBe(false);
				sprite.destroy();
			},
		);

		it("a gesture refused again keeps listening, and playing stops listening", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();

			gesture("click");
			expect(state.playCalls).toBe(2);
			await settle();
			gesture("click");
			expect(state.playCalls).toBe(3);
			await settle();

			allow(el, state);
			gesture("click");
			expect(state.playCalls).toBe(4);
			await settle();
			// playing now: nothing is left listening, and neither a gesture
			// nor a frame calls play() again
			expect(listening()).toBe(0);
			gesture("click");
			sprite.update(16);
			expect(state.playCalls).toBe(4);
			expect(unhandled).toHaveLength(0);
			sprite.destroy();
		});

		it("a paused game does not start the video on a gesture", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();

			event.emit(event.STATE_PAUSE);
			expect(listening()).toBe(0);
			allow(el, state);
			gesture("click");
			expect(state.playCalls).toBe(1);

			// once the game runs again, update() asks as it always has
			sprite.update(16);
			expect(state.playCalls).toBe(2);
			expect(el.paused).toBe(false);
			sprite.destroy();
		});

		it("a refusal landing after the game paused does not start listening", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			// paused while the request is still pending
			event.emit(event.STATE_PAUSE);
			await settle();

			expect(listening()).toBe(0);
			allow(el, state);
			gesture("click");
			expect(state.playCalls).toBe(1);
			sprite.destroy();
		});

		it("a sprite paused while waiting ignores the gesture", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();

			sprite.pause();
			allow(el, state);
			gesture("click");
			expect(state.playCalls).toBe(1);

			// resuming later plays on the next frame, as before
			sprite.play();
			sprite.update(16);
			expect(state.playCalls).toBe(2);
			sprite.destroy();
		});

		it("destroy() stops listening for the gesture", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();

			sprite.destroy();
			expect(listening()).toBe(0);
			allow(el, state);
			gesture("click");
			expect(state.playCalls).toBe(1);
		});

		it("a sprite destroyed while play() is pending never starts listening", async () => {
			const { el, state } = makeVideoStub();
			refuse(el, state);
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			// the refusal lands after the sprite is gone
			sprite.destroy();
			await settle();

			const thrown = [];
			const onError = (e) => {
				thrown.push(e.error);
				e.preventDefault();
			};
			window.addEventListener("error", onError);
			try {
				allow(el, state);
				gesture("click");
			} finally {
				window.removeEventListener("error", onError);
			}
			expect(thrown).toHaveLength(0);
			expect(state.playCalls).toBe(1);
		});

		it("an interrupted play() is retried on the next frame, still handled", async () => {
			const { el, state } = makeVideoStub();
			// e.g. pause() landing while play() was pending
			refuse(el, state, "AbortError");
			const sprite = makeVideoSprite(el);
			sprite.play();
			sprite.update(16);
			await settle();
			expect(state.playCalls).toBe(1);

			allow(el, state);
			sprite.update(16);
			expect(state.playCalls).toBe(2);
			expect(el.paused).toBe(false);
			expect(unhandled).toHaveLength(0);
			sprite.destroy();
		});
	});
});
