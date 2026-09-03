import { afterEach, describe, expect, it } from "vitest";
import { load as loadSound } from "../src/audio/playback.ts";
import { setStopOnAudioError, state } from "../src/audio/state.ts";
import { audio, loader } from "../src/index.js";
import { fetchData } from "../src/utils/fetchdata.js";

/**
 * Two regressions from the in-tree audio backend (20.3.0), both of which
 * strand a game on a blank loading screen.
 */
describe("audio preloading", () => {
	afterEach(() => {
		setStopOnAudioError(true);
		for (const name of Object.keys(state.tracks)) {
			delete state.tracks[name];
		}
		state.retryCounters = {};
	});

	describe("a clip that fails to load with errors ignored", () => {
		it("continues the preload instead of failing it", async () => {
			// `stopOnAudioError = false` means "ignore audio errors, disable
			// audio and carry on". But the error callback handed to a parser
			// IS the preload promise's `reject` (loader.js), so calling it
			// aborted the whole preload: `Promise.all` rejected,
			// `completeLoading()` never ran, and the game sat on a blank
			// screen forever — over one missing sound effect.
			audio.init("wav");
			setStopOnAudioError(false);
			const outcome = await new Promise((resolve) => {
				loadSound(
					{ name: "no-such-clip", src: "tests/does-not-exist/" },
					() => {
						return resolve("continued");
					},
					() => {
						return resolve("failed the preload");
					},
				);
			});
			expect(outcome).toBe("continued");
		}, 20000);

		it("says so in the console — the only signal on this path", async () => {
			// The preload carries on and the game reaches the next scene, so
			// the warning is all a developer gets to tell them the sound is
			// missing. Nothing guarded it.
			audio.init("wav");
			setStopOnAudioError(false);
			const warned = [];
			const warn = console.warn;
			console.warn = (...a) => {
				warned.push(a.join(" "));
			};
			try {
				await new Promise((resolve) => {
					loadSound(
						{ name: "noisy-failure", src: "tests/does-not-exist/" },
						() => {
							return resolve();
						},
						() => {
							return resolve();
						},
					);
					setTimeout(resolve, 8000);
				});
			} finally {
				console.warn = warn;
			}
			expect(
				warned.some((m) => {
					return m.includes("failed loading noisy-failure");
				}),
			).toBe(true);
			expect(
				warned.some((m) => {
					return m.includes("disabling audio");
				}),
			).toBe(true);
		}, 15000);

		it("reports the failure without throwing where nobody can catch", async () => {
			// The default path used to `throw` from a timer callback, so it
			// landed on an empty stack as an uncaught global error: no caller's
			// try/catch could see it, the documented "throws" was unreachable,
			// and test runners flagged the unhandled error as a false-positive
			// risk across the whole suite. It now reports instead.
			//
			// The CONTRACT that must not change is the error callback — for a
			// promise-based preload that is the reject, and it is what a caller
			// actually catches. Both halves asserted here together.
			audio.init("wav");
			setStopOnAudioError(true);
			const errors = [];
			const uncaught = [];
			const err = console.error;
			const onUncaught = (e) => {
				return uncaught.push(e.message ?? String(e));
			};
			console.error = (...a) => {
				errors.push(a.join(" "));
			};
			globalThis.addEventListener("error", onUncaught);
			let reported = false;
			try {
				await new Promise((resolve) => {
					loadSound(
						{ name: "loud-failure", src: "tests/does-not-exist/" },
						() => {
							return resolve();
						},
						() => {
							reported = true;
							resolve();
						},
					);
					setTimeout(resolve, 8000);
				});
				// let any stray uncaught error surface before we look
				await new Promise((r) => {
					setTimeout(r, 50);
				});
			} finally {
				console.error = err;
				globalThis.removeEventListener("error", onUncaught);
			}
			// the contract: the loader is told, so the preload rejects
			expect(reported).toBe(true);
			// the diagnostic still reaches the console
			expect(
				errors.some((m) => {
					return m.includes("failed loading loud-failure");
				}),
			).toBe(true);
			// ...and nothing escapes as an uncatchable global error
			expect(
				uncaught.filter((m) => {
					return m.includes("failed loading loud-failure");
				}),
			).toEqual([]);
		}, 15000);

		it("still fails the preload when errors are NOT ignored", async () => {
			// the other half of the contract: the default must keep reporting
			audio.init("wav");
			setStopOnAudioError(true);
			const outcome = await new Promise((resolve) => {
				try {
					loadSound(
						{ name: "no-such-clip-2", src: "tests/does-not-exist/" },
						() => {
							return resolve("continued");
						},
						() => {
							return resolve("failed the preload");
						},
					);
				} catch {
					resolve("failed the preload");
				}
			});
			expect(outcome).toBe("failed the preload");
		}, 20000);
	});

	describe("failures that carry no voice id", () => {
		// A clip-level failure — the bytes arrived but will not decode, or no
		// codec matches, or there is no audio support — emits `loaderror` with
		// a null id. The listener demanded a NUMERIC id, so none of these ever
		// reached the retry/give-up path: no callback either way, and the
		// preload waited forever. Only a transport failure worked, and only
		// because it falls back to an HTML5 element whose error carries a
		// real voice id.
		//
		// The realistic trigger is SPA-style hosting: a missing `sfx.wav` is
		// rewritten to `index.html` and served 200, so the fetch succeeds and
		// the decode fails. Also a corrupt or truncated file.
		it("a clip whose bytes will not decode still continues the preload", async () => {
			audio.init("wav");
			setStopOnAudioError(false);
			const outcome = await new Promise((resolve) => {
				const timer = setTimeout(() => {
					return resolve("hung");
				}, 8000);
				loadSound(
					{ name: "undecodable", src: "data:audio/wav;base64,bm90LWEtd2F2" },
					() => {
						clearTimeout(timer);
						resolve("continued");
					},
					() => {
						clearTimeout(timer);
						resolve("failed the preload");
					},
				);
			});
			expect(outcome).toBe("continued");
		}, 15000);

		it("a source with no usable codec still continues the preload", async () => {
			audio.init("wav");
			setStopOnAudioError(false);
			const outcome = await new Promise((resolve) => {
				const timer = setTimeout(() => {
					return resolve("hung");
				}, 8000);
				loadSound(
					{ name: "no-codec", src: "data:audio/x-nonsense;base64,AAAA" },
					() => {
						clearTimeout(timer);
						resolve("continued");
					},
					() => {
						clearTimeout(timer);
						resolve("failed the preload");
					},
				);
			});
			expect(outcome).toBe("continued");
		}, 15000);
	});

	describe("the reported symptom, through the real preloader", () => {
		it("reaches the completion callback with a bad sound in the manifest", async () => {
			// This is the bug as a game hits it: one sound in the preload
			// manifest fails, and the loader never finishes — no completion
			// callback, no scene change, a blank screen forever.
			audio.init("wav");
			setStopOnAudioError(false);
			const done = await new Promise((resolve) => {
				const timer = setTimeout(() => {
					return resolve("never completed");
				}, 15000);
				loader
					.preload(
						[
							{
								name: "ghost-sfx",
								type: "audio",
								src: "tests/does-not-exist/",
							},
						],
						() => {
							clearTimeout(timer);
							resolve("completed");
						},
						false, // no state switch: this is a bare harness
					)
					.catch(() => {
						clearTimeout(timer);
						resolve("preload rejected");
					});
			});
			expect(done).toBe("completed");
		}, 20000);
	});

	describe("other ways the preload used to never settle", () => {
		it("`preload: false` reports done instead of waiting forever", async () => {
			// The backend is told not to fetch, so neither callback ever fires
			// — a manifest containing the clip waited on it indefinitely. The
			// clip is still created and playable on demand, which is what
			// `preload: false` asks for.
			audio.init("wav");
			const outcome = await new Promise((resolve) => {
				const timer = setTimeout(() => {
					return resolve("hung");
				}, 5000);
				loadSound(
					{ name: "lazy-clip", src: "tests/does-not-exist/", preload: false },
					() => {
						clearTimeout(timer);
						resolve("reported done");
					},
					() => {
						clearTimeout(timer);
						resolve("failed");
					},
				);
			});
			expect(outcome).toBe("reported done");
		}, 10000);

		it("unloading mid-retry gives the next load a fresh budget", () => {
			// the retry counter outlived its clip, so a reload of the same name
			// inherited a spent budget and gave up on its first failure
			audio.init("wav");
			loadSound({
				name: "recycled",
				src: "tests/does-not-exist/",
				preload: false,
			});
			state.retryCounters.recycled = 2; // mid-retry
			audio.unload("recycled");
			expect(state.retryCounters.recycled).toBeUndefined();
		});
	});

	describe("the loader's credential settings", () => {
		it("are read-only bindings — `setOptions` is the way to set them", () => {
			// Same trap as the removed `loader.onload` / `onProgress`: these are
			// ES-module bindings, so a direct assignment throws. The JSDoc used
			// to give the throwing form as its example.
			for (const key of ["withCredentials", "crossOrigin", "nocache"]) {
				expect(() => {
					loader[key] = true;
				}).toThrow(TypeError);
			}
			loader.setOptions({ withCredentials: true });
			expect(loader.withCredentials).toBe(true);
			loader.setOptions({ withCredentials: false });
			expect(loader.withCredentials).toBe(false);
		});
	});

	describe("withCredentials", () => {
		it("reaches the audio backend's XHR options", () => {
			// The backend reads `o.xhr.withCredentials`; the loader was still
			// passing the old flat `xhrWithCredentials`, so credentials were
			// silently dropped and an authenticated audio preload never
			// completed — the same blank screen, from the other direction.
			audio.init("wav");
			loadSound(
				{ name: "cred-clip", src: "tests/does-not-exist/" },
				undefined,
				undefined,
				{ withCredentials: true },
			);
			expect(state.tracks["cred-clip"]._xhr.withCredentials).toBe(true);
		});

		it("still honours the pre-20.3 flat `xhrWithCredentials`", async () => {
			// Games written against the previous audio backend pass this
			// straight through to a `Sound`, so it has to keep working — it is
			// deprecated, not removed.
			const { Sound } = await import("../src/audio/backend/sound.ts");
			const clip = new Sound({
				src: ["data:audio/wav;base64,UklGRgA="],
				preload: false,
				xhrWithCredentials: true,
			});
			expect(clip._xhr.withCredentials).toBe(true);
		});

		it("lets the nested form win when both are given", async () => {
			const { Sound } = await import("../src/audio/backend/sound.ts");
			const clip = new Sound({
				src: ["data:audio/wav;base64,UklGRgA="],
				preload: false,
				xhrWithCredentials: true,
				xhr: { withCredentials: false },
			});
			expect(clip._xhr.withCredentials).toBe(false);
		});

		it("reaches the actual fetch, not just the options object", async () => {
			// The whole chain, end to end: `loader.setOptions({withCredentials})`
			// -> parser settings -> `xhr.withCredentials` -> `_xhr` -> the
			// fetch the backend performs. Buffered audio goes through the same
			// shared `fetchData` as every other asset type, so proving the
			// option arrives at the fetcher proves credentials are sent.
			const { setAudioFetcher } = await import(
				"../src/audio/backend/buffer.ts"
			);
			const seen = [];
			setAudioFetcher((url, options) => {
				seen.push(options);
				return Promise.reject(new Error("not a real fetch"));
			});
			try {
				audio.init("wav");
				setStopOnAudioError(false);
				await new Promise((resolve) => {
					loadSound(
						{ name: "fetch-cred-clip", src: "tests/does-not-exist/" },
						() => {
							return resolve();
						},
						() => {
							return resolve();
						},
						{ withCredentials: true },
					);
					setTimeout(resolve, 3000);
				});
			} finally {
				// `setAudioFetcher` is module-global — restore the real one or
				// every later audio test loads through this stub
				setAudioFetcher((url, options) => {
					return fetchData(url, "arrayBuffer", {
						withCredentials: options.withCredentials === true,
					});
				});
			}
			expect(seen.length).toBeGreaterThan(0);
			expect(seen[0].withCredentials).toBe(true);
		}, 10000);

		it("defaults to false when unset", () => {
			audio.init("wav");
			loadSound({ name: "plain-clip", src: "tests/does-not-exist/" });
			expect(state.tracks["plain-clip"]._xhr.withCredentials).toBe(false);
		});
	});
});
