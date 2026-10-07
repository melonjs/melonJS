import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAutoPause } from "../src/audio/autopause.ts";
import { resetSpatialTracking } from "../src/audio/spatial.ts";
import {
	getListenerPosition,
	getSoundOrThrow,
	isGlobalMuted,
} from "../src/audio/state.ts";
import { Application, audio, Renderable } from "../src/index.js";
import { emit, GAME_AFTER_UPDATE, on } from "../src/system/event.ts";

/** a valid, silent WAV served as a data URL, so a clip really loads */
const makeSilentWavDataUrl = (durationSec = 0.05) => {
	const sampleRate = 8000;
	const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
	const dataSize = numSamples * 2;
	const buf = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buf);
	let p = 0;
	const str = (s) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(p++, s.charCodeAt(i));
		}
	};
	const u32 = (v) => {
		view.setUint32(p, v, true);
		p += 4;
	};
	const u16 = (v) => {
		view.setUint16(p, v, true);
		p += 2;
	};
	str("RIFF");
	u32(36 + dataSize);
	str("WAVE");
	str("fmt ");
	u32(16);
	u16(1);
	u16(1);
	u32(sampleRate);
	u32(sampleRate * 2);
	u16(2);
	u16(16);
	str("data");
	u32(dataSize);
	let bytes = "";
	const all = new Uint8Array(buf);
	for (let i = 0; i < all.length; i++) {
		bytes += String.fromCharCode(all[i]);
	}
	return `data:audio/wav;base64,${btoa(bytes)}`;
};

const loadClip = (name, extra = {}) => {
	audio.init("wav");
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => {
			return reject(new Error(`timeout ${name}`));
		}, 2000);
		audio.load(
			{ name, src: makeSilentWavDataUrl(), ...extra },
			() => {
				clearTimeout(t);
				resolve();
			},
			() => {
				clearTimeout(t);
				reject(new Error(`load failed ${name}`));
			},
		);
	});
};

/**
 * How many stops the engine has asked the backend for on this clip.
 *
 * Neither `audio.playing()` nor the clip's own `stop` lifecycle hook can answer
 * "did this stop?" here. The test page has had no user gesture, so the context
 * is suspended, `_playLock` stays true, and every voice reads `_paused: true`
 * from the moment it starts; under that lock `stop()` pushes itself onto the
 * backend's replay queue and returns before it emits anything. That queue entry
 * IS the record of the request, and it is what will run the moment a real page
 * unlocks.
 * @param {string} name - the clip
 * @returns {number} the number of queued stop requests
 */
const stopRequests = (name) => {
	return getSoundOrThrow(name)._queue.filter((q) => {
		return q.event === "stop";
	}).length;
};

/** the voice's own panner node, which is where the truth is */
const pannerOf = (name, id) => {
	return getSoundOrThrow(name)._soundById(id)?._panner;
};

/**
 * What the backend recorded for a voice.
 *
 * `AudioParam.value` is read rather than asserted on: a scheduled
 * `setValueAtTime` does not settle into `.value` while the test context is
 * suspended, so it reads 0 whatever was written. `_pos` / `_stereo` are what
 * the engine actually stores, and what a voice `reset()` replays from.
 * @param {string} name - the clip
 * @param {number} id - the playback id
 * @returns {object} the backend voice
 */
const voiceOf = (name, id) => {
	return getSoundOrThrow(name)._soundById(id);
};

/**
 * Blur and focus, as the application raises them.
 *
 * `Application#_onBlur` is called rather than the `BLUR` event, because the
 * gate under test IS the application's settings: the handler is what decides
 * whether a blur silences the mix. `state.pause()` reached from here is inert
 * without a running stage, which is the point of only asserting on the mute.
 * @param {object} settings - the app settings under test
 * @returns {object} `blur` / `focus`, bound to those settings
 */
const focusPair = (settings = { pauseOnBlur: true, resumeOnFocus: true }) => {
	const app = { stopOnBlur: false, ...settings };
	return {
		blur: () => {
			return Application.prototype._onBlur.call(app);
		},
		focus: () => {
			return Application.prototype._onFocus.call(app);
		},
	};
};

/** one frame of the engine's post-update hook */
const frame = () => {
	emit(GAME_AFTER_UPDATE, 16);
};

