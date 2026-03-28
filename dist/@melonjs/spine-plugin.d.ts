/**
 * @classdesc
 * a Spine 4.x plugin implementation for melonJS
 * @augments plugin.BasePlugin
 */
export class SpinePlugin extends plugin.BasePlugin {
    constructor();
    assetManager: AssetManager;
}
/**
 * @classdesc
 * An renderable object to render Spine animated skeleton.
 * @augments Renderable
 */
declare class Spine extends Renderable {
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
    constructor(x: number, y: number, settings: {
        atlasFile?: number | undefined;
        jsonFile?: number | undefined;
        mixTime?: number | undefined;
    });
    runtime: {
        __proto__: null;
        AlphaTimeline: typeof AlphaTimeline;
        Animation: typeof Animation;
        AnimationState: typeof AnimationState;
        AnimationStateAdapter: typeof AnimationStateAdapter;
        AnimationStateData: typeof AnimationStateData;
        AssetCache: typeof AssetCache;
        AssetManager: {
            new (context: any, pathPrefix?: string, downloader?: Downloader): {
                pathPrefix: string;
                textureLoader: any;
                downloader: Downloader;
                cache: AssetCache;
                errors: {};
                toLoad: number;
                loaded: number;
                start(path: any): string;
                success(callback: any, path: any, asset: any): void;
                error(callback: any, path: any, message: any): void;
                loadAll(): Promise<any>;
                setRawDataURI(path: any, data: any): void;
                loadBinary(path: any, success?: () => void, error?: () => void): void;
                loadText(path: any, success?: () => void, error?: () => void): void;
                loadJson(path: any, success?: () => void, error?: () => void): void;
                reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
                loadTexture(path: any, success?: () => void, error?: () => void): void;
                loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
                loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
                loadBinaryAsync(path: any): Promise<any>;
                loadJsonAsync(path: any): Promise<any>;
                loadTextureAsync(path: any): Promise<any>;
                loadTextureAtlasAsync(path: any): Promise<any>;
                loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
                setCache(cache: any): void;
                get(path: any): any;
                require(path: any): any;
                remove(path: any): any;
                removeAll(): void;
                isLoadingComplete(): boolean;
                getToLoad(): number;
                getLoaded(): number;
                dispose(): void;
                disposeAsset(path: any): void;
                hasErrors(): boolean;
                getErrors(): {};
            };
        };
        AssetManagerBase: typeof AssetManagerBase;
        AtlasAttachmentLoader: typeof AtlasAttachmentLoader;
        Attachment: typeof Attachment;
        AttachmentTimeline: typeof AttachmentTimeline;
        BinaryInput: typeof BinaryInput;
        readonly BlendMode: any;
        Bone: typeof Bone;
        BoneData: typeof BoneData;
        BoundingBoxAttachment: typeof BoundingBoxAttachment;
        CURRENT: number;
        CameraController: typeof CameraController;
        ClippingAttachment: typeof ClippingAttachment;
        Color: typeof Color;
        Color2Attribute: typeof Color2Attribute;
        ColorAttribute: typeof ColorAttribute;
        ConstraintData: typeof ConstraintData;
        CurveTimeline: typeof CurveTimeline;
        CurveTimeline1: typeof CurveTimeline1;
        CurveTimeline2: typeof CurveTimeline2;
        DebugUtils: typeof DebugUtils;
        DeformTimeline: typeof DeformTimeline;
        Downloader: typeof Downloader;
        DrawOrderTimeline: typeof DrawOrderTimeline;
        Event: typeof Event;
        EventData: typeof EventData;
        EventQueue: typeof EventQueue;
        EventTimeline: typeof EventTimeline;
        readonly EventType: any;
        FIRST: number;
        FakeTexture: typeof FakeTexture;
        GLTexture: typeof GLTexture;
        HOLD_FIRST: number;
        HOLD_MIX: number;
        HOLD_SUBSEQUENT: number;
        IkConstraint: typeof IkConstraint;
        IkConstraintData: typeof IkConstraintData;
        IkConstraintTimeline: typeof IkConstraintTimeline;
        readonly Inherit: any;
        InheritTimeline: typeof InheritTimeline;
        Input: typeof Input;
        IntSet: typeof IntSet;
        Interpolation: typeof Interpolation;
        LoadingScreen: typeof LoadingScreen;
        M00: number;
        M01: number;
        M02: number;
        M03: number;
        M10: number;
        M11: number;
        M12: number;
        M13: number;
        M20: number;
        M21: number;
        M22: number;
        M23: number;
        M30: number;
        M31: number;
        M32: number;
        M33: number;
        ManagedWebGLRenderingContext: typeof ManagedWebGLRenderingContext;
        MathUtils: typeof MathUtils;
        Matrix4: typeof Matrix4;
        Mesh: typeof Mesh;
        MeshAttachment: typeof MeshAttachment;
        readonly MixBlend: any;
        readonly MixDirection: any;
        OrthoCamera: typeof OrthoCamera;
        PathAttachment: typeof PathAttachment;
        PathConstraint: typeof PathConstraint;
        PathConstraintData: typeof PathConstraintData;
        PathConstraintMixTimeline: typeof PathConstraintMixTimeline;
        PathConstraintPositionTimeline: typeof PathConstraintPositionTimeline;
        PathConstraintSpacingTimeline: typeof PathConstraintSpacingTimeline;
        readonly Physics: any;
        PhysicsConstraintDampingTimeline: typeof PhysicsConstraintDampingTimeline;
        PhysicsConstraintGravityTimeline: typeof PhysicsConstraintGravityTimeline;
        PhysicsConstraintInertiaTimeline: typeof PhysicsConstraintInertiaTimeline;
        PhysicsConstraintMassTimeline: typeof PhysicsConstraintMassTimeline;
        PhysicsConstraintMixTimeline: typeof PhysicsConstraintMixTimeline;
        PhysicsConstraintResetTimeline: typeof PhysicsConstraintResetTimeline;
        PhysicsConstraintStrengthTimeline: typeof PhysicsConstraintStrengthTimeline;
        PhysicsConstraintTimeline: typeof PhysicsConstraintTimeline;
        PhysicsConstraintWindTimeline: typeof PhysicsConstraintWindTimeline;
        PointAttachment: typeof PointAttachment;
        PolygonBatcher: typeof PolygonBatcher;
        Pool: typeof Pool;
        Position2Attribute: typeof Position2Attribute;
        Position3Attribute: typeof Position3Attribute;
        readonly PositionMode: any;
        Pow: typeof Pow;
        PowOut: typeof PowOut;
        RGB2Timeline: typeof RGB2Timeline;
        RGBA2Timeline: typeof RGBA2Timeline;
        RGBATimeline: typeof RGBATimeline;
        RGBTimeline: typeof RGBTimeline;
        RegionAttachment: typeof RegionAttachment;
        readonly ResizeMode: any;
        readonly RotateMode: any;
        RotateTimeline: typeof RotateTimeline;
        SETUP: number;
        SUBSEQUENT: number;
        ScaleTimeline: typeof ScaleTimeline;
        ScaleXTimeline: typeof ScaleXTimeline;
        ScaleYTimeline: typeof ScaleYTimeline;
        SceneRenderer: typeof SceneRenderer;
        SequenceTimeline: typeof SequenceTimeline;
        Shader: typeof Shader;
        ShapeRenderer: typeof ShapeRenderer;
        readonly ShapeType: any;
        ShearTimeline: typeof ShearTimeline;
        ShearXTimeline: typeof ShearXTimeline;
        ShearYTimeline: typeof ShearYTimeline;
        Skeleton: typeof Skeleton;
        SkeletonBinary: typeof SkeletonBinary;
        SkeletonBounds: typeof SkeletonBounds;
        SkeletonClipping: typeof SkeletonClipping;
        SkeletonData: typeof SkeletonData;
        SkeletonDebugRenderer: typeof SkeletonDebugRenderer;
        SkeletonJson: typeof SkeletonJson;
        SkeletonRenderer: {
            new (context: any, twoColorTint?: boolean): {
                premultipliedAlpha: boolean;
                tempColor: Color;
                tempColor2: Color;
                vertices: any[] | Float32Array<any>;
                vertexSize: number;
                twoColorTint: boolean;
                renderable: Renderable;
                clipper: SkeletonClipping;
                temp: Vector2;
                temp2: Vector2;
                temp3: Color;
                temp4: Color;
                draw(batcher: any, skeleton: any, slotRangeStart?: number, slotRangeEnd?: number, transformer?: null): void;
                /** Returns the {@link SkeletonClipping} used by this renderer for use with e.g. {@link Skeleton.getBounds} **/
                getSkeletonClipping(): SkeletonClipping;
            };
            QUAD_TRIANGLES: number[];
        };
        Skin: typeof Skin;
        SkinEntry: typeof SkinEntry;
        Slot: typeof Slot;
        SlotData: typeof SlotData;
        readonly SpacingMode: any;
        SpineCanvas: typeof SpineCanvas;
        StringSet: typeof StringSet;
        TexCoordAttribute: typeof TexCoordAttribute;
        Texture: typeof Texture;
        TextureAtlas: typeof TextureAtlas;
        TextureAtlasPage: typeof TextureAtlasPage;
        TextureAtlasRegion: typeof TextureAtlasRegion;
        readonly TextureFilter: any;
        TextureRegion: typeof TextureRegion;
        readonly TextureWrap: any;
        TimeKeeper: typeof TimeKeeper;
        Timeline: typeof Timeline;
        Touch: typeof Touch;
        TrackEntry: typeof TrackEntry;
        TransformConstraint: typeof TransformConstraint;
        TransformConstraintData: typeof TransformConstraintData;
        TransformConstraintTimeline: typeof TransformConstraintTimeline;
        TranslateTimeline: typeof TranslateTimeline;
        TranslateXTimeline: typeof TranslateXTimeline;
        TranslateYTimeline: typeof TranslateYTimeline;
        Triangulator: typeof Triangulator;
        Utils: typeof Utils;
        Vector2: typeof Vector2;
        Vector3: typeof Vector3;
        VertexAttachment: typeof VertexAttachment;
        VertexAttribute: typeof VertexAttribute;
        readonly VertexAttributeType: any;
        WindowedMean: typeof WindowedMean;
    } | {
        __proto__: null;
        AlphaTimeline: typeof AlphaTimeline;
        Animation: typeof Animation;
        AnimationState: typeof AnimationState;
        AnimationStateAdapter: typeof AnimationStateAdapter;
        AnimationStateData: typeof AnimationStateData;
        AssetCache: typeof AssetCache;
        AssetManager: {
            new (pathPrefix?: string, downloader?: Downloader): {
                pathPrefix: string;
                textureLoader: any;
                downloader: Downloader;
                cache: AssetCache;
                errors: {};
                toLoad: number;
                loaded: number;
                start(path: any): string;
                success(callback: any, path: any, asset: any): void;
                error(callback: any, path: any, message: any): void;
                loadAll(): Promise<any>;
                setRawDataURI(path: any, data: any): void;
                loadBinary(path: any, success?: () => void, error?: () => void): void;
                loadText(path: any, success?: () => void, error?: () => void): void;
                loadJson(path: any, success?: () => void, error?: () => void): void;
                reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
                loadTexture(path: any, success?: () => void, error?: () => void): void;
                loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
                loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
                loadBinaryAsync(path: any): Promise<any>;
                loadJsonAsync(path: any): Promise<any>;
                loadTextureAsync(path: any): Promise<any>;
                loadTextureAtlasAsync(path: any): Promise<any>;
                loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
                setCache(cache: any): void;
                get(path: any): any;
                require(path: any): any;
                remove(path: any): any;
                removeAll(): void;
                isLoadingComplete(): boolean;
                getToLoad(): number;
                getLoaded(): number;
                dispose(): void;
                disposeAsset(path: any): void;
                hasErrors(): boolean;
                getErrors(): {};
            };
        };
        AssetManagerBase: typeof AssetManagerBase;
        AtlasAttachmentLoader: typeof AtlasAttachmentLoader;
        Attachment: typeof Attachment;
        AttachmentTimeline: typeof AttachmentTimeline;
        BinaryInput: typeof BinaryInput;
        readonly BlendMode: any;
        Bone: typeof Bone;
        BoneData: typeof BoneData;
        BoundingBoxAttachment: typeof BoundingBoxAttachment;
        CURRENT: number;
        CanvasTexture: typeof CanvasTexture;
        ClippingAttachment: typeof ClippingAttachment;
        Color: typeof Color;
        ConstraintData: typeof ConstraintData;
        CurveTimeline: typeof CurveTimeline;
        CurveTimeline1: typeof CurveTimeline1;
        CurveTimeline2: typeof CurveTimeline2;
        DebugUtils: typeof DebugUtils;
        DeformTimeline: typeof DeformTimeline;
        Downloader: typeof Downloader;
        DrawOrderTimeline: typeof DrawOrderTimeline;
        Event: typeof Event;
        EventData: typeof EventData;
        EventQueue: typeof EventQueue;
        EventTimeline: typeof EventTimeline;
        readonly EventType: any;
        FIRST: number;
        FakeTexture: typeof FakeTexture;
        HOLD_FIRST: number;
        HOLD_MIX: number;
        HOLD_SUBSEQUENT: number;
        IkConstraint: typeof IkConstraint;
        IkConstraintData: typeof IkConstraintData;
        IkConstraintTimeline: typeof IkConstraintTimeline;
        readonly Inherit: any;
        InheritTimeline: typeof InheritTimeline;
        IntSet: typeof IntSet;
        Interpolation: typeof Interpolation;
        MathUtils: typeof MathUtils;
        MeshAttachment: typeof MeshAttachment;
        readonly MixBlend: any;
        readonly MixDirection: any;
        PathAttachment: typeof PathAttachment;
        PathConstraint: typeof PathConstraint;
        PathConstraintData: typeof PathConstraintData;
        PathConstraintMixTimeline: typeof PathConstraintMixTimeline;
        PathConstraintPositionTimeline: typeof PathConstraintPositionTimeline;
        PathConstraintSpacingTimeline: typeof PathConstraintSpacingTimeline;
        readonly Physics: any;
        PhysicsConstraintDampingTimeline: typeof PhysicsConstraintDampingTimeline;
        PhysicsConstraintGravityTimeline: typeof PhysicsConstraintGravityTimeline;
        PhysicsConstraintInertiaTimeline: typeof PhysicsConstraintInertiaTimeline;
        PhysicsConstraintMassTimeline: typeof PhysicsConstraintMassTimeline;
        PhysicsConstraintMixTimeline: typeof PhysicsConstraintMixTimeline;
        PhysicsConstraintResetTimeline: typeof PhysicsConstraintResetTimeline;
        PhysicsConstraintStrengthTimeline: typeof PhysicsConstraintStrengthTimeline;
        PhysicsConstraintTimeline: typeof PhysicsConstraintTimeline;
        PhysicsConstraintWindTimeline: typeof PhysicsConstraintWindTimeline;
        PointAttachment: typeof PointAttachment;
        Pool: typeof Pool;
        readonly PositionMode: any;
        Pow: typeof Pow;
        PowOut: typeof PowOut;
        RGB2Timeline: typeof RGB2Timeline;
        RGBA2Timeline: typeof RGBA2Timeline;
        RGBATimeline: typeof RGBATimeline;
        RGBTimeline: typeof RGBTimeline;
        RegionAttachment: typeof RegionAttachment;
        readonly RotateMode: any;
        RotateTimeline: typeof RotateTimeline;
        SETUP: number;
        SUBSEQUENT: number;
        ScaleTimeline: typeof ScaleTimeline;
        ScaleXTimeline: typeof ScaleXTimeline;
        ScaleYTimeline: typeof ScaleYTimeline;
        SequenceTimeline: typeof SequenceTimeline;
        ShearTimeline: typeof ShearTimeline;
        ShearXTimeline: typeof ShearXTimeline;
        ShearYTimeline: typeof ShearYTimeline;
        Skeleton: typeof Skeleton;
        SkeletonBinary: typeof SkeletonBinary;
        SkeletonBounds: typeof SkeletonBounds;
        SkeletonClipping: typeof SkeletonClipping;
        SkeletonData: typeof SkeletonData;
        SkeletonJson: typeof SkeletonJson;
        SkeletonRenderer: {
            new (context: any): {
                ctx: any;
                triangleRendering: boolean;
                debugRendering: boolean;
                vertices: any[] | Float32Array<any>;
                tempColor: Color;
                draw(skeleton: any): void;
                drawImages(skeleton: any): void;
                drawTriangles(skeleton: any): void;
                drawTriangle(img: any, x0: any, y0: any, u0: any, v0: any, x1: any, y1: any, u1: any, v1: any, x2: any, y2: any, u2: any, v2: any): void;
                computeRegionVertices(slot: any, region: any, pma: any): any[] | Float32Array<any>;
                computeMeshVertices(slot: any, mesh: any, pma: any): any[] | Float32Array<any>;
            };
            QUAD_TRIANGLES: number[];
            VERTEX_SIZE: number;
        };
        Skin: typeof Skin;
        SkinEntry: typeof SkinEntry;
        Slot: typeof Slot;
        SlotData: typeof SlotData;
        readonly SpacingMode: any;
        StringSet: typeof StringSet;
        Texture: typeof Texture;
        TextureAtlas: typeof TextureAtlas;
        TextureAtlasPage: typeof TextureAtlasPage;
        TextureAtlasRegion: typeof TextureAtlasRegion;
        readonly TextureFilter: any;
        TextureRegion: typeof TextureRegion;
        readonly TextureWrap: any;
        TimeKeeper: typeof TimeKeeper;
        Timeline: typeof Timeline;
        TrackEntry: typeof TrackEntry;
        TransformConstraint: typeof TransformConstraint;
        TransformConstraintData: typeof TransformConstraintData;
        TransformConstraintTimeline: typeof TransformConstraintTimeline;
        TranslateTimeline: typeof TranslateTimeline;
        TranslateXTimeline: typeof TranslateXTimeline;
        TranslateYTimeline: typeof TranslateYTimeline;
        Triangulator: typeof Triangulator;
        Utils: typeof Utils;
        Vector2: typeof Vector2;
        VertexAttachment: typeof VertexAttachment;
        WindowedMean: typeof WindowedMean;
    };
    skeleton: any;
    plugin: plugin.BasePlugin;
    renderer: any;
    animationState: any;
    skeletonRenderer: {
        premultipliedAlpha: boolean;
        tempColor: Color;
        tempColor2: Color;
        vertices: any[] | Float32Array<any>;
        vertexSize: number;
        twoColorTint: boolean;
        renderable: Renderable;
        clipper: SkeletonClipping;
        temp: Vector2;
        temp2: Vector2;
        temp3: Color;
        temp4: Color;
        draw(batcher: any, skeleton: any, slotRangeStart?: number, slotRangeEnd?: number, transformer?: null): void;
        /** Returns the {@link SkeletonClipping} used by this renderer for use with e.g. {@link Skeleton.getBounds} **/
        getSkeletonClipping(): SkeletonClipping;
    } | SkeletonRenderer;
    root: any;
    boneOffset: Vector2;
    boneSize: Vector2;
    isSpineFlipped: {
        x: boolean;
        y: boolean;
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
    currentTrack: TrackEntry;
    gl: any;
    canvas: any;
    context: any;
    twoColorTint: boolean | undefined;
    batcherShader: Shader | undefined;
    batcher: PolygonBatcher | undefined;
    shapesShader: Shader | undefined;
    shapes: ShapeRenderer | undefined;
    skeletonDebugRenderer: SkeletonDebugRenderer | undefined;
    mixTime: number;
    jsonFile: number | undefined;
    atlasFile: number | undefined;
    set debugRendering(value: boolean);
    /**
     * Whether to enable the debug mode when rendering the spine object
     * @default false
     * @type {boolean}
     */
    get debugRendering(): boolean;
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
    setSkeleton(atlasFile?: number, jsonFile?: number): void;
    /**
     * flip the Spine skeleton on the horizontal axis (around its center)
     * @param {boolean} [flip=true] - `true` to flip this Spine object.
     * @returns {Spine} Reference to this object for method chaining
     */
    flipX(flip?: boolean): Spine;
    isDirty: boolean | undefined;
    /**
     * flip the Spine skeleton on the vertical axis (around its center)
     * @param {boolean} [flip=true] - `true` to flip this Spine object.
     * @returns {Spine} Reference to this object for method chaining
     */
    flipY(flip?: boolean): Spine;
    /**
    * Rotate this Spine object by the specified angle (in radians).
    * @param {number} angle - The angle to rotate (in radians)
    * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
    * @returns {Spine} Reference to this object for method chaining
    */
    rotate(angle: number, v?: Vector2d | ObservableVector2d): Spine;
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
    scale(x: number, y?: number): Spine;
    /**
     * update the bounding box for this spine object.
     * (this will automatically update the bounds of the entire skeleton animation)
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    updateBounds(absolute?: boolean): Bounds;
    /**
     * update function (automatically called by melonJS).
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean} true if the renderable is dirty
     */
    update(dt: number): boolean;
    /**
     * Draw this Spine object using the appropriate renderer.
     * If WebGL, it uses a PolygonBatcher and custom shader.
     * Otherwise, it falls back to canvas renderer.
     *
     * @param {CanvasRenderer|WebGLRenderer} renderer - A renderer instance.
     * @param {Camera2d} [viewport] - Optional camera viewport for rendering.
     */
    draw(renderer: CanvasRenderer | WebGLRenderer): void;
    /**
     * Reset the renderer state after using a custom renderer.
     * Rebinds the default vertex buffer and resets the compositor and shader.
     */
    resetRenderer(): void;
    /**
     * Enable a specific renderer, such as PolygonBatcher, and bind its shader.
     * Ends the current renderer if one is already active.
     *
     * @param {PolygonBatcher} renderer - The renderer to enable.
     */
    enableRenderer(renderer: PolygonBatcher): void;
    activeRenderer: PolygonBatcher | ShapeRenderer | SkeletonDebugRenderer | null | undefined;
    /**
     * Ends the current active renderer, if any.
     * Typically used to stop batching before switching renderers.
     */
    end(): void;
    /**
     * Disposes of all rendering-related resources to free GPU memory.
     * Should be called when this Spine object is no longer needed.
     */
    dispose(): void;
    /**
     * Sets the current animation for a track, discarding any queued animations.
     * @param {number} [track_index] -  If the formerly current track entry was never applied to a skeleton, it is replaced (not mixed from). In either case trackEnd determines when the track is cleared.
     * @param {number} [index] - the animation index
     * @param {boolean} [loop= false] - If true, the animation will repeat. If false it will not, instead its last frame is applied if played beyond its duration.
     * @returns {TrackEntry} A track entry to allow further customization of animation playback. References to the track entry must not be kept after the dispose event occurs.
     */
    setAnimationByIndex(track_index?: number, index?: number, loop?: boolean): TrackEntry;
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
    setAnimation(track_index?: number, name?: string, loop?: boolean): TrackEntry;
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
    isCurrentAnimation(name: string): boolean;
    /**
     * Adds an animation to be played after the current or last queued animation for a track, and sets the track entry's mixDuration.
     * @param {number} [delay=0] - If > 0, sets delay. If <= 0, the delay set is the duration of the previous track entry minus any mix duration plus the specified `delay` (ie the mix ends at (`delay` = 0) or before (`delay` < 0) the previous track entry duration). If the previous entry is looping, its next loop completion is used instead of its duration.
     * @return {TrackEntry} A track entry to allow further customization of animation playback. References to the track entry must not be kept after the dispose} event occurs.
     */
    addAnimationByIndex(track_index: any, index: any, loop?: boolean, delay?: number): TrackEntry;
    addAnimationByName(track_index: any, animationName: any, loop?: boolean, delay?: number): void;
    getSpinePosition(): Vector2d;
    setSpineSize(width: any, height: any): void;
    width: any;
    height: any;
    getSpineSize(): {
        width: any;
        height: any;
    };
    /**
     * Set the default mix duration to use when no mix duration has been defined between two animations.
     * @param {number} mixTime
     */
    setDefaultMixTime(mixTime: number): void;
    /**
     * Sets a mix duration by animation name.
     */
    setTransitionMixTime(firstAnimation: any, secondAnimation: any, mixTime: any): void;
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
    setSkinByName(skinName: string): void;
    /**
     * Reset this slot to the setup pose.
     */
    setToSetupPose(): void;
}
import { plugin } from 'melonjs';
/**
 * @classdesc
 * An Asset Manager class to load spine assets
 */
declare class AssetManager {
    /**
     * @param {CanvasRenderer|WebGLRenderer} renderer - a melonJS renderer instance
     * @param {string} [pathPrefix=""] - a default path prefix for assets location
     */
    constructor(renderer: CanvasRenderer | WebGLRenderer, pathPrefix?: string);
    asset_manager: {
        pathPrefix: string;
        textureLoader: any;
        downloader: Downloader;
        cache: AssetCache;
        errors: {};
        toLoad: number;
        loaded: number;
        start(path: any): string;
        success(callback: any, path: any, asset: any): void;
        error(callback: any, path: any, message: any): void;
        loadAll(): Promise<any>;
        setRawDataURI(path: any, data: any): void;
        loadBinary(path: any, success?: () => void, error?: () => void): void;
        loadText(path: any, success?: () => void, error?: () => void): void;
        loadJson(path: any, success?: () => void, error?: () => void): void;
        reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
        loadTexture(path: any, success?: () => void, error?: () => void): void;
        loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadBinaryAsync(path: any): Promise<any>;
        loadJsonAsync(path: any): Promise<any>;
        loadTextureAsync(path: any): Promise<any>;
        loadTextureAtlasAsync(path: any): Promise<any>;
        loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
        setCache(cache: any): void;
        get(path: any): any;
        require(path: any): any;
        remove(path: any): any;
        removeAll(): void;
        isLoadingComplete(): boolean;
        getToLoad(): number;
        getLoaded(): number;
        dispose(): void;
        disposeAsset(path: any): void;
        hasErrors(): boolean;
        getErrors(): {};
    } | {
        pathPrefix: string;
        textureLoader: any;
        downloader: Downloader;
        cache: AssetCache;
        errors: {};
        toLoad: number;
        loaded: number;
        start(path: any): string;
        success(callback: any, path: any, asset: any): void;
        error(callback: any, path: any, message: any): void;
        loadAll(): Promise<any>;
        setRawDataURI(path: any, data: any): void;
        loadBinary(path: any, success?: () => void, error?: () => void): void;
        loadText(path: any, success?: () => void, error?: () => void): void;
        loadJson(path: any, success?: () => void, error?: () => void): void;
        reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
        loadTexture(path: any, success?: () => void, error?: () => void): void;
        loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadBinaryAsync(path: any): Promise<any>;
        loadJsonAsync(path: any): Promise<any>;
        loadTextureAsync(path: any): Promise<any>;
        loadTextureAtlasAsync(path: any): Promise<any>;
        loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
        setCache(cache: any): void;
        get(path: any): any;
        require(path: any): any;
        remove(path: any): any;
        removeAll(): void;
        isLoadingComplete(): boolean;
        getToLoad(): number;
        getLoaded(): number;
        dispose(): void;
        disposeAsset(path: any): void;
        hasErrors(): boolean;
        getErrors(): {};
    };
    pathPrefix: string;
    /**
     * set a default path prefix for assets location
     * @see loadAsset
     * @param {string} pathPrefix
     */
    setPrefix(pathPrefix: string): void;
    /**
     * define all spine assets to be loaded
     * @see setPrefix
     * @see loadAll
     * @param {string} atlas
     * @param {string} skel
     * @example
     * // "manually" load spine assets
     * Spine.assetManager.setPrefix("data/spine/");
     * Spine.assetManager.loadAsset("alien.atlas", "alien-ess.json");
     * await Spine.assetManager.loadAll();
     */
    loadAsset(atlas: string, skel: string): void;
    /**
     * load the given texture atlas
     * @param {string} atlas
     */
    loadTextureAtlas(atlas: string, onload: any, onerror: any): void;
    /**
     * load the given skeleton .skel file
     * @param {string} skel
     */
    loadBinary(skel: string, onload: any, onerror: any): void;
    /**
     * load the given skeleton binary file
     * @param {string} skel
     */
    loadText(skel: string, onload: any, onerror: any): void;
    /**
     * load all defined spine assets
     * @see loadAsset
     */
    loadAll(): Promise<any>;
    /**
     * get the loaded skeleton data
     * @param {string} path
     */
    require(path: string): any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Renderable {
    constructor(vertices: any, numVertices: any, numFloats: any);
    vertices: any;
    numVertices: any;
    numFloats: any;
}
/** Changes a bone's local {@link Bone#shearX} and {@link Bone#shearY}. */
declare class AlphaTimeline extends CurveTimeline1 {
    slotIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** A simple container for a list of timelines and a name. */
declare class Animation {
    constructor(name: any, timelines: any, duration: any);
    /** The animation's name, which is unique across all animations in the skeleton. */
    name: any;
    timelines: any[];
    timelineIds: StringSet;
    /** The duration of the animation in seconds, which is the highest time of all keys in the timeline. */
    duration: any;
    setTimelines(timelines: any): void;
    hasTimeline(ids: any): boolean;
    /** Applies all the animation's timelines to the specified skeleton.
     *
     * See Timeline {@link Timeline#apply(Skeleton, float, float, Array, float, MixBlend, MixDirection)}.
     * @param loop If true, the animation repeats after {@link #getDuration()}.
     * @param events May be null to ignore fired events. */
    apply(skeleton: any, lastTime: any, time: any, loop: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Applies animations over time, queues animations for later playback, mixes (crossfading) between animations, and applies
 * multiple animations on top of each other (layering).
 *
 * See [Applying Animations](http://esotericsoftware.com/spine-applying-animations/) in the Spine Runtimes Guide. */
declare class AnimationState {
    static _emptyAnimation: Animation;
    static emptyAnimation(): Animation;
    constructor(data: any);
    /** The AnimationStateData to look up mix durations. */
    data: any;
    /** The list of tracks that currently have animations, which may contain null entries. */
    tracks: any[];
    /** Multiplier for the delta time when the animation state is updated, causing time for all animations and mixes to play slower
     * or faster. Defaults to 1.
     *
     * See TrackEntry {@link TrackEntry#timeScale} for affecting a single animation. */
    timeScale: number;
    unkeyedState: number;
    events: any[];
    listeners: any[];
    queue: EventQueue;
    propertyIDs: StringSet;
    animationsChanged: boolean;
    trackEntryPool: Pool;
    /** Increments each track entry {@link TrackEntry#trackTime()}, setting queued animations as current if needed. */
    update(delta: any): void;
    /** Returns true when all mixing from entries are complete. */
    updateMixingFrom(to: any, delta: any): any;
    /** Poses the skeleton using the track entry animations. There are no side effects other than invoking listeners, so the
     * animation state can be applied to multiple skeletons to pose them identically.
     * @returns True if any animations were applied. */
    apply(skeleton: any): boolean;
    applyMixingFrom(to: any, skeleton: any, blend: any): number;
    applyAttachmentTimeline(timeline: any, skeleton: any, time: any, blend: any, attachments: any): void;
    setAttachment(skeleton: any, slot: any, attachmentName: any, attachments: any): void;
    applyRotateTimeline(timeline: any, skeleton: any, time: any, alpha: any, blend: any, timelinesRotation: any, i: any, firstFrame: any): void;
    queueEvents(entry: any, animationTime: any): void;
    /** Removes all animations from all tracks, leaving skeletons in their current pose.
     *
     * It may be desired to use {@link AnimationState#setEmptyAnimation()} to mix the skeletons back to the setup pose,
     * rather than leaving them in their current pose. */
    clearTracks(): void;
    /** Removes all animations from the track, leaving skeletons in their current pose.
     *
     * It may be desired to use {@link AnimationState#setEmptyAnimation()} to mix the skeletons back to the setup pose,
     * rather than leaving them in their current pose. */
    clearTrack(trackIndex: any): void;
    setCurrent(index: any, current: any, interrupt: any): void;
    /** Sets an animation by name.
      *
      * See {@link #setAnimationWith()}. */
    setAnimation(trackIndex: any, animationName: any, loop?: boolean): any;
    /** Sets the current animation for a track, discarding any queued animations. If the formerly current track entry was never
     * applied to a skeleton, it is replaced (not mixed from).
     * @param loop If true, the animation will repeat. If false it will not, instead its last frame is applied if played beyond its
     *           duration. In either case {@link TrackEntry#trackEnd} determines when the track is cleared.
     * @returns A track entry to allow further customization of animation playback. References to the track entry must not be kept
     *         after the {@link AnimationStateListener#dispose()} event occurs. */
    setAnimationWith(trackIndex: any, animation: any, loop?: boolean): any;
    /** Queues an animation by name.
     *
     * See {@link #addAnimationWith()}. */
    addAnimation(trackIndex: any, animationName: any, loop?: boolean, delay?: number): any;
    /** Adds an animation to be played after the current or last queued animation for a track. If the track is empty, it is
     * equivalent to calling {@link #setAnimationWith()}.
     * @param delay If > 0, sets {@link TrackEntry#delay}. If <= 0, the delay set is the duration of the previous track entry
     *           minus any mix duration (from the {@link AnimationStateData}) plus the specified `delay` (ie the mix
     *           ends at (`delay` = 0) or before (`delay` < 0) the previous track entry duration). If the
     *           previous entry is looping, its next loop completion is used instead of its duration.
     * @returns A track entry to allow further customization of animation playback. References to the track entry must not be kept
     *         after the {@link AnimationStateListener#dispose()} event occurs. */
    addAnimationWith(trackIndex: any, animation: any, loop?: boolean, delay?: number): any;
    /** Sets an empty animation for a track, discarding any queued animations, and sets the track entry's
     * {@link TrackEntry#mixduration}. An empty animation has no timelines and serves as a placeholder for mixing in or out.
     *
     * Mixing out is done by setting an empty animation with a mix duration using either {@link #setEmptyAnimation()},
     * {@link #setEmptyAnimations()}, or {@link #addEmptyAnimation()}. Mixing to an empty animation causes
     * the previous animation to be applied less and less over the mix duration. Properties keyed in the previous animation
     * transition to the value from lower tracks or to the setup pose value if no lower tracks key the property. A mix duration of
     * 0 still mixes out over one frame.
     *
     * Mixing in is done by first setting an empty animation, then adding an animation using
     * {@link #addAnimation()} and on the returned track entry, set the
     * {@link TrackEntry#setMixDuration()}. Mixing from an empty animation causes the new animation to be applied more and
     * more over the mix duration. Properties keyed in the new animation transition from the value from lower tracks or from the
     * setup pose value if no lower tracks key the property to the value keyed in the new animation. */
    setEmptyAnimation(trackIndex: any, mixDuration?: number): any;
    /** Adds an empty animation to be played after the current or last queued animation for a track, and sets the track entry's
     * {@link TrackEntry#mixDuration}. If the track is empty, it is equivalent to calling
     * {@link #setEmptyAnimation()}.
     *
     * See {@link #setEmptyAnimation()}.
     * @param delay If > 0, sets {@link TrackEntry#delay}. If <= 0, the delay set is the duration of the previous track entry
     *           minus any mix duration plus the specified `delay` (ie the mix ends at (`delay` = 0) or
     *           before (`delay` < 0) the previous track entry duration). If the previous entry is looping, its next
     *           loop completion is used instead of its duration.
     * @return A track entry to allow further customization of animation playback. References to the track entry must not be kept
     *         after the {@link AnimationStateListener#dispose()} event occurs. */
    addEmptyAnimation(trackIndex: any, mixDuration?: number, delay?: number): any;
    /** Sets an empty animation for every track, discarding any queued animations, and mixes to it over the specified mix
      * duration. */
    setEmptyAnimations(mixDuration?: number): void;
    expandToIndex(index: any): any;
    /** @param last May be null. */
    trackEntry(trackIndex: any, animation: any, loop: any, last: any): any;
    /** Removes the {@link TrackEntry#getNext() next entry} and all entries after it for the specified entry. */
    clearNext(entry: any): void;
    _animationsChanged(): void;
    computeHold(entry: any): void;
    /** Returns the track entry for the animation currently playing on the track, or null if no animation is currently playing. */
    getCurrent(trackIndex: any): any;
    /** Adds a listener to receive events for all track entries. */
    addListener(listener: any): void;
    /** Removes the listener added with {@link #addListener()}. */
    removeListener(listener: any): void;
    /** Removes all listeners added with {@link #addListener()}. */
    clearListeners(): void;
    /** Discards all listener notifications that have not yet been delivered. This can be useful to call from an
     * {@link AnimationStateListener} when it is known that further notifications that may have been already queued for delivery
     * are not wanted because new animations are being set. */
    clearListenerNotifications(): void;
}
declare class AnimationStateAdapter {
    start(entry: any): void;
    interrupt(entry: any): void;
    end(entry: any): void;
    dispose(entry: any): void;
    complete(entry: any): void;
    event(entry: any, event: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores mix (crossfade) durations to be applied when {@link AnimationState} animations are changed. */
declare class AnimationStateData {
    constructor(skeletonData: any);
    /** The SkeletonData to look up animations when they are specified by name. */
    skeletonData: any;
    animationToMixTime: {};
    /** The mix duration to use when no mix duration has been defined between two animations. */
    defaultMix: number;
    /** Sets a mix duration by animation name.
     *
     * See {@link #setMixWith()}. */
    setMix(fromName: any, toName: any, duration: any): void;
    /** Sets the mix duration when changing from the specified animation to the other.
     *
     * See {@link TrackEntry#mixDuration}. */
    setMixWith(from: any, to: any, duration: any): void;
    /** Returns the mix duration to use when changing from the specified animation to the other, or the {@link #defaultMix} if
      * no mix duration has been set. */
    getMix(from: any, to: any): any;
}
declare class AssetCache {
    static AVAILABLE_CACHES: Map<any, any>;
    static getCache(id: any): any;
    assets: {};
    assetsRefCount: {};
    assetsLoaded: {};
    addAsset(path: any, asset: any): Promise<void>;
}
declare class Downloader {
    callbacks: {};
    rawDataUris: {};
    dataUriToString(dataUri: any): any;
    base64ToUint8Array(base64: any): Uint8Array<ArrayBuffer>;
    dataUriToUint8Array(dataUri: any): Uint8Array<ArrayBuffer>;
    downloadText(url: any, success: any, error: any): void;
    downloadJson(url: any, success: any, error: any): void;
    downloadBinary(url: any, success: any, error: any): void;
    start(url: any, success: any, error: any): true | undefined;
    finish(url: any, status: any, data: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class AssetManagerBase {
    constructor(textureLoader: any, pathPrefix?: string, downloader?: Downloader, cache?: AssetCache);
    pathPrefix: string;
    textureLoader: any;
    downloader: Downloader;
    cache: AssetCache;
    errors: {};
    toLoad: number;
    loaded: number;
    start(path: any): string;
    success(callback: any, path: any, asset: any): void;
    error(callback: any, path: any, message: any): void;
    loadAll(): Promise<any>;
    setRawDataURI(path: any, data: any): void;
    loadBinary(path: any, success?: () => void, error?: () => void): void;
    loadText(path: any, success?: () => void, error?: () => void): void;
    loadJson(path: any, success?: () => void, error?: () => void): void;
    reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
    loadTexture(path: any, success?: () => void, error?: () => void): void;
    loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
    loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
    loadBinaryAsync(path: any): Promise<any>;
    loadJsonAsync(path: any): Promise<any>;
    loadTextureAsync(path: any): Promise<any>;
    loadTextureAtlasAsync(path: any): Promise<any>;
    loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
    setCache(cache: any): void;
    get(path: any): any;
    require(path: any): any;
    remove(path: any): any;
    removeAll(): void;
    isLoadingComplete(): boolean;
    getToLoad(): number;
    getLoaded(): number;
    dispose(): void;
    disposeAsset(path: any): void;
    hasErrors(): boolean;
    getErrors(): {};
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An {@link AttachmentLoader} that configures attachments using texture regions from an {@link TextureAtlas}.
 *
 * See [Loading skeleton data](http://esotericsoftware.com/spine-loading-skeleton-data#JSON-and-binary-data) in the
 * Spine Runtimes Guide. */
declare class AtlasAttachmentLoader {
    constructor(atlas: any);
    atlas: any;
    loadSequence(name: any, basePath: any, sequence: any): void;
    newRegionAttachment(skin: any, name: any, path: any, sequence: any): RegionAttachment;
    newMeshAttachment(skin: any, name: any, path: any, sequence: any): MeshAttachment;
    newBoundingBoxAttachment(skin: any, name: any): BoundingBoxAttachment;
    newPathAttachment(skin: any, name: any): PathAttachment;
    newPointAttachment(skin: any, name: any): PointAttachment;
    newClippingAttachment(skin: any, name: any): ClippingAttachment;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** The base class for all attachments. */
declare class Attachment {
    constructor(name: any);
    name: any;
}
/** Changes a slot's {@link Slot#attachment}. */
declare class AttachmentTimeline extends Timeline {
    slotIndex: number;
    /** The attachment name for each key frame. May contain null values to clear the attachment. */
    attachmentNames: any[];
    /** Sets the time in seconds and the attachment name for the specified key frame. */
    setFrame(frame: any, time: any, attachmentName: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
    setAttachment(skeleton: any, slot: any, attachmentName: any): void;
}
declare class BinaryInput {
    constructor(data: any, strings?: any[], index?: number, buffer?: DataView<any>);
    strings: any[];
    index: number;
    buffer: DataView<any>;
    readByte(): number;
    readUnsignedByte(): number;
    readShort(): number;
    readInt32(): number;
    readInt(optimizePositive: any): number;
    readStringRef(): any;
    readString(): string | null;
    readFloat(): number;
    readBoolean(): boolean;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores a bone's current pose.
 *
 * A bone has a local transform which is used to compute its world transform. A bone also has an applied transform, which is a
 * local transform that can be applied to compute the world transform. The local transform and applied transform may differ if a
 * constraint or application code modifies the world transform after it was computed from the local transform. */
declare class Bone {
    /** @param parent May be null. */
    constructor(data: any, skeleton: any, parent: any);
    /** The bone's setup pose data. */
    data: any;
    /** The skeleton this bone belongs to. */
    skeleton: any;
    /** The parent bone, or null if this is the root bone. */
    parent: null;
    /** The immediate children of this bone. */
    children: any[];
    /** The local x translation. */
    x: number;
    /** The local y translation. */
    y: number;
    /** The local rotation in degrees, counter clockwise. */
    rotation: number;
    /** The local scaleX. */
    scaleX: number;
    /** The local scaleY. */
    scaleY: number;
    /** The local shearX. */
    shearX: number;
    /** The local shearY. */
    shearY: number;
    /** The applied local x translation. */
    ax: number;
    /** The applied local y translation. */
    ay: number;
    /** The applied local rotation in degrees, counter clockwise. */
    arotation: number;
    /** The applied local scaleX. */
    ascaleX: number;
    /** The applied local scaleY. */
    ascaleY: number;
    /** The applied local shearX. */
    ashearX: number;
    /** The applied local shearY. */
    ashearY: number;
    /** Part of the world transform matrix for the X axis. If changed, {@link #updateAppliedTransform()} should be called. */
    a: number;
    /** Part of the world transform matrix for the Y axis. If changed, {@link #updateAppliedTransform()} should be called. */
    b: number;
    /** Part of the world transform matrix for the X axis. If changed, {@link #updateAppliedTransform()} should be called. */
    c: number;
    /** Part of the world transform matrix for the Y axis. If changed, {@link #updateAppliedTransform()} should be called. */
    d: number;
    /** The world X position. If changed, {@link #updateAppliedTransform()} should be called. */
    worldY: number;
    /** The world Y position. If changed, {@link #updateAppliedTransform()} should be called. */
    worldX: number;
    inherit: any;
    sorted: boolean;
    active: boolean;
    /** Returns false when the bone has not been computed because {@link BoneData#skinRequired} is true and the
      * {@link Skeleton#skin active skin} does not {@link Skin#bones contain} this bone. */
    isActive(): boolean;
    /** Computes the world transform using the parent bone and this bone's local applied transform. */
    update(physics: any): void;
    /** Computes the world transform using the parent bone and this bone's local transform.
     *
     * See {@link #updateWorldTransformWith()}. */
    updateWorldTransform(): void;
    /** Computes the world transform using the parent bone and the specified local transform. The applied transform is set to the
     * specified local transform. Child bones are not updated.
     *
     * See [World transforms](http://esotericsoftware.com/spine-runtime-skeletons#World-transforms) in the Spine
     * Runtimes Guide. */
    updateWorldTransformWith(x: any, y: any, rotation: any, scaleX: any, scaleY: any, shearX: any, shearY: any): void;
    /** Sets this bone's local transform to the setup pose. */
    setToSetupPose(): void;
    /** Computes the applied transform values from the world transform.
     *
     * If the world transform is modified (by a constraint, {@link #rotateWorld(float)}, etc) then this method should be called so
     * the applied transform matches the world transform. The applied transform may be needed by other code (eg to apply other
     * constraints).
     *
     * Some information is ambiguous in the world transform, such as -1,-1 scale versus 180 rotation. The applied transform after
     * calling this method is equivalent to the local transform used to compute the world transform, but may not be identical. */
    updateAppliedTransform(): void;
    /** The world rotation for the X axis, calculated using {@link #a} and {@link #c}. */
    getWorldRotationX(): number;
    /** The world rotation for the Y axis, calculated using {@link #b} and {@link #d}. */
    getWorldRotationY(): number;
    /** The magnitude (always positive) of the world scale X, calculated using {@link #a} and {@link #c}. */
    getWorldScaleX(): number;
    /** The magnitude (always positive) of the world scale Y, calculated using {@link #b} and {@link #d}. */
    getWorldScaleY(): number;
    /** Transforms a point from world coordinates to the bone's local coordinates. */
    worldToLocal(world: any): any;
    /** Transforms a point from the bone's local coordinates to world coordinates. */
    localToWorld(local: any): any;
    /** Transforms a point from world coordinates to the parent bone's local coordinates. */
    worldToParent(world: any): any;
    /** Transforms a point from the parent bone's coordinates to world coordinates. */
    parentToWorld(world: any): any;
    /** Transforms a world rotation to a local rotation. */
    worldToLocalRotation(worldRotation: any): number;
    /** Transforms a local rotation to a world rotation. */
    localToWorldRotation(localRotation: any): number;
    /** Rotates the world transform the specified amount.
     * <p>
     * After changes are made to the world transform, {@link #updateAppliedTransform()} should be called and
     * {@link #update(Physics)} will need to be called on any child bones, recursively. */
    rotateWorld(degrees: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose for a {@link Bone}. */
declare class BoneData {
    constructor(index: any, name: any, parent: any);
    /** The index of the bone in {@link Skeleton#getBones()}. */
    index: number;
    /** The name of the bone, which is unique across all bones in the skeleton. */
    name: any;
    /** @returns May be null. */
    parent: null;
    /** The bone's length. */
    length: number;
    /** The local x translation. */
    x: number;
    /** The local y translation. */
    y: number;
    /** The local rotation in degrees, counter clockwise. */
    rotation: number;
    /** The local scaleX. */
    scaleX: number;
    /** The local scaleY. */
    scaleY: number;
    /** The local shearX. */
    shearX: number;
    /** The local shearX. */
    shearY: number;
    /** The transform mode for how parent world transforms affect this bone. */
    inherit: any;
    /** When true, {@link Skeleton#updateWorldTransform()} only updates this bone if the {@link Skeleton#skin} contains this
      * bone.
      * @see Skin#bones */
    skinRequired: boolean;
    /** The color of the bone as it was in Spine. Available only when nonessential data was exported. Bones are not usually
     * rendered at runtime. */
    color: Color;
    /** The bone icon as it was in Spine, or null if nonessential data was not exported. */
    icon: any;
    /** False if the bone was hidden in Spine and nonessential data was exported. Does not affect runtime rendering. */
    visible: boolean;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment with vertices that make up a polygon. Can be used for hit detection, creating physics bodies, spawning particle
 * effects, and more.
 *
 * See {@link SkeletonBounds} and [Bounding Boxes](http://esotericsoftware.com/spine-bounding-boxes) in the Spine User
 * Guide. */
declare class BoundingBoxAttachment extends VertexAttachment {
    color: Color;
    copy(): BoundingBoxAttachment;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class CameraController {
    constructor(canvas: any, camera: any);
    canvas: any;
    camera: any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment with vertices that make up a polygon used for clipping the rendering of other attachments. */
declare class ClippingAttachment extends VertexAttachment {
    /** Clipping is performed between the clipping polygon's slot and the end slot. Returns null if clipping is done until the end of
     * the skeleton's rendering. */
    endSlot: null;
    /** The color of the clipping polygon as it was in Spine. Available only when nonessential data was exported. Clipping polygons
     * are not usually rendered at runtime. */
    color: Color;
    copy(): ClippingAttachment;
}
declare class Color {
    static WHITE: Color;
    static RED: Color;
    static GREEN: Color;
    static BLUE: Color;
    static MAGENTA: Color;
    static rgba8888ToColor(color: any, value: any): void;
    static rgb888ToColor(color: any, value: any): void;
    static fromString(hex: any, color?: Color): Color;
    constructor(r?: number, g?: number, b?: number, a?: number);
    r: number;
    g: number;
    b: number;
    a: number;
    set(r: any, g: any, b: any, a: any): this;
    setFromColor(c: any): this;
    setFromString(hex: any): this;
    add(r: any, g: any, b: any, a: any): this;
    clamp(): this;
    toRgb888(): number;
}
declare class Color2Attribute extends VertexAttribute {
    constructor();
}
declare class ColorAttribute extends VertexAttribute {
    constructor();
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** The base class for all constraint datas. */
declare class ConstraintData {
    constructor(name: any, order: any, skinRequired: any);
    name: any;
    order: any;
    skinRequired: any;
}
/** The base class for timelines that use interpolation between key frame values. */
declare class CurveTimeline extends Timeline {
    constructor(frameCount: any, bezierCount: any, propertyIds: any);
    curves: any[] | Float32Array<any>;
    /** Sets the specified key frame to linear interpolation. */
    setLinear(frame: any): void;
    /** Sets the specified key frame to stepped interpolation. */
    setStepped(frame: any): void;
    /** Shrinks the storage for Bezier curves, for use when <code>bezierCount</code> (specified in the constructor) was larger
     * than the actual number of Bezier curves. */
    shrink(bezierCount: any): void;
    /** Stores the segments for the specified Bezier curve. For timelines that modify multiple values, there may be more than
     * one curve per frame.
     * @param bezier The ordinal of this Bezier curve for this timeline, between 0 and <code>bezierCount - 1</code> (specified
     *           in the constructor), inclusive.
     * @param frame Between 0 and <code>frameCount - 1</code>, inclusive.
     * @param value The index of the value for this frame that this curve is used for.
     * @param time1 The time for the first key.
     * @param value1 The value for the first key.
     * @param cx1 The time for the first Bezier handle.
     * @param cy1 The value for the first Bezier handle.
     * @param cx2 The time of the second Bezier handle.
     * @param cy2 The value for the second Bezier handle.
     * @param time2 The time for the second key.
     * @param value2 The value for the second key. */
    setBezier(bezier: any, frame: any, value: any, time1: any, value1: any, cx1: any, cy1: any, cx2: any, cy2: any, time2: any, value2: any): void;
    /** Returns the Bezier interpolated value for the specified time.
     * @param frameIndex The index into {@link #getFrames()} for the values of the frame before <code>time</code>.
     * @param valueOffset The offset from <code>frameIndex</code> to the value this curve is used for.
     * @param i The index of the Bezier segments. See {@link #getCurveType(int)}. */
    getBezierValue(time: any, frameIndex: any, valueOffset: any, i: any): any;
}
declare class CurveTimeline1 extends CurveTimeline {
    /** Sets the time and value for the specified frame.
     * @param frame Between 0 and <code>frameCount</code>, inclusive.
     * @param time The frame time in seconds. */
    setFrame(frame: any, time: any, value: any): void;
    /** Returns the interpolated value for the specified time. */
    getCurveValue(time: any): any;
    getRelativeValue(time: any, alpha: any, blend: any, current: any, setup: any): any;
    getAbsoluteValue(time: any, alpha: any, blend: any, current: any, setup: any): any;
    getAbsoluteValue2(time: any, alpha: any, blend: any, current: any, setup: any, value: any): any;
    getScaleValue(time: any, alpha: any, blend: any, direction: any, current: any, setup: any): any;
}
/** The base class for a {@link CurveTimeline} which sets two properties. */
declare class CurveTimeline2 extends CurveTimeline {
    /** @param bezierCount The maximum number of Bezier curves. See {@link #shrink(int)}.
     * @param propertyIds Unique identifiers for the properties the timeline modifies. */
    constructor(frameCount: any, bezierCount: any, propertyId1: any, propertyId2: any);
    /** Sets the time and values for the specified frame.
     * @param frame Between 0 and <code>frameCount</code>, inclusive.
     * @param time The frame time in seconds. */
    setFrame(frame: any, time: any, value1: any, value2: any): void;
}
declare class DebugUtils {
    static logBones(skeleton: any): void;
}
/** Changes a slot's {@link Slot#deform} to deform a {@link VertexAttachment}. */
declare class DeformTimeline extends CurveTimeline {
    constructor(frameCount: any, bezierCount: any, slotIndex: any, attachment: any);
    slotIndex: number;
    /** The attachment that will be deformed. */
    attachment: any;
    /** The vertices for each key frame. */
    vertices: any[];
    /** Sets the time in seconds and the vertices for the specified key frame.
     * @param vertices Vertex positions for an unweighted VertexAttachment, or deform offsets if it has weights. */
    setFrame(frame: any, time: any, vertices: any): void;
    getCurvePercent(time: any, frame: any): any;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a skeleton's {@link Skeleton#drawOrder}. */
declare class DrawOrderTimeline extends Timeline {
    static propertyIds: string[];
    constructor(frameCount: any);
    /** The draw order for each key frame. See {@link #setFrame(int, float, int[])}. */
    drawOrders: any[];
    /** Sets the time in seconds and the draw order for the specified key frame.
     * @param drawOrder For each slot in {@link Skeleton#slots}, the index of the new draw order. May be null to use setup pose
     *           draw order. */
    setFrame(frame: any, time: any, drawOrder: any): void;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the current pose values for an {@link Event}.
 *
 * See Timeline {@link Timeline#apply()},
 * AnimationStateListener {@link AnimationStateListener#event()}, and
 * [Events](http://esotericsoftware.com/spine-events) in the Spine User Guide. */
declare class Event {
    constructor(time: any, data: any);
    data: any;
    intValue: number;
    floatValue: number;
    stringValue: null;
    time: number;
    volume: number;
    balance: number;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose values for an {@link Event}.
 *
 * See [Events](http://esotericsoftware.com/spine-events) in the Spine User Guide. */
declare class EventData {
    constructor(name: any);
    name: any;
    intValue: number;
    floatValue: number;
    stringValue: null;
    audioPath: null;
    volume: number;
    balance: number;
}
declare class EventQueue {
    constructor(animState: any);
    objects: any[];
    drainDisabled: boolean;
    animState: any;
    start(entry: any): void;
    interrupt(entry: any): void;
    end(entry: any): void;
    dispose(entry: any): void;
    complete(entry: any): void;
    event(entry: any, event: any): void;
    drain(): void;
    clear(): void;
}
/** Fires an {@link Event} when specific animation times are reached. */
declare class EventTimeline extends Timeline {
    static propertyIds: string[];
    constructor(frameCount: any);
    /** The event for each key frame. */
    events: any[];
    /** Sets the time in seconds and the event for the specified key frame. */
    setFrame(frame: any, event: any): void;
    /** Fires events for frames > `lastTime` and <= `time`. */
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
declare class FakeTexture extends Texture {
    setFilters(minFilter: any, magFilter: any): void;
    setWraps(uWrap: any, vWrap: any): void;
    dispose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class GLTexture extends Texture {
    static DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL: boolean;
    static validateMagFilter(magFilter: any): any;
    static usesMipMaps(filter: any): boolean;
    constructor(context: any, image: any, useMipMaps?: boolean);
    context: ManagedWebGLRenderingContext;
    texture: null;
    boundUnit: number;
    useMipMaps: boolean;
    setFilters(minFilter: any, magFilter: any): void;
    setWraps(uWrap: any, vWrap: any): void;
    update(useMipMaps: any): void;
    restore(): void;
    bind(unit?: number): void;
    unbind(): void;
    dispose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the current pose for an IK constraint. An IK constraint adjusts the rotation of 1 or 2 constrained bones so the tip of
 * the last bone is as close to the target bone as possible.
 *
 * See [IK constraints](http://esotericsoftware.com/spine-ik-constraints) in the Spine User Guide. */
declare class IkConstraint {
    constructor(data: any, skeleton: any);
    /** The IK constraint's setup pose data. */
    data: any;
    /** The bones that will be modified by this IK constraint. */
    bones: any[];
    /** The bone that is the IK target. */
    target: any;
    /** Controls the bend direction of the IK bones, either 1 or -1. */
    bendDirection: number;
    /** When true and only a single bone is being constrained, if the target is too close, the bone is scaled to reach it. */
    compress: boolean;
    /** When true, if the target is out of range, the parent bone is scaled to reach it. If more than one bone is being constrained
     * and the parent bone has local nonuniform scale, stretch is not applied. */
    stretch: boolean;
    /** A percentage (0-1) that controls the mix between the constrained and unconstrained rotations. */
    mix: number;
    /** For two bone IK, the distance from the maximum reach of the bones that rotation will slow. */
    softness: number;
    active: boolean;
    isActive(): boolean;
    setToSetupPose(): void;
    update(physics: any): void;
    /** Applies 1 bone IK. The target is specified in the world coordinate system. */
    apply1(bone: any, targetX: any, targetY: any, compress: any, stretch: any, uniform: any, alpha: any): void;
    /** Applies 2 bone IK. The target is specified in the world coordinate system.
     * @param child A direct descendant of the parent bone. */
    apply2(parent: any, child: any, targetX: any, targetY: any, bendDir: any, stretch: any, uniform: any, softness: any, alpha: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose for an {@link IkConstraint}.
 * <p>
 * See [IK constraints](http://esotericsoftware.com/spine-ik-constraints) in the Spine User Guide. */
declare class IkConstraintData extends ConstraintData {
    constructor(name: any);
    /** The bones that are constrained by this IK constraint. */
    bones: any[];
    /** The bone that is the IK target. */
    _target: null;
    set target(boneData: never);
    get target(): never;
    /** Controls the bend direction of the IK bones, either 1 or -1. */
    bendDirection: number;
    /** When true and only a single bone is being constrained, if the target is too close, the bone is scaled to reach it. */
    compress: boolean;
    /** When true, if the target is out of range, the parent bone is scaled to reach it. If more than one bone is being constrained
     * and the parent bone has local nonuniform scale, stretch is not applied. */
    stretch: boolean;
    /** When true, only a single bone is being constrained, and {@link #getCompress()} or {@link #getStretch()} is used, the bone
     * is scaled on both the X and Y axes. */
    uniform: boolean;
    /** A percentage (0-1) that controls the mix between the constrained and unconstrained rotations. */
    mix: number;
    /** For two bone IK, the distance from the maximum reach of the bones that rotation will slow. */
    softness: number;
}
/** Changes an IK constraint's {@link IkConstraint#mix}, {@link IkConstraint#softness},
 * {@link IkConstraint#bendDirection}, {@link IkConstraint#stretch}, and {@link IkConstraint#compress}. */
declare class IkConstraintTimeline extends CurveTimeline {
    /** The index of the IK constraint in {@link Skeleton#getIkConstraints()} that will be changed when this timeline is applied */
    constraintIndex: number;
    /** Sets the time in seconds, mix, softness, bend direction, compress, and stretch for the specified key frame. */
    setFrame(frame: any, time: any, mix: any, softness: any, bendDirection: any, compress: any, stretch: any): void;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
declare class InheritTimeline extends Timeline {
    boneIndex: number;
    /** Sets the transform mode for the specified frame.
     * @param frame Between 0 and <code>frameCount</code>, inclusive.
     * @param time The frame time in seconds. */
    setFrame(frame: any, time: any, inherit: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Input {
    constructor(element: any, autoPreventDefault?: boolean);
    element: any;
    mouseX: number;
    mouseY: number;
    buttonDown: boolean;
    touch0: null;
    touch1: null;
    initialPinchDistance: number;
    listeners: any[];
    autoPreventDefault: boolean;
    isTouch: boolean;
    callbacks: {
        mouseDown: (ev: any) => void;
        mouseMove: (ev: any) => void;
        mouseUp: (ev: any) => void;
        mouseWheel: (ev: any) => void;
        touchStart: (ev: any) => void;
        touchMove: (ev: any) => void;
        touchEnd: (ev: any) => void;
    };
    setupCallbacks(element: any): {
        mouseDown: (ev: any) => void;
        mouseMove: (ev: any) => void;
        mouseUp: (ev: any) => void;
        mouseWheel: (ev: any) => void;
        touchStart: (ev: any) => void;
        touchMove: (ev: any) => void;
        touchEnd: (ev: any) => void;
    };
    dispose(): void;
    addListener(listener: any): void;
    removeListener(listener: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class IntSet {
    array: any[];
    add(value: any): boolean;
    contains(value: any): boolean;
    remove(value: any): void;
    clear(): void;
}
declare class Interpolation {
    apply(start: any, end: any, a: any): any;
}
declare class LoadingScreen {
    constructor(renderer: any);
    renderer: any;
    logo: null;
    spinner: null;
    angle: number;
    fadeOut: number;
    fadeIn: number;
    timeKeeper: TimeKeeper;
    backgroundColor: Color;
    tempColor: Color;
    dispose(): void;
    draw(complete?: boolean): void;
    drawInCoordinates(x: any, y: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class ManagedWebGLRenderingContext {
    constructor(canvasOrContext: any, contextConfig?: {
        alpha: string;
    });
    canvas: any;
    gl: any;
    restorables: any[];
    contextLostHandler(e: any): void;
    contextRestoredHandler(e: any): void;
    dispose(): void;
    addRestorable(restorable: any): void;
    removeRestorable(restorable: any): void;
}
declare class MathUtils {
    static PI: number;
    static PI2: number;
    static invPI2: number;
    static radiansToDegrees: number;
    static radDeg: number;
    static degreesToRadians: number;
    static degRad: number;
    static clamp(value: any, min: any, max: any): any;
    static cosDeg(degrees: any): number;
    static sinDeg(degrees: any): number;
    static atan2Deg(y: any, x: any): number;
    static signum(value: any): 1 | 0 | -1;
    static toInt(x: any): number;
    static cbrt(x: any): number;
    static randomTriangular(min: any, max: any): any;
    static randomTriangularWith(min: any, max: any, mode: any): any;
    static isPowerOfTwo(value: any): any;
}
declare class Matrix4 {
    static xAxis: Vector3;
    static yAxis: Vector3;
    static zAxis: Vector3;
    static tmpMatrix: Matrix4;
    temp: Float32Array<ArrayBuffer>;
    values: Float32Array<ArrayBuffer>;
    set(values: any): this;
    transpose(): this;
    identity(): this;
    invert(): this;
    determinant(): number;
    translate(x: any, y: any, z: any): this;
    copy(): Matrix4;
    projection(near: any, far: any, fovy: any, aspectRatio: any): this;
    ortho2d(x: any, y: any, width: any, height: any): this;
    ortho(left: any, right: any, bottom: any, top: any, near: any, far: any): this;
    multiply(matrix: any): this;
    multiplyLeft(matrix: any): this;
    lookAt(position: any, direction: any, up: any): this;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Mesh {
    constructor(context: any, attributes: any, maxVertices: any, maxIndices: any);
    attributes: any;
    context: ManagedWebGLRenderingContext;
    vertices: Float32Array<ArrayBuffer>;
    verticesBuffer: null;
    verticesLength: number;
    dirtyVertices: boolean;
    indices: Uint16Array<any>;
    indicesBuffer: null;
    indicesLength: number;
    dirtyIndices: boolean;
    elementsPerVertex: number;
    getAttributes(): any;
    maxVertices(): number;
    numVertices(): number;
    setVerticesLength(length: any): void;
    getVertices(): Float32Array<ArrayBuffer>;
    maxIndices(): number;
    numIndices(): number;
    setIndicesLength(length: any): void;
    getIndices(): Uint16Array<any>;
    getVertexSizeInFloats(): number;
    setVertices(vertices: any): void;
    setIndices(indices: any): void;
    draw(shader: any, primitiveType: any): void;
    drawWithOffset(shader: any, primitiveType: any, offset: any, count: any): void;
    bind(shader: any): void;
    unbind(shader: any): void;
    update(): void;
    restore(): void;
    dispose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment that displays a textured mesh. A mesh has hull vertices and internal vertices within the hull. Holes are not
 * supported. Each vertex has UVs (texture coordinates) and triangles are used to map an image on to the mesh.
 *
 * See [Mesh attachments](http://esotericsoftware.com/spine-meshes) in the Spine User Guide. */
declare class MeshAttachment extends VertexAttachment {
    constructor(name: any, path: any);
    region: null;
    /** The name of the texture region for this attachment. */
    path: any;
    /** The UV pair for each vertex, normalized within the texture region. */
    regionUVs: any[];
    /** The UV pair for each vertex, normalized within the entire texture.
     *
     * See {@link #updateUVs}. */
    uvs: any[];
    /** Triplets of vertex indices which describe the mesh's triangulation. */
    triangles: any[];
    /** The color to tint the mesh. */
    color: Color;
    /** The width of the mesh's image. Available only when nonessential data was exported. */
    width: number;
    /** The height of the mesh's image. Available only when nonessential data was exported. */
    height: number;
    /** The number of entries at the beginning of {@link #vertices} that make up the mesh hull. */
    hullLength: number;
    /** Vertex index pairs describing edges for controling triangulation. Mesh triangles will never cross edges. Only available if
     * nonessential data was exported. Triangulation is not performed at runtime. */
    edges: any[];
    parentMesh: null;
    sequence: null;
    tempColor: Color;
    /** Calculates {@link #uvs} using the {@link #regionUVs} and region. Must be called if the region, the region's properties, or
     * the {@link #regionUVs} are changed. */
    updateRegion(): void;
    /** The parent mesh if this is a linked mesh, else null. A linked mesh shares the {@link #bones}, {@link #vertices},
     * {@link #regionUVs}, {@link #triangles}, {@link #hullLength}, {@link #edges}, {@link #width}, and {@link #height} with the
     * parent mesh, but may have a different {@link #name} or {@link #path} (and therefore a different texture). */
    getParentMesh(): null;
    /** @param parentMesh May be null. */
    setParentMesh(parentMesh: any): void;
    copy(): MeshAttachment;
    computeWorldVertices(slot: any, start: any, count: any, worldVertices: any, offset: any, stride: any): void;
    /** Returns a new mesh with the {@link #parentMesh} set to this mesh's parent mesh, if any, else to this mesh. **/
    newLinkedMesh(): MeshAttachment;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class OrthoCamera {
    constructor(viewportWidth: any, viewportHeight: any);
    position: Vector3;
    direction: Vector3;
    up: Vector3;
    near: number;
    far: number;
    zoom: number;
    viewportWidth: number;
    viewportHeight: number;
    projectionView: Matrix4;
    inverseProjectionView: Matrix4;
    projection: Matrix4;
    view: Matrix4;
    update(): void;
    screenToWorld(screenCoords: any, screenWidth: any, screenHeight: any): any;
    worldToScreen(worldCoords: any, screenWidth: any, screenHeight: any): any;
    setViewport(viewportWidth: any, viewportHeight: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment whose vertices make up a composite Bezier curve.
 *
 * See {@link PathConstraint} and [Paths](http://esotericsoftware.com/spine-paths) in the Spine User Guide. */
declare class PathAttachment extends VertexAttachment {
    /** The lengths along the path in the setup pose from the start of the path to the end of each Bezier curve. */
    lengths: any[];
    /** If true, the start and end knots are connected. */
    closed: boolean;
    /** If true, additional calculations are performed to make calculating positions along the path more accurate. If false, fewer
     * calculations are performed but calculating positions along the path is less accurate. */
    constantSpeed: boolean;
    /** The color of the path as it was in Spine. Available only when nonessential data was exported. Paths are not usually
     * rendered at runtime. */
    color: Color;
    copy(): PathAttachment;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the current pose for a path constraint. A path constraint adjusts the rotation, translation, and scale of the
 * constrained bones so they follow a {@link PathAttachment}.
 *
 * See [Path constraints](http://esotericsoftware.com/spine-path-constraints) in the Spine User Guide. */
declare class PathConstraint {
    static NONE: number;
    static BEFORE: number;
    static AFTER: number;
    static epsilon: number;
    constructor(data: any, skeleton: any);
    /** The path constraint's setup pose data. */
    data: any;
    /** The bones that will be modified by this path constraint. */
    bones: any[];
    /** The slot whose path attachment will be used to constrained the bones. */
    target: any;
    /** The position along the path. */
    position: number;
    /** The spacing between bones. */
    spacing: number;
    mixRotate: number;
    mixX: number;
    mixY: number;
    spaces: any[];
    positions: any[];
    world: any[];
    curves: any[];
    lengths: any[];
    segments: any[];
    active: boolean;
    isActive(): boolean;
    setToSetupPose(): void;
    update(physics: any): void;
    computeWorldPositions(path: any, spacesCount: any, tangents: any): any;
    addBeforePosition(p: any, temp: any, i: any, out: any, o: any): void;
    addAfterPosition(p: any, temp: any, i: any, out: any, o: any): void;
    addCurvePosition(p: any, x1: any, y1: any, cx1: any, cy1: any, cx2: any, cy2: any, x2: any, y2: any, out: any, o: any, tangents: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose for a {@link PathConstraint}.
 *
 * See [path constraints](http://esotericsoftware.com/spine-path-constraints) in the Spine User Guide. */
declare class PathConstraintData extends ConstraintData {
    constructor(name: any);
    /** The bones that will be modified by this path constraint. */
    bones: any[];
    /** The slot whose path attachment will be used to constrained the bones. */
    _target: null;
    set target(slotData: never);
    get target(): never;
    /** The mode for positioning the first bone on the path. */
    positionMode: any;
    /** The mode for positioning the bones after the first bone on the path. */
    spacingMode: any;
    /** The mode for adjusting the rotation of the bones. */
    rotateMode: any;
    /** An offset added to the constrained bone rotation. */
    offsetRotation: number;
    /** The position along the path. */
    position: number;
    /** The spacing between bones. */
    spacing: number;
    mixRotate: number;
    mixX: number;
    mixY: number;
}
/** Changes a transform constraint's {@link PathConstraint#getMixRotate()}, {@link PathConstraint#getMixX()}, and
 * {@link PathConstraint#getMixY()}. */
declare class PathConstraintMixTimeline extends CurveTimeline {
    /** The index of the path constraint in {@link Skeleton#getPathConstraints()} that will be changed when this timeline is
     * applied. */
    constraintIndex: number;
    setFrame(frame: any, time: any, mixRotate: any, mixX: any, mixY: any): void;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a path constraint's {@link PathConstraint#position}. */
declare class PathConstraintPositionTimeline extends CurveTimeline1 {
    /** The index of the path constraint in {@link Skeleton#getPathConstraints()} that will be changed when this timeline is
     * applied. */
    constraintIndex: number;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a path constraint's {@link PathConstraint#spacing}. */
declare class PathConstraintSpacingTimeline extends CurveTimeline1 {
    /** The index of the path constraint in {@link Skeleton#getPathConstraints()} that will be changed when this timeline is
     * applied. */
    constraintIndex: number;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getDamping()}. */
declare class PhysicsConstraintDampingTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getGravity()}. */
declare class PhysicsConstraintGravityTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getInertia()}. */
declare class PhysicsConstraintInertiaTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getMassInverse()}. The timeline values are not inverted. */
declare class PhysicsConstraintMassTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): number;
    get(constraint: any): number;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getMix()}. */
declare class PhysicsConstraintMixTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** Resets a physics constraint when specific animation times are reached. */
declare class PhysicsConstraintResetTimeline extends Timeline {
    static propertyIds: string[];
    /** @param physicsConstraintIndex -1 for all physics constraints in the skeleton. */
    constructor(frameCount: any, physicsConstraintIndex: any);
    /** The index of the physics constraint in {@link Skeleton#getPhysicsConstraints()} that will be reset when this timeline is
    * applied, or -1 if all physics constraints in the skeleton will be reset. */
    constraintIndex: any;
    /** Sets the time for the specified frame.
     * @param frame Between 0 and <code>frameCount</code>, inclusive. */
    setFrame(frame: any, time: any): void;
    /** Resets the physics constraint when frames > <code>lastTime</code> and <= <code>time</code>. */
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getStrength()}. */
declare class PhysicsConstraintStrengthTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/** The base class for most {@link PhysicsConstraint} timelines. */
declare class PhysicsConstraintTimeline extends CurveTimeline1 {
    /** @param physicsConstraintIndex -1 for all physics constraints in the skeleton. */
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any, property: any);
    /** The index of the physics constraint in {@link Skeleton#getPhysicsConstraints()} that will be changed when this timeline
     * is applied, or -1 if all physics constraints in the skeleton will be changed. */
    constraintIndex: number;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a physics constraint's {@link PhysicsConstraint#getWind()}. */
declare class PhysicsConstraintWindTimeline extends PhysicsConstraintTimeline {
    constructor(frameCount: any, bezierCount: any, physicsConstraintIndex: any);
    setup(constraint: any): any;
    get(constraint: any): any;
    set(constraint: any, value: any): void;
    global(constraint: any): any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment which is a single point and a rotation. This can be used to spawn projectiles, particles, etc. A bone can be
 * used in similar ways, but a PointAttachment is slightly less expensive to compute and can be hidden, shown, and placed in a
 * skin.
 *
 * See [Point Attachments](http://esotericsoftware.com/spine-point-attachments) in the Spine User Guide. */
declare class PointAttachment extends VertexAttachment {
    x: number;
    y: number;
    rotation: number;
    /** The color of the point attachment as it was in Spine. Available only when nonessential data was exported. Point attachments
     * are not usually rendered at runtime. */
    color: Color;
    computeWorldPosition(bone: any, point: any): any;
    computeWorldRotation(bone: any): number;
    copy(): PointAttachment;
}
declare class PolygonBatcher {
    static disableCulling: boolean;
    static globalDrawCalls: number;
    static blendModesGL: {
        srcRgb: number;
        srcRgbPma: number;
        dstRgb: number;
        srcAlpha: number;
    }[];
    static getAndResetGlobalDrawCalls(): number;
    constructor(context: any, twoColorTint?: boolean, maxVertices?: number);
    context: ManagedWebGLRenderingContext;
    drawCalls: number;
    isDrawing: boolean;
    mesh: Mesh;
    shader: null;
    lastTexture: null;
    verticesLength: number;
    indicesLength: number;
    srcColorBlend: any;
    srcAlphaBlend: any;
    dstBlend: any;
    cullWasEnabled: boolean;
    begin(shader: any): void;
    setBlendMode(blendMode: any, premultipliedAlpha: any): void;
    draw(texture: any, vertices: any, indices: any): void;
    flush(): void;
    end(): void;
    getDrawCalls(): number;
    dispose(): void;
}
declare class Pool {
    constructor(instantiator: any);
    items: any[];
    instantiator: any;
    obtain(): any;
    free(item: any): void;
    freeAll(items: any): void;
    clear(): void;
}
declare class Position2Attribute extends VertexAttribute {
    constructor();
}
declare class Position3Attribute extends VertexAttribute {
    constructor();
}
declare class Pow extends Interpolation {
    constructor(power: any);
    power: number;
    applyInternal(a: any): number;
}
declare class PowOut extends Pow {
}
/** Changes a slot's {@link Slot#color} and {@link Slot#darkColor} for two color tinting. */
declare class RGB2Timeline extends CurveTimeline {
    slotIndex: number;
    /** Sets the time in seconds, light, and dark colors for the specified key frame. */
    setFrame(frame: any, time: any, r: any, g: any, b: any, r2: any, g2: any, b2: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a slot's {@link Slot#color} and {@link Slot#darkColor} for two color tinting. */
declare class RGBA2Timeline extends CurveTimeline {
    slotIndex: number;
    /** Sets the time in seconds, light, and dark colors for the specified key frame. */
    setFrame(frame: any, time: any, r: any, g: any, b: any, a: any, r2: any, g2: any, b2: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a slot's {@link Slot#color}. */
declare class RGBATimeline extends CurveTimeline {
    slotIndex: number;
    /** Sets the time in seconds, red, green, blue, and alpha for the specified key frame. */
    setFrame(frame: any, time: any, r: any, g: any, b: any, a: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a slot's {@link Slot#color}. */
declare class RGBTimeline extends CurveTimeline {
    slotIndex: number;
    /** Sets the time in seconds, red, green, blue, and alpha for the specified key frame. */
    setFrame(frame: any, time: any, r: any, g: any, b: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** An attachment that displays a textured quadrilateral.
 *
 * See [Region attachments](http://esotericsoftware.com/spine-regions) in the Spine User Guide. */
declare class RegionAttachment extends Attachment {
    static X1: number;
    static Y1: number;
    static C1R: number;
    static C1G: number;
    static C1B: number;
    static C1A: number;
    static U1: number;
    static V1: number;
    static X2: number;
    static Y2: number;
    static C2R: number;
    static C2G: number;
    static C2B: number;
    static C2A: number;
    static U2: number;
    static V2: number;
    static X3: number;
    static Y3: number;
    static C3R: number;
    static C3G: number;
    static C3B: number;
    static C3A: number;
    static U3: number;
    static V3: number;
    static X4: number;
    static Y4: number;
    static C4R: number;
    static C4G: number;
    static C4B: number;
    static C4A: number;
    static U4: number;
    static V4: number;
    constructor(name: any, path: any);
    /** The local x translation. */
    x: number;
    /** The local y translation. */
    y: number;
    /** The local scaleX. */
    scaleX: number;
    /** The local scaleY. */
    scaleY: number;
    /** The local rotation. */
    rotation: number;
    /** The width of the region attachment in Spine. */
    width: number;
    /** The height of the region attachment in Spine. */
    height: number;
    /** The color to tint the region attachment. */
    color: Color;
    /** The name of the texture region for this attachment. */
    path: any;
    region: null;
    sequence: null;
    /** For each of the 4 vertices, a pair of <code>x,y</code> values that is the local position of the vertex.
     *
     * See {@link #updateOffset()}. */
    offset: any[] | Float32Array<any>;
    uvs: any[] | Float32Array<any>;
    tempColor: Color;
    /** Calculates the {@link #offset} using the region settings. Must be called after changing region settings. */
    updateRegion(): void;
    /** Transforms the attachment's four vertices to world coordinates. If the attachment has a {@link #sequence}, the region may
     * be changed.
     * <p>
     * See <a href="http://esotericsoftware.com/spine-runtime-skeletons#World-transforms">World transforms</a> in the Spine
     * Runtimes Guide.
     * @param worldVertices The output world vertices. Must have a length >= <code>offset</code> + 8.
     * @param offset The <code>worldVertices</code> index to begin writing values.
     * @param stride The number of <code>worldVertices</code> entries between the value pairs written. */
    computeWorldVertices(slot: any, worldVertices: any, offset: any, stride: any): void;
    copy(): RegionAttachment;
}
/** Changes a bone's local {@link Bone#rotation}. */
declare class RotateTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#scaleX)} and {@link Bone#scaleY}. */
declare class ScaleTimeline extends CurveTimeline2 {
    constructor(frameCount: any, bezierCount: any, boneIndex: any);
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#scaleX)} and {@link Bone#scaleY}. */
declare class ScaleXTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#scaleX)} and {@link Bone#scaleY}. */
declare class ScaleYTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
declare class SceneRenderer {
    constructor(canvas: any, context: any, twoColorTint?: boolean);
    context: ManagedWebGLRenderingContext;
    canvas: any;
    camera: OrthoCamera;
    batcher: PolygonBatcher;
    twoColorTint: boolean;
    batcherShader: Shader;
    shapes: ShapeRenderer;
    shapesShader: Shader;
    activeRenderer: null;
    skeletonRenderer: {
        premultipliedAlpha: boolean;
        tempColor: Color;
        tempColor2: Color;
        vertices: any[] | Float32Array<any>;
        vertexSize: number;
        twoColorTint: boolean;
        renderable: Renderable;
        clipper: SkeletonClipping;
        temp: Vector2;
        temp2: Vector2;
        temp3: Color;
        temp4: Color;
        draw(batcher: any, skeleton: any, slotRangeStart?: number, slotRangeEnd?: number, transformer?: null): void;
        /** Returns the {@link SkeletonClipping} used by this renderer for use with e.g. {@link Skeleton.getBounds} **/
        getSkeletonClipping(): SkeletonClipping;
    };
    skeletonDebugRenderer: SkeletonDebugRenderer;
    dispose(): void;
    begin(): void;
    drawSkeleton(skeleton: any, premultipliedAlpha?: boolean, slotRangeStart?: number, slotRangeEnd?: number, transform?: null): void;
    drawSkeletonDebug(skeleton: any, premultipliedAlpha: boolean | undefined, ignoredBones: any): void;
    drawTexture(texture: any, x: any, y: any, width: any, height: any, color: any): void;
    drawTextureUV(texture: any, x: any, y: any, width: any, height: any, u: any, v: any, u2: any, v2: any, color: any): void;
    drawTextureRotated(texture: any, x: any, y: any, width: any, height: any, pivotX: any, pivotY: any, angle: any, color: any): void;
    drawRegion(region: any, x: any, y: any, width: any, height: any, color: any): void;
    line(x: any, y: any, x2: any, y2: any, color: any, color2: any): void;
    triangle(filled: any, x: any, y: any, x2: any, y2: any, x3: any, y3: any, color: any, color2: any, color3: any): void;
    quad(filled: any, x: any, y: any, x2: any, y2: any, x3: any, y3: any, x4: any, y4: any, color: any, color2: any, color3: any, color4: any): void;
    rect(filled: any, x: any, y: any, width: any, height: any, color: any): void;
    rectLine(filled: any, x1: any, y1: any, x2: any, y2: any, width: any, color: any): void;
    polygon(polygonVertices: any, offset: any, count: any, color: any): void;
    circle(filled: any, x: any, y: any, radius: any, color: any, segments?: number): void;
    curve(x1: any, y1: any, cx1: any, cy1: any, cx2: any, cy2: any, x2: any, y2: any, segments: any, color: any): void;
    end(): void;
    resize(resizeMode: any): void;
    enableRenderer(renderer: any): void;
}
/** Changes a slot's {@link Slot#getSequenceIndex()} for an attachment's {@link Sequence}. */
declare class SequenceTimeline extends Timeline {
    static ENTRIES: number;
    static MODE: number;
    static DELAY: number;
    constructor(frameCount: any, slotIndex: any, attachment: any);
    slotIndex: any;
    attachment: any;
    getSlotIndex(): any;
    getAttachment(): any;
    /** Sets the time, mode, index, and frame time for the specified frame.
     * @param frame Between 0 and <code>frameCount</code>, inclusive.
     * @param time Seconds between frames. */
    setFrame(frame: any, time: any, mode: any, index: any, delay: any): void;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Shader {
    static MVP_MATRIX: string;
    static POSITION: string;
    static COLOR: string;
    static COLOR2: string;
    static TEXCOORDS: string;
    static SAMPLER: string;
    static newColoredTextured(context: any): Shader;
    static newTwoColoredTextured(context: any): Shader;
    static newColored(context: any): Shader;
    constructor(context: any, vertexShader: any, fragmentShader: any);
    vertexShader: any;
    fragmentShader: any;
    context: ManagedWebGLRenderingContext;
    vs: null;
    vsSource: any;
    fs: null;
    fsSource: any;
    program: null;
    tmp2x2: Float32Array<ArrayBuffer>;
    tmp3x3: Float32Array<ArrayBuffer>;
    tmp4x4: Float32Array<ArrayBuffer>;
    getProgram(): null;
    getVertexShader(): any;
    getFragmentShader(): any;
    getVertexShaderSource(): any;
    getFragmentSource(): any;
    compile(): void;
    compileShader(type: any, source: any): any;
    compileProgram(vs: any, fs: any): any;
    restore(): void;
    bind(): void;
    unbind(): void;
    setUniformi(uniform: any, value: any): void;
    setUniformf(uniform: any, value: any): void;
    setUniform2f(uniform: any, value: any, value2: any): void;
    setUniform3f(uniform: any, value: any, value2: any, value3: any): void;
    setUniform4f(uniform: any, value: any, value2: any, value3: any, value4: any): void;
    setUniform2x2f(uniform: any, value: any): void;
    setUniform3x3f(uniform: any, value: any): void;
    setUniform4x4f(uniform: any, value: any): void;
    getUniformLocation(uniform: any): any;
    getAttributeLocation(attribute: any): any;
    dispose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class ShapeRenderer {
    constructor(context: any, maxVertices?: number);
    context: ManagedWebGLRenderingContext;
    isDrawing: boolean;
    mesh: Mesh;
    shapeType: any;
    color: Color;
    shader: null;
    vertexIndex: number;
    tmp: Vector2;
    srcColorBlend: any;
    srcAlphaBlend: any;
    dstBlend: any;
    begin(shader: any): void;
    setBlendMode(srcColorBlend: any, srcAlphaBlend: any, dstBlend: any): void;
    setColor(color: any): void;
    setColorWith(r: any, g: any, b: any, a: any): void;
    point(x: any, y: any, color: any): void;
    line(x: any, y: any, x2: any, y2: any, color: any): void;
    triangle(filled: any, x: any, y: any, x2: any, y2: any, x3: any, y3: any, color: any, color2: any, color3: any): void;
    quad(filled: any, x: any, y: any, x2: any, y2: any, x3: any, y3: any, x4: any, y4: any, color: any, color2: any, color3: any, color4: any): void;
    rect(filled: any, x: any, y: any, width: any, height: any, color: any): void;
    rectLine(filled: any, x1: any, y1: any, x2: any, y2: any, width: any, color: any): void;
    x(x: any, y: any, size: any): void;
    polygon(polygonVertices: any, offset: any, count: any, color: any): void;
    circle(filled: any, x: any, y: any, radius: any, color: any, segments?: number): void;
    curve(x1: any, y1: any, cx1: any, cy1: any, cx2: any, cy2: any, x2: any, y2: any, segments: any, color: any): void;
    vertex(x: any, y: any, color: any): void;
    end(): void;
    flush(): void;
    check(shapeType: any, numVertices: any): void;
    dispose(): void;
}
/** Changes a bone's local {@link Bone#shearX} and {@link Bone#shearY}. */
declare class ShearTimeline extends CurveTimeline2 {
    constructor(frameCount: any, bezierCount: any, boneIndex: any);
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#shearX} and {@link Bone#shearY}. */
declare class ShearXTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#shearX} and {@link Bone#shearY}. */
declare class ShearYTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the current pose for a skeleton.
 *
 * See [Instance objects](http://esotericsoftware.com/spine-runtime-architecture#Instance-objects) in the Spine Runtimes Guide. */
declare class Skeleton {
    static quadTriangles: number[];
    static yDown: boolean;
    constructor(data: any);
    /** The skeleton's setup pose data. */
    data: any;
    /** The skeleton's bones, sorted parent first. The root bone is always the first bone. */
    bones: any[];
    /** The skeleton's slots in the setup pose draw order. */
    slots: any[];
    /** The skeleton's slots in the order they should be drawn. The returned array may be modified to change the draw order. */
    drawOrder: any[];
    /** The skeleton's IK constraints. */
    ikConstraints: any[];
    /** The skeleton's transform constraints. */
    transformConstraints: any[];
    /** The skeleton's path constraints. */
    pathConstraints: any[];
    /** The skeleton's physics constraints. */
    physicsConstraints: any[];
    /** The list of bones and constraints, sorted in the order they should be updated, as computed by {@link #updateCache()}. */
    _updateCache: any[];
    /** The skeleton's current skin. May be null. */
    skin: null;
    /** The color to tint all the skeleton's attachments. */
    color: Color;
    /** Scales the entire skeleton on the X axis. This affects all bones, even if the bone's transform mode disallows scale
      * inheritance. */
    scaleX: number;
    /** Scales the entire skeleton on the Y axis. This affects all bones, even if the bone's transform mode disallows scale
      * inheritance. */
    _scaleY: number;
    set scaleY(scaleY: number);
    get scaleY(): number;
    /** Sets the skeleton X position, which is added to the root bone worldX position. */
    x: number;
    /** Sets the skeleton Y position, which is added to the root bone worldY position. */
    y: number;
    /** Returns the skeleton's time. This is used for time-based manipulations, such as {@link PhysicsConstraint}.
     * <p>
     * See {@link #update(float)}. */
    time: number;
    /** Caches information about bones and constraints. Must be called if the {@link #getSkin()} is modified or if bones,
     * constraints, or weighted path attachments are added or removed. */
    updateCache(): void;
    sortIkConstraint(constraint: any): void;
    sortPathConstraint(constraint: any): void;
    sortTransformConstraint(constraint: any): void;
    sortPathConstraintAttachment(skin: any, slotIndex: any, slotBone: any): void;
    sortPathConstraintAttachmentWith(attachment: any, slotBone: any): void;
    sortPhysicsConstraint(constraint: any): void;
    sortBone(bone: any): void;
    sortReset(bones: any): void;
    /** Updates the world transform for each bone and applies all constraints.
     *
     * See [World transforms](http://esotericsoftware.com/spine-runtime-skeletons#World-transforms) in the Spine
     * Runtimes Guide. */
    updateWorldTransform(physics: any): void;
    updateWorldTransformWith(physics: any, parent: any): void;
    /** Sets the bones, constraints, and slots to their setup pose values. */
    setToSetupPose(): void;
    /** Sets the bones and constraints to their setup pose values. */
    setBonesToSetupPose(): void;
    /** Sets the slots and draw order to their setup pose values. */
    setSlotsToSetupPose(): void;
    /** @returns May return null. */
    getRootBone(): any;
    /** @returns May be null. */
    findBone(boneName: any): any;
    /** Finds a slot by comparing each slot's name. It is more efficient to cache the results of this method than to call it
     * repeatedly.
     * @returns May be null. */
    findSlot(slotName: any): any;
    /** Sets a skin by name.
     *
     * See {@link #setSkin()}. */
    setSkinByName(skinName: any): void;
    /** Sets the skin used to look up attachments before looking in the {@link SkeletonData#defaultSkin default skin}. If the
     * skin is changed, {@link #updateCache()} is called.
     *
     * Attachments from the new skin are attached if the corresponding attachment from the old skin was attached. If there was no
     * old skin, each slot's setup mode attachment is attached from the new skin.
     *
     * After changing the skin, the visible attachments can be reset to those attached in the setup pose by calling
     * {@link #setSlotsToSetupPose()}. Also, often {@link AnimationState#apply()} is called before the next time the
     * skeleton is rendered to allow any attachment keys in the current animation(s) to hide or show attachments from the new skin.
     * @param newSkin May be null. */
    setSkin(newSkin: any): void;
    /** Finds an attachment by looking in the {@link #skin} and {@link SkeletonData#defaultSkin} using the slot name and attachment
     * name.
     *
     * See {@link #getAttachment()}.
     * @returns May be null. */
    getAttachmentByName(slotName: any, attachmentName: any): any;
    /** Finds an attachment by looking in the {@link #skin} and {@link SkeletonData#defaultSkin} using the slot index and
     * attachment name. First the skin is checked and if the attachment was not found, the default skin is checked.
     *
     * See [Runtime skins](http://esotericsoftware.com/spine-runtime-skins) in the Spine Runtimes Guide.
     * @returns May be null. */
    getAttachment(slotIndex: any, attachmentName: any): any;
    /** A convenience method to set an attachment by finding the slot with {@link #findSlot()}, finding the attachment with
     * {@link #getAttachment()}, then setting the slot's {@link Slot#attachment}.
     * @param attachmentName May be null to clear the slot's attachment. */
    setAttachment(slotName: any, attachmentName: any): void;
    /** Finds an IK constraint by comparing each IK constraint's name. It is more efficient to cache the results of this method
     * than to call it repeatedly.
     * @return May be null. */
    findIkConstraint(constraintName: any): any;
    /** Finds a transform constraint by comparing each transform constraint's name. It is more efficient to cache the results of
     * this method than to call it repeatedly.
     * @return May be null. */
    findTransformConstraint(constraintName: any): any;
    /** Finds a path constraint by comparing each path constraint's name. It is more efficient to cache the results of this method
     * than to call it repeatedly.
     * @return May be null. */
    findPathConstraint(constraintName: any): any;
    /** Finds a physics constraint by comparing each physics constraint's name. It is more efficient to cache the results of this
     * method than to call it repeatedly. */
    findPhysicsConstraint(constraintName: any): any;
    /** Returns the axis aligned bounding box (AABB) of the region and mesh attachments for the current pose as `{ x: number, y: number, width: number, height: number }`.
     * Note that this method will create temporary objects which can add to garbage collection pressure. Use `getBounds()` if garbage collection is a concern. */
    getBoundsRect(clipper: any): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Returns the axis aligned bounding box (AABB) of the region and mesh attachments for the current pose.
     * @param offset An output value, the distance from the skeleton origin to the bottom left corner of the AABB.
     * @param size An output value, the width and height of the AABB.
     * @param temp Working memory to temporarily store attachments' computed world vertices.
     * @param clipper {@link SkeletonClipping} to use. If <code>null</code>, no clipping is applied. */
    getBounds(offset: any, size: any, temp?: any[], clipper?: null): void;
    /** Increments the skeleton's {@link #time}. */
    update(delta: any): void;
    physicsTranslate(x: any, y: any): void;
    /** Calls {@link PhysicsConstraint#rotate(float, float, float)} for each physics constraint. */
    physicsRotate(x: any, y: any, degrees: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Loads skeleton data in the Spine binary format.
 *
 * See [Spine binary format](http://esotericsoftware.com/spine-binary-format) and
 * [JSON and binary data](http://esotericsoftware.com/spine-loading-skeleton-data#JSON-and-binary-data) in the Spine
 * Runtimes Guide. */
declare class SkeletonBinary {
    constructor(attachmentLoader: any);
    /** Scales bone positions, image sizes, and translations as they are loaded. This allows different size images to be used at
     * runtime than were used in Spine.
     *
     * See [Scaling](http://esotericsoftware.com/spine-loading-skeleton-data#Scaling) in the Spine Runtimes Guide. */
    scale: number;
    attachmentLoader: any;
    linkedMeshes: any[];
    readSkeletonData(binary: any): SkeletonData;
    readSkin(input: any, skeletonData: any, defaultSkin: any, nonessential: any): Skin | null;
    readAttachment(input: any, skeletonData: any, skin: any, slotIndex: any, attachmentName: any, nonessential: any): any;
    readSequence(input: any): Sequence;
    readVertices(input: any, weighted: any): Vertices;
    readFloatArray(input: any, n: any, scale: any): any[];
    readShortArray(input: any, n: any): any[];
    readAnimation(input: any, name: any, skeletonData: any): Animation;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Collects each visible {@link BoundingBoxAttachment} and computes the world vertices for its polygon. The polygon vertices are
 * provided along with convenience methods for doing hit detection. */
declare class SkeletonBounds {
    /** The left edge of the axis aligned bounding box. */
    minX: number;
    /** The bottom edge of the axis aligned bounding box. */
    minY: number;
    /** The right edge of the axis aligned bounding box. */
    maxX: number;
    /** The top edge of the axis aligned bounding box. */
    maxY: number;
    /** The visible bounding boxes. */
    boundingBoxes: any[];
    /** The world vertices for the bounding box polygons. */
    polygons: any[];
    polygonPool: Pool;
    /** Clears any previous polygons, finds all visible bounding box attachments, and computes the world vertices for each bounding
     * box's polygon.
     * @param updateAabb If true, the axis aligned bounding box containing all the polygons is computed. If false, the
     *           SkeletonBounds AABB methods will always return true. */
    update(skeleton: any, updateAabb: any): void;
    aabbCompute(): void;
    /** Returns true if the axis aligned bounding box contains the point. */
    aabbContainsPoint(x: any, y: any): boolean;
    /** Returns true if the axis aligned bounding box intersects the line segment. */
    aabbIntersectsSegment(x1: any, y1: any, x2: any, y2: any): boolean;
    /** Returns true if the axis aligned bounding box intersects the axis aligned bounding box of the specified bounds. */
    aabbIntersectsSkeleton(bounds: any): boolean;
    /** Returns the first bounding box attachment that contains the point, or null. When doing many checks, it is usually more
     * efficient to only call this method if {@link #aabbContainsPoint(float, float)} returns true. */
    containsPoint(x: any, y: any): any;
    /** Returns true if the polygon contains the point. */
    containsPointPolygon(polygon: any, x: any, y: any): boolean;
    /** Returns the first bounding box attachment that contains any part of the line segment, or null. When doing many checks, it
     * is usually more efficient to only call this method if {@link #aabbIntersectsSegment()} returns
     * true. */
    intersectsSegment(x1: any, y1: any, x2: any, y2: any): any;
    /** Returns true if the polygon contains any part of the line segment. */
    intersectsSegmentPolygon(polygon: any, x1: any, y1: any, x2: any, y2: any): boolean;
    /** Returns the polygon for the specified bounding box, or null. */
    getPolygon(boundingBox: any): any;
    /** The width of the axis aligned bounding box. */
    getWidth(): number;
    /** The height of the axis aligned bounding box. */
    getHeight(): number;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class SkeletonClipping {
    static makeClockwise(polygon: any): void;
    triangulator: Triangulator;
    clippingPolygon: any[];
    clipOutput: any[];
    clippedVertices: any[];
    clippedUVs: any[];
    clippedTriangles: any[];
    scratch: any[];
    clipAttachment: null;
    clippingPolygons: null;
    clipStart(slot: any, clip: any): number;
    clipEndWithSlot(slot: any): void;
    clipEnd(): void;
    isClipping(): boolean;
    clipTriangles(vertices: any, verticesLengthOrTriangles: any, trianglesOrTrianglesLength: any, trianglesLengthOrUvs: any, uvsOrLight: any, lightOrDark: any, darkOrTwoColor: any, twoColorParam: any): void;
    clipTrianglesNoRender(vertices: any, triangles: any, trianglesLength: any): void;
    clipTrianglesRender(vertices: any, triangles: any, trianglesLength: any, uvs: any, light: any, dark: any, twoColor: any): void;
    clipTrianglesUnpacked(vertices: any, triangles: any, trianglesLength: any, uvs: any): void;
    /** Clips the input triangle against the convex, clockwise clipping area. If the triangle lies entirely within the clipping
     * area, false is returned. The clipping area must duplicate the first vertex at the end of the vertices list. */
    clip(x1: any, y1: any, x2: any, y2: any, x3: any, y3: any, clippingArea: any, output: any): boolean;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose and all of the stateless data for a skeleton.
 *
 * See [Data objects](http://esotericsoftware.com/spine-runtime-architecture#Data-objects) in the Spine Runtimes
 * Guide. */
declare class SkeletonData {
    /** The skeleton's name, which by default is the name of the skeleton data file, if possible. May be null. */
    name: null;
    /** The skeleton's bones, sorted parent first. The root bone is always the first bone. */
    bones: any[];
    /** The skeleton's slots in the setup pose draw order. */
    slots: any[];
    skins: any[];
    /** The skeleton's default skin. By default this skin contains all attachments that were not in a skin in Spine.
     *
     * See {@link Skeleton#getAttachmentByName()}.
     * May be null. */
    defaultSkin: null;
    /** The skeleton's events. */
    events: any[];
    /** The skeleton's animations. */
    animations: any[];
    /** The skeleton's IK constraints. */
    ikConstraints: any[];
    /** The skeleton's transform constraints. */
    transformConstraints: any[];
    /** The skeleton's path constraints. */
    pathConstraints: any[];
    /** The skeleton's physics constraints. */
    physicsConstraints: any[];
    /** The X coordinate of the skeleton's axis aligned bounding box in the setup pose. */
    x: number;
    /** The Y coordinate of the skeleton's axis aligned bounding box in the setup pose. */
    y: number;
    /** The width of the skeleton's axis aligned bounding box in the setup pose. */
    width: number;
    /** The height of the skeleton's axis aligned bounding box in the setup pose. */
    height: number;
    /** Baseline scale factor for applying distance-dependent effects on non-scalable properties, such as angle or scale. Default
     * is 100. */
    referenceScale: number;
    /** The Spine version used to export the skeleton data, or null. */
    version: null;
    /** The skeleton data hash. This value will change if any of the skeleton data has changed. May be null. */
    hash: null;
    /** The dopesheet FPS in Spine. Available only when nonessential data was exported. */
    fps: number;
    /** The path to the images directory as defined in Spine. Available only when nonessential data was exported. May be null. */
    imagesPath: null;
    /** The path to the audio directory as defined in Spine. Available only when nonessential data was exported. May be null. */
    audioPath: null;
    /** Finds a bone by comparing each bone's name. It is more efficient to cache the results of this method than to call it
     * multiple times.
     * @returns May be null. */
    findBone(boneName: any): any;
    /** Finds a slot by comparing each slot's name. It is more efficient to cache the results of this method than to call it
     * multiple times.
     * @returns May be null. */
    findSlot(slotName: any): any;
    /** Finds a skin by comparing each skin's name. It is more efficient to cache the results of this method than to call it
     * multiple times.
     * @returns May be null. */
    findSkin(skinName: any): any;
    /** Finds an event by comparing each events's name. It is more efficient to cache the results of this method than to call it
     * multiple times.
     * @returns May be null. */
    findEvent(eventDataName: any): any;
    /** Finds an animation by comparing each animation's name. It is more efficient to cache the results of this method than to
     * call it multiple times.
     * @returns May be null. */
    findAnimation(animationName: any): any;
    /** Finds an IK constraint by comparing each IK constraint's name. It is more efficient to cache the results of this method
     * than to call it multiple times.
     * @return May be null. */
    findIkConstraint(constraintName: any): any;
    /** Finds a transform constraint by comparing each transform constraint's name. It is more efficient to cache the results of
     * this method than to call it multiple times.
     * @return May be null. */
    findTransformConstraint(constraintName: any): any;
    /** Finds a path constraint by comparing each path constraint's name. It is more efficient to cache the results of this method
     * than to call it multiple times.
     * @return May be null. */
    findPathConstraint(constraintName: any): any;
    /** Finds a physics constraint by comparing each physics constraint's name. It is more efficient to cache the results of this method
     * than to call it multiple times.
     * @return May be null. */
    findPhysicsConstraint(constraintName: any): any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class SkeletonDebugRenderer {
    static LIGHT_GRAY: Color;
    static GREEN: Color;
    constructor(context: any);
    boneLineColor: Color;
    boneOriginColor: Color;
    attachmentLineColor: Color;
    triangleLineColor: Color;
    pathColor: Color;
    clipColor: Color;
    aabbColor: Color;
    drawBones: boolean;
    drawRegionAttachments: boolean;
    drawBoundingBoxes: boolean;
    drawMeshHull: boolean;
    drawMeshTriangles: boolean;
    drawPaths: boolean;
    drawSkeletonXY: boolean;
    drawClipping: boolean;
    premultipliedAlpha: boolean;
    scale: number;
    boneWidth: number;
    context: ManagedWebGLRenderingContext;
    bounds: SkeletonBounds;
    temp: any[];
    vertices: any[] | Float32Array<any>;
    draw(shapes: any, skeleton: any, ignoredBones: any): void;
    dispose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Loads skeleton data in the Spine JSON format.
 *
 * See [Spine JSON format](http://esotericsoftware.com/spine-json-format) and
 * [JSON and binary data](http://esotericsoftware.com/spine-loading-skeleton-data#JSON-and-binary-data) in the Spine
 * Runtimes Guide. */
declare class SkeletonJson {
    constructor(attachmentLoader: any);
    attachmentLoader: any;
    /** Scales bone positions, image sizes, and translations as they are loaded. This allows different size images to be used at
     * runtime than were used in Spine.
     *
     * See [Scaling](http://esotericsoftware.com/spine-loading-skeleton-data#Scaling) in the Spine Runtimes Guide. */
    scale: number;
    linkedMeshes: any[];
    readSkeletonData(json: any): SkeletonData;
    readAttachment(map: any, skin: any, slotIndex: any, name: any, skeletonData: any): any;
    readSequence(map: any): Sequence | null;
    readVertices(map: any, attachment: any, verticesLength: any): void;
    readAnimation(map: any, name: any, skeletonData: any): void;
}
declare class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: any, y: any): this;
    length(): number;
    normalize(): this;
}
/** Stores attachments by slot index and attachment name.
 *
 * See SkeletonData {@link SkeletonData#defaultSkin}, Skeleton {@link Skeleton#skin}, and
 * [Runtime skins](http://esotericsoftware.com/spine-runtime-skins) in the Spine Runtimes Guide. */
declare class Skin {
    constructor(name: any);
    /** The skin's name, which is unique across all skins in the skeleton. */
    name: any;
    attachments: any[];
    bones: any[];
    constraints: any[];
    /** The color of the skin as it was in Spine, or a default color if nonessential data was not exported. */
    color: Color;
    /** Adds an attachment to the skin for the specified slot index and name. */
    setAttachment(slotIndex: any, name: any, attachment: any): void;
    /** Adds all attachments, bones, and constraints from the specified skin to this skin. */
    addSkin(skin: any): void;
    /** Adds all bones and constraints and copies of all attachments from the specified skin to this skin. Mesh attachments are not
     * copied, instead a new linked mesh is created. The attachment copies can be modified without affecting the originals. */
    copySkin(skin: any): void;
    /** Returns the attachment for the specified slot index and name, or null. */
    getAttachment(slotIndex: any, name: any): any;
    /** Removes the attachment in the skin for the specified slot index and name, if any. */
    removeAttachment(slotIndex: any, name: any): void;
    /** Returns all attachments in this skin. */
    getAttachments(): any[];
    /** Returns all attachments in this skin for the specified slot index. */
    getAttachmentsForSlot(slotIndex: any, attachments: any): void;
    /** Clears all attachments, bones, and constraints. */
    clear(): void;
    /** Attach each attachment in this skin if the corresponding attachment in the old skin is currently attached. */
    attachAll(skeleton: any, oldSkin: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores an entry in the skin consisting of the slot index, name, and attachment **/
declare class SkinEntry {
    constructor(slotIndex: number | undefined, name: any, attachment: any);
    slotIndex: number;
    name: any;
    attachment: any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores a slot's current pose. Slots organize attachments for {@link Skeleton#drawOrder} purposes and provide a place to store
 * state for an attachment. State cannot be stored in an attachment itself because attachments are stateless and may be shared
 * across multiple skeletons. */
declare class Slot {
    constructor(data: any, bone: any);
    /** The slot's setup pose data. */
    data: any;
    /** The bone this slot belongs to. */
    bone: any;
    /** The color used to tint the slot's attachment. If {@link #getDarkColor()} is set, this is used as the light color for two
     * color tinting. */
    color: Color;
    /** The dark color used to tint the slot's attachment for two color tinting, or null if two color tinting is not used. The dark
     * color's alpha is not used. */
    darkColor: null;
    attachment: null;
    attachmentState: number;
    /** The index of the texture region to display when the slot's attachment has a {@link Sequence}. -1 represents the
     * {@link Sequence#getSetupIndex()}. */
    sequenceIndex: number;
    /** Values to deform the slot's attachment. For an unweighted mesh, the entries are local positions for each vertex. For a
     * weighted mesh, the entries are an offset for each vertex which will be added to the mesh's local vertex positions.
     *
     * See {@link VertexAttachment#computeWorldVertices()} and {@link DeformTimeline}. */
    deform: any[];
    /** The skeleton this slot belongs to. */
    getSkeleton(): any;
    /** The current attachment for the slot, or null if the slot has no attachment. */
    getAttachment(): null;
    /** Sets the slot's attachment and, if the attachment changed, resets {@link #sequenceIndex} and clears the {@link #deform}.
     * The deform is not cleared if the old attachment has the same {@link VertexAttachment#getTimelineAttachment()} as the
     * specified attachment. */
    setAttachment(attachment: any): void;
    /** Sets this slot to the setup pose. */
    setToSetupPose(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose for a {@link Slot}. */
declare class SlotData {
    constructor(index: any, name: any, boneData: any);
    /** The index of the slot in {@link Skeleton#getSlots()}. */
    index: number;
    /** The name of the slot, which is unique across all slots in the skeleton. */
    name: any;
    /** The bone this slot belongs to. */
    boneData: any;
    /** The color used to tint the slot's attachment. If {@link #getDarkColor()} is set, this is used as the light color for two
     * color tinting. */
    color: Color;
    /** The dark color used to tint the slot's attachment for two color tinting, or null if two color tinting is not used. The dark
     * color's alpha is not used. */
    darkColor: null;
    /** The name of the attachment that is visible for this slot in the setup pose, or null if no attachment is visible. */
    attachmentName: null;
    /** The blend mode for drawing the slot's attachment. */
    blendMode: any;
    /** False if the slot was hidden in Spine and nonessential data was exported. Does not affect runtime rendering. */
    visible: boolean;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Manages the life-cycle and WebGL context of a {@link SpineCanvasApp}. The app loads
 * assets and initializes itself, then updates and renders its state at the screen refresh rate. */
declare class SpineCanvas {
    /** Constructs a new spine canvas, rendering to the provided HTML canvas. */
    constructor(canvas: any, config: any);
    config: any;
    context: ManagedWebGLRenderingContext;
    /** Tracks the current time, delta, and other time related statistics. */
    time: TimeKeeper;
    /** The HTML canvas to render to. */
    htmlCanvas: any;
    /** The WebGL rendering context. */
    gl: any;
    /** The scene renderer for easy drawing of skeletons, shapes, and images. */
    renderer: SceneRenderer;
    /** The asset manager to load assets with. */
    assetManager: {
        pathPrefix: string;
        textureLoader: any;
        downloader: Downloader;
        cache: AssetCache;
        errors: {};
        toLoad: number;
        loaded: number;
        start(path: any): string;
        success(callback: any, path: any, asset: any): void;
        error(callback: any, path: any, message: any): void;
        loadAll(): Promise<any>;
        setRawDataURI(path: any, data: any): void;
        loadBinary(path: any, success?: () => void, error?: () => void): void;
        loadText(path: any, success?: () => void, error?: () => void): void;
        loadJson(path: any, success?: () => void, error?: () => void): void;
        reuseAssets(path: any, success?: () => void, error?: () => void): boolean;
        loadTexture(path: any, success?: () => void, error?: () => void): void;
        loadTextureAtlas(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadTextureAtlasButNoTextures(path: any, success: () => void, error: () => void, fileAlias: any): void;
        loadBinaryAsync(path: any): Promise<any>;
        loadJsonAsync(path: any): Promise<any>;
        loadTextureAsync(path: any): Promise<any>;
        loadTextureAtlasAsync(path: any): Promise<any>;
        loadTextureAtlasButNoTexturesAsync(path: any): Promise<any>;
        setCache(cache: any): void;
        get(path: any): any;
        require(path: any): any;
        remove(path: any): any;
        removeAll(): void;
        isLoadingComplete(): boolean;
        getToLoad(): number;
        getLoaded(): number;
        dispose(): void;
        disposeAsset(path: any): void;
        hasErrors(): boolean;
        getErrors(): {};
    };
    /** The input processor used to listen to mouse, touch, and keyboard events. */
    input: Input;
    disposed: boolean;
    /** Clears the canvas with the given color. The color values are given in the range [0,1]. */
    clear(r: any, g: any, b: any, a: any): void;
    /** Disposes the app, so the update() and render() functions are no longer called. Calls the dispose() callback.*/
    dispose(): void;
}
declare class StringSet {
    entries: {};
    size: number;
    add(value: any): boolean;
    addAll(values: any): boolean;
    contains(value: any): any;
    clear(): void;
}
declare class TexCoordAttribute extends VertexAttribute {
    constructor(unit?: number);
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Texture {
    constructor(image: any);
    _image: any;
    getImage(): any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class TextureAtlas {
    constructor(atlasText: any);
    pages: any[];
    regions: any[];
    findRegion(name: any): any;
    setTextures(assetManager: any, pathPrefix?: string): void;
    dispose(): void;
}
declare class TextureAtlasPage {
    constructor(name: any);
    name: any;
    minFilter: any;
    magFilter: any;
    uWrap: any;
    vWrap: any;
    texture: null;
    width: number;
    height: number;
    pma: boolean;
    regions: any[];
    setTexture(texture: any): void;
}
declare class TextureAtlasRegion extends TextureRegion {
    constructor(page: any, name: any);
    page: any;
    name: any;
    x: number;
    y: number;
    index: number;
    names: null;
    values: null;
}
declare class TextureRegion {
    texture: any;
    u: number;
    v: number;
    u2: number;
    v2: number;
    width: number;
    height: number;
    degrees: number;
    offsetX: number;
    offsetY: number;
    originalWidth: number;
    originalHeight: number;
}
declare class TimeKeeper {
    maxDelta: number;
    framesPerSecond: number;
    delta: number;
    totalTime: number;
    lastTime: number;
    frameCount: number;
    frameTime: number;
    update(): void;
}
/** The interface for all timelines. */
declare class Timeline {
    static search1(frames: any, time: any): number;
    static search(frames: any, time: any, step: any): number;
    constructor(frameCount: any, propertyIds: any);
    propertyIds: any;
    frames: any[] | Float32Array<any>;
    getPropertyIds(): any;
    getFrameEntries(): number;
    getFrameCount(): number;
    getDuration(): any;
}
declare class Touch {
    constructor(identifier: any, x: any, y: any);
    identifier: any;
    x: any;
    y: any;
}
/** Stores settings and other state for the playback of an animation on an {@link AnimationState} track.
 *
 * References to a track entry must not be kept after the {@link AnimationStateListener#dispose()} event occurs. */
declare class TrackEntry {
    /** The animation to apply for this track entry. */
    animation: null;
    previous: null;
    /** The animation queued to start after this animation, or null. `next` makes up a linked list. */
    next: null;
    /** The track entry for the previous animation when mixing from the previous animation to this animation, or null if no
     * mixing is currently occuring. When mixing from multiple animations, `mixingFrom` makes up a linked list. */
    mixingFrom: null;
    /** The track entry for the next animation when mixing from this animation to the next animation, or null if no mixing is
     * currently occuring. When mixing to multiple animations, `mixingTo` makes up a linked list. */
    mixingTo: null;
    /** The listener for events generated by this track entry, or null.
     *
     * A track entry returned from {@link AnimationState#setAnimation()} is already the current animation
     * for the track, so the track entry listener {@link AnimationStateListener#start()} will not be called. */
    listener: null;
    /** The index of the track where this track entry is either current or queued.
     *
     * See {@link AnimationState#getCurrent()}. */
    trackIndex: number;
    /** If true, the animation will repeat. If false it will not, instead its last frame is applied if played beyond its
     * duration. */
    loop: boolean;
    /** If true, when mixing from the previous animation to this animation, the previous animation is applied as normal instead
     * of being mixed out.
     *
     * When mixing between animations that key the same property, if a lower track also keys that property then the value will
     * briefly dip toward the lower track value during the mix. This happens because the first animation mixes from 100% to 0%
     * while the second animation mixes from 0% to 100%. Setting `holdPrevious` to true applies the first animation
     * at 100% during the mix so the lower track value is overwritten. Such dipping does not occur on the lowest track which
     * keys the property, only when a higher track also keys the property.
     *
     * Snapping will occur if `holdPrevious` is true and this animation does not key all the same properties as the
     * previous animation. */
    holdPrevious: boolean;
    reverse: boolean;
    shortestRotation: boolean;
    /** When the mix percentage ({@link #mixTime} / {@link #mixDuration}) is less than the
     * `eventThreshold`, event timelines are applied while this animation is being mixed out. Defaults to 0, so event
     * timelines are not applied while this animation is being mixed out. */
    eventThreshold: number;
    /** When the mix percentage ({@link #mixtime} / {@link #mixDuration}) is less than the
     * `attachmentThreshold`, attachment timelines are applied while this animation is being mixed out. Defaults to
     * 0, so attachment timelines are not applied while this animation is being mixed out. */
    mixAttachmentThreshold: number;
    /** When {@link #getAlpha()} is greater than <code>alphaAttachmentThreshold</code>, attachment timelines are applied.
     * Defaults to 0, so attachment timelines are always applied. */
    alphaAttachmentThreshold: number;
    /** When the mix percentage ({@link #getMixTime()} / {@link #getMixDuration()}) is less than the
     * <code>mixDrawOrderThreshold</code>, draw order timelines are applied while this animation is being mixed out. Defaults to
     * 0, so draw order timelines are not applied while this animation is being mixed out. */
    mixDrawOrderThreshold: number;
    /** Seconds when this animation starts, both initially and after looping. Defaults to 0.
     *
     * When changing the `animationStart` time, it often makes sense to set {@link #animationLast} to the same
     * value to prevent timeline keys before the start time from triggering. */
    animationStart: number;
    /** Seconds for the last frame of this animation. Non-looping animations won't play past this time. Looping animations will
     * loop back to {@link #animationStart} at this time. Defaults to the animation {@link Animation#duration}. */
    animationEnd: number;
    /** The time in seconds this animation was last applied. Some timelines use this for one-time triggers. Eg, when this
     * animation is applied, event timelines will fire all events between the `animationLast` time (exclusive) and
     * `animationTime` (inclusive). Defaults to -1 to ensure triggers on frame 0 happen the first time this animation
     * is applied. */
    animationLast: number;
    nextAnimationLast: number;
    /** Seconds to postpone playing the animation. When this track entry is the current track entry, `delay`
     * postpones incrementing the {@link #trackTime}. When this track entry is queued, `delay` is the time from
     * the start of the previous animation to when this track entry will become the current track entry (ie when the previous
     * track entry {@link TrackEntry#trackTime} >= this track entry's `delay`).
     *
     * {@link #timeScale} affects the delay. */
    delay: number;
    /** Current time in seconds this track entry has been the current track entry. The track time determines
     * {@link #animationTime}. The track time can be set to start the animation at a time other than 0, without affecting
     * looping. */
    trackTime: number;
    trackLast: number;
    nextTrackLast: number;
    /** The track time in seconds when this animation will be removed from the track. Defaults to the highest possible float
     * value, meaning the animation will be applied until a new animation is set or the track is cleared. If the track end time
     * is reached, no other animations are queued for playback, and mixing from any previous animations is complete, then the
     * properties keyed by the animation are set to the setup pose and the track is cleared.
     *
     * It may be desired to use {@link AnimationState#addEmptyAnimation()} rather than have the animation
     * abruptly cease being applied. */
    trackEnd: number;
    /** Multiplier for the delta time when this track entry is updated, causing time for this animation to pass slower or
     * faster. Defaults to 1.
     *
     * {@link #mixTime} is not affected by track entry time scale, so {@link #mixDuration} may need to be adjusted to
     * match the animation speed.
     *
     * When using {@link AnimationState#addAnimation()} with a `delay` <= 0, note the
     * {@link #delay} is set using the mix duration from the {@link AnimationStateData}, assuming time scale to be 1. If
     * the time scale is not 1, the delay may need to be adjusted.
     *
     * See AnimationState {@link AnimationState#timeScale} for affecting all animations. */
    timeScale: number;
    /** Values < 1 mix this animation with the skeleton's current pose (usually the pose resulting from lower tracks). Defaults
     * to 1, which overwrites the skeleton's current pose with this animation.
     *
     * Typically track 0 is used to completely pose the skeleton, then alpha is used on higher tracks. It doesn't make sense to
     * use alpha on track 0 if the skeleton pose is from the last frame render. */
    alpha: number;
    /** Seconds from 0 to the {@link #getMixDuration()} when mixing from the previous animation to this animation. May be
     * slightly more than `mixDuration` when the mix is complete. */
    mixTime: number;
    /** Seconds for mixing from the previous animation to this animation. Defaults to the value provided by AnimationStateData
     * {@link AnimationStateData#getMix()} based on the animation before this animation (if any).
     *
     * A mix duration of 0 still mixes out over one frame to provide the track entry being mixed out a chance to revert the
     * properties it was animating.
     *
     * The `mixDuration` can be set manually rather than use the value from
     * {@link AnimationStateData#getMix()}. In that case, the `mixDuration` can be set for a new
     * track entry only before {@link AnimationState#update(float)} is first called.
     *
     * When using {@link AnimationState#addAnimation()} with a `delay` <= 0, note the
     * {@link #delay} is set using the mix duration from the {@link AnimationStateData}, not a mix duration set
     * afterward. */
    _mixDuration: number;
    interruptAlpha: number;
    totalAlpha: number;
    set mixDuration(mixDuration: number);
    get mixDuration(): number;
    setMixDurationWithDelay(mixDuration: any, delay: any): void;
    /** Controls how properties keyed in the animation are mixed with lower tracks. Defaults to {@link MixBlend#replace}, which
     * replaces the values from the lower tracks with the animation values. {@link MixBlend#add} adds the animation values to
     * the values from the lower tracks.
     *
     * The `mixBlend` can be set for a new track entry only before {@link AnimationState#apply()} is first
     * called. */
    mixBlend: any;
    timelineMode: any[];
    timelineHoldMix: any[];
    timelinesRotation: any[];
    reset(): void;
    /** Uses {@link #trackTime} to compute the `animationTime`, which is between {@link #animationStart}
     * and {@link #animationEnd}. When the `trackTime` is 0, the `animationTime` is equal to the
     * `animationStart` time. */
    getAnimationTime(): number;
    setAnimationLast(animationLast: any): void;
    /** Returns true if at least one loop has been completed.
     *
     * See {@link AnimationStateListener#complete()}. */
    isComplete(): boolean;
    /** Resets the rotation directions for mixing this entry's rotate timelines. This can be useful to avoid bones rotating the
     * long way around when using {@link #alpha} and starting animations on other tracks.
     *
     * Mixing with {@link MixBlend#replace} involves finding a rotation between two others, which has two possible solutions:
     * the short way or the long way around. The two rotations likely change over time, so which direction is the short or long
     * way also changes. If the short way was always chosen, bones would flip to the other side when that direction became the
     * long way. TrackEntry chooses the short way the first time it is applied and remembers that direction. */
    resetRotationDirections(): void;
    getTrackComplete(): number;
    /** Returns true if this track entry has been applied at least once.
     * <p>
     * See {@link AnimationState#apply(Skeleton)}. */
    wasApplied(): boolean;
    /** Returns true if there is a {@link #getNext()} track entry and it will become the current track entry during the next
     * {@link AnimationState#update(float)}. */
    isNextReady(): boolean;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the current pose for a transform constraint. A transform constraint adjusts the world transform of the constrained
 * bones to match that of the target bone.
 *
 * See [Transform constraints](http://esotericsoftware.com/spine-transform-constraints) in the Spine User Guide. */
declare class TransformConstraint {
    constructor(data: any, skeleton: any);
    /** The transform constraint's setup pose data. */
    data: any;
    /** The bones that will be modified by this transform constraint. */
    bones: any[];
    /** The target bone whose world transform will be copied to the constrained bones. */
    target: any;
    mixRotate: number;
    mixX: number;
    mixY: number;
    mixScaleX: number;
    mixScaleY: number;
    mixShearY: number;
    temp: Vector2;
    active: boolean;
    isActive(): boolean;
    setToSetupPose(): void;
    update(physics: any): void;
    applyAbsoluteWorld(): void;
    applyRelativeWorld(): void;
    applyAbsoluteLocal(): void;
    applyRelativeLocal(): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
/** Stores the setup pose for a {@link TransformConstraint}.
 *
 * See [Transform constraints](http://esotericsoftware.com/spine-transform-constraints) in the Spine User Guide. */
declare class TransformConstraintData extends ConstraintData {
    constructor(name: any);
    /** The bones that will be modified by this transform constraint. */
    bones: any[];
    /** The target bone whose world transform will be copied to the constrained bones. */
    _target: null;
    set target(boneData: never);
    get target(): never;
    mixRotate: number;
    mixX: number;
    mixY: number;
    mixScaleX: number;
    mixScaleY: number;
    mixShearY: number;
    /** An offset added to the constrained bone rotation. */
    offsetRotation: number;
    /** An offset added to the constrained bone X translation. */
    offsetX: number;
    /** An offset added to the constrained bone Y translation. */
    offsetY: number;
    /** An offset added to the constrained bone scaleX. */
    offsetScaleX: number;
    /** An offset added to the constrained bone scaleY. */
    offsetScaleY: number;
    /** An offset added to the constrained bone shearY. */
    offsetShearY: number;
    relative: boolean;
    local: boolean;
}
/** Changes a transform constraint's {@link TransformConstraint#rotateMix}, {@link TransformConstraint#translateMix},
 * {@link TransformConstraint#scaleMix}, and {@link TransformConstraint#shearMix}. */
declare class TransformConstraintTimeline extends CurveTimeline {
    /** The index of the transform constraint slot in {@link Skeleton#transformConstraints} that will be changed. */
    constraintIndex: number;
    /** The time in seconds, rotate mix, translate mix, scale mix, and shear mix for the specified key frame. */
    setFrame(frame: any, time: any, mixRotate: any, mixX: any, mixY: any, mixScaleX: any, mixScaleY: any, mixShearY: any): void;
    apply(skeleton: any, lastTime: any, time: any, firedEvents: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#x} and {@link Bone#y}. */
declare class TranslateTimeline extends CurveTimeline2 {
    constructor(frameCount: any, bezierCount: any, boneIndex: any);
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#x}. */
declare class TranslateXTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/** Changes a bone's local {@link Bone#x}. */
declare class TranslateYTimeline extends CurveTimeline1 {
    boneIndex: number;
    apply(skeleton: any, lastTime: any, time: any, events: any, alpha: any, blend: any, direction: any): void;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Triangulator {
    static isConcave(index: any, vertexCount: any, vertices: any, indices: any): boolean;
    static positiveArea(p1x: any, p1y: any, p2x: any, p2y: any, p3x: any, p3y: any): boolean;
    static winding(p1x: any, p1y: any, p2x: any, p2y: any, p3x: any, p3y: any): 1 | -1;
    convexPolygons: any[];
    convexPolygonsIndices: any[];
    indicesArray: any[];
    isConcaveArray: any[];
    triangles: any[];
    polygonPool: Pool;
    polygonIndicesPool: Pool;
    triangulate(verticesArray: any): any[];
    decompose(verticesArray: any, triangles: any): any[];
}
declare class Utils {
    static SUPPORTS_TYPED_ARRAYS: boolean;
    static arrayCopy(source: any, sourceStart: any, dest: any, destStart: any, numElements: any): void;
    static arrayFill(array: any, fromIndex: any, toIndex: any, value: any): void;
    static setArraySize(array: any, size: any, value?: number): any;
    static ensureArrayCapacity(array: any, size: any, value?: number): any;
    static newArray(size: any, defaultValue: any): any[];
    static newFloatArray(size: any): any[] | Float32Array<any>;
    static newShortArray(size: any): any[] | Int16Array<any>;
    static toFloatArray(array: any): any;
    static toSinglePrecision(value: any): any;
    static webkit602BugfixHelper(alpha: any, blend: any): void;
    static contains(array: any, element: any, identity?: boolean): boolean;
    static enumValue(type: any, name: any): any;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    setFrom(v: any): this;
    set(x: any, y: any, z: any): this;
    add(v: any): this;
    sub(v: any): this;
    scale(s: any): this;
    normalize(): this;
    cross(v: any): this;
    multiply(matrix: any): this;
    project(matrix: any): this;
    dot(v: any): number;
    length(): number;
    distance(v: any): number;
}
/** Base class for an attachment with vertices that are transformed by one or more bones and can be deformed by a slot's
 * {@link Slot#deform}. */
declare class VertexAttachment extends Attachment {
    static nextID: number;
    /** The unique ID for this attachment. */
    id: number;
    /** The bones which affect the {@link #getVertices()}. The array entries are, for each vertex, the number of bones affecting
     * the vertex followed by that many bone indices, which is the index of the bone in {@link Skeleton#bones}. Will be null
     * if this attachment has no weights. */
    bones: null;
    /** The vertex positions in the bone's coordinate system. For a non-weighted attachment, the values are `x,y`
     * entries for each vertex. For a weighted attachment, the values are `x,y,weight` entries for each bone affecting
     * each vertex. */
    vertices: any[];
    /** The maximum number of world vertex values that can be output by
     * {@link #computeWorldVertices()} using the `count` parameter. */
    worldVerticesLength: number;
    /** Timelines for the timeline attachment are also applied to this attachment.
     * May be null if no attachment-specific timelines should be applied. */
    timelineAttachment: this;
    /** Transforms the attachment's local {@link #vertices} to world coordinates. If the slot's {@link Slot#deform} is
     * not empty, it is used to deform the vertices.
     *
     * See [World transforms](http://esotericsoftware.com/spine-runtime-skeletons#World-transforms) in the Spine
     * Runtimes Guide.
     * @param start The index of the first {@link #vertices} value to transform. Each vertex has 2 values, x and y.
     * @param count The number of world vertex values to output. Must be <= {@link #worldVerticesLength} - `start`.
     * @param worldVertices The output world vertices. Must have a length >= `offset` + `count` *
     *           `stride` / 2.
     * @param offset The `worldVertices` index to begin writing values.
     * @param stride The number of `worldVertices` entries between the value pairs written. */
    computeWorldVertices(slot: any, start: any, count: any, worldVertices: any, offset: any, stride: any): void;
    /** Does not copy id (generated) or name (set on construction). **/
    copyTo(attachment: any): void;
}
declare class VertexAttribute {
    constructor(name: any, type: any, numElements: any);
    name: any;
    type: any;
    numElements: any;
}
declare class WindowedMean {
    constructor(windowSize?: number);
    values: any[];
    addedValues: number;
    lastValue: number;
    mean: number;
    dirty: boolean;
    hasEnoughData(): boolean;
    addValue(value: any): void;
    getMean(): number;
}
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class CanvasTexture extends Texture {
    setFilters(minFilter: any, magFilter: any): void;
    setWraps(uWrap: any, vWrap: any): void;
    dispose(): void;
}
declare class SkeletonRenderer {
    constructor(runtime: any);
    skeletonRenderer: any;
    runtime: any;
    tintColor: Color$1;
    tempColor: Color$1;
    debugRendering: boolean;
    clipper: SkeletonClipping;
    clippingVertices: any[];
    clippingMask: Polygon;
    draw(renderer: any, skeleton: any): void;
    drawTriangle(renderer: any, img: any, x0: any, y0: any, u0: any, v0: any, x1: any, y1: any, u1: any, v1: any, x2: any, y2: any, u2: any, v2: any): void;
    computeMeshVertices(slot: any, mesh: any, pma: boolean | undefined, vertexSize: any): void;
}
import { Vector2d } from 'melonjs';
/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated April 5, 2025. Replaces all prior versions.
 *
 * Copyright (c) 2013-2025, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/
declare class Sequence {
    static _nextID: number;
    static nextID(): number;
    constructor(count: any);
    id: number;
    regions: any[];
    start: number;
    digits: number;
    /** The index of the region to show for the setup pose. */
    setupIndex: number;
    copy(): Sequence;
    apply(slot: any, attachment: any): void;
    getPath(basePath: any, index: any): any;
}
declare class Vertices {
    constructor(bones?: null, vertices?: null, length?: number);
    bones: any;
    vertices: any;
    length: number;
}
import { Color as Color$1 } from 'melonjs';
import { Polygon } from 'melonjs';
export { Spine as default };
