// Type definitions for melonJS
// Project: http://melonjs.org/
// Definitions by: Kamil Rojewski <kamil.rojewski@gmail.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// All comments taken directly from melonJS.

declare namespace me {
    interface FunctionDictionary {
        [key: string]: (...arg: any[]) => any;
    }

    interface ObjectStatic {
        extend(...mixins: Array<Object|FunctionDictionary>): ObjectStatic;
    }

    interface ErrorClass {
        name: string;
        message: string;
    }

    interface ErrorStatic extends ObjectStatic {
        new (message: string): ErrorClass;

        extend(...mixins: Array<Object|FunctionDictionary>): ErrorStatic;
    }

    interface ScreenObjectClass {
        onDestroyEvent(...args: any[]): any;
        onResetEvent(...args: any[]): any;
    }

    interface ScreenObjectStatic extends ObjectStatic {
        new (): ScreenObjectClass;

        extend(...mixins: Array<Object|FunctionDictionary>): ScreenObjectStatic;
    }

    interface Vector2dErrorClass extends ErrorClass {
    }

    interface Vector2dErrorStatic extends ErrorStatic {
        new (msg: string): Vector2dErrorClass;

        extend(...mixins: Array<Object|FunctionDictionary>): Vector2dErrorStatic;
    }

    interface Vector2dClass {
        x: number;
        y: number;

        /**
         * Update this vector values to absolute values 
         */
        abs(): Vector2dClass;

        /**
         * set the Vector x and y properties to the given values
         */
        set(x: number, y: number): Vector2dClass;

        /**
         * set the Vector x and y properties to 0
         */
        setZero(): Vector2dClass;

        /**
         * set the Vector x and y properties using the passed vector
         */
        setV(v: Vector2dClass): Vector2dClass;

        /**
         * Add the passed vector to this vector
         */
        add(v: Vector2dClass): Vector2dClass;

        /**
         * Substract the passed vector to this vector
         */
        sub(v: Vector2dClass): Vector2dClass;

        /**
         * Multiply this vector values by the given scalar
         */
        scale(x: number, y?: number): Vector2dClass;

        /**
         * Multiply this vector values by the passed vector
         */
        scaleV(v: Vector2dClass): Vector2dClass;

        /**
         * Divide this vector values by the passed value
         */
        div(n: number): Vector2dClass;

        /**
         * Clamp the vector value within the specified value range
         */
        clamp(low: number, high: number): Vector2dClass;

        /**
         * Clamp this vector value within the specified value range
         */
        clampSelf(low: number, high: number): Vector2dClass;

        /**
         * Update this vector with the minimum value between this and the passed vector
         */
        minV(v: Vector2dClass): Vector2dClass;

        /**
         * Update this vector with the maximum value between this and the passed vector
         */
        maxV(v: Vector2dClass): Vector2dClass;

        /**
         * Floor the vector values
         */
        floor(): Vector2dClass;

        /**
         * Floor this vector values
         */
        floorSelf(): Vector2dClass;

        /**
         * Ceil the vector values
         */
        ceil(): Vector2dClass;

        /**
         * Ceil this vector values
         */
        ceilSelf(): Vector2dClass;

        /**
         * Negate the vector values
         */
        negate(): Vector2dClass;

        /**
         * Negate this vector values
         */
        negateSelf(): Vector2dClass;

        /**
         * Copy the x,y values of the passed vector to this one
         */
        copy(v: Vector2dClass): Vector2dClass;

        /**
         * return true if the two vectors are the same
         */
        equals(v: Vector2dClass): Vector2dClass;

        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         */
        normalize(): Vector2dClass;

        /**
         * Change this vector to be perpendicular to what it was before.
         * (Effectively rotates it 90 degrees in a clockwise direction)
         */
        perp(): Vector2dClass;

        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         */
        rotate(angle: number): Vector2dClass;

        /**
         * return the dot product of this vector and the passed one
         */
        dotProduct(v: Vector2dClass): number;

        /**
         * return the square length of this vector
         */
        length2(): number;

        /**
         * return the length (magnitude) of this vector
         */
        length(): number;

        /**
         * return the distance between this vector and the passed one
         */
        distance(v: Vector2dClass): number;

        /**
         * return the angle between this vector and the passed one
         */
        angle(v: Vector2dClass): number;

        /**
         * Project this vector on to another vector.
         */
        project(v: Vector2dClass): Vector2dClass;

        /**
         * Project this vector onto a vector of unit length.
         * This is slightly more efficient than `project` when dealing with unit vectors.
         */
        projectN(v: Vector2dClass): Vector2dClass;

        /**
         * return a clone copy of this vector
         */
        clone(): Vector2dClass;

        /**
         * convert the object to a string representation
         */
        toString(): string;
    }

    interface Vector2dStatic {
        Error: Vector2dErrorStatic;

        new (x?: number, y?: number): Vector2dClass;
    }

    interface ColorErrorClass extends ErrorClass {
    }

    interface ColorErrorStatic extends ErrorStatic {
        new (msg: string): ColorErrorClass;

        extend(...mixins: Array<Object|FunctionDictionary>): ColorErrorStatic;
    }

    interface ColorClass {
        r: number;
        g: number;
        b: number;
        alpha: number;
        glArray: Float32Array;

        /**
         * Set this color to the specified value.
         * 
         * @param r red component [0 .. 255]
         * @param g green component [0 .. 255]
         * @param b blue component [0 .. 255]
         * @param alpha value [0.0 .. 1.0]
         */
        setColor(r: number|ColorClass, g?: number, b?: number, alpha?: number): ColorClass;

        /**
         * Create a new copy of this color object.
         */
        clone(): ColorClass;

        /**
         * Copy a color object or CSS color into this one.
         */
        copy(color: ColorClass|string): ColorClass;

        /**
         * Blend this color with the given one using addition.
         */
        add(color: ColorClass): ColorClass;

        /**
         * Darken this color value by 0..1
         */
        darken(scale: number): ColorClass;

        /**
         * Lighten this color value by 0..1
         */
        lighten(scale: number): ColorClass;

        /**
         * Generate random r,g,b values for this color object
         */
        random(): ColorClass;

        /**
         * Return true if the r,g,b,a values of this color are equal with the given one.
         */
        equals(color: ColorClass): boolean;

        /**
         * Parse a CSS color string and set this color to the corresponding r,g,b values.
         */
        parseCSS(color: string): ColorClass;

        /**
         * Parse an RGB or RGBA CSS color string
         */
        parseRGB(color: string): ColorClass;

        /**
         * Parse a Hex color ("#RGB", "#RGBA" or "#RRGGBB", "#RRGGBBAA" format) and set this color to
         * the corresponding r,g,b,a values
         */
        parseHex(color: string): ColorClass;

        /**
         * Get the color in "#RRGGBB" format
         */
        toHex(): string;

        /**
         * Get the color in "#RRGGBBAA" format
         */
        toHex8(): string;

        /**
         * Get the color in "rgb(R,G,B)" format
         */
        toRGB(): string;

        /**
         * Get the color in "rgba(R,G,B,A)" format
         */
        toRGBA(): string;
    }

    interface ColorStatic extends ObjectStatic {
        new (r?: number|Float32Array, g?: number, b?: number, alpha?: number): ColorClass;

        extend(...mixins: Array<Object|FunctionDictionary>): ColorStatic;
    }

    interface TMXPropertiesXml {
        [name: string]: any;
    }

    interface TMXVectorXml {
        x: number;
        y: number;
    }

    interface TMXImageXml {
        format: string;
        id?: number;
        source: string;
        trans?: string;
        width: number;
        height: number;
        data?: string;
        encoding?: string;
    }

    interface TMXFrameXml {
        tileid: number;
        duration: number;
    }

    interface TMXTerrainXml {
        name: string;
        tile: number;
        properties?: TMXPropertiesXml;
    }

    interface TMXTerrainTypesXml {
        terrain?: TMXTerrainXml[];
    }

    interface TMXEllipseXml {
    }

    interface TMXObjectXml {
        id: number;
        name: string;
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        rotation?: number;
        gid?: number;
        visible?: number;
        properties?: TMXPropertiesXml;
        ellipse?: TMXEllipseXml;
        polygon?: TMXVectorXml[];
        polyline?: TMXVectorXml[];
    }