const at = (x, y, z = 0) => {
	const r = new Renderable(x, y, 8, 8);
	r.pos.z = z;
	return r;
};

describe("spatial audio", () => {
	beforeEach(() => {
		resetSpatialTracking();
		resetAutoPause();
	});
	afterEach(() => {
		audio.setListener(null);
		resetSpatialTracking();
		resetAutoPause();
	});

	describe("listener", () => {
		it("round-trips a world position", () => {
			audio.listener(100, 250, -30);
			expect(audio.listener()).toEqual([100, 250, -30]);
		});

		it("REGRESSION: a followed source and the listener agree on which way is down", async () => {
			// A set/get round trip CANNOT catch this: the first version
			// converted to audio space in `worldPositionOf` and converted AGAIN
			// inside `listener()`, so reads and writes both flipped and matched
			// each other while the SOURCE sat in the opposite hemisphere. The
			// only honest check is listener against source.
			await loadClip("down");
			const player = at(0, 2000);
			audio.setListener(player);
			const id = audio.play("down", { follow: player });
			frame();

			// the public read is in WORLD space, where it was written
			expect(audio.listener()[1]).toBeCloseTo(2000, 3);
			// and BOTH must land in the same hemisphere once converted. Reading
			// the listener in world space and the source in audio space would
			// pass even with no conversion at all, which is how the double flip
			// survived the first time: compare the two as the panner sees them.
			const sourceY = voiceOf("down", id)._pos[1];
			expect(getListenerPosition()[1]).toBeCloseTo(sourceY, 3);
			// and that shared value is Web Audio's +Y-up, not melonJS's y-down
			expect(sourceY).toBeCloseTo(-2000, 3);
			audio.stop("down");
		});

		it("follows a renderable across frames, and releases when it dies", async () => {
			const player = at(10, 20);
			audio.setListener(player);
			frame();
			expect(audio.listener()[0]).toBeCloseTo(10, 5);

			player.pos.set(400, 90, 0);
			frame();
			expect(audio.listener()[0]).toBeCloseTo(400, 5);

			// a destroyed target must not throw from inside the frame loop
			player.destroy();
			expect(() => {
				frame();
			}).not.toThrow();
			expect(() => {
				frame();
			}).not.toThrow();
		});

		it("takes orientation from a Camera3d, and only from a Camera3d", () => {
			const plain = at(0, 0);
			audio.listenerOrientation(0, 0, -1, 0, -1, 0);
			const before = audio.listenerOrientation();
			audio.setListener(plain);
			frame();
			// a plain renderable contributes position only
			expect(audio.listenerOrientation()).toEqual(before);
		});

		it("does not install a frame handler until something is followed", () => {
			// the manual `listener()` path writes straight through and
			// subscribes to nothing, so a game using it pays no per-frame cost
			let ticked = false;
			const probe = () => {
				ticked = true;
			};
			on(GAME_AFTER_UPDATE, probe);
			audio.listener(1, 2, 3);
			frame();
			expect(ticked).toBe(true); // the probe itself runs
			// and the listener did not move on its own afterwards
			audio.listener(7, 8, 9);
			frame();
			expect(audio.listener()).toEqual([7, 8, 9]);
		});
	});

	describe("placement", () => {
		it("`at` pins a fixed world point, with Y flipped once", async () => {
			await loadClip("pin");
			const id = audio.play("pin", { at: { x: 300, y: 120 } });
			expect(voiceOf("pin", id)._pos[0]).toBeCloseTo(300, 3);
			expect(voiceOf("pin", id)._pos[1]).toBeCloseTo(-120, 3);
			audio.stop("pin");
		});

		it("`follow` tracks its renderable every frame", async () => {
			await loadClip("track");
			const thing = at(0, 0);
			const id = audio.play("track", { follow: thing });
			thing.pos.set(640, 480, 0);
			frame();
			expect(voiceOf("track", id)._pos[0]).toBeCloseTo(640, 3);
			expect(voiceOf("track", id)._pos[1]).toBeCloseTo(-480, 3);
			audio.stop("track");
		});

		it("refuses `follow` and `at` together rather than silently picking one", async () => {
			await loadClip("both");
			expect(() => {
				return audio.play("both", { at: { x: 1, y: 1 }, follow: at(0, 0) });
			}).toThrow(/follow.*or.*at/i);
		});

		it("stops tracking on audio.stop, so a dead target cannot throw later", async () => {
			await loadClip("released");
			const thing = at(0, 0);
			audio.play("released", { follow: thing, loop: true });
			audio.stop("released");
			thing.destroy();
			expect(() => {
				frame();
			}).not.toThrow();
		});

		it("`stopWithTarget` stops the sound when its renderable dies", async () => {
			await loadClip("owned");
			const owner = at(0, 0);
			const id = audio.play("owned", {
				follow: owner,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			expect(stopRequests("owned")).toBe(0);
			owner.destroy();
			frame();
			// a loop on a dead entity is the case this exists for: without it
			// the sound plays on forever from wherever the entity last stood
			expect(stopRequests("owned")).toBe(1);
			expect(id).toBeGreaterThan(0);
		});

		it("without `stopWithTarget` a dead renderable only ends the tracking", async () => {
			await loadClip("orphan");
			const owner = at(0, 0);
			audio.play("orphan", { follow: owner, loop: true });
			frame();
			owner.destroy();
			frame();
			// tracking is released, but the sound is the game's to end
			expect(stopRequests("orphan")).toBe(0);
			audio.stop("orphan");
		});

		it("`unfollow` detaches a sound and leaves it where it is", async () => {
			await loadClip("detach");
			const thing = at(300, 0);
			const id = audio.play("detach", { follow: thing, loop: true });
			frame();
			expect(voiceOf("detach", id)._pos[0]).toBeCloseTo(300, 3);
			audio.unfollow(id);
			thing.pos.set(900, 0, 0);
			frame();
			// not stopped, and still at the position it was detached at
			expect(stopRequests("detach")).toBe(0);
			expect(voiceOf("detach", id)._pos[0]).toBeCloseTo(300, 3);
			audio.stop("detach");
		});

		it("survives the clip being unloaded while followed", async () => {
			await loadClip("unloaded");
			const thing = at(0, 0);
			audio.play("unloaded", { follow: thing, loop: true });
			audio.unload("unloaded");
			expect(() => {
				frame();
			}).not.toThrow();
		});
	});

	describe("defaults", () => {
		it("gives placed sounds pixel-shaped attributes, not metre ones", async () => {
			await loadClip("defaults");
			const id = audio.play("defaults", { at: { x: 0, y: 0 } });
			const panner = pannerOf("defaults", id);
			// the backend's own default is 1 metre and "HRTF"
			expect(panner.refDistance).toBeGreaterThan(100);
			expect(panner.panningModel).toBe("equalpower");
			audio.stop("defaults");
		});

		it("applies to NEW sounds only", async () => {
			await loadClip("newonly");
			const first = audio.play("newonly", { at: { x: 0, y: 0 } });
			const firstRef = pannerOf("newonly", first).refDistance;

			audio.setSpatialDefaults({ refDistance: 777 });
			const second = audio.play("newonly", { at: { x: 0, y: 0 } });

			expect(pannerOf("newonly", first).refDistance).toBe(firstRef);
			expect(pannerOf("newonly", second).refDistance).toBe(777);
			audio.stop("newonly");
		});

		it("leaves a plain position() call on the backend defaults", async () => {
			await loadClip("plain");
			const id = audio.play("plain");
			audio.position("plain", 1, 2, 3, id);
			// untouched by the pixel defaults: this is the 20.x contract
			expect(pannerOf("plain", id).refDistance).toBe(1);
			audio.stop("plain");
		});
	});

	describe("stereo and position in either order", () => {
		it("position then stereo", async () => {
			await loadClip("p-then-s");
			const id = audio.play("p-then-s");
			audio.position("p-then-s", 5, 0, 0, id);
			expect(pannerOf("p-then-s", id)).toBeInstanceOf(PannerNode);
			audio.stereo("p-then-s", -1, id);
			// used to be a silent no-op, leaving a PannerNode in place
			expect(pannerOf("p-then-s", id)).toBeInstanceOf(StereoPannerNode);
			expect(voiceOf("p-then-s", id)._stereo).toBeCloseTo(-1, 5);
			audio.stop("p-then-s");
		});

		it("stereo then position", async () => {
			await loadClip("s-then-p");
			const id = audio.play("s-then-p");
			audio.stereo("s-then-p", 1, id);
			expect(pannerOf("s-then-p", id)).toBeInstanceOf(StereoPannerNode);
			audio.position("s-then-p", 9, 0, 0, id);
			expect(pannerOf("s-then-p", id)).toBeInstanceOf(PannerNode);
			expect(voiceOf("s-then-p", id)._pos[0]).toBeCloseTo(9, 3);
			// and the stereo state is cleared, or `reset()` would resurrect
			// the StereoPannerNode on the next play
			expect(voiceOf("s-then-p", id)._stereo).toBeNull();
			audio.stop("s-then-p");
		});

		it("REGRESSION: a group stereo does not make follow a silent no-op", async () => {
			// `_stereo` is inherited from the GROUP at voice init and takes
			// precedence over `_pos`, so one historical `audio.stereo(name, 0)`
			// used to make every later voice a StereoPannerNode, and `follow`
			// wrote positions into a node that has none.
			await loadClip("poisoned");
			audio.stereo("poisoned", 0);
			const thing = at(500, 0);
			const id = audio.play("poisoned", { follow: thing });
			frame();
			expect(pannerOf("poisoned", id)).toBeInstanceOf(PannerNode);
			expect(voiceOf("poisoned", id)._pos[0]).toBeCloseTo(500, 3);
			audio.stop("poisoned");
		});
	});

	describe("panner attributes reach the group", () => {
		it("REGRESSION: panner() before the first play is not a no-op", async () => {
			// the documented example did nothing at all: the setter merged
			// into live voices only, and there were none yet
			await loadClip("group-attr");
			audio.panner("group-attr", { refDistance: 42 });
			expect(audio.panner("group-attr").refDistance).toBe(42);
			const id = audio.play("group-attr");
			audio.position("group-attr", 1, 1, 1, id);
			expect(pannerOf("group-attr", id).refDistance).toBe(42);
			audio.stop("group-attr");
		});
	});

	describe("focus loss silences the mix", () => {
		it("mutes on blur and restores on focus", () => {
			const { blur, focus } = focusPair();
			expect(isGlobalMuted()).toBe(false);
			blur();
			expect(isGlobalMuted()).toBe(true);
			focus();
			expect(isGlobalMuted()).toBe(false);
		});

		it("does not un-mute a game that muted itself", () => {
			const { blur, focus } = focusPair();
			audio.muteAll();
			blur();
			focus();
			// the player chose silence; a focus round trip is not consent
			expect(isGlobalMuted()).toBe(true);
			audio.unmuteAll();
		});

		it("survives repeated blurs before a single focus", () => {
			const { blur, focus } = focusPair();
			blur();
			blur();
			focus();
			expect(isGlobalMuted()).toBe(false);
		});

		it("silences procedural audio too, since it routes through the master gain", () => {
			// `tone()` bypasses the voice machinery entirely; muting the master
			// gain is the only approach that covers it without being told about
			// it one source at a time
			const { blur, focus } = focusPair();
			blur();
			expect(() => {
				return audio.tone({ freq: 440, duration: 0.01 });
			}).not.toThrow();
			expect(isGlobalMuted()).toBe(true);
			focus();
		});

		it("leaves the mix alone when the game opted out of pausing in the background", () => {
			const { blur, focus } = focusPair({
				pauseOnBlur: false,
				resumeOnFocus: false,
			});
			blur();
			expect(isGlobalMuted()).toBe(false);
			focus();
			expect(isGlobalMuted()).toBe(false);
		});

		it("restores on focus even for a game that stops on blur without resuming", () => {
			// `stopOnBlur` restarts the stage from `_onFocus` regardless of
			// `resumeOnFocus`, so the mute has to be lifted there too or the
			// game comes back silent for good
			const { blur, focus } = focusPair({
				stopOnBlur: true,
				pauseOnBlur: false,
				resumeOnFocus: false,
			});
			blur();
			expect(isGlobalMuted()).toBe(true);
			focus();
			expect(isGlobalMuted()).toBe(false);
		});
	});
});
