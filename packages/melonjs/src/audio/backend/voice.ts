// Import audioEngine singleton from core.ts
import { audioEngine, type Sound } from "./core.ts";
import { applySpatialAfterLoad, installSpatialOnVoice } from "./spatial.ts";
import {
	type GainNodeWithBufferSource,
	type HTMLAudioElementWithUnlocked,
	isHTMLAudioElement,
} from "./types.ts";

export class Voice {
	/**
	 * @ignore
	 * @internal
	 */
	_parent: Sound;
	/**
	 * @ignore
	 * @internal
	 */
	_muted: boolean = false;
	/**
	 * @ignore
	 * @internal
	 */
	_loop: boolean = false;
	/**
	 * @ignore
	 * @internal
	 */
	_volume: number = 1;
	/**
	 * @ignore
	 * @internal
	 */
	_rate: number = 1;
	/**
	 * @ignore
	 * @internal
	 */
	_seek: number = 0;
	/**
	 * @ignore
	 * @internal
	 */
	_paused: boolean = true;
	/**
	 * @ignore
	 * @internal
	 */
	_ended: boolean = true;
	/**
	 * @ignore
	 * @internal
	 */
	_sprite: string = "__default";
	/**
	 * @ignore
	 * @internal
	 */
	_id: number = 0;
	/**
	 * @ignore
	 * @internal
	 */
	_node: HTMLAudioElementWithUnlocked | GainNodeWithBufferSource | null = null;
	/**
	 * @ignore
	 * @internal
	 */
	_playStart: number = 0;
	/**
	 * @ignore
	 * @internal
	 */
	_rateSeek: number = 0;
	/**
	 * @ignore
	 * @internal
	 */
	_errorFn?: (event: Event) => void;
	/**
	 * @ignore
	 * @internal
	 */
	_loadFn?: (event: Event) => void;
	/**
	 * @ignore
	 * @internal
	 */
	_endFn?: (event: Event) => void;
	/**
	 * @ignore
	 * @internal
	 */
	_start?: number;
	/**
	 * @ignore
	 * @internal
	 */
	_stop?: number;
	/**
	 * @ignore
	 * @internal
	 */
	_panner?: PannerNode | StereoPannerNode;
	/**
	 * @ignore
	 * @internal
	 */
	_fadeTo?: number | undefined;
	/**
	 * @ignore
	 * @internal
	 */
	_interval?: ReturnType<typeof setInterval> | undefined;

	constructor(sound: Sound) {
		this._parent = sound;
		this.init();
	}

	init(): this {
		const parent = this._parent;

		this._muted = parent._muted;
		this._loop = parent._loop;
		this._volume = parent._volume;
		this._rate = parent._rate;
		this._seek = 0;
		this._paused = true;
		this._ended = true;
		this._sprite = "__default";

		this._id = ++audioEngine._counter;

		parent._sounds.push(this);

		this.create();

		// Execute plugin hooks
		installSpatialOnVoice(this, parent);

		return this;
	}

	create(): this {
		const parent = this._parent;
		const volume =
			audioEngine._muted || this._muted || parent._muted ? 0 : this._volume;

		this._errorFn = this._errorListener.bind(this);
		this._loadFn = this._loadListener.bind(this);
		this._endFn = this._endListener.bind(this);

		if (parent._webAudio && audioEngine.ctx) {
			const gainNode = audioEngine.ctx.createGain();
			if (gainNode) {
				this._node = gainNode;
				this._node.gain.setValueAtTime(volume, audioEngine.ctx.currentTime);
				(this._node as { paused?: boolean }).paused = true;
				this._node.connect(audioEngine.masterGain!);
			}
		} else if (!audioEngine.noAudio) {
			this._node = audioEngine._obtainHtml5Audio();

			this._errorFn = this._errorListener.bind(this);
			this._node.addEventListener("error", this._errorFn, false);

			this._loadFn = this._loadListener.bind(this);
			this._node.addEventListener(
				audioEngine._canPlayEvent,
				this._loadFn,
				false,
			);

			this._endFn = this._endListener.bind(this);
			this._node.addEventListener("ended", this._endFn, false);

			const src =
				typeof parent._src === "string"
					? parent._src
					: Array.isArray(parent._src) && parent._src.length > 0
						? parent._src[0]
						: "";
			this._node.src = src;
			const preloadValue =
				parent._preload === true
					? "auto"
					: parent._preload === false
						? "none"
						: parent._preload === "metadata"
							? "metadata"
							: "auto";
			this._node.preload = preloadValue;
			const volumeOrEngine = audioEngine.volume();
			if (typeof volumeOrEngine === "number") {
				this._node.volume = volume * volumeOrEngine;
			}

			this._node.load();
		}

		return this;
	}

	reset(): this {
		const parent = this._parent;

		this._muted = parent._muted;
		this._loop = parent._loop;
		this._volume = parent._volume;
		this._rate = parent._rate;
		this._seek = 0;
		this._rateSeek = 0;
		this._paused = true;
		this._ended = true;
		this._sprite = "__default";

		this._id = ++audioEngine._counter;

		return this;
	}

	_errorListener(): void {
		if (this._node && isHTMLAudioElement(this._node)) {
			const errorCode = this._node.error ? this._node.error.code : 0;
			this._parent._emit("loaderror", this._id, String(errorCode));
			if (this._errorFn) {
				this._node.removeEventListener("error", this._errorFn, false);
			}
		}
	}

	_loadListener(): void {
		if (!this._node || !isHTMLAudioElement(this._node)) {
			return;
		}

		const parent = this._parent;

		parent._duration = Math.ceil(this._node.duration * 10) / 10;

		if (Object.keys(parent._sprite).length === 0) {
			parent._sprite = { __default: [0, parent._duration * 1000] };
		}

		if (parent._state !== "loaded") {
			parent._state = "loaded";
			parent._emit("load");
			parent._loadQueue();

			// Execute plugin hooks
			applySpatialAfterLoad(parent);
		}

		if (this._loadFn) {
			this._node.removeEventListener(
				audioEngine._canPlayEvent,
				this._loadFn,
				false,
			);
		}
	}

	_endListener(): void {
		const parent = this._parent;

		if (
			parent._duration === Infinity &&
			this._node &&
			isHTMLAudioElement(this._node)
		) {
			parent._duration = Math.ceil(this._node.duration * 10) / 10;

			if (parent._sprite.__default[1] === Infinity) {
				parent._sprite.__default[1] = parent._duration * 1000;
			}

			parent._ended(this);
		}

		if (this._endFn && this._node) {
			this._node.removeEventListener("ended", this._endFn, false);
		}
	}
}
