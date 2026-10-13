// Import helper functions directly for better tree-shaking
import { AudioContextOwner } from "../context.ts";
import type { Sound } from "./sound.ts";
import { installSpatialOnEngine } from "./spatial.ts";
import {
	type HTMLAudioElementWithUnlocked,
	isHTMLAudioElement,
	type WindowWithAudio,
} from "./types.ts";

export class AudioEngine {
	/**
	 * @ignore
	 * @internal
	 */
	_counter: number = 1000;
	/**
	 * @ignore
	 * @internal
	 */
	_html5AudioPool: HTMLAudioElement[] = [];
	html5PoolSize: number = 10;
	/**
	 * @ignore
	 * @internal
	 */
	_codecs: Record<string, boolean> = {};
	sounds: Sound[] = [];
	/**
	 * @ignore
	 * @internal
	 */
	_muted: boolean = false;
	/**
	 * @ignore
	 * @internal
	 */
	_volume: number = 1;
	/**
	 * @ignore
	 * @internal
	 */
	_canPlayEvent: string = "canplaythrough";
	/**
	 * @ignore
	 * @internal
	 */
	_navigator: Navigator | null = null;
	masterGain: GainNode | null = null;
	noAudio: boolean = false;
	usingWebAudio: boolean = true;
	autoSuspend: boolean = true;
	ctx: AudioContext | null = null;
	autoUnlock: boolean = true;
	state: string = "suspended";
	/**
	 * @ignore
	 * @internal
	 */
	_audioUnlocked: boolean = false;
	/**
	 * The single owner of the context: see `../context.ts`.
	 *
	 * The engine no longer creates listeners for keeping the context alive,
	 * nor decides when a stop should be reverted. It answers the owner's two
	 * questions and does the reviving, which is the part only it can do
	 * because only it has the voices waiting on the result.
	 */
	readonly contextOwner: AudioContextOwner = new AudioContextOwner({
		isRunning: () => this.state === "running",
		resume: () => {
			this._autoResume();
		},
	});
	/**
	 * @ignore
	 * @internal
	 */
	_scratchBuffer: AudioBuffer | null = null;
	/**
	 * @ignore
	 * @internal
	 */
	_suspendTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * @ignore
	 * @internal
	 */
	_mobileUnloaded?: boolean;

	constructor() {
		// Initialize all properties (explicit initialization ensures correct values)
		this._counter = 1000;
		this._html5AudioPool = [];
		this.html5PoolSize = 10;
		this._codecs = {};
		this.sounds = [];
		this._muted = false;
		this._volume = 1;
		this._canPlayEvent = "canplaythrough";
		this._navigator = globalThis.navigator ?? null;
		this.masterGain = null;
		this.noAudio = false;
		this.usingWebAudio = true;
		this.autoSuspend = true;
		this.ctx = null;
		this.autoUnlock = true;

		// Setup audioEngine (codecs, audio context, etc.)
		this._setup();

		// Register the audioEngine instance with the plugin manager
		// This triggers onEngineInit hooks for any plugins already registered
		installSpatialOnEngine(this);
	}

	volume(vol?: number): number | this {
		if (vol !== undefined) {
			vol = parseFloat(String(vol));

			this.ensureContext();

			if (typeof vol === "number" && vol >= 0 && vol <= 1) {
				this._volume = vol;

				if (this._muted) {
					return this;
				}

				if (this.usingWebAudio && this.ctx) {
					this.masterGain!.gain.setValueAtTime(vol, this.ctx.currentTime);
				}

				for (let i = 0; i < this.sounds.length; i++) {
					if (!this.sounds[i]._webAudio) {
						const ids = this.sounds[i]._getSoundIds();
						for (let j = 0; j < ids.length; j++) {
							const sound = this.sounds[i]._soundById(ids[j]);
							if (sound && sound._node && isHTMLAudioElement(sound._node)) {
								sound._node.volume = sound._volume * vol;
							}
						}
					}
				}

				return this;
			}
		}

		return this._volume;
	}

	mute(muted: boolean): this {
		this.ensureContext();

		this._muted = muted;

		if (this.usingWebAudio && this.ctx) {
			this.masterGain!.gain.setValueAtTime(
				muted ? 0 : this._volume,
				this.ctx.currentTime,
			);
		}

		for (let i = 0; i < this.sounds.length; i++) {
			if (!this.sounds[i]._webAudio) {
				const ids = this.sounds[i]._getSoundIds();
				for (let j = 0; j < ids.length; j++) {
					const sound = this.sounds[i]._soundById(ids[j]);
					if (sound && sound._node && isHTMLAudioElement(sound._node)) {
						sound._node.muted = muted ? true : sound._muted;
					}
				}
			}
		}

		return this;
	}