    interface TMXGenericLayerXml {
        name: string;
        type: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        opacity?: number;
        visible?: number;
        offsetx?: number;
        offsety?: number;
        properties?: TMXPropertiesXml;
    }

    interface TMXLayerXml extends TMXGenericLayerXml {
        data?: string;
        encoding?: string;
    }

    interface TMXImageLayerXml extends TMXGenericLayerXml {
        image?: string;
    }

    interface TMXObjectGroupXml extends TMXGenericLayerXml {
        color: string;
        draworder: 'index'|'topdown';
        objects?: TMXObjectXml[];
    }

    interface TMXTileXml {
        id: number;
        terrain?: string;
        probability?: number;
        properties?: TMXPropertiesXml;
        image?: TMXImageXml;
        layers?: TMXObjectGroupXml[];
        animation?: TMXFrameXml[];
    }

    interface TMXTilesetXml {
        firstgid: number;
        source?: string;
        name: string;
        tilewidth: number;
        tileheight: number;
        spacing: number;
        margin: number;
        tileoffset: {
            x: number;
            y: number;
        };
        image?: string;
        imagewidth?: number;
        imageheight?: number;
        tiles: {
            [id: number]: TMXTileXml;
        }
        tilecount?: number;
        columns?: number;
        properties?: TMXPropertiesXml;
        terraintypes?: TMXTerrainTypesXml;
    }

    interface TMXXml {
        version: string;
        tilesets?: TMXTilesetXml[];
        text?: string;
        orientation: 'orthogonal'|'isometric'|'staggered'|'hexagonal';
        renderorder?: 'right-down'|'right-up'|'left-down'|'left-up';
        width: number;
        height: number;
        tilewidth: number;
        tileheight: number;
        hexsidelength?: number;
        staggeraxis?: 'x'|'y';
        staggerindex?: 'even'|'odd';
        backgroundcolor?: string;
        nextobjectid?: number;
    }

    interface TileClass extends RectClass {
        flipped: boolean;
        flippedAD: boolean;
        flippedY: boolean;
        flipX: boolean;
        tileId: number;
        tileset: TMXTilesetClass;

        /**
         * return a renderable object for this Tile object
         */
        getRenderable(settings: SpriteOptions): RenderableClass;
    }

    interface TileStatic extends RectStatic {
        new (x: number, y: number, gid: number, tileset: TMXTilesetClass): TileClass;
        extend(...mixins: Array<Object|FunctionDictionary>): TileStatic;
    }

    interface TMXTilesetErrorClass extends ErrorClass {
    }

    interface TMXTilesetErrorStatic extends ErrorStatic {
        new (msg: string): TMXTilesetErrorClass;
    }

    interface TMXTilesetClass {
        firstgid: number;
        lastgid: number;
        source?: string;
        name: string;
        tilewidth: number;
        tileheight: number;
        spacing: number;
        margin: number;
        tileoffset: Vector2dClass;
        isAnimated: boolean;
        animations: {
            [key: string]: any;
        };
        image: HTMLImageElement;

        /**
         * return true if the gid belongs to the tileset
         */
        contains(gid: number): boolean;

        /**
         * Get the view (local) tile ID from a GID, with animations applied
         * 
         * @param gid Global tile ID
         */
        getViewTileId(gid: number): number;

        /**
         * return the properties of the specified tile
         */
        getTileProperties(tileId: number): Object;
    }

    interface TMXTilesetStatic extends ObjectStatic {
        Error: TMXTilesetErrorStatic;

        new (tileset: Object): TMXTilesetClass;
        extend(...mixins: Array<Object|FunctionDictionary>): TMXTilesetStatic;
    }

    interface TMXTilesetGroupClass {
        /**
         * return the tileset corresponding to the specified id
         * will throw an exception if no matching tileset is found
         */
        getTilesetByGid(gid: number): TMXTilesetClass;
    }

    interface TMXTilesetGroupStatic {
        new (): TMXTilesetGroupClass;
    }

    interface  TMXLayerClass extends RenderableClass {
        alpha: number;
        ancestor: ContainerClass;
        isAnimated: boolean;
        tilesets: TMXTilesetGroupClass;

        /**
         * Return the TileId of the Tile at the specified position
         * 
         * @param x X coordinate (in world/pixels coordinates)
         * @param y Y coordinate (in world/pixels coordinates)
         */
        getTileId(x: number, y: number): number;

        /**
         * Return the Tile object at the specified position
         * 
         * @param x X coordinate (in world/pixels coordinates)
         * @param y Y coordinate (in world/pixels coordinates)
         */
        getTile(x: number, y: number): TileClass;

        /**
         * Create a new Tile at the specified position
         * 
         * @param x X coordinate (in map coordinates: row/column)
         * @param y Y coordinate (in map coordinates: row/column)
         * @param tileId tileId
         */
        setTile(x: number, y: number, tileId: number): TileClass;

        /**
         * clear the tile at the specified position
         * 
         * @param x X coordinate (in map coordinates: row/column)
         * @param y Y coordinate (in map coordinates: row/column)
         */
        clearTile(x: number, y: number): void;
    }

    interface  TMXLayerStatic extends  RenderableStatic {
        new (tilewidth: number, tileheight: number, orientation: 'isometric'|'orthogonal', tilesets: TMXTilesetGroupClass, z: number): TMXLayerClass;
        extend(...mixins: Array<Object|FunctionDictionary>): TMXLayerStatic;
    }

    interface TMXTileMapClass {
        cols: number;
        rows: number;
        tileheight: number;
        tilewidth: number;

        /**
         * add all the map layers and objects to the given container
         * 
         * @param container target container
         * @param flatten if true, flatten all objects into the given container
         */
        addTo(container: ContainerClass, flatten: boolean): void;

        /**
         * return an Array of instantiated objects, based on the map object definition
         * 
         * @param flatten if true, flatten all objects into the returned array, ignoring all defined groups (no sub containers will be created)
         */
        getObjects(flatten: boolean): RenderableClass[];

        /**
         * return all the existing layers
         */
        getLayers(): TMXLayerClass[];

        /**
         * destroy function, clean all allocated objects
         */
        destroy(): void;
    }

    interface TMXTileMapStatic extends ObjectStatic {
        new (levelId: string, data: TMXXml): TMXTileMapClass;
        extend(...mixins: Array<Object|FunctionDictionary>): TMXTileMapStatic;
    }

    interface Resource {
        name: string;
        type: string;
        src: string;
        stream?: boolean;
    }

    interface OnLoadCallback {
        (): any;
    }

    interface OnErrorCallback {
        (): any;
    }

    interface OnProgressCallback {
        (progress: number, resource: Resource): any;
    }

    interface Matrix2dClass {
        /**
         * reset the transformation matrix to the identity matrix (no transformation)
         */
        identity(): Matrix2dClass;

        /**
         * set the matrix to the specified value
         */
        setTransform(a1: number, a2: number, a3: number, a4: number, a5: number, a6: number): Matrix2dClass;

        /**
         * set the matrix to the specified value
         */
        setTransform(a1: number, a2: number, a3: number, a4: number, a5: number, a6: number, a7: number, a8: number, a9: number): Matrix2dClass;

        /**
         * Copies over the values from another me.Matrix2d.
         */
        copy(m: Matrix2dClass): Matrix2dClass;

        /**
         * multiply both matrix
         */
        multiply(m: Matrix2dClass): Matrix2dClass;

        /**
         * Transforms the given vector according to this matrix.
         */
        multiplyVector(v: Vector2dClass): Vector2dClass;

        /**
         * scale the matrix
         */
        scale(x: number, y: number): Matrix2dClass;

        /**
         * adds a 2D scaling transformation
         */
        scaleV(v: Vector2dClass): Matrix2dClass;

        /**
         * specifies a 2D scale operation using the [sx, 1] scaling vector
         */
        scaleX(x: number): Matrix2dClass;

        /**
         * specifies a 2D scale operation using the [1,sy] scaling vector
         */
        scaleY(y: number): Matrix2dClass;

