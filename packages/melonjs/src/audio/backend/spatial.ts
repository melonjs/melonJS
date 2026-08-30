import type { SoundOptions } from "./core.ts";
import {
	type AudioEngine,
	audioEngine,
	type Sound,
	type Voice,
} from "./core.ts";
import { isGainNode } from "./types.ts";

/**
 * Extended SoundOptions with spatial audio properties.
 * Use this interface when creating a Sound instance with spatial audio capabilities.
 * @example
 * ```typescript
 * const sound = new Sound({
 *   src: ['sound.mp3'],
 *   pos: [10, 20, 30],
 *   stereo: 0.5,
 *   distanceModel: 'inverse'
 * } as SpatialSoundOptions);
 * ```
 */
/** Panner attributes a spatial sound can be configured with. */
export interface PannerAttrOptions {
	/** Inner angle of the sound cone in degrees. */
	coneInnerAngle: number;
	/** Outer angle of the sound cone in degrees. */
	coneOuterAngle: number;
	/** Gain value outside the outer cone (0.0 to 1.0). */
	coneOuterGain: number;
	/** Distance model algorithm. */
	distanceModel: "linear" | "inverse" | "exponential";
	/** Maximum distance for the distance model. */
	maxDistance: number;
	/** Panning model algorithm. */
	panningModel: "equalpower" | "HRTF";
	/** Reference distance for the distance model. */
	refDistance: number;
	/** Rolloff factor for the distance model. */
	rolloffFactor: number;
}

export interface SpatialSoundOptions extends SoundOptions {
	/** 3D position of the sound source [x, y, z]. */
	pos?: [number, number, number];
	/** Orientation vector of the sound source [x, y, z]. */
	orientation?: [number, number, number];
	/** Stereo panning value from -1.0 (left) to 1.0 (right). */
	stereo?: number;
	/** Inner angle of the sound cone in degrees. Default: `360` */
	coneInnerAngle?: number;
	/** Outer angle of the sound cone in degrees. Default: `360` */
	coneOuterAngle?: number;
	/** Gain value outside the outer cone. Range: 0.0 to 1.0. Default: `0` */
	coneOuterGain?: number;
	/** Distance model algorithm: 'linear', 'inverse', or 'exponential'. Default: `'inverse'` */
	distanceModel?: "linear" | "inverse" | "exponential";
	/** Maximum distance for the distance model. Default: `10000` */
	maxDistance?: number;
	/** Panning model: 'equalpower' or 'HRTF'. Default: `'HRTF'` */
	panningModel?: "equalpower" | "HRTF";
	/** Reference distance for the distance model. Default: `1` */
	refDistance?: number;
	/** Rolloff factor for the distance model. Default: `1` */
	rolloffFactor?: number;
	/** Fires when the stereo panning changes. */
	onstereo?: () => void;
	/** Fires when the 3D position changes. */
	onpos?: () => void;
	/** Fires when the orientation changes. */
	onorientation?: () => void;
}

/**
 * Spatial audio state for the global audioEngine instance.
 * Contains the listener's position and orientation in 3D space.
 * @internal
 */
export interface SpatialAudioState {
	/** Listener's 3D position [x, y, z]. */
	_pos: [number, number, number];
	/** Listener's orientation [forwardX, forwardY, forwardZ, upX, upY, upZ]. */
	_orientation: [number, number, number, number, number, number];
}

/**
 * Spatial audio state for a Sound instance.
 * Contains the sound source's position, orientation, and panner attributes.
 * @internal
 */
export interface SpatialSoundState {
	/** Voice source's 3D position [x, y, z], or null if not set. */
	_pos: [number, number, number] | null;
	/** Voice source's orientation vector [x, y, z]. */
	_orientation: [number, number, number];
	/** Stereo panning value from -1.0 to 1.0, or null if not set. */
	_stereo: number | null;
	/** Panner node attributes for 3D audio processing. */
	_pannerAttr: PannerAttrOptions;
	/** Event listeners for stereo panning changes. */
	_onstereo: Array<{ fn: () => void }>;
	/** Event listeners for position changes. */
	_onpos: Array<{ fn: () => void }>;
	/** Event listeners for orientation changes. */
	_onorientation: Array<{ fn: () => void }>;
}

