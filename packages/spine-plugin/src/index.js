import { Math, Renderable, Vector2d, plugin, version } from "melonjs";
import * as spineWebGL from "@esotericsoftware/spine-webgl";
import * as spineCanvas from "@esotericsoftware/spine-canvas";
import { Vector2, Physics } from "@esotericsoftware/spine-core";

import SkeletonRenderer from "./SkeletonRenderer.js";
import { SpinePlugin } from "./SpinePlugin.js";

export { SpinePlugin } from "./SpinePlugin.js";

// a temporary array used for skeleton.getBounds();
let tempArray = [];

/**
 * @classdesc
 * An renderable object to render Spine animated skeleton.
 * @augments Renderable
 */
export default class Spine extends Renderable {
    runtime;
    skeleton;
    plugin;
    renderer;
    animationState;
    skeletonRenderer;
    root;
    boneOffset;
    boneSize;
    isSpineFlipped = {
        x : false,
        y : false
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
     * @param {number} [settings.atlasFile] - the name of the atlasFile to be used to create this spine animation
     * @param {number} [settings.jsonFile] - the name of the atlasFile to be used to create this spine animation
     * @param {number} [settings.mixTime = 0.2] - the default mix duration to use when no mix duration has been defined between two animations.
     * @example
    * import * as Spine from '@melonjs/spine-plugin';
    * import * as me from 'melonjs';
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
            throw "Spine plugin: plugin needs to be registered first using plugin.register";
        }
        this.renderer = this.plugin.app.renderer;

        if (this.renderer.WebGLVersion >= 1) {
            this.runtime = spineWebGL;
            this.gl = this.renderer.gl;
            this.canvas = ( version.split(".").map(Number).reduce((a, v, i) => a || v - "17.0.0".split(".")[i], 0) > 0 ) ? this.renderer.renderTarget.canvas : this.renderer.canvas;
            this.context = this.renderer;
            this.twoColorTint = true;
            this.batcherShader = this.runtime.Shader.newTwoColoredTextured(this.canvas);
            this.batcher = new this.runtime.PolygonBatcher(this.canvas, true);
            this.shapesShader = this.runtime.Shader.newColored(this.canvas);
            this.shapes = new this.runtime.ShapeRenderer(this.canvas);
            this.skeletonRenderer = new this.runtime.SkeletonRenderer(this.canvas, true);
            this.skeletonDebugRenderer = new this.runtime.SkeletonDebugRenderer(this.canvas);
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

        // use internally when calulcating bounds
        this.boneOffset = new Vector2();
        this.boneSize = new Vector2();

        // default mixTime
        this.mixTime = typeof settings.mixTime !== "undefined" ? settings.mixTime :  0.2;


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
     * set and load the given skeleton atlas and json definition files
     * (use this if you did not specify any json or atlas through the constructor)
     * @param {number} [atlasFile] - the name of the atlasFile to be used to create this spine animation
     * @param {number} [jsonFile] - the name of the atlasFile to be used to create this spine animation
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
        let atlas = this.plugin.assetManager.require(atlasFile);
        let atlasLoader = new this.runtime.AtlasAttachmentLoader(atlas);
        let skeletonJson = new this.runtime.SkeletonJson(atlasLoader);
        let skeletonData = skeletonJson.readSkeletonData(this.plugin.assetManager.require(jsonFile));

        // Instantiate a new skeleton based on the atlas and skeleton data.
        this.skeleton = new this.runtime.Skeleton(skeletonData);

        this.setToSetupPose();

        // Setup an animation state with a default mix of 0.2 seconds.
        var animationStateData = new this.runtime.AnimationStateData(this.skeleton.data);
        animationStateData.defaultMix = this.mixTime;
        this.animationState = new this.runtime.AnimationState(animationStateData);

        // get a reference to the root bone
        this.root = this.skeleton.getRootBone();
    }

    /**
     * flip the Spine skeleton on the horizontal axis (around its center)
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
     * flip the Spine skeleton on the vertical axis (around its center)
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
        if (this.renderer.WebGLVersion >= 1) {
            this.skeleton.getRootBone().rotation -= Math.radToDeg(angle);
        } else {
            // rotation for rootBone is in degrees (anti-clockwise)
            this.skeleton.getRootBone().rotation -= Math.radToDeg(angle) + 90;
            // melonJS rotate method takes radians
            return super.rotate(angle, v);
        }
    }

     /**
     * scale the Spine object around his anchor point.  Scaling actually applies changes
     * to the currentTransform member wich is used by the renderer to scale the object
     * when rendering.  It does not scale the object itself.  For example if the renderable
     * is an image, the image.width and image.height properties are unaltered but the currentTransform
     * member will be changed.
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Spine} Reference to this object for method chaining
     */
    scale(x, y = x) {
        // untested
        return super.scale(x, y);
    }