        /**
         * rotate the matrix (counter-clockwise) by the specified angle (in radians)
         */
        rotate(angle: number): Matrix2dClass;

        /**
         * translate the matrix position on the horizontal and vertical axis
         */
        translate(x: number, y: number): Matrix2dClass;

        /**
         * translate the matrix by a vector on the horizontal and vertical axis
         */
        translateV(v: Vector2dClass): Matrix2dClass;

        /**
         * returns true if the matrix is an identity matrix
         */
        isIdentity(): boolean;

        /**
         * Clone the Matrix
         */
        clone(): Matrix2dClass;

        /**
         * convert the object to a string representation
         */
        toString(): string;
    }

    interface Matrix2dStatic extends ObjectStatic {
        new (mat2d?: Matrix2dClass): Matrix2dClass;
        new (values: number[]): Matrix2dClass;
        extend(...mixins: Array<Object|FunctionDictionary>): Matrix2dStatic;
    }

    interface RendererOptions {
        doubleBuffering?: boolean;
        antiAlias?: boolean;
        transparent?: boolean;
        zoomX?: number;
        zoomY?: number;
    }

    interface  RendererClass {
        /**
         * return a reference to the system canvas
         */
        getCanvas(): HTMLCanvasElement;

        /**
         * return a reference to the screen canvas
         */
        getScreenCanvas(): HTMLCanvasElement;

        /**
         * return a reference to the screen canvas corresponding 2d Context
         * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
         */
        getScreenContext(): CanvasRenderingContext2D;

        /**
         * Returns the 2D Context object of the given Canvas
         * Also configures anti-aliasing based on constructor options.
         */
        getContext2d(canvas: HTMLCanvasElement, opaque: boolean): CanvasRenderingContext2D;

        /**
         * return the width of the system Canvas
         */
        getWidth(): number;

        /**
         * return the height of the system Canvas
         */
        getHeight(): number;

        /**
         * return the current global alpha
         */
        globalAlpha(): number;

        /**
         * resizes the canvas
         */
        resize(width: number, height: number): void;

        /**
         * enable/disable image smoothing (scaling interpolation) for the specified 2d Context
         * (!) this might not be supported by all browsers
         */
        setAntiAlias(context: CanvasRenderingContext2D, enable: boolean): void;
    }

    interface  RendererStatic extends ObjectStatic {
        new (canvas: HTMLCanvasElement, width: number, height: number, options: RendererOptions): RendererClass;
        extend(...mixins: Array<Object|FunctionDictionary>): RendererStatic;
    }

    interface SpriteOptions {
        image: CanvasRendererTextureClass|WebGLRendererTextureClass|HTMLImageElement|string;
        region?: string;
        framewidth?: number;
        frameheight?: number;
        rotation?: number;
        flipX?: boolean;
        flipY?: boolean;
        anchorPoint?: Vector2dClass;
    }

    interface FlickerCallback {
        (): any;
    }

    interface SpriteClass extends RenderableClass {
        alpha: number;
        ancestor: ContainerClass;
        angle: number;

        /**
         * return the flickering state of the object
         */
        isFlickering(): boolean;

        /**
         * make the object flicker
         * 
         * @param duration expressed in milliseconds
         * @param callback Function to call when flickering ends
         */
        flicker(duration: number, callback: FlickerCallback): void;

        /**
         * Flip object on horizontal axis
         */
        flipX(flip: boolean): void;

        /**
         * Flip object on vertical axis
         */
        flipY(flip: boolean): void;

        /**
         * scale the sprite around his center
         */
        scale(x: number, y: number): void;

        /**
         * Scale this Polygon by the given scalar.
         */
        scale(x: number, y?: number): PolygonClass;

        /**
         * scale the sprite around his center
         */
        scaleV(v: Vector2dClass): void;

        /**
         * Scale this Polygon by the given vector
         */
        scaleV(v: Vector2dClass): PolygonClass;
    }

    interface SpriteStatic extends RenderableStatic {
        new (x: number, y: number, settings: AnimationSheetOptions): SpriteClass;
        extend(...mixins: Array<Object|FunctionDictionary>): SpriteStatic;
    }

    interface AnimationSheetOptions {
        image: HTMLImageElement|string;
        framewidth?: number;
        frameheight?: number;
        anchorPoint?: Vector2dClass;
    }

    interface ResetAnimCallback {
        (): any;
    }

    interface AnimationSheetClass extends SpriteClass {
        animationpause: boolean;
        animationspeed: number;

        /**
         * add an animation
         * 
         * @param name animation id
         * @param index list of sprite index or name defining the animation. Can also use objects to specify delay for each frame, see below
         * @param animationspeed cycling speed for animation in ms
         */
        addAnimation(name: string, index: Array<number|string|Object>, animationspeed?: number): void;

        /**
         * set the current animation
         */
        setCurrentAnimation(name: string, resetAnim: string|ResetAnimCallback): void;

        /**
         * return true if the specified animation is the current one
         */
        isCurrentAnimation(name: string): boolean;

        /**
         * force the current animation frame index
         */
        setAnimationFrame(index?: number): void;

        /**
         * return the current animation frame index
         */
        getCurrentAnimationFrame(): number;
    }

    interface AnimationSheetStatic extends SpriteStatic {
        new (x: number, y: number, settings: AnimationSheetOptions): AnimationSheetClass;
        extend(...mixins: Array<Object|FunctionDictionary>): AnimationSheetStatic;
    }

    interface CanvasRendererTextureErrorClass extends ErrorClass {
    }

    interface CanvasRendererTextureErrorStatic extends ErrorStatic {
        new (msg: string): CanvasRendererTextureErrorClass;
    }

    interface CanvasRendererTextureClass {
        /**
         * Create an animation object using the first region found using all specified names
         */
        createAnimationFromName(names: Array<String|Number>, settings?: SpriteOptions): AnimationSheetClass;

        /**
         * return the Atlas dictionnary
         */
        getAtlas(): Object;

        /**
         * return the Atlas texture
         */
        getTexture(): CanvasRendererTextureClass;

        /**
         * return a normalized region/frame information for the specified sprite name
         */
        getRegion(name: string): Object;

        /**
         * Create a sprite object using the first region found using the specified name
         */
        createSpriteFromName(name: string, settings?: SpriteOptions): SpriteClass;
    }

    interface CanvasRendererTextureStatic extends ObjectStatic {
        Error: CanvasRendererTextureErrorStatic;

        new (atlas: Object, texture?: HTMLImageElement, cached?: boolean): CanvasRendererTextureClass;
    }

    interface CanvasRendererClass extends RendererClass {
        /**
         * prepare the framebuffer for drawing a new frame
         */
        clear(): void;

        /**
         * render the main framebuffer on screen
         */
        flush(): void;

        /**
         * Clears the main framebuffer with the given color
         * 
         * @param color CSS color
         * @param opaque Allow transparency [default] or clear the surface completely [true]
         */
        clearColor(color: ColorClass|string, opaque: boolean): void;

        /**
         * Sets all pixels in the given rectangle to transparent black,
         * erasing any previously drawn content.
         * 
         * @param x x axis of the coordinate for the rectangle starting point.
         * @param y y axis of the coordinate for the rectangle starting point.
         * @param width The rectangle's width.
         * @param height The rectangle's height.
         */
        clearRect(x: number, y: number, width: number, height: number): void;

        /**
         * Create a pattern with the specified repition
         * 
         * @param image Source image
         * @param repeat Define how the pattern should be repeated
         */
        createPattern(image: HTMLImageElement, repeat: 'repeat'|'repeat-x'|'repeat-y'|'no-repeat'): CanvasPattern;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         */
        drawImage(image: HTMLImageElement, dx: number, dy: number): void;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         * @param dw Destination width
         * @param dh Destination height
         */
        drawImage(image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number): void;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param sx Source x-coordinate
         * @param sy Source y-coordinate
         * @param sw Source width
         * @param sh Source height
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         * @param dw Destination width
         * @param dh Destination height
         */
        drawImage(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;

        /**
         * Draw a pattern within the given rectangle.
         */
        drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;

        /**
         * Fill an arc at the specified coordinates with given radius, start and end points
         * 
         * @param x arc center point x-axis
         * @param y arc center point y-axis
         * @param radius
         * @param start start angle in radians
         * @param end end angle in radians
         * @param antiClockwise draw arc anti-clockwise
         */
        fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise: boolean): void;