/**
 * Spatial audio state for a Voice instance.
 * Contains per-sound spatial audio properties.
 * @internal
 */
export interface SpatialVoiceState {
	/** Voice's 3D position [x, y, z], or null if not set. */
	_pos: [number, number, number] | null;
	/** Voice's orientation vector [x, y, z]. */
	_orientation: [number, number, number];
	/** Stereo panning value from -1.0 to 1.0, or null if not set. */
	_stereo: number | null;
	/** Panner node attributes for 3D audio processing. */
	_pannerAttr: PannerAttrOptions;
}

/**
 * audioEngine instance with spatial audio capabilities.
 * Use this type when the spatial plugin is registered to get full type safety for spatial audio methods.
 * @example
 * ```typescript
 * import { audioEngine } from 'engine';
 * import { SpatialAudioPlugin, type SpatialAudioEngine } from 'engine/plugins/spatial';
 *
 * audioEngine.addPlugin(new SpatialAudioPlugin());
 *
 * const engine: SpatialAudioEngine = audioEngine as SpatialAudioEngine;
 * engine.pos(10, 20, 30); // Set listener position
 * engine.orientation(0, 0, -1, 0, 1, 0); // Set listener orientation
 * engine.stereo(0.5); // Set stereo panning
 * ```
 */
export type SpatialAudioEngine = AudioEngine &
	SpatialAudioState & {
		/**
		 * Set or get the listener's 3D position.
		 * @param x - X coordinate (optional)
		 * @param y - Y coordinate (optional)
		 * @param z - Z coordinate (optional)
		 * @returns If called with no arguments, returns the current position [x, y, z]. Otherwise, returns the audioEngine instance for chaining.
		 */
		pos(
			x?: number,
			y?: number,
			z?: number,
		): SpatialAudioEngine | [number, number, number];
		/**
		 * Set or get the listener's orientation.
		 * @param x - Forward X component (optional)
		 * @param y - Forward Y component (optional)
		 * @param z - Forward Z component (optional)
		 * @param xUp - Up X component (optional)
		 * @param yUp - Up Y component (optional)
		 * @param zUp - Up Z component (optional)
		 * @returns If called with no arguments, returns the current orientation [forwardX, forwardY, forwardZ, upX, upY, upZ]. Otherwise, returns the audioEngine instance for chaining.
		 */
		orientation(
			x?: number,
			y?: number,
			z?: number,
			xUp?: number,
			yUp?: number,
			zUp?: number,
		): SpatialAudioEngine | [number, number, number, number, number, number];
		/**
		 * Set or get the stereo panning value.
		 * @param pan - Panning value from -1.0 (left) to 1.0 (right) (optional)
		 * @returns If called with no arguments, returns the current panning value. Otherwise, returns the audioEngine instance for chaining.
		 */
		stereo(pan?: number): SpatialAudioEngine;
	};

/**
 * Sound instance with spatial audio capabilities.
 * Use this type when the spatial plugin is registered to get full type safety for spatial audio methods.
 * @example
 * ```typescript
 * import { Sound } from 'engine';
 * import { SpatialAudioPlugin, type SpatialSound, type SpatialSoundOptions } from 'engine/plugins/spatial';
 *
 * audioEngine.addPlugin(new SpatialAudioPlugin());
 *
 * const sound: SpatialSound = new Sound({
 *   src: ['sound.mp3'],
 *   pos: [10, 20, 30]
 * } as SpatialSoundOptions) as SpatialSound;
 *
 * sound.pos(5, 10, 15); // Set sound position
 * sound.stereo(0.5); // Set stereo panning
 * sound.orientation(0, 1, 0); // Set sound orientation
 * ```
 */