    /**
     * update the bounding box for this spine object.
     * (this will automatically update the bounds of the entire skeleton animation)
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    updateBounds(absolute = true) {
        if (this.isRenderable) {
            let bounds = this.getBounds();
            let isIdentity = this.autoTransform === true && this.currentTransform.isIdentity();

            bounds.clear();

            if (typeof this.skeleton !== "undefined") {
                let rootBone = this.skeleton.getRootBone();
                let boneOffset = this.boneOffset;
                let boneSize = this.boneSize;

                this.skeleton.getBounds(boneOffset, boneSize, tempArray);

                let minX = boneOffset.x - rootBone.x,
                    minY = boneOffset.y - rootBone.y;

                bounds.addFrame(
                    minX,
                    minY,
                    minX + boneSize.x,
                    minY + boneSize.y,
                    !isIdentity ? this.currentTransform : undefined
                );
            } else {
                bounds.addFrame(
                    0,
                    0,
                    this.width,
                    this.height,
                    !isIdentity ? this.currentTransform : undefined
                );
            }

            if (absolute === true) {
                var absPos = this.getAbsolutePosition();
                //bounds.translate(absPos.x, absPos.y);
                bounds.centerOn(absPos.x + bounds.centerX,  absPos.y + bounds.centerY);
            }
            return bounds;

        } else {
            // manage the case where updateBounds is called
            // before the object being yet properly initialized
            return super.updateBounds(absolute);
        }
    }

    /**
     * update function (automatically called by melonJS).
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean} true if the renderable is dirty
     */
    update(dt) {
        if (typeof this.skeleton !== "undefined") {
            let rootBone = this.skeleton.getRootBone();
            //let height = this.renderer.getHeight();

            // Update and apply the animation state, update the skeleton's
            this.animationState.update(dt / 1000);
            this.animationState.apply(this.skeleton);

            // update the root bone position
            rootBone.x = this.pos.x;
            rootBone.y = this.pos.y;

            // world transforms
            this.skeleton.updateWorldTransform(Physics.update);

            // update Bounds
            this.updateBounds();

            // world transforms
            //this.skeleton.updateWorldTransform(Physics.update);
        }
        return true;
    }


    /**
     * Draw this Spine object using the appropriate renderer.
     * If WebGL, it uses a PolygonBatcher and custom shader.
     * Otherwise, it falls back to canvas renderer.
     *
     * @param {CanvasRenderer|WebGLRenderer} renderer - A renderer instance.
     * @param {Camera2d} [viewport] - Optional camera viewport for rendering.
     */
    draw(renderer) {
        if (this.renderer.WebGLVersion >= 1) {
            this.renderer.flush();
            this.enableRenderer(this.batcher);
            this.skeletonRenderer.draw(this.batcher, this.skeleton, -1, -1, null);
            if (this.skeletonRenderer.debugRendering) {
                this.enableRenderer(this.shapes);
                this.skeletonDebugRenderer.draw(this.shapes, this.skeleton);
            }
            this.end();
            this.resetRenderer();
        } else {
            this.skeletonRenderer.draw(renderer, this.skeleton);
        }
    }