	stop(): this {
		for (let i = 0; i < this.sounds.length; i++) {
			this.sounds[i].stop();
		}

		return this;
	}

	unload(): this {
		for (let i = this.sounds.length - 1; i >= 0; i--) {
			this.sounds[i].unload();
		}

		if (
			this.usingWebAudio &&
			this.ctx &&
			typeof this.ctx.close !== "undefined"
		) {
			void this.ctx.close();
			this.ctx = null;
			this.contextOwner.detach();
			this.ensureContext();
		}

		return this;
	}

	codecs(ext: string): boolean {
		return this._codecs[ext.replace(/^x-/, "")];
	}

	/**
	 * Create the shared `AudioContext` and master gain node if they do not exist
	 * yet, and return the context.
	 *
	 * Idempotent: with a context already live this returns it untouched. It used
	 * to be a free function in `helpers/` that reached back into the singleton,
	 * with no internal guard — so six call sites each carried their own
	 * `if (!ctx)` check to stop a second context being built and the first
	 * leaked.
	 *
	 * Browsers create a context in the `suspended` state until a user gesture
	 * resumes it, so building one early costs nothing and plays nothing.
	 * @returns the shared context, or `null` when Web Audio is unavailable
	 */
	ensureContext(): AudioContext | null {
		if (this.ctx) {
			return this.ctx;
		}
		if (!this.usingWebAudio) {
			return null;
		}

		try {
			if (typeof globalThis.AudioContext !== "undefined") {
				this.ctx = new globalThis.AudioContext();
			} else {
				this.usingWebAudio = false;
			}
		} catch {
			// a browser can refuse to construct one (blocked, or too many live)
			this.usingWebAudio = false;
		}

		if (!this.ctx) {
			this.usingWebAudio = false;
			return null;
		}

		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.setValueAtTime(
			this._muted ? 0 : this._volume,
			this.ctx.currentTime,
		);
		this.masterGain.connect(this.ctx.destination);

		this.contextOwner.attach(this.ctx);
		this._setup();
		return this.ctx;
	}

	_setup(): this {
		this.state = this.ctx ? this.ctx.state || "suspended" : "suspended";
		this._autoSuspend();

		if (!this.usingWebAudio) {
			if (typeof globalThis.Audio !== "undefined") {
				try {
					const test = new globalThis.Audio();
					if (typeof test.oncanplaythrough === "undefined") {
						this._canPlayEvent = "canplay";
					}
				} catch {
					this.noAudio = true;
				}
			} else {
				this.noAudio = true;
			}
		}

		try {
			const test = new globalThis.Audio();
			if (test.muted) {
				this.noAudio = true;
			}
		} catch {
			// probing for codec support; a throw just means unsupported
		}

		if (!this.noAudio) {
			this._setupCodecs();
		}

		return this;
	}

	_setupCodecs(): this {
		let audioTest: HTMLAudioElement | null;

		try {
			audioTest =
				typeof globalThis.Audio !== "undefined" ? new globalThis.Audio() : null;
		} catch {
			return this;
		}

		if (!audioTest || typeof audioTest.canPlayType !== "function") {
			return this;
		}

		const mpegTest = audioTest.canPlayType("audio/mpeg;").replace(/^no$/, "");

		this._codecs = {
			mp3: !!(
				mpegTest || audioTest.canPlayType("audio/mp3;").replace(/^no$/, "")
			),
			mpeg: !!mpegTest,
			opus: !!audioTest
				.canPlayType('audio/ogg; codecs="opus"')
				.replace(/^no$/, ""),
			ogg: !!audioTest
				.canPlayType('audio/ogg; codecs="vorbis"')
				.replace(/^no$/, ""),
			oga: !!audioTest
				.canPlayType('audio/ogg; codecs="vorbis"')
				.replace(/^no$/, ""),
			wav: !!(
				audioTest.canPlayType('audio/wav; codecs="1"') ||
				audioTest.canPlayType("audio/wav")
			).replace(/^no$/, ""),
			aac: !!audioTest.canPlayType("audio/aac;").replace(/^no$/, ""),
			caf: !!audioTest.canPlayType("audio/x-caf;").replace(/^no$/, ""),
			m4a: !!(
				audioTest.canPlayType("audio/x-m4a;") ||
				audioTest.canPlayType("audio/m4a;") ||
				audioTest.canPlayType("audio/aac;")
			).replace(/^no$/, ""),
			m4b: !!(
				audioTest.canPlayType("audio/x-m4b;") ||
				audioTest.canPlayType("audio/m4b;") ||
				audioTest.canPlayType("audio/aac;")
			).replace(/^no$/, ""),
			mp4: !!(
				audioTest.canPlayType("audio/x-mp4;") ||
				audioTest.canPlayType("audio/mp4;") ||
				audioTest.canPlayType("audio/aac;")
			).replace(/^no$/, ""),
			weba: !!audioTest
				.canPlayType('audio/webm; codecs="vorbis"')
				.replace(/^no$/, ""),
			webm: !!audioTest
				.canPlayType('audio/webm; codecs="vorbis"')
				.replace(/^no$/, ""),
			dolby: !!audioTest
				.canPlayType('audio/mp4; codecs="ec-3"')
				.replace(/^no$/, ""),
			flac: !!(
				audioTest.canPlayType("audio/x-flac;") ||
				audioTest.canPlayType("audio/flac;")
			).replace(/^no$/, ""),
		};

		return this;
	}