export type SpatialSound = Sound &
	SpatialSoundState & {
		/**
		 * Set or get the sound's 3D position.
		 * @param x - X coordinate (optional)
		 * @param y - Y coordinate (optional)
		 * @param z - Z coordinate (optional)
		 * @param id - Voice ID to target a specific sound instance (optional)
		 * @returns If called with no arguments, returns the current position [x, y, z]. Otherwise, returns the Sound instance for chaining.
		 */
		pos(
			x?: number,
			y?: number,
			z?: number,
			id?: number,
		): SpatialSound | [number, number, number] | null;
		/**
		 * Set or get the sound's orientation vector.
		 * @param x - X component (optional)
		 * @param y - Y component (optional)
		 * @param z - Z component (optional)
		 * @param id - Voice ID to target a specific sound instance (optional)
		 * @returns If called with no arguments, returns the current orientation [x, y, z]. Otherwise, returns the Sound instance for chaining.
		 */
		orientation(
			x?: number,
			y?: number,
			z?: number,
			id?: number,
		): SpatialSound | [number, number, number] | null;
		/**
		 * Set or get the stereo panning value.
		 * @param pan - Panning value from -1.0 (left) to 1.0 (right) (optional)
		 * @param id - Voice ID to target a specific sound instance (optional)
		 * @returns If called with no arguments, returns the current panning value. Otherwise, returns the Sound instance for chaining.
		 */
		stereo(pan?: number, id?: number): SpatialSound | number | null;
		/**
		 * Set or get panner node attributes.
		 * @param o - Panner attributes object (optional)
		 * @param id - Voice ID to target a specific sound instance (optional)
		 * @returns If called with no arguments, returns the current panner attributes. Otherwise, returns the Sound instance for chaining.
		 */
		pannerAttr(
			o?: PannerAttrOptions | number,
			id?: number,
		): SpatialSound | PannerAttrOptions;
	};

/**
 * Setup a panner node for a sound
 * @param sound - the sound the hook fires for
 * @param type - which panner flavour to build
 */
function setupPanner(
	sound: Voice & SpatialVoiceState,
	type: "stereo" | "spatial" = "spatial",
): void {
	if (!audioEngine.ctx) {
		return;
	}

	// Create the new panner node
	if (type === "spatial") {
		sound._panner = audioEngine.ctx.createPanner();
		const panner = sound._panner;
		panner.coneInnerAngle = sound._pannerAttr.coneInnerAngle;
		panner.coneOuterAngle = sound._pannerAttr.coneOuterAngle;
		panner.coneOuterGain = sound._pannerAttr.coneOuterGain;
		panner.distanceModel = sound._pannerAttr.distanceModel;
		panner.maxDistance = sound._pannerAttr.maxDistance;
		panner.refDistance = sound._pannerAttr.refDistance;
		panner.rolloffFactor = sound._pannerAttr.rolloffFactor;
		panner.panningModel = sound._pannerAttr.panningModel;

		if (sound._pos) {
			if (typeof panner.positionX !== "undefined") {
				panner.positionX.setValueAtTime(
					sound._pos[0],
					audioEngine.ctx?.currentTime ?? 0,
				);
				panner.positionY.setValueAtTime(
					sound._pos[1],
					audioEngine.ctx?.currentTime ?? 0,
				);
				panner.positionZ.setValueAtTime(
					sound._pos[2],
					audioEngine.ctx?.currentTime ?? 0,
				);
			} else {
				// the AudioParam form is feature-detected above; this is the
				// fallback for browsers that never shipped it
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				panner.setPosition(sound._pos[0], sound._pos[1], sound._pos[2]);
			}
		}

		if (typeof panner.orientationX !== "undefined") {
			panner.orientationX.setValueAtTime(
				sound._orientation[0],
				audioEngine.ctx?.currentTime ?? 0,
			);
			panner.orientationY.setValueAtTime(
				sound._orientation[1],
				audioEngine.ctx?.currentTime ?? 0,
			);
			panner.orientationZ.setValueAtTime(
				sound._orientation[2],
				audioEngine.ctx?.currentTime ?? 0,
			);
		} else {
			// the AudioParam form is feature-detected above; this is the
			// fallback for browsers that never shipped it
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			panner.setOrientation(
				sound._orientation[0],
				sound._orientation[1],
				sound._orientation[2],
			);
		}
	} else {
		sound._panner = audioEngine.ctx.createStereoPanner();
		const stereoPanner = sound._panner;
		if (sound._stereo !== null) {
			stereoPanner.pan.setValueAtTime(
				sound._stereo,
				audioEngine.ctx?.currentTime ?? 0,
			);
		}
	}

	// Connect panner to the sound's node
	if (sound._node && isGainNode(sound._node)) {
		sound._panner.connect(sound._node);
	}

	// Update connections if sound is playing
	if (!sound._paused) {
		(sound._parent as any).pause(sound._id, true);
		(sound._parent as any).play(sound._id, true);
	}
}