        /**
         * Draw a filled rectangle at the specified coordinates
         */
        fillRect(x: number, y: number, width: number, height: number): void;

        /**
         * return a reference to the system 2d Context
         */
        getContext(): CanvasRenderingContext2D;

        /**
         * resets the canvas transform to identity
         */
        resetTransform(): void;

        /**
         * scales the canvas & 2d Context
         */
        scaleCanvas(scaleX: number, scaleY: number): void;

        /**
         * save the canvas context
         */
        save(): void;

        /**
         * restores the canvas context
         */
        restore(): void;

        /**
         * rotates the canvas context
         * 
         * @param angle angle in radians
         */
        rotate(angle: number): void;

        /**
         * scales the canvas context
         */
        scale(x: number, y: number): void;

        /**
         * Sets the fill & stroke style colors for the context.
         */
        setColor(color: ColorClass|string): void;

        /**
         * Sets the global alpha on the canvas context
         */
        setGlobalAlpha(alpha: number): void;

        /**
         * sets the line width on the context
         */
        setLineWidth(width: number): void;

        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * 
         * @param x arc center point x-axis
         * @param y arc center point y-axis
         * @param radius
         * @param start start angle in radians
         * @param end end angle in radians
         * @param antiClockwise draw arc anti-clockwise
         */
        strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise: boolean): void;

        /**
         * Stroke an ellipse at the specified coordinates with given radius, start and end points
         * 
         * @param x arc center point x-axis
         * @param y arc center point y-axis
         * @param w horizontal radius of the ellipse
         * @param h vertical radius of the ellipse
         */
        strokeEllipse(x: number, y: number, w: number, h: number): void;

        /**
         * Stroke a line of the given two points
         * 
         * @param startX the start x coordinate
         * @param startY the start y coordinate
         * @param endX the end x coordinate
         * @param endY the end y coordinate
         */
        strokeLine(startX: number, startY: number, endX: number, endY: number): void;

        /**
         * Strokes a me.Polygon on the screen with a specified color
         */
        strokePolygon(poly: PolygonClass): void;

        /**
         * Stroke a rectangle at the specified coordinates with a given color
         */
        strokeRect(x: number, y: number, width: number, height: number): void;

        /**
         * draw the given shape
         */
        drawShape(shape: RectClass|PolygonClass|LineClass|EllipseClass): void;

        /**
         * Resets (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         */
        setTransform(mat2d: Matrix2dClass): void;

        /**
         * Multiply given matrix into the renderer tranformation matrix
         * 
         * @param mat2d Matrix to transform by
         */
        transform(mat2d: Matrix2dClass): void;