	_unlockAudio(): void {
		if (this._audioUnlocked || !this.ctx) {
			return;
		}

		this._audioUnlocked = false;
		this.autoUnlock = false;

		if (!this._mobileUnloaded && this.ctx.sampleRate !== 44100) {
			this._mobileUnloaded = true;
			this.unload();
		}

		// `unload()` above can leave the context null on low-end iOS devices, and
		// creating the scratch buffer then threw (goldfire/howler.js#1363)
		if (!this.ctx) {
			return;
		}

		this._scratchBuffer = this.ctx.createBuffer(1, 1, 22050);

		const unlock = () => {
			while (this._html5AudioPool.length < this.html5PoolSize) {
				try {
					const audioNode = new (
						globalThis as unknown as WindowWithAudio
					).Audio() as HTMLAudioElementWithUnlocked;
					audioNode._unlocked = true;
					this._releaseHtml5Audio(audioNode);
				} catch {
					this.noAudio = true;
					break;
				}
			}

			for (let i = 0; i < this.sounds.length; i++) {
				if (!this.sounds[i]._webAudio) {
					const ids = this.sounds[i]._getSoundIds();
					for (let j = 0; j < ids.length; j++) {
						const sound = this.sounds[i]._soundById(ids[j]);
						if (
							sound &&
							sound._node &&
							isHTMLAudioElement(sound._node) &&
							!sound._node._unlocked
						) {
							sound._node._unlocked = true;
							sound._node.load();
						}
					}
				}
			}

			this._autoResume();

			const source = this.ctx!.createBufferSource();
			source.buffer = this._scratchBuffer;
			source.connect(this.ctx!.destination);
			source.start(0);

			// Unlocked the moment the context is known to run, from whichever
			// signal says so first. The scratch source's `onended` was the only
			// one, and a one-sample buffer in a context that is not running
			// never ends: the gesture was spent, the listeners stayed, and the
			// "unlock" event never reached a sound. A resolved `resume()` is
			// the same proof and arrives on its own. Idempotent, because both
			// signals normally arrive.
			const unlocked = () => {
				if (this._audioUnlocked) {
					return;
				}
				this._audioUnlocked = true;
				source.disconnect(0);

				document.removeEventListener("touchstart", unlock, true);
				document.removeEventListener("touchend", unlock, true);
				document.removeEventListener("click", unlock, true);
				document.removeEventListener("keydown", unlock, true);

				for (let i = 0; i < this.sounds.length; i++) {
					this.sounds[i]._emit("unlock");
				}
			};
			source.onended = unlocked;

			if (typeof this.ctx!.resume === "function") {
				this.ctx!.resume().then(unlocked, () => {
					// refused: the gesture did not count, or the output is not
					// available. The listeners stay for the next one
				});
			}
		};

		document.addEventListener("touchstart", unlock, true);
		document.addEventListener("touchend", unlock, true);
		document.addEventListener("click", unlock, true);
		document.addEventListener("keydown", unlock, true);
	}