/**
 * Mixin function to add spatial audio to AudioEngine (listener)
 * @param instance - the engine instance to augment
 */
function withSpatialListener(instance: AudioEngine): AudioEngine &
	SpatialAudioState & {
		pos(
			x?: number,
			y?: number,
			z?: number,
		): SpatialAudioEngine | [number, number, number];
		orientation(
			x?: number,
			y?: number,
			z?: number,
			xUp?: number,
			yUp?: number,
			zUp?: number,
		): SpatialAudioEngine | number[];
		stereo(pan?: number): SpatialAudioEngine;
	} {
	const spatial = instance as SpatialAudioEngine;

	// Initialize spatial properties
	spatial._pos = [0, 0, 0];
	spatial._orientation = [0, 0, -1, 0, 1, 0];

	// Add pos method to set listener position
	spatial.pos = function (x?: number, y?: number, z?: number) {
		// The listener lives on the AudioContext, which is created lazily —
		// `volume()` does the same nudge. Without this, a `pos()` before any
		// sound exists finds no context, returns early, and silently discards
		// the value. howler 2.x created the context during init, so this is a
		// behaviour regression against it rather than a design choice.
		audioEngine.ensureContext();
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Set the defaults for optional 'y' & 'z'
		y = typeof y !== "number" ? this._pos[1] : y;
		z = typeof z !== "number" ? this._pos[2] : z;

		if (typeof x === "number") {
			this._pos = [x, y, z];

			if (typeof this.ctx.listener.positionX !== "undefined") {
				this.ctx.listener.positionX.setTargetAtTime(
					this._pos[0],
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.positionY.setTargetAtTime(
					this._pos[1],
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.positionZ.setTargetAtTime(
					this._pos[2],
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
			} else {
				// the AudioParam form is feature-detected above; this is the
				// fallback for browsers that never shipped it
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				this.ctx.listener.setPosition(this._pos[0], this._pos[1], this._pos[2]);
			}
		} else {
			return this._pos;
		}

		return this;
	};

	// Add orientation method to set listener orientation
	spatial.orientation = function (
		x?: number,
		y?: number,
		z?: number,
		xUp?: number,
		yUp?: number,
		zUp?: number,
	) {
		// The listener lives on the AudioContext, which is created lazily —
		// `volume()` does the same nudge. Without this, a `pos()` before any
		// sound exists finds no context, returns early, and silently discards
		// the value. howler 2.x created the context during init, so this is a
		// behaviour regression against it rather than a design choice.
		audioEngine.ensureContext();
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Set the defaults for optional parameters
		const or = this._orientation;
		y = typeof y !== "number" ? or[1] : y;
		z = typeof z !== "number" ? or[2] : z;
		xUp = typeof xUp !== "number" ? or[3] : xUp;
		yUp = typeof yUp !== "number" ? or[4] : yUp;
		zUp = typeof zUp !== "number" ? or[5] : zUp;

		if (typeof x === "number") {
			this._orientation = [x, y, z, xUp, yUp, zUp];

			if (typeof this.ctx.listener.forwardX !== "undefined") {
				this.ctx.listener.forwardX.setTargetAtTime(
					x,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.forwardY.setTargetAtTime(
					y,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.forwardZ.setTargetAtTime(
					z,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.upX.setTargetAtTime(
					xUp,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.upY.setTargetAtTime(
					yUp,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
				this.ctx.listener.upZ.setTargetAtTime(
					zUp,
					audioEngine.ctx?.currentTime ?? 0,
					0.1,
				);
			} else {
				// the AudioParam form is feature-detected above; this is the
				// fallback for browsers that never shipped it
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				this.ctx.listener.setOrientation(x, y, z, xUp, yUp, zUp);
			}
		} else {
			return or;
		}

		return this;
	};

	// Add stereo method
	spatial.stereo = function (pan?: number) {
		// The listener lives on the AudioContext, which is created lazily —
		// `volume()` does the same nudge. Without this, a `pos()` before any
		// sound exists finds no context, returns early, and silently discards
		// the value. howler 2.x created the context during init, so this is a
		// behaviour regression against it rather than a design choice.
		audioEngine.ensureContext();
		if (!this.ctx || !this.ctx.listener) {
			return this;
		}

		// Loop through all sounds and update their stereo panning
		for (let i = this.sounds.length - 1; i >= 0; i--) {
			(this.sounds[i] as SpatialSound).stereo?.(pan);
		}

		return this;
	};

	return spatial;
}

/**
 * Spatial Audio Plugin
 * Adds 3D spatial audio and stereo panning capabilities to audioEngine and Sound instances
 */

/**
 * Initialize spatial audio when audioEngine is initialized
 * This is called either:
 * - When audioEngine initializes (if plugin was registered before)
 * - Immediately during registration (if audioEngine is already initialized)
 * @param engine - the audio engine singleton
 */
export function installSpatialOnEngine(engine: AudioEngine): void {
	withSpatialListener(engine);
}

/**
 * Extend Sound instances with spatial audio methods
 * @param sound - the sound the hook fires for
 * @param options - the options the sound was constructed with
 */
export function installSpatialOnSound(
	sound: Sound,
	options: SoundOptions,
): void {
	const spatialOptions = options as SpatialSoundOptions;
	const spatial = sound as SpatialSound;

	// Setup user-defined default properties
	spatial._orientation = spatialOptions.orientation || [1, 0, 0];
	spatial._stereo =
		spatialOptions.stereo !== undefined ? spatialOptions.stereo : null;
	spatial._pos = spatialOptions.pos || null;
	spatial._pannerAttr = {
		coneInnerAngle:
			typeof spatialOptions.coneInnerAngle !== "undefined"
				? spatialOptions.coneInnerAngle
				: 360,
		coneOuterAngle:
			typeof spatialOptions.coneOuterAngle !== "undefined"
				? spatialOptions.coneOuterAngle
				: 360,
		coneOuterGain:
			typeof spatialOptions.coneOuterGain !== "undefined"
				? spatialOptions.coneOuterGain
				: 0,
		distanceModel:
			typeof spatialOptions.distanceModel !== "undefined"
				? spatialOptions.distanceModel
				: "inverse",
		maxDistance:
			typeof spatialOptions.maxDistance !== "undefined"
				? spatialOptions.maxDistance
				: 10000,
		panningModel:
			typeof spatialOptions.panningModel !== "undefined"
				? spatialOptions.panningModel
				: "HRTF",
		refDistance:
			typeof spatialOptions.refDistance !== "undefined"
				? spatialOptions.refDistance
				: 1,
		rolloffFactor:
			typeof spatialOptions.rolloffFactor !== "undefined"
				? spatialOptions.rolloffFactor
				: 1,
	};

	// Setup event listeners
	spatial._onstereo = spatialOptions.onstereo
		? [{ fn: spatialOptions.onstereo }]
		: [];
	spatial._onpos = spatialOptions.onpos ? [{ fn: spatialOptions.onpos }] : [];
	spatial._onorientation = spatialOptions.onorientation
		? [{ fn: spatialOptions.onorientation }]
		: [];

	// Add stereo method
	spatial.stereo = function (pan?: number, id?: number) {
		// aliased because the nested callbacks below rebind `this`

		const self = this as any;

		// Stop right here if not using Web Audio
		if (!self._webAudio) {
			return self;
		}

		// If the sound hasn't loaded, add it to the load queue
		if (self._state !== "loaded") {
			self._queue.push({
				event: "stereo",
				action: () => {
					self.stereo(pan, id);
				},
			});
			return self;
		}

		// Check for PannerStereoNode support and fallback to PannerNode if it doesn't exist
		const pannerType =
			typeof audioEngine.ctx?.createStereoPanner !== "undefined"
				? "stereo"
				: "spatial";

		// Group-level read/write, restoring howler 2.x behaviour that this
		// TypeScript port dropped: with no `id`, a call with no value reads
		// the group's value back, and a call with one records it on the
		// group. Without this the getter returned the Sound itself and the
		// group value stayed at its initial state, so a set never read back.
		if (typeof id === "undefined") {
			if (typeof pan === "number") {
				self._stereo = pan;
				self._pos = [pan, 0, 0];
			} else {
				return self._stereo;
			}
		}

		const ids = self._getSoundIds(id);
		for (let i = 0; i < ids.length; i++) {
			const sound = self._soundById(ids[i]) as Voice & SpatialVoiceState;
			if (sound) {
				sound._stereo = pan ?? null;

				// Create a new panner node if one doesn't already exist
				if (!sound._panner) {
					// Make sure we have a position to setup the node with
					if (!sound._pos) {
						sound._pos = self._pos || [0, 0, -0.5];
					}
					setupPanner(sound, pannerType);
				} else if (
					pannerType === "stereo" &&
					sound._panner instanceof StereoPannerNode
				) {
					sound._panner.pan.setValueAtTime(
						pan ?? 0,
						audioEngine.ctx?.currentTime ?? 0,
					);
				}
			}
		}

		// Fire event
		self._emit("stereo", id);

		return self;
	};

	// Add pos method
	spatial.pos = function (x?: number, y?: number, z?: number, id?: number) {
		// aliased because the nested callbacks below rebind `this`
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Stop right here if not using Web Audio
		if (!self._webAudio) {
			return self;
		}

		// If the sound hasn't loaded, add it to the load queue
		if (self._state !== "loaded") {
			self._queue.push({
				event: "pos",
				action: () => {
					self.pos(x, y, z, id);
				},
			});
			return self;
		}

		// Set the defaults for optional 'y' & 'z'
		y = typeof y !== "number" ? (self._pos ? self._pos[1] : 0) : y;
		z = typeof z !== "number" ? (self._pos ? self._pos[2] : 0) : z;

		// Group-level read/write, restoring howler 2.x behaviour that this
		// TypeScript port dropped: with no `id`, a call with no value reads
		// the group's value back, and a call with one records it on the
		// group. Without this the getter returned the Sound itself and the
		// group value stayed at its initial state, so a set never read back.
		if (typeof id === "undefined") {
			if (typeof x === "number") {
				self._pos = [x, y, z];
			} else {
				return self._pos;
			}
		}

		if (typeof x === "number") {
			const ids = self._getSoundIds(id);
			for (let i = 0; i < ids.length; i++) {
				const sound = self._soundById(ids[i]) as Voice & SpatialVoiceState;
				if (sound) {
					sound._pos = [x, y, z];

					// Create a new panner node if one doesn't already exist
					if (!sound._panner) {
						setupPanner(sound, "spatial");
					} else if (sound._panner instanceof PannerNode) {
						// Update position
						if (typeof sound._panner.positionX !== "undefined") {
							sound._panner.positionX.setValueAtTime(
								x,
								audioEngine.ctx?.currentTime ?? 0,
							);
							sound._panner.positionY.setValueAtTime(
								y,
								audioEngine.ctx?.currentTime ?? 0,
							);
							sound._panner.positionZ.setValueAtTime(
								z,
								audioEngine.ctx?.currentTime ?? 0,
							);
						} else {
							// the AudioParam form is feature-detected above; this is the
							// fallback for browsers that never shipped it
							// eslint-disable-next-line @typescript-eslint/no-deprecated
							sound._panner.setPosition(x, y, z);
						}
					}
				}
			}

			// Fire event
			self._emit("pos", id);

			return self;
		} else {
			// Return the position of the first sound or the group's position
			if (typeof id === "number") {
				const sound = self._soundById(id) as Voice & SpatialVoiceState;
				return sound ? sound._pos || [0, 0, 0] : [0, 0, 0];
			}
			return self._pos || [0, 0, 0];
		}
	};

	// Add orientation method
	spatial.orientation = function (
		x?: number,
		y?: number,
		z?: number,
		id?: number,
	) {
		// aliased because the nested callbacks below rebind `this`
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Stop right here if not using Web Audio
		if (!self._webAudio) {
			return self;
		}

		// If the sound hasn't loaded, add it to the load queue
		if (self._state !== "loaded") {
			self._queue.push({
				event: "orientation",
				action: () => {
					self.orientation(x, y, z, id);
				},
			});
			return self;
		}

		// Set the defaults for optional 'y' & 'z'
		y = typeof y !== "number" ? self._orientation[1] : y;
		z = typeof z !== "number" ? self._orientation[2] : z;

		// Group-level read/write, restoring howler 2.x behaviour that this
		// TypeScript port dropped: with no `id`, a call with no value reads
		// the group's value back, and a call with one records it on the
		// group. Without this the getter returned the Sound itself and the
		// group value stayed at its initial state, so a set never read back.
		if (typeof id === "undefined") {
			if (typeof x === "number") {
				self._orientation = [x, y, z];
			} else {
				return self._orientation;
			}
		}

		if (typeof x === "number") {
			const ids = self._getSoundIds(id);
			for (let i = 0; i < ids.length; i++) {
				const sound = self._soundById(ids[i]) as Voice & SpatialVoiceState;
				if (sound) {
					sound._orientation = [x, y, z];

					// Create a new panner node if one doesn't already exist
					if (!sound._panner) {
						if (!sound._pos) {
							sound._pos = self._pos || [0, 0, -0.5];
						}
						setupPanner(sound, "spatial");
					} else if (sound._panner instanceof PannerNode) {
						// Update orientation
						if (typeof sound._panner.orientationX !== "undefined") {
							sound._panner.orientationX.setValueAtTime(
								x,
								audioEngine.ctx?.currentTime ?? 0,
							);
							sound._panner.orientationY.setValueAtTime(
								y,
								audioEngine.ctx?.currentTime ?? 0,
							);
							sound._panner.orientationZ.setValueAtTime(
								z,
								audioEngine.ctx?.currentTime ?? 0,
							);
						} else {
							// the AudioParam form is feature-detected above; this is the
							// fallback for browsers that never shipped it
							// eslint-disable-next-line @typescript-eslint/no-deprecated
							sound._panner.setOrientation(x, y, z);
						}
					}
				}
			}

			// Fire event
			self._emit("orientation", id);

			return self;
		} else {
			// Return the orientation of the first sound or the group's orientation
			if (typeof id === "number") {
				const sound = self._soundById(id) as Voice & SpatialVoiceState;
				return sound ? sound._orientation : [1, 0, 0];
			}
			return self._orientation;
		}
	};

	// Add pannerAttr method
	spatial.pannerAttr = function (...args: unknown[]) {
		// aliased because the nested callbacks below rebind `this`
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		let o = args[0] as any;
		let id = args[1] as number | undefined;
		let sound: (Voice & SpatialVoiceState) | null;

		if (args.length === 0) {
			// Return this sound's panner attribute values
			return self._pannerAttr;
		} else if (args.length === 1) {
			if (typeof args[0] === "number") {
				// Return this sound's panner attribute values
				sound = self._soundById(parseInt(String(args[0]), 10)) as Voice &
					SpatialSoundState;
				return sound ? sound._pannerAttr : self._pannerAttr;
			} else {
				// Update all sounds in the group
				o = args[0];
			}
		} else if (args.length === 2) {
			o = args[0];
			id = parseInt(String(args[1]), 10);
		}

		// Update the values of the specified sounds
		const ids = self._getSoundIds(id);
		for (let i = 0; i < ids.length; i++) {
			sound = self._soundById(ids[i]) as any;

			if (sound) {
				// Merge the new values into the sound
				const pa = sound._pannerAttr;
				sound._pannerAttr = {
					coneInnerAngle:
						typeof o.coneInnerAngle !== "undefined"
							? o.coneInnerAngle
							: pa.coneInnerAngle,
					coneOuterAngle:
						typeof o.coneOuterAngle !== "undefined"
							? o.coneOuterAngle
							: pa.coneOuterAngle,
					coneOuterGain:
						typeof o.coneOuterGain !== "undefined"
							? o.coneOuterGain
							: pa.coneOuterGain,
					distanceModel:
						typeof o.distanceModel !== "undefined"
							? o.distanceModel
							: pa.distanceModel,
					maxDistance:
						typeof o.maxDistance !== "undefined"
							? o.maxDistance
							: pa.maxDistance,
					refDistance:
						typeof o.refDistance !== "undefined"
							? o.refDistance
							: pa.refDistance,
					rolloffFactor:
						typeof o.rolloffFactor !== "undefined"
							? o.rolloffFactor
							: pa.rolloffFactor,
					panningModel:
						typeof o.panningModel !== "undefined"
							? o.panningModel
							: pa.panningModel,
				};

				// Create a new panner node if one doesn't already exist
				let panner = sound._panner;
				if (!panner) {
					// Make sure we have a position to setup the node with
					if (!sound._pos) {
						sound._pos = self._pos || [0, 0, -0.5];
					}

					// Create a new panner node
					setupPanner(sound, "spatial");
					panner = sound._panner;
				}

				// Update the panner values
				if (panner instanceof PannerNode) {
					panner.coneInnerAngle = sound._pannerAttr.coneInnerAngle;
					panner.coneOuterAngle = sound._pannerAttr.coneOuterAngle;
					panner.coneOuterGain = sound._pannerAttr.coneOuterGain;
					panner.distanceModel = sound._pannerAttr.distanceModel;
					panner.maxDistance = sound._pannerAttr.maxDistance;
					panner.refDistance = sound._pannerAttr.refDistance;
					panner.rolloffFactor = sound._pannerAttr.rolloffFactor;
					panner.panningModel = sound._pannerAttr.panningModel;
				}
			}
		}

		return self;
	};
}

/**
 * Extend Voice instances with spatial audio properties
 * @param voice - the individual playing instance
 * @param parent - the sound the voice belongs to
 */
export function installSpatialOnVoice(voice: Voice, parent: Sound): void {
	const spatialParent = parent as any;
	const spatialSound = voice as any;

	// Setup user-defined default properties
	spatialSound._orientation = spatialParent._orientation;
	spatialSound._stereo = spatialParent._stereo;
	spatialSound._pos = spatialParent._pos;
	spatialSound._pannerAttr = { ...spatialParent._pannerAttr };

	// Wrap the reset method to handle spatial cleanup
	if (!spatialSound._originalReset) {
		spatialSound._originalReset = spatialSound.reset.bind(spatialSound);
		spatialSound.reset = function () {
			// aliased because the nested callbacks below rebind `this`
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const self = this;
			const parent = self._parent;

			// Reset all spatial plugin properties on this voice
			self._orientation = parent._orientation;
			self._stereo = parent._stereo;
			self._pos = parent._pos;
			// copied, not shared: taking the reference let a change on one
			// voice rewrite the group's attributes and leak into every sound
			// created afterwards (goldfire/howler.js#1758)
			self._pannerAttr = { ...parent._pannerAttr };

			// If a stereo or position was specified, set it up
			if (self._stereo !== null && self._stereo !== undefined) {
				parent.stereo(self._stereo, self._id);
			} else if (self._pos) {
				parent.pos(self._pos[0], self._pos[1], self._pos[2], self._id);
			} else if (self._panner) {
				// Disconnect the panner
				self._panner.disconnect(0);
				self._panner = undefined;
				parent._refreshBuffer(self);
			}

			// Complete resetting of the voice
			return self._originalReset();
		};
	}

	// If a stereo or position was specified, set it up
	if (spatialSound._stereo !== null && spatialSound._stereo !== undefined) {
		spatialParent.stereo(spatialSound._stereo, spatialSound._id);
	} else if (spatialSound._pos) {
		spatialParent.pos(
			spatialSound._pos[0],
			spatialSound._pos[1],
			spatialSound._pos[2],
			spatialSound._id,
		);
	}
}

/**
 * Handle load queue for spatial audio
 * @param sound - the sound the hook fires for
 */
export function applySpatialAfterLoad(sound: Sound): void {
	const spatial = sound as any;

	// Process any queued spatial audio actions
	if (spatial._queue) {
		for (let i = 0; i < spatial._queue.length; i++) {
			const task = spatial._queue[i];
			if (
				task.event === "stereo" ||
				task.event === "pos" ||
				task.event === "orientation"
			) {
				task.action();
			}
		}
	}
}
