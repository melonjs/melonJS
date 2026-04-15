import * as spineCanvas from "@esotericsoftware/spine-canvas";
import { MeshAttachment, Physics, Vector2 } from "@esotericsoftware/spine-core";
import * as spineWebGL from "@esotericsoftware/spine-webgl";
import { Math, plugin, Renderable } from "melonjs";
import SkeletonRenderer from "./SkeletonRenderer.js";
import SpineBatcher from "./SpineBatcher.js";
import { SpinePlugin } from "./SpinePlugin.js";

// a temporary array used for skeleton.getBounds();
const tempArray = [];

/**
 * @classdesc
 * A renderable object to render Spine animated skeleton.
 * @augments Renderable
 */
export default class Spine extends Renderable {
	runtime;
	skeleton;
	plugin;
	animationState;
	skeletonRenderer;
	root;
	boneOffset;
	boneSize;
	isSpineFlipped = {
		x: false,
		y: false,
	};

	/**
	 * Stores settings and other state for the playback of the current animation (if any).
	 * @type {TrackEntry}
	 * @see http://en.esotericsoftware.com/spine-api-reference#TrackEntry
	 * @see setAnimation
	 * @default undefined
	 * @example
	 * // set a default animation to "run"
	 * this.setAnimation(0, "run", true);
	 * ...
	 * ...
	 * // pause the animation
	 * this.currentTrack.timeScale = 0;
	 * ...
	 * ...
	 * // resume the animation
	 * this.currentTrack.timeScale = 1;
	 */
	currentTrack;