	_obtainHtml5Audio(): HTMLAudioElementWithUnlocked {
		if (this._html5AudioPool.length) {
			return this._html5AudioPool.pop()!;
		}

		// `play()` is typed as always returning a promise, but browsers before
		// the promise-returning spec return undefined — hence the guard, and the
		// cast that lets the compiler accept a check it thinks is impossible
		const testPlay = new (
			globalThis as unknown as WindowWithAudio
		).Audio().play() as Promise<void> | undefined;
		if (testPlay && typeof Promise !== "undefined") {
			if (testPlay instanceof Promise) {
				testPlay.catch(() => {
					console.warn(
						"HTML5 Audio pool exhausted, returning potentially locked audio object.",
					);
				});
			} else if (
				typeof testPlay === "object" &&
				testPlay !== null &&
				"then" in testPlay &&
				typeof (testPlay as { then?: unknown }).then === "function"
			) {
				// Handle thenable objects
				(testPlay as { catch: (onRejected: () => void) => void }).catch(() => {
					console.warn(
						"HTML5 Audio pool exhausted, returning potentially locked audio object.",
					);
				});
			}
		}

		return new (globalThis as unknown as WindowWithAudio).Audio();
	}

	_releaseHtml5Audio(audio: HTMLAudioElementWithUnlocked): this {
		if (audio._unlocked) {
			this._html5AudioPool.push(audio);
		}

		return this;
	}

	_autoSuspend(): void {
		if (
			!this.autoSuspend ||
			!this.ctx ||
			typeof this.ctx.suspend === "undefined" ||
			!this.usingWebAudio
		) {
			return;
		}

		for (let i = 0; i < this.sounds.length; i++) {
			if (this.sounds[i]._webAudio) {
				for (let j = 0; j < this.sounds[i]._sounds.length; j++) {
					if (!this.sounds[i]._sounds[j]._paused) {
						return;
					}
				}
			}
		}

		if (this._suspendTimer) {
			clearTimeout(this._suspendTimer);
		}

		this._suspendTimer = setTimeout(() => {
			if (!this.autoSuspend) {
				return;
			}

			this._suspendTimer = null;
			this.state = "suspending";

			const handleSuspension = () => {
				this.state = "suspended";
			};

			this.ctx!.suspend().then(handleSuspension, handleSuspension);
		}, 30000);
	}

	_autoResume(): void {
		if (
			!this.ctx ||
			typeof this.ctx.resume === "undefined" ||
			!this.usingWebAudio
		) {
			return;
		}

		if (
			this.state === "running" &&
			// The context has to actually be running for this to be "cancel the
			// idle suspension, nothing else to do". Upstream only ruled out
			// "interrupted" here, so a context the browser stopped during the
			// 30-second idle window landed in this branch: the timer was
			// cleared, nothing was resumed, and the play went ahead into a
			// stopped context. Only the play after that one found the timer
			// gone and resumed. A stop inside the window is a stop like any
			// other, and belongs to the branch below
			this.ctx.state === "running" &&
			this._suspendTimer
		) {
			clearTimeout(this._suspendTimer);
			this._suspendTimer = null;
		} else if (
			this.state === "suspended" ||
			// A suspend this engine asked for that the browser has not answered
			// yet. Upstream only raised a flag here and resumed once the suspend
			// settled, which assumed it would. WebKit parks a suspend requested
			// outside a user gesture on a context the page was never allowed to
			// start, until the context next actually suspends, and an engine
			// waiting on that promise never asks for one again: thirty idle
			// seconds on a fresh page left it "suspending" for good, every clip
			// parked under `_playLock` for a "resume" that could not come, while
			// the first gesture's scratch resume had the hardware running
			// underneath. Resume now instead. The context orders it after the
			// suspend, so the state lands where the last request pointed, and
			// the bookkeeping follows the resume's own answer
			this.state === "suspending" ||
			// iOS reports "suspended" (not "interrupted") after the output device
			// changes — unplugging headphones left playback dead
			// (goldfire/howler.js#1551)
			(this.state === "running" &&
				(this.ctx.state === "interrupted" || this.ctx.state === "suspended"))
		) {
			void this.ctx
				.resume()
				.then(() => {
					this.state = "running";

					for (let i = 0; i < this.sounds.length; i++) {
						this.sounds[i]._emit("resume");
					}
				})
				.catch((err: unknown) => {
					// the device can refuse to start — InvalidStateError on a
					// disconnected or busy output. Left unhandled this rejected
					// silently and the engine stayed wedged in "suspended"
					// (goldfire/howler.js#1764)
					const reason = err instanceof Error ? err.message : String(err);
					console.warn(`melonJS: audio context resume failed: ${reason}`);
					this.state = "suspended";
					for (let i = 0; i < this.sounds.length; i++) {
						this.sounds[i]._emit("resumeerror");
					}
				});

			if (this._suspendTimer) {
				clearTimeout(this._suspendTimer);
				this._suspendTimer = null;
			}
		}
	}
}