        /**
         * Translates the context to the given position
         */
        translate(x: number, y: number): void;
    }

    interface CanvasRendererStatic extends RendererStatic {
        Texture: CanvasRendererTextureStatic;

        new (canvas: HTMLCanvasElement, width: number, height: number, options: RendererOptions): CanvasRendererClass;
        extend(...mixins: Array<Object|FunctionDictionary>): CanvasRendererStatic;
    }

    interface WebGLRendererTextureErrorClass extends ErrorClass {
    }

    interface WebGLRendererTextureErrorStatic extends ErrorStatic {
        new (msg: string): WebGLRendererTextureClass;
    }

    interface WebGLRendererTextureClass extends CanvasRendererTextureClass {
    }

    interface WebGLRendererTextureClassStatic extends CanvasRendererTextureStatic {
        Error: WebGLRendererTextureErrorStatic;

        new (atlas: Object, texture?: HTMLImageElement, cached?: boolean): WebGLRendererTextureClass;
    }

    interface WebGLRendererCompositorClass {
        length: number;

        /**
         * Sets the projection matrix with the given size
         * 
         * @param w WebGL Canvas width
         * @param h WebGL Canvas height
         */
        setProjection(w: number, h: number): void;

        /**
         * Select the shader to use for compositing
         * 
         * @param shader The shader program to use
         */
        useShader(shader: WebGLProgram): void;

        /**
         * Add a textured quad
         * 
         * @param texture Source texture
         * @param key Source texture region name
         * @param x Destination x-coordinate
         * @param y Destination y-coordinate
         * @param w Destination width
         * @param h Destination height
         */
        addQuad(texture: WebGLRendererTextureClass, key: string, x: number, y: number, w: number, h: number): void;

        /**
         * Flush batched texture operations to the GPU
         */
        flush(): void;

        /**
         * Draw a line
         */
        drawLine(points: Vector2dClass[], open?: boolean): void;

        /**
         * Set the line width
         */
        lineWidth(width: number): void;

        /**
         * Clear the frame buffer, flushes the composite operations and calls
         */
        clear(): void;
    }

    interface WebGLRendererCompositorStatic extends ObjectStatic {
        new (gl: WebGLRenderingContext, matrix: Matrix2dClass, color: ColorClass): WebGLRendererCompositorClass;
        extend(...mixins: Array<Object|FunctionDictionary>): WebGLRendererCompositorStatic;
    }

    interface WebGLRendererOptions extends RendererOptions {
        compositor?: WebGLRendererCompositorClass;
    }

    interface WebGLRendererClass extends RendererClass {
        gl: WebGLRenderingContext;

        /**
         * Create a pattern with the specified repition
         * 
         * @param image Source image
         * @param repeat Define how the pattern should be repeated
         */
        createPattern(image: HTMLImageElement, repeat: 'repeat'|'repeat-x'|'repeat-y'|'no-repeat'): CanvasPattern;

        /**
         * Flush the compositor to the frame buffer
         */
        flush(): void;

        /**
         * Clears the main framebuffer with the given color
         * 
         * @param color CSS color
         * @param opaque Allow transparency [default] or clear the surface completely [true]
         */
        clearColor(color: ColorClass|string, opaque: boolean): void;

        /**
         * Sets all pixels in the given rectangle to transparent black,
         * erasing any previously drawn content.
         * 
         * @param x x axis of the coordinate for the rectangle starting point.
         * @param y y axis of the coordinate for the rectangle starting point.
         * @param width The rectangle's width.
         * @param height The rectangle's height.
         */
        clearRect(x: number, y: number, width: number, height: number): void;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         */
        drawImage(image: HTMLImageElement, dx: number, dy: number): void;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         * @param dw Destination width
         * @param dh Destination height
         */
        drawImage(image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number): void;

        /**
         * Draw an image using the canvas api
         * 
         * @param image Source image
         * @param sx Source x-coordinate
         * @param sy Source y-coordinate
         * @param sw Source width
         * @param sh Source height
         * @param dx Destination x-coordinate
         * @param dy Destination y-coordinate
         * @param dw Destination width
         * @param dh Destination height
         */
        drawImage(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;

        /**
         * Draw a pattern within the given rectangle.
         */
        drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;

        /**
         * Draw a filled rectangle at the specified coordinates
         */
        fillRect(x: number, y: number, width: number, height: number): void;

        /**
         * Returns the WebGL Context object of the given Canvas
         */
        getContextGL(canvas: HTMLCanvasElement, opaque?: boolean): WebGLRenderingContext;

        /**
         * Returns the WebGLContext instance for the renderer
         */
        getContext(): WebGLRenderingContext;

        /**
         * resets the gl transform to identity
         */
        resetTransform(): void;

        /**
         * Reset context state
         */
        reset(): void;

        /**
         * scales the canvas & GL Context
         */
        scaleCanvas(scaleX: number, scaleY: number): void;

        /**
         * restores the canvas context
         */
        restore(): void;

        /**
         * rotates the canvas context
         * 
         * @param angle angle in radians
         */
        rotate(angle: number): void;

        /**
         * save the canvas context
         */
        save(): void;

        /**
         * scales the canvas context
         */
        scale(x: number, y: number): void;

        /**
         * Sets the global alpha on the canvas context
         */
        setGlobalAlpha(alpha: number): void;

        /**
         * Sets the fill & stroke style colors for the context.
         */
        setColor(color: ColorClass|string): void;

        /**
         * Set the line width
         */
        setLineWidth(width: number): void;

        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * 
         * @param x arc center point x-axis
         * @param y arc center point y-axis
         * @param radius
         * @param start start angle in radians
         * @param end end angle in radians
         * @param antiClockwise draw arc anti-clockwise
         */
        strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise: boolean): void;

        /**
         * Stroke an ellipse at the specified coordinates with given radius, start and end points
         * 
         * @param x arc center point x-axis
         * @param y arc center point y-axis
         * @param w horizontal radius of the ellipse
         * @param h vertical radius of the ellipse
         */
        strokeEllipse(x: number, y: number, w: number, h: number): void;

        /**
         * Stroke a line of the given two points
         * 
         * @param startX the start x coordinate
         * @param startY the start y coordinate
         * @param endX the end x coordinate
         * @param endY the end y coordinate
         */
        strokeLine(startX: number, startY: number, endX: number, endY: number): void;

        /**
         * Strokes a me.Polygon on the screen with a specified color
         */
        strokePolygon(poly: PolygonClass): void;

        /**
         * Stroke a rectangle at the specified coordinates with a given color
         */
        strokeRect(x: number, y: number, width: number, height: number): void;

        /**
         * draw the given shape
         */
        drawShape(shape: RectClass|PolygonClass|LineClass|EllipseClass): void;

        /**
         * Resets (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         */
        setTransform(mat2d: Matrix2dClass): void;

        /**
         * Multiply given matrix into the renderer tranformation matrix
         * 
         * @param mat2d Matrix to transform by
         */
        transform(mat2d: Matrix2dClass): void;

        /**
         * Translates the context to the given position
         */
        translate(x: number, y: number): void;
    }

    interface WebGLRendererStatic extends RendererStatic {
        Texture: WebGLRendererTextureClassStatic;

        new (canvas: HTMLCanvasElement, width: number, height: number, options: WebGLRendererOptions): WebGLRendererClass;
        extend(...mixins: Array<Object|FunctionDictionary>): WebGLRendererStatic;
    }

    interface PolygonErrorClass extends ErrorClass {
    }

    interface PolygonErrorStatic extends ErrorStatic {
        new (msg: string): PolygonErrorClass;
    }

    interface PolygonClass {
        points: Vector2dClass[];
        pos: Vector2dClass;

        /**
         * set new value to the Polygon
         * 
         * @param x position of the Polygon
         * @param y position of the Polygon
         * @param points array of vector defining the Polygon
         */
        setShape(x: number, y: number, points: Vector2dClass[]): PolygonClass;

        /**
         * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
         * 
         * @param angle The angle to rotate (in radians)
         */
        rotate(angle: number): PolygonClass;

        /**
         * Scale this Polygon by the given scalar.
         */
        scale(x: number, y?: number): PolygonClass;

        /**
         * Scale this Polygon by the given vector
         */
        scaleV(v: Vector2dClass): PolygonClass;

        /**
         * Computes the calculated collision polygon.
         * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
         */
        recalc(): PolygonClass;

        /**
         * translate the Polygon by the specified offset
         * 
         * @param x x offset
         * @param y y offset
         */
        translate(x: number, y: number): PolygonClass;

        /**
         * translate the Polygon by the specified vector
         * 
         * @param v vector offset
         */
        translateV(v: Vector2dClass): PolygonClass;

        /**
         * check if this Polygon contains the specified point
         */
        containsPointV(v: Vector2dClass): boolean;

        /**
         * check if this Polygon contains the specified point
         * (Note: it is highly recommended to first do a hit test on the corresponding
         *  bounding rect, as the function can be highly consuming with complex shapes)
         * 
         * @param x x coordinate
         * @param y y coordinate
         */
        containsPoint(x: number, y: number): boolean;

        /**
         * Returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         */
        getBounds(): RectClass;

        /**
         * Update the bounding box for this shape.
         */
        updateBounds(): RectClass;

        /**
         * clone this Polygon
         */
        clone(): PolygonClass;
    }

    interface PolygonStatic extends ObjectStatic {
        Error: PolygonErrorStatic;

        new (x: number, y: number, points: Vector2dClass[]): PolygonClass;
        extend(...mixins: Array<Object|FunctionDictionary>): PolygonStatic;
    }

    interface LineErrorClass extends ErrorClass {
    }

    interface LineErrorStatic extends ErrorStatic {
        new (msg: string): LineErrorClass;
    }

    interface LineClass extends PolygonClass {
        /**
         * clone this line segment
         */
        clone(): LineClass;
    }

    interface LineStatic extends PolygonStatic {
        Error: LineErrorStatic;

        new (x: number, y: number, points: Vector2dClass[]): LineClass;
        extend(...mixins: Array<Object|FunctionDictionary>): LineStatic;
    }

    interface EllipseClass {
        pos: Vector2dClass;
        radius: number;
        radiusV: Vector2dClass;
        radiusSq: Vector2dClass;
        ratio: Vector2dClass;

        /**
         * set new value to the Ellipse shape
         * 
         * @param x position of the ellipse
         * @param y position of the ellipse
         * @param w width (diameter) of the ellipse
         * @param h height (diameter) of the ellipse
         */
        setShape(x: number, y: number, w: number, h: number): EllipseClass;

        /**
         * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
         * 
         * @param angle The angle to rotate (in radians)
         */
        rotate(angle: number): EllipseClass;

        /**
         * Scale this Ellipse by the specified scalar.
         */
        scale(x: number, y?: number): EllipseClass;

        /**
         * Scale this Ellipse by the specified vector.
         */
        scaleV(v: Vector2dClass): EllipseClass;

        /**
         * translate the circle/ellipse by the specified offset
         * 
         * @param x x offset
         * @param y y offset
         */
        translate(x: number, y: number): EllipseClass;

        /**
         * translate the circle/ellipse by the specified vector
         */
        translateV(v: Vector2dClass): EllipseClass;

        /**
         * check if this circle/ellipse contains the specified point
         */
        containsPointV(v: Vector2dClass): boolean;

        /**
         * check if this circle/ellipse contains the specified point
         */
        containsPoint(x: number, y: number): boolean;

        /**
         * Returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         */
        getBounds(): RectClass;

        /**
         * Update the bounding box for this shape.
         */
        updateBounds(): RectClass;

        /**
         * clone this Ellipse
         */
        clone(): EllipseClass;
    }

    interface EllipseStatic extends ObjectStatic {
        new (x: number, y: number, w: number, h: number): EllipseClass;
        extend(...mixins: Array<Object|FunctionDictionary>): EllipseStatic;
    }

    interface RectClass extends PolygonClass {
        height: number;
        width: number;
        bottom: number;
        left: number;
        right: number;
        top: number;

        /**
         * set new value to the rectangle shape
         * 
         * @param x position of the Rectangle
         * @param y position of the Rectangle
         * @param w width of the rectangle
         * @param h height of the rectangle
         */
        setShape(x: number, y: number, w: number, h: number): RectClass;

        /**
         * set new value to the Polygon
         * 
         * @param x position of the Polygon
         * @param y position of the Polygon
         * @param points array of vector defining the Polygon
         */
        setShape(x: number, y: number, points: Vector2dClass[]): RectClass;

        /**
         * resize the rectangle
         * 
         * @param w new width of the rectangle
         * @param h new height of the rectangle
         */
        resize(w: number, h: number): RectClass;

        /**
         * clone this rectangle
         */
        clone(): RectClass;

        /**
         * copy the position and size of the given rectangle into this one
         */
        copy(rect: RectClass): RectClass;

        /**
         * merge this rectangle with another one
         * 
         * @param rect other rectangle to union with
         */
        union(rect: RectClass): RectClass;

        /**
         * check if this rectangle is intersecting with the specified one
         */
        overlaps(rect: RectClass): boolean;

        /**
         * check if this rectangle contains the specified one
         */
        contains(rect: RectClass): boolean;

        /**
         * Returns a polygon whose edges are the same as this box.
         */
        toPolygon(): PolygonClass;
    }

    interface RectStatic extends PolygonStatic {
        new (x?: number, y?: number, width?: number, height?: number): RectClass;
        extend(...mixins: Array<Object|FunctionDictionary>): RectStatic;
    }

    interface RenderableClass extends RectClass {
        GUID: string;
        inViewport: boolean;
        alwaysUpdate: boolean;
        updateWhenPaused: boolean;
        isPersistent: boolean;
        floating: boolean;
        anchorPoint: Vector2dClass;
        alpha: number;
        ancestor: ContainerClass;

        /**
         * get the renderable alpha channel value
         */
        getOpacity(): number;

        /**
         * set the renderable alpha channel value
         */
        setOpacity(alpha: number): void;

        /**
         * update function
         * called by the game manager on each game loop
         */
        update(): boolean;

        /**
         * object draw
         * called by the game manager on each game loop
         * 
         * @param renderer a renderer object
         */
        draw(renderer: CanvasRendererClass|WebGLRendererClass): void;

        /**
         * OnDestroy Notification function
         * Called by engine before deleting the object
         */
        onDestroyEvent(): any;
    }

    interface RenderableStatic extends RectStatic {
        new (x?: number, y?: number, width?: number, height?: number): RenderableClass;
        extend(...mixins: Array<Object|FunctionDictionary>): RenderableStatic;
    }

    interface ContainerErrorClass extends ErrorClass {
    }

    interface ContainerErrorStatic extends ErrorStatic {
        new (msg: string): ContainerErrorClass;
    }

    interface  ContainerClass extends RenderableClass {
        autoDepth: boolean;
        autoSort: boolean;
        childBounds: RectClass;
        sortOn: string;
        transform: Matrix2dClass;
        alpha: number;
        ancestor: ContainerClass;

        /**
         * Add a child to the container
         * if auto-sort is disable, the object will be appended at the bottom of the list
         */
        addChild(child: RenderableClass, z?: number): RenderableClass;

        /**
         * Add a child to the container at the specified index
         * (the list won't be sorted after insertion)
         */
        addChildAt(child: RenderableClass, index: number): RenderableClass;

        /**
         * Swaps the position (z-index) of 2 children
         */
        swapChildren(child1: RenderableClass, child2: RenderableClass): void;

        /**
         * Returns the Child at the specified index
         */
        getChildAt(index: number): RenderableClass;

        /**
         * Returns the index of the Child
         */
        getChildIndex(child: RenderableClass): number;

        /**
         * Returns true if contains the specified Child
         */
        hasChild(child: RenderableClass): boolean;

        /**
         * return the child corresponding to the given property and value
         * note : avoid calling this function every frame since
         * it parses the whole object tree each time
         * 
         * @param prop Property name
         * @param value Value of the property
         */
        getChildByProp(prop: string, value: string|RegExp|number|boolean): RenderableClass[];

        /**
         * returns the list of childs with the specified class type
         */
        getChildByType(type: Object): RenderableClass[];

        /**
         * returns the list of childs with the specified name
         * as defined in Tiled (Name field of the Object Properties)
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         */
        getChildByName(name: string|RegExp|number|boolean): RenderableClass[];

        /**
         * return the child corresponding to the specified GUID
         * note : avoid calling this function every frame since
         * it parses the whole object list each time
         */
        getChildByGUID(value: string|RegExp|number|boolean): RenderableClass;

        /**
         * resizes the child bounds rectangle, based on children bounds
         */
        updateChildBounds(): RectClass;

        /**
         * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed
         */
        removeChild(child: RenderableClass, keepalive?: boolean): void;

        /**
         * Removes (and optionally destroys) a child from the container.
         * (removal is immediate and unconditional)
         */
        removeChildNow(child: RenderableClass, keepalive?: boolean): void;

        /**
         * Automatically set the specified property of all childs to the given value
         * 
         * @param property property name
         * @param value property value
         * @param recursive recursively apply the value to child containers if true
         */
        setChildsProperty(prop: string, value: any, recursive?: boolean): void;

        /**
         * Move the child in the group one step forward (z depth).
         */
        moveUp(child: RenderableClass): void;

        /**
         * Move the child in the group one step backward (z depth).
         */
        moveDown(child: RenderableClass): void;

        /**
         * Move the specified child to the top(z depth).
         */
        moveToTop(child: RenderableClass): void;

        /**
         * Move the specified child the bottom (z depth).
         */
        moveToBottom(child: RenderableClass): void;

        /**
         * Manually trigger the sort of all the childs in the container
         */
        sort(recursive: boolean): void;
    }

    interface  ContainerStatic extends RenderableStatic {
        Error: ContainerErrorStatic;

        new (x?: number, y?: number, width?: number, height?: number): ContainerClass;
        extend(...mixins: Array<Object|FunctionDictionary>): ContainerStatic;
    }

    interface LevelLoadedCallback {
        (): any;
    }

    interface LoadLevelOptions {
        container?: ContainerClass;
        onLoaded?: LevelLoadedCallback;
        flatten?: boolean;
        setViewportBounds?: boolean;
    }

    interface BodyClass extends RectClass {
        accel: Vector2dClass;
        collisionType: number;
        falling: boolean;
        friction: Vector2dClass;
        gravity: number;
        jumping: boolean;
        maxVel: Vector2dClass;
        vel: Vector2dClass;

        /**
         * add a collision shape to this entity
         */
        addShape(shape: RectClass|PolygonClass|LineClass|EllipseClass, batchInsert?: boolean): number;

        /**
         * add collision shapes based on the given PhysicsEditor JSON object
         * 
         * @param json a JSON object as exported from the PhysicsEditor tool
         * @param id the shape identifier within the given the json object
         * @param scale the desired scale of the body (physic-body-editor only)
         */
        addShapesFromJSON(json: Object, id: string, scale?: number): number;

        /**
         * return the collision shape at the given index
         */
        getShape(index: number):  RectClass|PolygonClass|LineClass|EllipseClass;

        /**
         * remove the specified shape from the body shape list
         */
        removeShape(shape: RectClass|PolygonClass|LineClass|EllipseClass): number;

        /**
         * remove the shape at the given index from the body shape list
         */
        removeShapeAt(index: number): number;

        /**
         * By default all entities are able to collide with all other entities,
         * but it's also possible to specificy 'collision filters' to provide a finer
         * control over which entities can collide with each other.
         * 
         * @param bitmask the collision mask
         */
        setCollisionMask(bitmask: number): void;

        /**
         * update the body position
         */
        update(): boolean;
    }

    interface BodyStatic extends RectStatic {
        new (entity: EntityClass, shapes?: Array<RectClass|PolygonClass|LineClass|EllipseClass>): BodyClass;
        extend(...mixins: Array<Object|FunctionDictionary>): BodyStatic;
    }

    interface EntityOptions {
        name?: string;
        id?: string;
        image?: HTMLImageElement|string;
        framewidth?: number;
        frameheight?: number;
        type?: string;
        collisionMask?: number;
        shapes?: Object;
    }

    interface EntityErrorClass extends ErrorClass {
    }

    interface EntityErrorStatic extends ErrorStatic {
        new (msg: string): EntityErrorClass;
    }

    interface EntityClass extends RenderableClass {
        alive: boolean;
        body: BodyClass;
        id: number;
        name: string;
        type: string;

        /**
         * return the distance to the specified entity
         */
        distanceTo(entity: EntityClass): number;

        /**
         * return the distance to the specified point
         */
        distanceToPoint(v: Vector2dClass): number;

        /**
         * return the angle to the specified entity
         */
        angleTo(entity: EntityClass): number;

        /**
         * return the angle to the specified point
         */
        angleToPoint(entity: EntityClass): number;

        /**
         * onDeactivateEvent Notification function
         * Called by engine before deleting the object
         */
        onDeactivateEvent(): void;

        /**
         * onCollision callback
         * triggered in case of collision, when this entity body is being "touched" by another one
         */
        onCollision(): boolean;
    }

    interface EntityStatic extends RenderableStatic {
        Error: EntityErrorStatic;

        new (x: number, y: number, settings: EntityOptions): EntityClass;
        extend(...mixins: Array<Object|FunctionDictionary>): EntityStatic;
    }

    enum AXISType {
        NONE,
        HORIZONTAL,
        VERTICAL,
        BOTH
    }

    interface EffectCompleteCallback {
        (): any;
    }

    interface ViewportClass extends RenderableClass {
        bounds: RectClass;
        alpha: number;
        ancestor: ContainerClass;

        /**
         * reset the viewport to specified coordinates
         */
        reset(x: number, y: number): void;

        /**
         * hange the deadzone settings.
         * the "deadzone" defines an area within the current viewport in which
         * the followed entity can move without scrolling the viewport.
         */
        setDeadzone(w: number, h: number): void;

        /**
         * resize the viewport
         */
        resize(w: number, h: number): void;

        /**
         * resize the viewport
         */
        resize(w: number, h: number): RectClass;

        /**
         * set the viewport boundaries (set to the world limit by default).
         * the viewport is bound to the given coordinates and cannot move/be scrolled outside of it.
         */
        setBounds(x : number, y: number, w: number, h: number): void;

        /**
         * set the viewport to follow the specified entity
         */
        follow(target: EntityClass|Vector2dClass, axis: AXISType): void;

        /**
         * move the viewport position by the specified offset
         */
        move(x: number, y: number): void;

        /**
         * move the viewport to the specified coordinates
         */
        moveTo(x: number, y: number): void;

        /**
         * shake the camera
         * 
         * @param intensity maximum offset that the screen can be moved while shaking
         * @param duration expressed in milliseconds
         * @param axis specify on which axis you want the shake effect
         * @param onComplete callback once shaking effect is over
         * @param force if true this will override the current effect
         */
        shake(intensity: number, duration: number, axis?: AXISType, onComplete?: EffectCompleteCallback, force?: boolean): void;

        /**
         * fadeOut(flash) effect
         * screen is filled with the specified color and slowly goes back to normal
         * 
         * @param color a CSS color value
         * @param duration expressed in milliseconds
         * @param onComplete callback once effect is over
         */
        fadeOut(color: ColorClass|string, duration?: number, onComplete?: EffectCompleteCallback): void;

        /**
         * fadeIn effect
         * fade to the specified color
         * 
         * @param color a CSS color value
         * @param duration expressed in milliseconds
         * @param onComplete callback once effect is over
         */
        fadeIn(color: ColorClass|string, duration?: number, onComplete?: EffectCompleteCallback): void;

        /**
         * return the viewport width
         */
        getWidth(): number;

        /**
         * return the viewport height
         */
        getHeight(): number;

        /**
         * set the viewport position around the specified object
         */
        focusOn(target: RenderableClass): void;

        /**
         * check if the specified rectangle is in the viewport
         */
        isVisible(rect: RectClass): boolean;

        /**
         * convert the given "local" (screen) coordinates into world coordinates
         */
        localToWorld(x: number, y: number, target?: Vector2dClass): Vector2dClass;

        /**
         * convert the given world coordinates into "local" (screen) coordinates
         */
        worldToLocal(x: number, y: number, target?: Vector2dClass): Vector2dClass;
    }

    interface ViewportStatic extends RenderableStatic {
        AXIS: {
            NONE: AXISType;
            HORIZONTAL: AXISType;
            VERTICAL: AXISType;
            BOTH: AXISType;
        };

        new (minX: number, minY: number, maxX: number, maxY: number): ViewportClass;
        extend(...mixins: Array<Object|FunctionDictionary>): ViewportStatic;
    }

    interface HashParameters {
        hitbox?: boolean;
        velocity?: boolean;
        quadtree?: boolean;
        webgl?: boolean;

        [key: string]: any;
    }

    interface PointerInformation extends RectClass {
        bind: number[];
        LEFT: number;
        MIDDLE: number;
        RIGHT: number;
    }

    interface GamePointerEvent extends PointerEvent {
        gameX: number;
        gameY: number;
    }

    interface PointerEventCallback {
        (event: GamePointerEvent): any;
    }

    interface VideoInitOptions {
        wrapper?: string;
        renderer?: number;
        doubleBuffering?: boolean;
        scale?: number|string;
        scaleMethod?: 'fit'|'fill-min'|'fill-max'|'flex'|'flex-width'|'flex-height'|'stretch';
        transparent?: boolean;
        antiAlias?: boolean;
    }

    interface StateCallback {
        (): any;
    }

    namespace loader {
        /**
         * onload callback
         */
        var onload: OnLoadCallback;

        /**
         * onProgress callback
         * each time a resource is loaded, the loader will fire the specified function, giving the actual progress [0 ... 1], as argument, and an object describing the resource loaded
         */
        var onProgress: OnProgressCallback;

        /**
         * return the specified Binary object
         * 
         * @param name name of the binary object ("ymTrack");
         */ 
        function getBinary(name: string): string;

        /**
         * return the specified Image Object
         * 
         * @param name name of the Image element ("tileset-platformer");
         */ 
        function getImage(name: string): HTMLImageElement;

        /**
         * return the specified JSON Object
         * 
         * @param name name for the json file to load
         */
        function getJSON(name: string): {};

        /**
         * return the loading progress in percent
         * 
         * @param name name of the tmx/tsx element ("map1");
         */ 
        function getTMX(name: string): TMXXml;

        /**
         * return the specified TMX/TSX object
         * 
         * @deprecated use callback instead
         */ 
        function getLoadProgress(): number;

        /**
         * Load a single resource (to be used if you need to load additional resource during the game)
         *
         * @param resource resource to load
         * @param onload function to be called when the resource is loaded
         * @param onerror function to be called in case of error
         */ 
        function load(resource: Resource, onload: OnLoadCallback, onerror: OnErrorCallback): void;

        /**
         * set all the specified game resources to be preloaded. 
         * 
         * @param resources resources to load
         * @param onload function to be called when the resource is loaded
         * @param switchToLoadState automatically switch to the loading screen
         */
        function preload(resources: Resource[], onload?: OnLoadCallback, switchToLoadState?: boolean): void;

        /**
         * unload specified resource to free memory
         * 
         * @param resource resource
         * 
         * @return true if unloaded
         */
        function unload(resource: Resource): boolean;

        /**
         * unload all resources to free memory
         */
        function unloadAll(): void;
    }

    namespace utils {
        /**
         * Decode a base64 encoded string into a binary string
         * 
         * @param input Base64 encoded data
         */
        function decodeBase64(input: string): string;

        /**
         * Encode binary string into a base64 string
         * 
         * @param input Binary string
         */
        function encodeBase64(input: string): string;

        /**
         * Decode a base64 encoded string into a byte array
         * 
         * @param input Base64 encoded data
         * @param bytes number of bytes per array entry
         */
        function decodeBase64AsArray(input: string, bytes?: number): number[];

        /**
         * decompress zlib/gzip data (NOT IMPLEMENTED)
         * 
         * @param data Array of bytes
         * @param format compressed data format ("gzip","zlib")
         */
        function decompress(data: number[], format: 'gzip'|'zlib'): number[];

        /**
         * Decode a CSV encoded array into a binary array
         * 
         * @param input CSV formatted data
         */
        function decodeCSV(input: string): number[];

        /**
         * Return the base name of the file without path info.
         * 
         * @param path path containing the filename
         */
        function getBasename(path: string): string;

        /**
         * return the extension of the file in the given path
         * 
         * @param path path containing the filename
         */
        function getFileExtension(path: string): string;

        /**
         * Get image pixels
         * 
         * @param image Image to read
         */
        function getPixels(image: HTMLImageElement|HTMLCanvasElement): ImageData;

        /**
         * Normalize a String or Image to an Image reference
         * 
         * @param image Image name or Image reference
         */
        function getImage(image: HTMLImageElement|string): HTMLImageElement;
    }

    namespace levelDirector {
        /**
         * load a level into the game manager
         * (will also create all level defined entities, etc..)
         * 
         * @param level level id
         * @param options additional optional parameters
         */
        function loadLevel(level: string, options: LoadLevelOptions): boolean;

        /**
         * return the current level id
         */
        function getCurrentLevelId(): string;

        /**
         * Return the current level definition.
         * for a reference to the live instantiated level,
         * rather use the container in which it was loaded (e.g. me.game.world)
         */
        function getCurrentLevel(): TMXTileMapClass;

        /**
         * reload the current level
         */
        function reloadLevel(options: LoadLevelOptions): boolean;

        /**
         * load the next level
         */
        function nextLevel(options: LoadLevelOptions): boolean;

        /**
         * load the previous level
         */
        function previousLevel(options: LoadLevelOptions): boolean;

        /**
         * return the amount of level preloaded
         */
        function levelCount(): number;
    }

    namespace game {
        let HASH: HashParameters;
        let mergeGroup: boolean;
        let viewport: ViewportClass;
        let world: ContainerClass;
        let sortOn: 'x'|'y'|'z';
        let onLevelLoaded: LevelLoadedCallback;

        /**
         * reset the game Object manager
         * destroy all current objects
         */
        function reset(): void;

        /**
         * Update the renderer framerate using the system config variables.
         */
        function updateFrameRate(): void;

        /**
         * Returns the parent container of the specified Child in the game world
         */
        function getParentContainer(child: RenderableClass): ContainerClass;

        /**
         * force the redraw (not update) of all objects
         */
        function repaint(): void;
    }

    namespace input {
        let preventDefault: boolean;
        let pointer: PointerInformation;
        let throttlingInterval: number;
        let GAMEPAD: Object;
        let KEY: {
            [key: string]: number;
        };

        /**
         * Translate the specified x and y values from the global (absolute)
         * coordinate to local (viewport) relative coordinate.
         */
        function globalToLocal(x: number, y: number, target?: Vector2dClass): Vector2dClass;

        /**
         * Associate a pointer event to a keycode
         */
        function bindPointer(leftClickKey: number): void;

        /**
         * Associate a pointer event to a keycode
         */
        function bindPointer(button: number, key: number): void;

        /**
         * unbind the defined keycode
         */
        function unbindPointer(button: number): void;

        /**
         * allows registration of event listeners on the object target.
         * melonJS defines the additional `gameX` and `gameY` properties when passing the Event object to the defined callback
         */
        function registerPointerEvent(eventType: string, region: RectClass|PolygonClass|LineClass|EllipseClass, callback: PointerEventCallback): void;

        /**
         * allows the removal of event listeners from the object target.
         */
        function releasePointerEvent(eventType: string, region: RectClass|PolygonClass|LineClass|EllipseClass, callback?: PointerEventCallback): void;

        /**
         * Associate a gamepad event to a keycode
         */
        function bindGamepad(gamepadIndex: number, button: number, key: number): void;

        /**
         * unbind the defined keycode
         */
        function unbindGamepad(gamepadIndex: number, button: number): void;

        /**
         * Set deadzone for analog gamepad inputs
         * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
         */
        function setGamepadDeadzone(value: number): void;

        /**
         * specify a custom mapping for a specific gamepad id
         */
        function setGamepadMapping(id: string, mapping: Object): void;

        /**
         * return the key press status of the specified action
         */
        function isKeyPressed(action: string): boolean;

        /**
         * return the key status of the specified action
         */
        function keyStatus(action: string): boolean;

        /**
         * trigger the specified key (simulated) event
         */
        function triggerKeyEvent(keyCode: number, status: boolean): void;

        /**
         * associate a user defined action to a keycode
         */
        function bindKey(keyCode: number, action: string, lock?: boolean, preventDefault?: boolean): void;

        /**
         * unlock a key manually
         */
        function unlockKey(action: string): void;

        /**
         * unbind the defined keycode
         */
        function unbindKey(keyCode: number): void;
    }

    namespace video {
        namespace shader {
            /**
             * Create a shader program (with bindings) using the given GLSL sources.
             */
            function createShader(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLShader;

            /**
             * Create a texture from an image 
             */
            function createTexture(gl: WebGLRenderingContext, 
                                   textureUnit: number,
                                   image: HTMLImageElement|HTMLCanvasElement|Uint8Array|Float32Array, 
                                   repeat: 'repeat'|'repeat-x'|'repeat-y'|'no-repeat', 
                                   w: number,
                                   h: number,
                                   border: number): WebGLTexture;
        }

        let Error: ErrorStatic;
        let CANVAS: number;
        let WEBGL: number;
        let AUTO: number;

        /**
         * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer).
         * melonJS support various scaling mode :
         *  - `fit` : Letterboxed; content is scaled to design aspect ratio
         *  - `fill-max` : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio
         *  - `flex-height` : Canvas height is resized to fit; content is scaled to design aspect ratio
         *  - `flex-width` : Canvas width is resized to fit; content is scaled to design aspect ratio
         *  - `stretch` : Canvas is resized to fit; content is scaled to screen aspect ratio
         */
        function init(gameWidth: number, gameHeight: number, options?: VideoInitOptions): boolean;

        /**
         * return the relative (to the page) position of the specified Canvas
         */
        function getPos(canvas: HTMLCanvasElement): Vector2dClass;

        /**
         * set the max canvas display size (when scaling)
         */
        function setMaxSize(width: number, height: number): void;

        /**
         * Create and return a new Canvas
         */
        function createCanvas(width: number, height: number, screencanvas?: boolean): HTMLCanvasElement;

        /**
         * return a reference to the wrapper
         */
        function getWrapper(): HTMLElement;

        /**
         * Modify the "displayed" canvas size
         */
        function updateDisplaySize(scaleX: number, scaleY: number): void;
    }

    namespace state {
        let LOADING: number;
        let MENU: number;
        let READY: number;
        let PLAY: number;
        let GAMEOVER: number;
        let GAME_END: number;
        let SCORE: number;
        let CREDITS: number;
        let SETTINGS: number;
        let USER: number;

        let onPause:StateCallback;
        let onResume:StateCallback;
        let onStop:StateCallback;
        let onRestart:StateCallback;

        /**
         * Stop the current screen object.
         */
        function stop(pauseTrack: boolean): void;

        /**
         * pause the current screen object
         */
        function pause(pauseTrack: boolean): void;

        /**
         * Restart the screen object from a full stop.
         */
        function restart(pauseTrack: boolean): void;

        /**
         * resume the screen object
         */
        function resume(pauseTrack: boolean): void;

        /**
         * return the running state of the state manager
         */
        function isRunning(): boolean;

        /**
         * Return the pause state of the state manager
         */
        function isPaused(): boolean;

        /**
         * associate the specified state with a screen object
         */
        function set(state: number, object: ScreenObjectClass): void;

        /**
         * return a reference to the current screen object
         * useful to call a object specific method
         */
        function current(): ScreenObjectClass;

        /**
         * pecify a global transition effect
         * 
         * @param effect (only "fade" is supported for now)
         * @param color a CSS color value
         * @param duration expressed in milliseconds
         */
        function transition(effect: string, color: ColorClass|string, duration?: number): void;

        /**
         * enable/disable transition for a specific state (by default enabled for all)
         */
        function setTransition(state: number, enable: boolean): void;

        /**
         * change the game/app state
         * 
         * @param state State ID (see constants)
         * @param arguments extra arguments to be passed to the reset functions
         */
        function change(state: number, ...arguments: any[]): void;

        /**
         * return true if the specified state is the current one
         */
        function isCurrent(state: number): boolean;
    }

    var Object: ObjectStatic;
    var ScreenObject: ScreenObjectStatic;
    var Vector2d: Vector2dStatic;
    var Color: ColorStatic;
    var TMXTileset: TMXTilesetStatic;
    var TMXTilesetGroup: TMXTilesetGroupStatic;
    var TMXLayer:  TMXLayerStatic;
    var TMXTileMap: TMXTileMapStatic;
    var Sprite: SpriteStatic;
    var AnimationSheet: AnimationSheetStatic;
    var Matrix2d: Matrix2dStatic;
    var Renderer: RendererStatic;
    var CanvasRenderer: CanvasRendererStatic;
    var WebGLRendererCompositor: WebGLRendererCompositorStatic;
    var WebGLRenderer: WebGLRendererStatic;
    var Polygon:  PolygonStatic;
    var Line: LineStatic;
    var Ellipse: EllipseStatic;
    var Rect: RectStatic;
    var Renderable: RenderableStatic;
    var Container: ContainerStatic;
    var Tile: TileStatic;
    var Viewport: ViewportStatic;
    var Entity: EntityStatic;
    var Body: BodyStatic;
}
