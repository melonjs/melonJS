(function () {

    /**
     * a generic Image Layer Object
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Number} x x coordinate
     * @param {Number} y y coordinate
     * @param {Object} settings ImageLayer properties
     * @param {HTMLImageElement|HTMLCanvasElement|String} settings.image Image reference. See {@link me.loader.getImage}
     * @param {String} [settings.name="me.ImageLayer"] layer name
     * @param {Number} [settings.z=0] z-index position
     * @param {Number|me.Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied. See {@link me.ImageLayer#ratio}
     * @param {String} [settings.repeat='repeat'] define if and how an Image Layer should be repeated (accepted values are 'repeat',
 'repeat-x', 'repeat-y', 'no-repeat'). See {@link me.ImageLayer#repeat}
     * @param {Number|me.Vector2d} [settings.anchorPoint=0.0] Image origin. See {@link me.ImageLayer#anchorPoint}
     * @example
     * // create a repetitive background pattern on the X axis using the citycloud image asset
     * me.game.world.addChild(new me.ImageLayer(0, 0, {
     *     image:"citycloud",
     *     repeat :"repeat-x"
     * }), 1);
     */
    me.ImageLayer = me.Renderable.extend({
        /**
         * @ignore
         */
        init: function (x, y, settings) {
            // call the constructor
            this._super(me.Renderable, "init", [x, y, Infinity, Infinity]);

            // get the corresponding image
            this.image = (typeof settings.image === "object") ? settings.image : me.loader.getImage(settings.image);

            // throw an error if image is null/undefined
            if (!this.image) {
                throw new Error((
                    (typeof(settings.image) === "string") ?
                    "'" + settings.image + "'" :
                    "Image"
                ) + " file for Image Layer '" + this.name + "' not found!");
            }

            this.imagewidth = this.image.width;
            this.imageheight = this.image.height;

            // set the sprite name if specified
            if (typeof (settings.name) === "string") {
                this.name = settings.name;
            }

            // render in screen coordinates
            this.floating = true;

            // displaying order
            this.pos.z = settings.z || 0;

            this.offset = me.pool.pull("me.Vector2d", x, y);

            /**
             * Define the image scrolling ratio<br>
             * Scrolling speed is defined by multiplying the viewport delta position (e.g. followed entity) by the specified ratio.
             * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
             * To specify a value through Tiled, use one of the following format : <br>
             * - a number, to change the value for both axis <br>
             * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
             * @public
             * @type me.Vector2d
             * @default <1.0,1.0>
             * @name me.ImageLayer#ratio
             */
            this.ratio = me.pool.pull("me.Vector2d", 1.0, 1.0);

            if (typeof(settings.ratio) !== "undefined") {
                // little hack for backward compatiblity
                if (typeof(settings.ratio) === "number") {
                    this.ratio.set(settings.ratio, settings.ratio);
                } else /* vector */ {
                    this.ratio.setV(settings.ratio);
                }
            }

            if (typeof(settings.anchorPoint) === "undefined") {
                /**
                 * Define how the image is anchored to the viewport bounds<br>
                 * By default, its upper-left corner is anchored to the viewport bounds upper left corner.<br>
                 * The anchorPoint is a unit vector where each component falls in range [0.0,1.0].<br>
                 * Some common examples:<br>
                 * * &lt;0.0,0.0&gt; : (Default) Anchor image to the upper-left corner of viewport bounds
                 * * &lt;0.5,0.5&gt; : Center the image within viewport bounds
                 * * &lt;1.0,1.0&gt; : Anchor image to the lower-right corner of viewport bounds
                 * To specify a value through Tiled, use one of the following format : <br>
                 * - a number, to change the value for both axis <br>
                 * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
                 * @public
                 * @type me.Vector2d
                 * @default <0.0,0.0>
                 * @name me.ImageLayer#anchorPoint
                 */
                this.anchorPoint.set(0, 0);
            }
            else {
                if (typeof(settings.anchorPoint) === "number") {
                    this.anchorPoint.set(settings.anchorPoint, settings.anchorPoint);
                }
                else /* vector */ {
                    this.anchorPoint.setV(settings.anchorPoint);
                }
            }

            /**
             * Define if and how an Image Layer should be repeated.<br>
             * By default, an Image Layer is repeated both vertically and horizontally.<br>
             * Acceptable values : <br>
             * * 'repeat' - The background image will be repeated both vertically and horizontally <br>
             * * 'repeat-x' - The background image will be repeated only horizontally.<br>
             * * 'repeat-y' - The background image will be repeated only vertically.<br>
             * * 'no-repeat' - The background-image will not be repeated.<br>
             * @public
             * @type String
             * @default 'repeat'
             * @name me.ImageLayer#repeat
             */
            Object.defineProperty(this, "repeat", {
                /**
                 * @ignore
                 */
                get : function get() {
                    return this._repeat;
                },
                /**
                 * @ignore
                 */
                set : function set(val) {
                    this._repeat = val;
                    switch (this._repeat) {
                        case "no-repeat" :
                            this.repeatX = false;
                            this.repeatY = false;
                            break;
                        case "repeat-x" :
                            this.repeatX = true;
                            this.repeatY = false;
                            break;
                        case "repeat-y" :
                            this.repeatX = false;
                            this.repeatY = true;
                            break;
                        default : // "repeat"
                            this.repeatX = true;
                            this.repeatY = true;
                            break;
                    }
                    this.resize(me.game.viewport.width, me.game.viewport.height);
                    this.createPattern();
                },
                configurable: true
            });

            this.repeat = settings.repeat || "repeat";

            // on context lost, all previous textures are destroyed
            me.event.subscribe(me.event.WEBGL_ONCONTEXT_RESTORED, this.createPattern.bind(this));
        },

        // called when the layer is added to the game world or a container
        onActivateEvent : function () {
            var _updateLayerFn = this.updateLayer.bind(this);
            // register to the viewport change notification
            this.vpChangeHdlr = me.event.subscribe(me.event.VIEWPORT_ONCHANGE, _updateLayerFn);
            this.vpResizeHdlr = me.event.subscribe(me.event.VIEWPORT_ONRESIZE, this.resize.bind(this));
            this.vpLoadedHdlr = me.event.subscribe(me.event.LEVEL_LOADED, function() {
                // force a first refresh when the level is loaded
                _updateLayerFn(me.game.viewport.pos);
            });
            // in case the level is not added to the root container,
            // the onActivateEvent call happens after the LEVEL_LOADED event
            // so we need to force a first update
            if (this.ancestor.root !== true) {
                this.updateLayer(me.game.viewport.pos);
            }
        },

        /**
         * resize the Image Layer to match the given size
         * @name resize
         * @memberOf me.ImageLayer.prototype
         * @function
         * @param {Number} w new width
         * @param {Number} h new height
        */
        resize : function (w, h) {
            this._super(me.Renderable, "resize", [
                this.repeatX ? Infinity : w,
                this.repeatY ? Infinity : h
            ]);
        },

        /**
         * createPattern function
         * @ignore
         * @function
         */
        createPattern : function () {
            this._pattern = me.video.renderer.createPattern(this.image, this._repeat);
        },

        /**
         * updateLayer function
         * @ignore
         * @function
         */
        updateLayer : function (vpos) {
            var rx = this.ratio.x,
                ry = this.ratio.y;

            if (rx === 0 && ry === 0) {
                // static image
                return;
            }

            var viewport = me.game.viewport,
                width = this.imagewidth,
                height = this.imageheight,
                bw = viewport.bounds.width,
                bh = viewport.bounds.height,
                ax = this.anchorPoint.x,
                ay = this.anchorPoint.y,

                /*
                 * Automatic positioning
                 *
                 * See https://github.com/melonjs/melonJS/issues/741#issuecomment-138431532
                 * for a thorough description of how this works.
                 */
                x = ax * (rx - 1) * (bw - viewport.width) + this.offset.x - rx * vpos.x,
                y = ay * (ry - 1) * (bh - viewport.height) + this.offset.y - ry * vpos.y;


            // Repeat horizontally; start drawing from left boundary
            if (this.repeatX) {
                this.pos.x = x % width;
            }
            else {
                this.pos.x = x;
            }

            // Repeat vertically; start drawing from top boundary
            if (this.repeatY) {
                this.pos.y = y % height;
            }
            else {
                this.pos.y = y;
            }
        },

       /*
        * override the default predraw function
        * as repeat and anchor are managed directly in the draw method
        * @ignore
        */
        preDraw : function (renderer) {
            // save the context
            renderer.save();
            // apply the defined alpha value
            renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());
        },

        /**
         * draw the image layer
         * @ignore
         */
        draw : function (renderer) {
            var viewport = me.game.viewport,
                width = this.imagewidth,
                height = this.imageheight,
                bw = viewport.bounds.width,
                bh = viewport.bounds.height,
                ax = this.anchorPoint.x,
                ay = this.anchorPoint.y,
                x = this.pos.x,
                y = this.pos.y;

            if (this.ratio.x === 0 && this.ratio.y === 0) {
                // static image
                x = x + ax * (bw - width);
                y = y + ay * (bh - height);
            }

            renderer.translate(x, y);
            renderer.drawPattern(
                this._pattern,
                0,
                0,
                viewport.width * 2,
                viewport.height * 2
            );
        },

        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // cancel all event subscriptions
            me.event.unsubscribe(this.vpChangeHdlr);
            me.event.unsubscribe(this.vpResizeHdlr);
            me.event.unsubscribe(this.vpLoadedHdlr);
        },

        /**
         * Destroy function<br>
         * @ignore
         */
        destroy : function () {
            me.pool.push(this.offset);
            this.offset = undefined;
            me.pool.push(this.ratio);
            this.ratio = undefined;
            this._super(me.Renderable, "destroy");
        }
    });
})();