    /**
     * Reset the renderer state after using a custom renderer.
     * Rebinds the default vertex buffer and resets the compositor and shader.
     */
    resetRenderer() {
        if (this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING) !== this.renderer.vertexBuffer) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.renderer.vertexBuffer);
        }
        this.renderer.currentCompositor = undefined;
        this.renderer.currentProgram = undefined;
        this.renderer.customShader = undefined;

        this.renderer.setCompositor("quad");
        this.renderer.currentCompositor.currentTextureUnit = undefined;

        this.gl.disable(this.gl.SCISSOR_TEST);
        this.gl.enable(this.gl.BLEND);
    }

    /**
     * Enable a specific renderer, such as PolygonBatcher, and bind its shader.
     * Ends the current renderer if one is already active.
     *
     * @param {PolygonBatcher} renderer - The renderer to enable.
     */
    enableRenderer(renderer) {
        if (this.activeRenderer === renderer) return;
        this.end();
        if (renderer instanceof this.runtime.PolygonBatcher) {
            this.batcherShader.bind();
            this.batcherShader.setUniform4x4f(this.runtime.Shader.MVP_MATRIX, this.context.projectionMatrix.val);
            this.batcherShader.setUniformi("u_texture", 0);
            this.batcher.begin(this.batcherShader);
            this.activeRenderer = this.batcher;
        }
        else if (renderer instanceof this.runtime.ShapeRenderer) {
            this.shapesShader.bind();
            this.shapesShader.setUniform4x4f(this.runtime.Shader.MVP_MATRIX, this.context.projectionMatrix.val);
            this.shapes.begin(this.shapesShader);
            this.activeRenderer = this.shapes;
        }
        else {
            this.activeRenderer = this.skeletonDebugRenderer;
        }
    }

    /**
     * Ends the current active renderer, if any.
     * Typically used to stop batching before switching renderers.
     */
    end() {
        if (this.activeRenderer === this.batcher) {
            this.batcher.end();
        } else if (this.activeRenderer === this.shapes) {
            this.shapes.end();
        }
        this.activeRenderer = null;
    }

    /**
     * Disposes of all rendering-related resources to free GPU memory.
     * Should be called when this Spine object is no longer needed.
     */
    dispose() {
        this.batcher.dispose();
        this.batcherShader.dispose();
        this.shapes.dispose();
        this.shapesShader.dispose();
        this.skeletonDebugRenderer.dispose();
    }


    /**
     * Sets the current animation for a track, discarding any queued animations.
     * @param {number} [track_index] -  If the formerly current track entry was never applied to a skeleton, it is replaced (not mixed from). In either case trackEnd determines when the track is cleared.
     * @param {number} [index] - the animation index
     * @param {boolean} [loop= false] - If true, the animation will repeat. If false it will not, instead its last frame is applied if played beyond its duration.
     * @returns {TrackEntry} A track entry to allow further customization of animation playback. References to the track entry must not be kept after the dispose event occurs.
     */
    setAnimationByIndex(track_index, index, loop = false) {
        if (index < 0 || index >= this.skeleton.data.animations.length) {
            return (console.log("Animation Index not found"));
        } else {
            return this.setAnimation(track_index, this.skeleton.data.animations[index].name, loop);
        }
    }

    /**
     * Sets the current animation for a track, discarding any queued animations.
     * @param {number} [track_index] -  If the formerly current track entry was never applied to a skeleton, it is replaced (not mixed from). In either case trackEnd determines when the track is cleared.
     * @param {string} [name] - the animation name
     * @param {boolean} [loop= false] - If true, the animation will repeat. If false it will not, instead its last frame is applied if played beyond its duration.
     * @returns {TrackEntry} A track entry to allow further customization of animation playback. References to the track entry must not be kept after the dispose event occurs.
     * @example
     * // set the current animation
     * spineAlien.setAnimation(0, "death", true);
     */
    setAnimation(track_index, name, loop = false) {
        this.currentTrack = this.animationState.setAnimation(track_index, name, loop);
        return this.currentTrack;
    }

    /**
     * return true if the given animation name is the current running animation for the current track.
     * @name isCurrentAnimation
     * @param {string} name - animation name
     * @returns {boolean}
     * @example
     * if (!this.isCurrentAnimation("death")) {
     *     // do something funny...
     * }
     */
    isCurrentAnimation(name) {
        return typeof this.currentTrack !== "undefined" && this.currentTrack.animation.name === name;
    }

    /**
     * Adds an animation to be played after the current or last queued animation for a track, and sets the track entry's mixDuration.
     * @param {number} [delay=0] - If > 0, sets delay. If <= 0, the delay set is the duration of the previous track entry minus any mix duration plus the specified `delay` (ie the mix ends at (`delay` = 0) or before (`delay` < 0) the previous track entry duration). If the previous entry is looping, its next loop completion is used instead of its duration.
     * @return {TrackEntry} A track entry to allow further customization of animation playback. References to the track entry must not be kept after the dispose} event occurs.
     */
    addAnimationByIndex(track_index, index, loop = false, delay = 0) {
        if (index < 0 || index >= this.skeleton.data.animations.length) {
            return (console.log("Animation Index not found"));
        } else {
            return this.addAnimation(track_index, this.skeleton.data.animations[index].name, loop, delay);
        }
    }

    addAnimationByName(track_index, animationName, loop = false, delay = 0) {
        this.animationState.addAnimation(track_index, animationName, loop, delay);
    }

    getSpinePosition() {
        return new Vector2d(this.pos.x, this.pos.y);
    }

    setSpineSize(width, height) {
        this.width = width;
        this.height = height;
    }

    getSpineSize() {
        return {
            width: this.width,
            height: this.height
        };
    }

    /**
     * Set the default mix duration to use when no mix duration has been defined between two animations.
     * @param {number} mixTime
     */
    setDefaultMixTime(mixTime) {
        this.animationState.data.defaultMix = this.mixTime = mixTime;
    }

    /**
     * Sets a mix duration by animation name.
     */
    setTransitionMixTime(firstAnimation, secondAnimation, mixTime) {
        this.animationState.setMix(firstAnimation, secondAnimation, mixTime);
    }

    /**
     * Sets a skin by name.
     * @param {string} skinName
     * @example
     * // create a new Spine Renderable
     * let spineAlien = new Spine(100, 100, {atlasFile: "mix-and-match-pma.atlas", jsonFile: "mix-and-match-pro.json"});
     *
     * // set default animation
     * spineAlien.setAnimation(0, "dance", true);
     *
     * // set default skin
     * spineAlien.setSkinByName("full-skins/girl");
     *
     * // add it to the game world
     * me.game.world.addChild(spineAlien);
     */
    setSkinByName(skinName) {
        this.skeleton.setSkinByName(skinName);
    }

    /**
     * Reset this slot to the setup pose.
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