	/**
	 * @param {number} x - the x coordinates of the Spine object
	 * @param {number} y - the y coordinates of the Spine object
	 * @param {object} settings - Configuration parameters for the Spine object
	 * @param {string} [settings.atlasFile] - the name of the atlasFile to be used to create this spine animation
	 * @param {string} [settings.jsonFile] - the name of the jsonFile to be used to create this spine animation
	 * @param {number} [settings.mixTime = 0.2] - the default mix duration to use when no mix duration has been defined between two animations.
	 * @example
	 * import Spine, { SpinePlugin } from '@melonjs/spine-plugin';
	 * import * as me from 'melonjs';
	 *
	 * // register the plugin
	 * me.plugin.register(SpinePlugin);
	 *
	 * // prepare/declare assets for the preloader
	 * const DataManifest = [
	 *     {
	 *         "name": "alien-ess.json",
	 *         "type": "spine",
	 *         "src": "data/spine/alien-ess.json"
	 *     },
	 *     {
	 *         "name": "alien.atlas",
	 *         "type": "spine",
	 *         "src": "data/spine/alien.atlas"
	 *     },
	 * ]
	 *
	 * // create a new Spine Renderable
	 * let spineAlien = new Spine(100, 100, {atlasFile: "alien.atlas", jsonFile: "alien-ess.json"});
	 *
	 * // set default animation
	 * spineAlien.setAnimation(0, "death", true);
	 *
	 * // add it to the game world
	 * me.game.world.addChild(spineAlien);
	 */
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);

		// ensure plugin was properly registered
		this.plugin = plugin.get(SpinePlugin);
		if (typeof this.plugin === "undefined") {
			throw new Error(
				"Spine plugin: plugin needs to be registered first using plugin.register",
			);
		}
		const renderer = this.plugin.app.renderer;

		/** @ignore */
		this.isWebGL = renderer.WebGLVersion >= 1;

		if (this.isWebGL) {
			this.runtime = spineWebGL;
			this.canvas = renderer.renderTarget.canvas;
			// register the Spine batcher with the melonJS renderer (once)
			if (!renderer.batchers.has("spine")) {
				renderer.addBatcher(new SpineBatcher(renderer, this.canvas), "spine");
			}
			this.spineBatcher = renderer.batchers.get("spine");

			// spine skeleton renderer
			this.skeletonRenderer = new this.runtime.SkeletonRenderer(
				this.canvas,
				true,
			);

			// debug renderer still uses Spine's own GL pipeline
			this.shapesShader = this.runtime.Shader.newColored(this.canvas);
			this.shapes = new this.runtime.ShapeRenderer(this.canvas);
			this.skeletonDebugRenderer = new this.runtime.SkeletonDebugRenderer(
				this.canvas,
			);
		} else {
			this.runtime = spineCanvas;
			this.skeletonRenderer = new SkeletonRenderer(this.runtime);
		}

		// force anchorPoint to 0,0
		this.anchorPoint.set(0, 0);

		// displaying order
		if (typeof settings.z !== "undefined") {
			this.pos.z = settings.z;
		}

		// used internally when calculating bounds
		this.boneOffset = new Vector2();
		this.boneSize = new Vector2();

		// default mixTime
		this.mixTime = settings.mixTime ?? 0.2;

		if (settings.jsonFile) {
			this.jsonFile = settings.jsonFile;
			this.atlasFile = settings.atlasFile;
			this.setSkeleton(this.atlasFile, this.jsonFile);
		}
	}

	/**
	 * Whether to enable the debug mode when rendering the spine object
	 * @default false
	 * @type {boolean}
	 */
	get debugRendering() {
		return this.skeletonRenderer.debugRendering;
	}

	set debugRendering(value) {
		this.skeletonRenderer.debugRendering = value;
	}

	/**
	 * Set and load the given skeleton atlas and json definition files.
	 * (use this if you did not specify any json or atlas through the constructor)
	 * @param {string} atlasFile - the name of the atlasFile to be used to create this spine animation
	 * @param {string} jsonFile - the name of the jsonFile to be used to create this spine animation
	 * @example
	 * // create a new Spine Renderable
	 * let spineAlien = new Spine(100, 100);
	 *
	 * // set the skeleton
	 * spineAlien.setSkeleton("alien.atlas", "alien-ess.json");
	 *
	 * // set default animation
	 * spineAlien.setAnimation(0, "death", true);
	 *
	 * // add it to the game world
	 * me.game.world.addChild(spineAlien);
	 */
	setSkeleton(atlasFile, jsonFile) {
		// Create the texture atlas and skeleton data.
		const atlas = this.plugin.assetManager.require(atlasFile);
		const atlasLoader = new this.runtime.AtlasAttachmentLoader(atlas);
		const skeletonJson = new this.runtime.SkeletonJson(atlasLoader);
		const skeletonData = skeletonJson.readSkeletonData(
			this.plugin.assetManager.require(jsonFile),
		);

		// detect premultiplied alpha from atlas pages
		this.premultipliedAlpha = atlas.pages.some((page) => {
			return page.pma;
		});
		this.skeletonRenderer.premultipliedAlpha = this.premultipliedAlpha;

		// Instantiate a new skeleton based on the atlas and skeleton data.
		this.skeleton = new this.runtime.Skeleton(skeletonData);

		// auto-detect if the skeleton uses mesh attachments for canvas renderer
		if (!this.isWebGL) {
			this.skeletonRenderer.triangleRendering = skeletonData.skins.some(
				(skin) => {
					for (const attachments of skin.attachments) {
						if (attachments) {
							for (const attachment of Object.values(attachments)) {
								if (attachment instanceof MeshAttachment) {
									return true;
								}
							}
						}
					}
					return false;
				},
			);
		}

		this.setToSetupPose();

		// Setup an animation state with a default mix of 0.2 seconds.
		const animationStateData = new this.runtime.AnimationStateData(
			this.skeleton.data,
		);
		animationStateData.defaultMix = this.mixTime;
		this.animationState = new this.runtime.AnimationState(animationStateData);

		// get a reference to the root bone
		this.root = this.skeleton.getRootBone();

		// invert physics gravity to match Y-down coordinate system
		for (const constraint of this.skeleton.physicsConstraints) {
			constraint.data.gravity = -constraint.data.gravity;
			constraint.gravity = -constraint.gravity;
		}
	}

	/**
	 * Flip the Spine skeleton on the horizontal axis (around its center).
	 * @param {boolean} [flip=true] - `true` to flip this Spine object.
	 * @returns {Spine} Reference to this object for method chaining
	 */
	flipX(flip = true) {
		if (this.isSpineFlipped.x !== flip) {
			this.isSpineFlipped.x = flip;
			this.root.scaleX *= -1;
			this.isDirty = true;
		}
		return this;
	}

	/**
	 * Flip the Spine skeleton on the vertical axis (around its center).
	 * @param {boolean} [flip=true] - `true` to flip this Spine object.
	 * @returns {Spine} Reference to this object for method chaining
	 */
	flipY(flip = true) {
		if (this.isSpineFlipped.y !== flip) {
			this.isSpineFlipped.y = flip;
			this.root.scaleY *= -1;
			this.isDirty = true;
		}
		return this;
	}

	/**
	 * Rotate this Spine object by the specified angle (in radians).
	 * @param {number} angle - The angle to rotate (in radians)
	 * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
	 * @returns {Spine} Reference to this object for method chaining
	 */
	rotate(angle, v) {
		if (this.isWebGL) {
			this.skeleton.getRootBone().rotation -= Math.radToDeg(angle);
		} else {
			// rotation for rootBone is in degrees (anti-clockwise)
			this.skeleton.getRootBone().rotation -= Math.radToDeg(angle) + 90;
		}
		// apply melonJS transform as well
		return super.rotate(angle, v);
	}

	/**
	 * Scale the Spine object around its anchor point.
	 * @param {number} x - a number representing the abscissa of the scaling vector.
	 * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
	 * @returns {Spine} Reference to this object for method chaining
	 */
	scale(x, y = x) {
		if (this.isWebGL) {
			// WebGL: SpineBatcher ignores currentTransform, scale through root bone
			this.root.scaleX *= x;
			this.root.scaleY *= y;
		}
		// Canvas: scale through currentTransform only (applied by preDraw),
		// which scales both region bone transforms and mesh world vertices uniformly
		return super.scale(x, y);
	}

	/**
	 * Update the bounding box for this spine object.
	 * (this will automatically update the bounds of the entire skeleton animation)
	 * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
	 * @returns {Bounds} this shape bounding box Rectangle object
	 */
	updateBounds(absolute = true) {
		if (this.isRenderable) {
			const bounds = this.getBounds();
			const isIdentity =
				this.autoTransform === true && this.currentTransform.isIdentity();

			bounds.clear();

			if (typeof this.skeleton !== "undefined") {
				const rootBone = this.skeleton.getRootBone();

				this.skeleton.getBounds(this.boneOffset, this.boneSize, tempArray);

				const minX = this.boneOffset.x - rootBone.x;
				const minY = this.boneOffset.y - rootBone.y;

				bounds.addFrame(
					minX,
					minY,
					minX + this.boneSize.x,
					minY + this.boneSize.y,
					!isIdentity ? this.currentTransform : undefined,
				);
			} else {
				bounds.addFrame(
					0,
					0,
					this.width,
					this.height,
					!isIdentity ? this.currentTransform : undefined,
				);
			}

			if (absolute === true) {
				const absPos = this.getAbsolutePosition();
				bounds.centerOn(absPos.x + bounds.centerX, absPos.y + bounds.centerY);
			}
			return bounds;
		} else {
			// manage the case where updateBounds is called
			// before the object being yet properly initialized
			return super.updateBounds(absolute);
		}
	}

	/**
	 * Update function (automatically called by melonJS).
	 * @param {number} dt - time since the last update in milliseconds.
	 * @returns {boolean} true if the renderable is dirty
	 */
	update(dt) {
		if (typeof this.skeleton !== "undefined") {
			const deltaSeconds = dt / 1000;

			// update skeleton time for physics simulation (Spine 4.2+)
			this.skeleton.update(deltaSeconds);

			// update and apply the animation state
			this.animationState.update(deltaSeconds);
			this.animationState.apply(this.skeleton);

			// update the root bone position
			const rootBone = this.skeleton.getRootBone();
			rootBone.x = this.pos.x;
			rootBone.y = this.pos.y;

			// world transforms
			this.skeleton.updateWorldTransform(Physics.update);

			// update Bounds
			this.updateBounds();
		}
		return true;
	}

	/**
	 * Draw this Spine object using the appropriate renderer.
	 * If WebGL, it uses the melonJS SpineBatcher for two-color tinted rendering.
	 * Otherwise, it falls back to the canvas skeleton renderer.
	 *
	 * @param {CanvasRenderer|WebGLRenderer} renderer - A renderer instance.
	 */
	draw(renderer) {
		if (typeof this.skeleton === "undefined") {
			return;
		}

		// apply melonJS tint to Spine skeleton color
		const t = this.tint.toArray();
		this.skeleton.color.set(t[0], t[1], t[2], this.skeleton.color.a);

		if (this.isWebGL) {
			// switch to the Spine batcher via melonJS batcher system
			renderer.setBatcher("spine");

			// draw the skeleton — SkeletonRenderer calls spineBatcher.draw()
			this.skeletonRenderer.draw(
				this.spineBatcher,
				this.skeleton,
				-1,
				-1,
				null,
			);

			// flush remaining spine vertices
			this.spineBatcher.flush();

			// debug rendering uses Spine's own GL pipeline
			if (this.skeletonRenderer.debugRendering) {
				this.shapesShader.bind();
				this.shapesShader.setUniform4x4f(
					this.runtime.Shader.MVP_MATRIX,
					renderer.projectionMatrix.toArray(),
				);
				this.shapes.begin(this.shapesShader);
				this.skeletonDebugRenderer.draw(this.shapes, this.skeleton);
				this.shapes.end();
			}

			// no manual cleanup needed — melonJS's setBatcher() automatically
			// rebinds the shared vertex buffer when switching batchers
		} else {
			this.skeletonRenderer.draw(renderer, this.skeleton);
		}
	}

	/**
	 * Disposes of all rendering-related resources to free GPU memory.
	 * Called automatically when the renderable is removed from the world.
	 */
	dispose() {
		if (this.isWebGL) {
			this.shapes.dispose();
			this.shapesShader.dispose();
			this.skeletonDebugRenderer.dispose();
		}
	}

	/**
	 * Called when the renderable is destroyed (removed from the world).
	 * Cleans up GPU resources automatically.
	 * @ignore
	 */
	onDestroyEvent() {
		this.dispose();
	}

	/**
	 * Sets the current animation for a track by animation index, discarding any queued animations.
	 * @param {number} trackIndex - the track index
	 * @param {number} index - the animation index
	 * @param {boolean} [loop=false] - If true, the animation will repeat.
	 * @returns {TrackEntry} A track entry to allow further customization of animation playback.
	 */
	setAnimationByIndex(trackIndex, index, loop = false) {
		if (index < 0 || index >= this.skeleton.data.animations.length) {
			console.warn("Spine plugin: animation index out of range:", index);
			return undefined;
		}
		return this.setAnimation(
			trackIndex,
			this.skeleton.data.animations[index].name,
			loop,
		);
	}

	/**
	 * Sets the current animation for a track, discarding any queued animations.
	 * @param {number} trackIndex - the track index
	 * @param {string} name - the animation name
	 * @param {boolean} [loop=false] - If true, the animation will repeat.
	 * @returns {TrackEntry} A track entry to allow further customization of animation playback.
	 * @example
	 * // set the current animation
	 * spineAlien.setAnimation(0, "death", true);
	 */
	setAnimation(trackIndex, name, loop = false) {
		this.currentTrack = this.animationState.setAnimation(
			trackIndex,
			name,
			loop,
		);
		return this.currentTrack;
	}

	/**
	 * Return true if the given animation name is the current running animation for the current track.
	 * @param {string} name - animation name
	 * @returns {boolean}
	 * @example
	 * if (!this.isCurrentAnimation("death")) {
	 *     // do something funny...
	 * }
	 */
	isCurrentAnimation(name) {
		return (
			typeof this.currentTrack !== "undefined" &&
			this.currentTrack.animation.name === name
		);
	}

	/**
	 * Adds an animation to be played after the current or last queued animation for a track, by index.
	 * @param {number} trackIndex - the track index
	 * @param {number} index - the animation index
	 * @param {boolean} [loop=false] - If true, the animation will repeat.
	 * @param {number} [delay=0] - delay in seconds before playing the animation
	 * @returns {TrackEntry} A track entry to allow further customization of animation playback.
	 */
	addAnimationByIndex(trackIndex, index, loop = false, delay = 0) {
		if (index < 0 || index >= this.skeleton.data.animations.length) {
			console.warn("Spine plugin: animation index out of range:", index);
			return undefined;
		}
		return this.addAnimation(
			trackIndex,
			this.skeleton.data.animations[index].name,
			loop,
			delay,
		);
	}

	/**
	 * Adds an animation to be played after the current or last queued animation for a track, by name.
	 * @param {number} trackIndex - the track index
	 * @param {string} name - the animation name
	 * @param {boolean} [loop=false] - If true, the animation will repeat.
	 * @param {number} [delay=0] - delay in seconds before playing the animation
	 * @returns {TrackEntry} A track entry to allow further customization of animation playback.
	 */
	addAnimation(trackIndex, name, loop = false, delay = 0) {
		return this.animationState.addAnimation(trackIndex, name, loop, delay);
	}

	/**
	 * Set the default mix duration to use when no mix duration has been defined between two animations.
	 * @param {number} mixTime
	 */
	setDefaultMixTime(mixTime) {
		this.animationState.data.defaultMix = this.mixTime = mixTime;
	}

	/**
	 * Sets a mix duration between two animations by name.
	 * @param {string} firstAnimation - the name of the first animation
	 * @param {string} secondAnimation - the name of the second animation
	 * @param {number} mixTime - the mix duration in seconds
	 */
	setTransitionMixTime(firstAnimation, secondAnimation, mixTime) {
		this.animationState.setMix(firstAnimation, secondAnimation, mixTime);
	}

	/**
	 * Sets a skin by name.
	 * @param {string} skinName
	 * @example
	 * // create a new Spine Renderable
	 * let spineChar = new Spine(100, 100, {atlasFile: "mix-and-match-pma.atlas", jsonFile: "mix-and-match-pro.json"});
	 *
	 * // set default animation
	 * spineChar.setAnimation(0, "dance", true);
	 *
	 * // set skin
	 * spineChar.setSkinByName("full-skins/girl");
	 *
	 * // add it to the game world
	 * me.game.world.addChild(spineChar);
	 */
	setSkinByName(skinName) {
		this.skeleton.setSkinByName(skinName);
	}

	/**
	 * Create a combined skin from multiple skin names (mix-and-match).
	 * @param {string} combinedName - name for the new combined skin
	 * @param {...string} skinNames - names of skins to combine
	 * @example
	 * // combine multiple skins for mix-and-match
	 * spineChar.setCombinedSkin("custom", "skin-base", "nose/short", "eyelids/girly");
	 */
	setCombinedSkin(combinedName, ...skinNames) {
		const Skin = this.runtime.Skin;
		const combined = new Skin(combinedName);
		for (const name of skinNames) {
			const skin = this.skeleton.data.findSkin(name);
			if (skin) {
				combined.addSkin(skin);
			} else {
				console.warn(`Spine plugin: skin "${name}" not found`);
			}
		}
		this.skeleton.setSkin(combined);
		this.skeleton.setToSetupPose();
	}

	/**
	 * Sets an empty animation for a track, allowing the track entry to be mixed from.
	 * @param {number} trackIndex - the track index
	 * @param {number} [mixDuration=0] - mix duration in seconds
	 * @returns {TrackEntry} A track entry to allow further customization.
	 */
	setEmptyAnimation(trackIndex, mixDuration = 0) {
		return this.animationState.setEmptyAnimation(trackIndex, mixDuration);
	}

	/**
	 * Find a bone by name.
	 * @param {string} boneName - the bone name
	 * @returns {Bone|null} the bone, or null if not found
	 */
	findBone(boneName) {
		return this.skeleton.findBone(boneName);
	}

	/**
	 * Find a slot by name.
	 * @param {string} slotName - the slot name
	 * @returns {Slot|null} the slot, or null if not found
	 */
	findSlot(slotName) {
		return this.skeleton.findSlot(slotName);
	}

	/**
	 * Register a listener for animation state events.
	 * @param {object} listener - an object with event handler methods
	 * @param {Function} [listener.start] - called when an animation starts
	 * @param {Function} [listener.interrupt] - called when an animation is interrupted
	 * @param {Function} [listener.end] - called when an animation ends
	 * @param {Function} [listener.dispose] - called when a track entry is disposed
	 * @param {Function} [listener.complete] - called when an animation completes a loop
	 * @param {Function} [listener.event] - called when a user-defined event fires
	 * @example
	 * spineObj.addAnimationListener({
	 *     complete: (entry) => {
	 *         console.log("Animation complete:", entry.animation.name);
	 *     },
	 *     event: (entry, event) => {
	 *         console.log("Event:", event.data.name);
	 *     }
	 * });
	 */
	addAnimationListener(listener) {
		this.animationState.addListener(listener);
	}

	/**
	 * Remove a previously registered animation state listener.
	 * @param {object} listener - the listener to remove
	 */
	removeAnimationListener(listener) {
		this.animationState.removeListener(listener);
	}

	/**
	 * Get the list of animation names available in this skeleton.
	 * @returns {string[]} array of animation names
	 */
	getAnimationNames() {
		return this.skeleton.data.animations.map((a) => {
			return a.name;
		});
	}

	/**
	 * Get the list of skin names available in this skeleton.
	 * @returns {string[]} array of skin names
	 */
	getSkinNames() {
		return this.skeleton.data.skins.map((s) => {
			return s.name;
		});
	}

	/**
	 * Reset this skeleton to the setup pose.
	 */
	setToSetupPose() {
		this.skeleton.setToSetupPose();
		// Spine uses Y-up, melonJS uses Y-down
		this.skeleton.getRootBone().scaleY *= -1;
		this.skeleton.updateWorldTransform(Physics.reset);
		// reset flip flags
		this.isSpineFlipped.y = false;
		this.isSpineFlipped.x = false;
		// reset reference to current track entry
		this.currentTrack = undefined;
		// mark the object as dirty
		this.isDirty = true;
	}
}
