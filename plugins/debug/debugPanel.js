/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2019 Olivier Biot
 * http://www.melonjs.org
 */

(function () {

    // ensure that me.debug is defined
    me.debug = me.debug || {};

    /**
     * @classdesc
     * a simple debug panel plugin <br>
     * <img src="images/debugPanel.png"/> <br>
     * the debug panel provides the following information : <br>
     * &bull; amount of total objects currently active in the current stage <br>
     * &bull; amount of draws operation <br>
     * &bull; amount of body shape (for collision) <br>
     * &bull; amount of bounding box <br>
     * &bull; amount of sprites objects <br>
     * &bull; amount of objects currently inactive in the the object pool <br>
     * &bull; memory usage (Heap Memory information is only available under Chrome) <br>
     * &bull; frame update time (in ms) <br>
     * &bull; frame draw time (in ms) <br>
     * &bull; current fps rate vs target fps <br>
     * additionally, using the checkbox in the panel it is also possible to display : <br>
     * &bull; the hitbox or bounding box for all objects <br>
     * &bull; current velocity vector <br>
     * &bull; quadtree spatial visualization <br>
     * usage : <br>
     * &bull; upon loading the debug panel, it will be automatically registered under me.plugins.debugPanel <br>
     * &bull; you can then press the default "s" key to show or hide the panel, or use me.plugins.debugPanel.show() and me.plugins.debugPanel.show(), or add #debug as a parameter to your URL e.g. http://myURL/index.html#debug <br>
     * &bull; default key can be configured using the following parameters in the url : e.g. http://myURL/index.html#debugToggleKey=d
     * @class
     * @hideconstructor
     * @name DebugPanel
     * @see me.plugins
     * @public
     * @extends me.plugin.Base
     * @memberOf me
     * @constructor
     * @example
     * // load the debugPanel in your index.html file
     * <script type="text/javascript" src="plugins/debug/debugPanel.js"></script>
     */
    me.DebugPanel = me.plugin.Base.extend({
        /** @private */
        init : function (debugToggle) {
            // call the super constructor
            this._super(me.plugin.Base, "init");
            this.panel = new DebugPanel(debugToggle);

            // if "#debug" is present in the URL
            if (me.game.HASH.debug === true) {
                this.show();
            } // else keep it hidden
        },

        /**
         * show the debug panel
         * @public
         * @function
         * @memberOf me.DebugPanel
         */
        show : function () {
            this.panel.show();
        },

        /**
         * hide the debug panel
         * @public
         * @function
         * @memberOf me.DebugPanel
         */
        hide : function () {
            this.panel.hide();
        },

        /**
         * toggle the debug panel visibility state
         * @public
         * @function
         * @memberOf me.DebugPanel
         */
        toggle : function () {
            if (this.panel.visible) {
                this.panel.hide();
            } else {
                this.panel.show();
            }
        }


    });

    // PRIVATE components

    var DEBUG_HEIGHT = 50;

    var Counters = me.Object.extend({
        init : function (stats) {
            this.stats = {};
            this.reset(stats);
        },

        reset : function (stats) {
            var self = this;
            (stats || Object.keys(this.stats)).forEach(function (stat) {
                self.stats[stat] = 0;
            });
        },

        inc : function (stat, value) {
            this.stats[stat] += (value || 1);
        },

        get : function (stat) {
            return this.stats[stat];
        }
    });

    // embedded bitmap font data
    var fontDataSource =
        "info face=\"PressStart2P\" size=10 bold=0 italic=0 charset= unicode= stretchH=100 smooth=1 aa=1 padding=1,1,1,1 spacing=0,0 outline=0\n" +
        "common lineHeight=10 base=10 scaleW=128 scaleH=128 pages=1 packed=0\n" +
        "page id=0 file=\"PressStart2P.png\"\n" +
        "chars count=95\n" +
        "char id=32 x=1 y=1 width=0 height=0 xoffset=0 yoffset=10 xadvance=10 page=0 chnl=15\n" +
        "char id=33 x=1 y=2 width=5 height=10 xoffset=3 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=34 x=1 y=13 width=8 height=5 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=35 x=7 y=1 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=36 x=1 y=19 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=37 x=1 y=30 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=38 x=1 y=41 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=39 x=10 y=12 width=4 height=5 xoffset=3 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=40 x=1 y=52 width=6 height=10 xoffset=3 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=41 x=1 y=63 width=6 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=42 x=1 y=74 width=10 height=8 xoffset=0 yoffset=1 xadvance=10 page=0 chnl=15\n" +
        "char id=43 x=8 y=52 width=9 height=8 xoffset=1 yoffset=1 xadvance=10 page=0 chnl=15\n" +
        "char id=44 x=8 y=61 width=5 height=5 xoffset=1 yoffset=6 xadvance=10 page=0 chnl=15\n" +
        "char id=45 x=8 y=67 width=9 height=2 xoffset=1 yoffset=4 xadvance=10 page=0 chnl=15\n" +
        "char id=46 x=14 y=61 width=4 height=4 xoffset=3 yoffset=6 xadvance=10 page=0 chnl=15\n" +
        "char id=47 x=12 y=18 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=48 x=18 y=1 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=49 x=12 y=29 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=50 x=12 y=40 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=51 x=22 y=29 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=52 x=23 y=12 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=53 x=29 y=1 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=54 x=1 y=83 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=55 x=1 y=94 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=56 x=1 y=105 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=57 x=1 y=116 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=58 x=18 y=51 width=4 height=8 xoffset=3 yoffset=1 xadvance=10 page=0 chnl=15\n" +
        "char id=59 x=12 y=70 width=5 height=9 xoffset=1 yoffset=1 xadvance=10 page=0 chnl=15\n" +
        "char id=60 x=12 y=80 width=8 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=61 x=23 y=23 width=10 height=5 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=62 x=18 y=66 width=8 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=63 x=23 y=40 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=64 x=33 y=29 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=65 x=23 y=51 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=66 x=34 y=12 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=67 x=40 y=1 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=68 x=12 y=91 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=69 x=21 y=77 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=70 x=27 y=62 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=71 x=34 y=40 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=72 x=34 y=51 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=73 x=44 y=23 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=74 x=45 y=12 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=75 x=51 y=1 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=76 x=12 y=102 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=77 x=12 y=113 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=78 x=22 y=102 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=79 x=23 y=88 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=80 x=32 y=73 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=81 x=38 y=62 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=82 x=23 y=113 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=83 x=33 y=99 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=84 x=34 y=84 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=85 x=43 y=73 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=86 x=34 y=110 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=87 x=44 y=84 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=88 x=44 y=95 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=89 x=45 y=106 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=90 x=45 y=117 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=91 x=45 y=34 width=6 height=10 xoffset=3 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=92 x=45 y=45 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=93 x=52 y=34 width=6 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=94 x=34 y=23 width=8 height=4 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=95 x=34 y=121 width=10 height=2 xoffset=0 yoffset=9 xadvance=10 page=0 chnl=15\n" +
        "char id=96 x=15 y=12 width=4 height=4 xoffset=4 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=97 x=54 y=23 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=98 x=56 y=12 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=99 x=62 y=1 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=100 x=49 y=56 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=101 x=56 y=45 width=10 height=8 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=102 x=59 y=31 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=103 x=54 y=67 width=10 height=9 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=104 x=60 y=54 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=105 x=67 y=42 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=106 x=67 y=9 width=8 height=11 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=107 x=69 y=21 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=108 x=76 y=1 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=109 x=76 y=12 width=10 height=8 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=110 x=69 y=32 width=10 height=8 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=111 x=86 y=1 width=10 height=8 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=112 x=97 y=1 width=10 height=9 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=113 x=108 y=1 width=10 height=9 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=114 x=87 y=10 width=9 height=8 xoffset=1 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=115 x=97 y=11 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=116 x=108 y=11 width=9 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=117 x=87 y=19 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=118 x=98 y=19 width=9 height=8 xoffset=1 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=119 x=80 y=27 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=120 x=108 y=22 width=10 height=8 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=121 x=91 y=28 width=10 height=9 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=122 x=80 y=35 width=10 height=7 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=123 x=118 y=11 width=6 height=10 xoffset=3 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=124 x=102 y=28 width=4 height=10 xoffset=4 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=125 x=119 y=22 width=6 height=10 xoffset=1 yoffset=0 xadvance=10 page=0 chnl=15\n" +
        "char id=126 x=91 y=38 width=10 height=5 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15\n" +
        "char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=3 xadvance=10 page=0 chnl=15";

    var fontImageSource = "data:image/png;base64,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";

    var DebugPanel = me.Renderable.extend({
        /** @private */
        init : function (debugToggle) {
            // call the super constructor
            this._super(me.Renderable, "init", [ 0, 0, me.video.renderer.getWidth(), DEBUG_HEIGHT ]);

            // enable collision and event detection
            this.isKinematic = false;

            // minimum melonJS version expected
            this.version = "6.3.0";

            // to hold the debug options
            // clickable rect area
            this.area = {};

            // Useful counters
            this.counters = new Counters([
                "shapes",
                "sprites",
                "velocity",
                "bounds",
                "children"
            ]);

            // for z ordering
            // make it ridiculously high
            this.pos.z = Infinity;

            // visibility flag
            this.visible = false;

            // frame update time in ms
            this.frameUpdateTime = 0;

            // frame draw time in ms
            this.frameDrawTime = 0;

            // set the object GUID value
            this.GUID = "debug-" + me.utils.createGUID();

            // set the object entity name
            this.name = "me.debugPanel";

            // persistent
            this.isPersistent = true;

            // a floating object
            this.floating = true;

            // renderable
            this.isRenderable = true;

            // always update, even when not visible
            this.alwaysUpdate = true;

            // WebGL/Canvas compatibility
            this.canvas = me.video.createCanvas(this.width, this.height, true);

            // create a default font, with fixed char width
            this.font_size = 10;
            this.mod = 2;
            if (this.width < 500) {
                this.font_size = 7;
                this.mod = this.mod * (this.font_size / 10);
            }

            // create the bitmapfont
            var fontImage = new Image();
            fontImage.src = fontImageSource;

            this.font = new me.BitmapText(0, 0, {
                fontData: fontDataSource,
                font: fontImage
            });
            this.font.name = "debugPanelFont";


            // free static ressources
            fontImageSource = null;
            fontDataSource = null;

            // clickable areas
            var size = 10 * this.mod;
            this.area.renderHitBox   = new me.Rect(250, 2,  size, size);
            this.area.renderVelocity = new me.Rect(250, 17, size, size);
            this.area.renderQuadTree = new me.Rect(410, 2,  size, size);

            // enable the FPS counter
            me.debug.displayFPS = true;

            var self = this;

            // add some keyboard shortcuts
            this.debugToggle = debugToggle || me.input.KEY.S;
            this.keyHandler = me.event.subscribe(me.event.KEYDOWN, function (action, keyCode) {
                if (keyCode === self.debugToggle) {
                    me.plugins.debugPanel.toggle();
                }
            });

            // some internal string/length
            this.help_str        = "["+String.fromCharCode(32 + this.debugToggle)+"]show/hide";
            this.help_str_len    = this.font.measureText(this.help_str).width;
            this.fps_str_len     = this.font.measureText("00/00 fps").width;
            this.memoryPositionX = 325 * this.mod;

            // resize the panel if the browser is resized
            me.event.subscribe(me.event.CANVAS_ONRESIZE, function (w) {
                self.resize(w, DEBUG_HEIGHT);
            });

            //patch patch patch !
            this.patchSystemFn();

            this.anchorPoint.set(0, 0);
        },

        /**
         * patch system fn to draw debug information
         * @ignore
         */
        patchSystemFn : function () {

            // add a few new debug flag (if not yet defined)
            me.debug.renderHitBox   = me.debug.renderHitBox   || me.game.HASH.hitbox || false;
            me.debug.renderVelocity = me.debug.renderVelocity || me.game.HASH.velocity || false;
            me.debug.renderQuadTree = me.debug.renderQuadTree || me.game.HASH.quadtree || false;

            var _this = this;
            var bounds = new me.Rect(0, 0, 0, 0);

            // patch timer.js
            me.plugin.patch(me.timer, "update", function (dt) {
                // call the original me.timer.update function
                this._patched.apply(this, arguments);

                // call the FPS counter
                me.timer.countFPS();
            });

            // patch me.game.update
            me.plugin.patch(me.game, "update", function (dt) {
                var frameUpdateStartTime = window.performance.now();

                this._patched.apply(this, arguments);

                // calculate the update time
                _this.frameUpdateTime = window.performance.now() - frameUpdateStartTime;
            });

            // patch me.game.draw
            me.plugin.patch(me.game, "draw", function () {
                var frameDrawStartTime = window.performance.now();

                _this.counters.reset();

                this._patched.apply(this, arguments);

                // calculate the drawing time
                _this.frameDrawTime = window.performance.now() - frameDrawStartTime;
            });

            // patch sprite.js
            me.plugin.patch(me.Sprite, "draw", function (renderer) {

                // call the original me.Sprite.draw function
                this._patched(renderer);

                // don't do anything else if the panel is hidden
                if (_this.visible) {

                    // increment the sprites counter
                    _this.counters.inc("sprites");

                    // draw the sprite rectangle
                    if (me.debug.renderHitBox) {
                        var bounds = this.getBounds();
                        var ax = this.anchorPoint.x * bounds.width,
                            ay = this.anchorPoint.y * bounds.height;

                        var ancestor = this.ancestor;
                        if (ancestor instanceof me.Container && ancestor.root === false) {
                            ax -= ancestor._absPos.x;
                            ay -= ancestor._absPos.y;
                        } else if (ancestor instanceof me.Entity) {
                            ancestor = ancestor.ancestor;
                            if (ancestor instanceof me.Container && ancestor.root === false) {
                                // is this correct ???
                                ax = ay = 0;
                            }
                        }

                        // translate back as the bounds position
                        // is already adjusted to the anchor Point
                        renderer.translate(ax, ay);

                        renderer.setColor("green");
                        renderer.stroke(bounds);

                        renderer.translate(-ax, -ay);

                        // the sprite mask if defined
                        if (typeof this.mask !== "undefined") {
                            renderer.setColor("orange");
                            renderer.stroke(this.mask);
                        }

                        if (typeof this.body !== "undefined") {
                            renderer.translate(this.pos.x, this.pos.y);
                            // draw all defined shapes
                            renderer.setColor("red");
                            for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                                renderer.stroke(shape);
                                _this.counters.inc("shapes");
                            }
                        }
                    }
                }
            });


            me.plugin.patch(me.BitmapText, "draw", function (renderer) {
                // call the original me.Sprite.draw function
                this._patched.apply(this, arguments);

                // draw the font rectangle
                if (_this.visible && me.debug.renderHitBox && this.name !== "debugPanelFont") {
                    var bounds = this.getBounds();

                    if (typeof this.ancestor !== "undefined") {
                        var ax = this.anchorPoint.x * bounds.width,
                            ay = this.anchorPoint.y * bounds.height;
                        // translate back as the bounds position
                        // is already adjusted to the anchor Point
                        renderer.translate(ax, ay);
                    } else {
                        renderer.save();
                    }

                    renderer.setColor("orange");
                    renderer.stroke(bounds);
                    _this.counters.inc("bounds");

                    if (typeof this.ancestor === "undefined") {
                        renderer.restore();
                    }
                }
            });

            // patch font.js
            me.plugin.patch(me.Text, "draw", function (renderer, text, x, y) {
                // call the original me.Text.draw function
                this._patched.apply(this, arguments);

                // call the original me.Sprite.draw function
                if (_this.visible && me.debug.renderHitBox) {
                    if (typeof this.ancestor === "undefined") {
                        renderer.save();
                    }
                    renderer.setColor("orange");
                    renderer.stroke(this.getBounds());
                    _this.counters.inc("bounds");
                    if (typeof this.ancestor === "undefined") {
                        renderer.restore();
                    }
                }
            });

            // patch font.js
            me.plugin.patch(me.Text, "drawStroke", function (renderer, text, x, y) {
                // call the original me.Font.drawStroke function
                this._patched.apply(this, arguments);

                // draw the font rectangle
                if (_this.visible && me.debug.renderHitBox) {
                    if (typeof this.ancestor === "undefined") {
                        renderer.save();
                    }
                    renderer.setColor("orange");
                    renderer.stroke(this.getBounds());
                    _this.counters.inc("bounds");
                    if (typeof this.ancestor === "undefined") {
                        renderer.restore();
                    }
                }
            });

            // patch entities.js
            me.plugin.patch(me.Entity, "postDraw", function (renderer) {
                // don't do anything else if the panel is hidden
                if (_this.visible) {
                    // increment the bounds counter
                    _this.counters.inc("bounds");

                    // check if debug mode is enabled
                    if (me.debug.renderHitBox) {
                        renderer.save();

                        renderer.translate(
                            -this.pos.x - this.body.pos.x - this.ancestor._absPos.x,
                            -this.pos.y - this.body.pos.y - this.ancestor._absPos.y
                        );

                        if (this.renderable instanceof me.Renderable) {
                            renderer.translate(
                                -this.anchorPoint.x * this.body.width,
                                -this.anchorPoint.y * this.body.height
                            );
                        }

                        // draw the bounding rect shape
                        renderer.setColor("orange");
                        renderer.stroke(this.getBounds());

                        renderer.translate(
                            this.pos.x + this.ancestor._absPos.x,
                            this.pos.y + this.ancestor._absPos.y
                        );

                        // draw all defined shapes
                        renderer.setColor("red");
                        for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                            renderer.stroke(shape);
                            _this.counters.inc("shapes");
                        }
                        renderer.restore();
                    }

                    if (me.debug.renderVelocity && (this.body.vel.x || this.body.vel.y)) {
                        bounds.copy(this.getBounds());
                        bounds.pos.sub(this.ancestor._absPos);
                        // draw entity current velocity
                        var x = bounds.width / 2;
                        var y = bounds.height / 2;

                        renderer.save();
                        renderer.setLineWidth(1);

                        renderer.setColor("blue");
                        renderer.translate(-x, -y);
                        renderer.strokeLine(0, 0, ~~(this.body.vel.x * (bounds.width / 2)), ~~(this.body.vel.y * (bounds.height / 2)));
                        _this.counters.inc("velocity");

                        renderer.restore();
                    }
                }
                // call the original me.Entity.postDraw function
                this._patched.apply(this, arguments);
            });

            // patch container.js
            me.plugin.patch(me.Container, "draw", function (renderer, rect) {
                // call the original me.Container.draw function
                this._patched.apply(this, arguments);

                // check if debug mode is enabled
                if (!_this.visible) {
                    // don't do anything else if the panel is hidden
                    return;
                }

                // increment counters
                _this.counters.inc("bounds");
                _this.counters.inc("children");

                if (me.debug.renderHitBox) {
                    renderer.save();
                    renderer.setLineWidth(1);

                    if (!this.root) {
                        renderer.translate(
                            -this._absPos.x,
                            -this._absPos.y
                        );
                    }

                    // draw the bounding rect shape
                    renderer.setColor("orange");
                    renderer.stroke(this.getBounds());

                    // draw the children bounding rect shape
                    renderer.setColor("purple");
                    renderer.stroke(this.childBounds);

                    renderer.restore();
                }
            });
        },

        /**
         * show the debug panel
         * @ignore
         */
        show : function () {
            if (!this.visible) {
                // add the debug panel to the game world
                me.game.world.addChild(this, Infinity);
                // register a mouse event for the checkboxes
                me.input.registerPointerEvent("pointerdown", this, this.onClick.bind(this));
                // mark it as visible
                this.visible = true;
                // force repaint
                me.game.repaint();
            }
        },

        /**
         * hide the debug panel
         * @ignore
         */
        hide : function () {
            if (this.visible) {
                // release the mouse event for the checkboxes
                me.input.releasePointerEvent("pointerdown", this);
                // remove the debug panel from the game world
                me.game.world.removeChild(this, true);
                // mark it as invisible
                this.visible = false;
                // force repaint
                me.game.repaint();
            }
        },


        /** @private */
        update : function () {
            return this.visible;
        },

        /** @private */
        onClick : function (e)  {
            // check the clickable areas
            if (this.area.renderHitBox.containsPoint(e.gameX, e.gameY)) {
                me.debug.renderHitBox = !me.debug.renderHitBox;
            } else if (this.area.renderVelocity.containsPoint(e.gameX, e.gameY)) {
                // does nothing for now, since velocity is
                // rendered together with hitboxes (is a global debug flag required?)
                me.debug.renderVelocity = !me.debug.renderVelocity;
            } else if (this.area.renderQuadTree.containsPoint(e.gameX, e.gameY)) {
                me.debug.renderQuadTree = !me.debug.renderQuadTree;
            }
            // force repaint
            me.game.repaint();
        },

        /** @private */
        drawQuadTreeNode : function (renderer, node) {
            var bounds = node.bounds;

            // draw the current bounds
            if (node.nodes.length === 0) {
                // cap the alpha value to 0.4 maximum
                var _alpha = (node.objects.length * 0.4) / me.collision.maxChildren;
                if (_alpha > 0.0) {
                    renderer.save();
                    renderer.setColor("rgba(255,0,0," + _alpha + ")");
                    renderer.fillRect(bounds.pos.x, bounds.pos.y, bounds.width, bounds.height);
                    renderer.restore();
                }
            } else {
                //has subnodes? drawQuadtree them!
                for (var i = 0; i < node.nodes.length; i++) {
                    this.drawQuadTreeNode(renderer, node.nodes[i]);
                }
            }
        },

        /** @private */
        drawQuadTree : function (renderer) {
            var x = me.game.viewport.pos.x;
            var y = me.game.viewport.pos.y;

            renderer.translate(-x, -y);

            this.drawQuadTreeNode(renderer, me.collision.quadTree);

            renderer.translate(x, y);
        },

        /** @private */
        drawMemoryGraph : function (renderer, endX) {
            if (window.performance && window.performance.memory) {
                var usedHeap  =  me.Math.round(window.performance.memory.usedJSHeapSize / 1048576, 2);
                var totalHeap =  me.Math.round(window.performance.memory.totalJSHeapSize / 1048576, 2);
                var maxLen = ~~(endX - this.memoryPositionX - 5);
                var len = maxLen * (usedHeap / totalHeap);

                renderer.setColor("#0065AD");
                renderer.fillRect(this.memoryPositionX, 0, maxLen, 20);
                renderer.setColor("#3AA4F0");
                renderer.fillRect(this.memoryPositionX + 1, 1, len - 1, 17);

                this.font.draw(renderer, "Heap : " + usedHeap + "/" + totalHeap + " MB", this.memoryPositionX + 5, 2 * this.mod);
            } else {
                // Heap Memory information not available
                this.font.draw(renderer, "Heap : ??/?? MB", this.memoryPositionX, 2 * this.mod);
            }
            this.font.draw(renderer, "Pool : " + me.pool.getInstanceCount(), this.memoryPositionX, 10 * this.mod);
        },

        /** @private */
        draw : function (renderer) {
            renderer.save();

            // draw the QuadTree (before the panel)
            if (me.debug.renderQuadTree === true) {
                this.drawQuadTree(renderer);
            }

            // draw the panel
            renderer.setGlobalAlpha(0.5);
            renderer.setColor("black");
            renderer.fillRect(
                this.left,  this.top,
                this.width, this.height
            );
            renderer.setGlobalAlpha(1.0);
            renderer.setColor("white");

            this.font.textAlign = "left";

            this.font.draw(renderer, "#objects : " + me.game.world.children.length, 5 * this.mod, 2 * this.mod);
            this.font.draw(renderer, "#draws   : " + me.game.world.drawCount, 5 * this.mod, 10 * this.mod);

            // debug checkboxes
            this.font.draw(renderer, "?hitbox   [" + (me.debug.renderHitBox ? "x" : " ") + "]",   75 * this.mod, 2 * this.mod);
            this.font.draw(renderer, "?velocity [" + (me.debug.renderVelocity ? "x" : " ") + "]", 75 * this.mod, 10 * this.mod);

            this.font.draw(renderer, "?QuadTree [" + (me.debug.renderQuadTree ? "x" : " ") + "]", 150 * this.mod, 2 * this.mod);

            // draw the update duration
            this.font.draw(renderer, "Update : " + this.frameUpdateTime.toFixed(2) + " ms", 225 * this.mod, 2 * this.mod);
            // draw the draw duration
            this.font.draw(renderer, "Draw   : " + this.frameDrawTime.toFixed(2) + " ms", 225 * this.mod, 10 * this.mod);


            // Draw color code hints (not supported with bitmapfont)
            //this.font.fillStyle.copy("red");
            this.font.draw(renderer, "Shapes   : " + this.counters.get("shapes"), 5 * this.mod, 17 * this.mod);

            //this.font.fillStyle.copy("green");
            this.font.draw(renderer, "Sprites   : " + this.counters.get("sprites"), 75 * this.mod, 17 * this.mod);

            //this.font.fillStyle.copy("blue");
            this.font.draw(renderer, "Velocity  : " + this.counters.get("velocity"), 150 * this.mod, 17 * this.mod);

            //this.font.fillStyle.copy("orange");
            this.font.draw(renderer, "Bounds : " + this.counters.get("bounds"), 225 * this.mod, 17 * this.mod);

            //this.font.fillStyle.copy("purple");
            this.font.draw(renderer, "Children : " + this.counters.get("children"), 325 * this.mod, 17 * this.mod);

            // Reset font style
            //this.font.setFont("courier", this.font_size, "white");

            // draw the memory heap usage
            var endX = this.width - 5;
            this.drawMemoryGraph(renderer, endX - this.help_str_len);

            this.font.textAlign = "right";

            // some help string
            this.font.draw(renderer, this.help_str, endX, 17 * this.mod);

            //fps counter
            var fps_str = me.timer.fps + "/" + me.sys.fps + " fps";
            this.font.draw(renderer, fps_str, endX, 2 * this.mod);

            renderer.restore();
        },

        /** @private */
        onDestroyEvent : function () {
            // hide the panel
            this.hide();
            // unbind keys event
            me.input.unbindKey(this.toggleKey);
            me.event.unsubscribe(this.keyHandler);
        }
    });

    // automatically register the debug panel
    me.device.onReady(function () {
        me.utils.function.defer(me.plugin.register, this, me.DebugPanel, "debugPanel",
            me.game.HASH.debugToggleKey ? me.game.HASH.debugToggleKey.charCodeAt(0) - 32 : undefined
        );
    });

    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})();
