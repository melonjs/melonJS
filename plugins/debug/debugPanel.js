/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * a simple debug panel plugin
 * usage : me.plugin.register.defer(this, me.debug.Panel, "debug");
 *
 * you can then use me.plugin.debug.show() or me.plugin.debug.hide()
 * to show or hide the panel, or press respectively the "S" and "H" keys.
 *
 * note :
 * Heap Memory information is available under Chrome when using
 * the "--enable-memory-info" parameter to launch Chrome
 */

(function () {

    // ensure that me.debug is defined
    me.debug = me.debug || {};

    var DEBUG_HEIGHT = 50;

    var Counters = Object.extend({
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

    var DebugPanel = me.Renderable.extend({
        /** @private */
        init : function (showKey, hideKey) {
            // call the super constructor
            this._super(me.Renderable, "init", [ 0, 0, me.game.viewport.width, DEBUG_HEIGHT ]);

            // minimum melonJS version expected
            this.version = "2.1.0";

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
            this.z = Infinity;

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
            this.mod = 1;
            if (this.width < 500) {
                this.font_size = 7;
                this.mod = 0.7;
            }
            this.font = new me.Font("courier", this.font_size, "white");

            // clickable areas
            var size = 12 * this.mod;
            this.area.renderHitBox   = new me.Rect(163, 5,  size, size);
            this.area.renderVelocity = new me.Rect(163, 20, size, size);
            this.area.renderQuadTree = new me.Rect(253, 5,  size, size);

            // some internal string/length
            this.help_str        = "(s)how/(h)ide";
            this.help_str_len    = this.font.measureText(me.video.renderer, this.help_str).width;
            this.fps_str_len     = this.font.measureText(me.video.renderer, "00/00 fps").width;
            this.memoryPositionX = 400 * this.mod;

            // enable the FPS counter
            me.debug.displayFPS = true;

            // bind the "S" and "H" keys
            me.input.bindKey(showKey || me.input.KEY.S, "show", false, false);
            me.input.bindKey(hideKey || me.input.KEY.H, "hide", false, false);

            // add some keyboard shortcuts
            var self = this;
            this.keyHandler = me.event.subscribe(me.event.KEYDOWN, function (action) {
                if (action === "show") {
                    self.show();
                }
                else if (action === "hide") {
                    self.hide();
                }
            });
            me.event.subscribe(me.event.VIEWPORT_ONRESIZE, function (w) {
                self.resize(w, DEBUG_HEIGHT);
            });

            //patch patch patch !
            this.patchSystemFn();
        },

        /**
         * patch system fn to draw debug information
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
                this._patched(dt);

                // call the FPS counter
                me.timer.countFPS();
            });

            // patch me.game.update
            me.plugin.patch(me.game, "update", function (dt) {
                var frameUpdateStartTime = window.performance.now();

                this._patched(dt);

                // calculate the update time
                _this.frameUpdateTime = window.performance.now() - frameUpdateStartTime;
            });

            // patch me.game.draw
            me.plugin.patch(me.game, "draw", function () {
                var frameDrawStartTime = window.performance.now();

                _this.counters.reset();
                this._patched();

                // calculate the drawing time
                _this.frameDrawTime = window.performance.now() - frameDrawStartTime;
            });

            // patch sprite.js
            me.plugin.patch(me.Sprite, "draw", function (renderer) {
                // call the original me.Sprite.draw function
                this._patched(renderer);

                // draw the sprite rectangle
                if (me.debug.renderHitBox) {
                    renderer.save();
                    renderer.setColor("green");
                    renderer.strokeRect(this.left, this.top, this.width, this.height);
                    _this.counters.inc("sprites");
                    renderer.restore();
                }
            });

            // patch entities.js
            me.plugin.patch(me.Entity, "draw", function (renderer) {
                // call the original me.Entity.draw function
                this._patched(renderer);

                // check if debug mode is enabled
                if (me.debug.renderHitBox) {
                    renderer.save();
                    renderer.setLineWidth(1);

                    // draw the bounding rect shape
                    renderer.setColor("orange");
                    bounds.copy(this.getBounds());
                    bounds.pos.sub(this.ancestor._absPos);
                    renderer.drawShape(bounds);
                    _this.counters.inc("bounds");

                    // draw all defined shapes
                    renderer.setColor("red");
                    renderer.translate(this.pos.x, this.pos.y);
                    for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                        renderer.drawShape(shape);
                        _this.counters.inc("shapes");
                    }

                    renderer.restore();
                }

                if (me.debug.renderVelocity && (this.body.vel.x || this.body.vel.y)) {
                    bounds.copy(this.getBounds());
                    bounds.pos.sub(this.ancestor._absPos);
                    // draw entity current velocity
                    var x = ~~(bounds.pos.x + (bounds.width / 2));
                    var y = ~~(bounds.pos.y + (bounds.height / 2));

                    renderer.save();
                    renderer.setLineWidth(1);

                    renderer.setColor("blue");
                    renderer.translate(x, y);
                    renderer.strokeLine(0, 0, ~~(this.body.vel.x * (bounds.width / 2)), ~~(this.body.vel.y * (bounds.height / 2)));
                    _this.counters.inc("velocity");

                    renderer.restore();
                }
            });

            // patch container.js
            me.plugin.patch(me.Container, "draw", function (renderer, rect) {
                // call the original me.Container.draw function
                this._patched(renderer, rect);

                // check if debug mode is enabled

                if (me.debug.renderHitBox) {
                    renderer.save();
                    renderer.setLineWidth(1);

                    // draw the bounding rect shape
                    renderer.setColor("orange");
                    bounds.copy(this.getBounds());
                    bounds.pos.sub(this.ancestor._absPos);
                    renderer.drawShape(bounds);
                    _this.counters.inc("bounds");

                    // draw the children bounding rect shape
                    renderer.setColor("purple");
                    bounds.copy(this.childBounds);
                    bounds.pos.sub(this.ancestor._absPos);
                    renderer.drawShape(bounds);
                    _this.counters.inc("children");

                    renderer.restore();
                }
            });
        },

        /**
         * show the debug panel
         */
        show : function () {
            if (!this.visible) {
                // register a mouse event for the checkboxes
                me.input.registerPointerEvent("pointerdown", this, this.onClick.bind(this), true);
                // add the debug panel to the game world
                me.game.world.addChild(this, Infinity);
                // mark it as visible
                this.visible = true;
            }
        },

        /**
         * hide the debug panel
         */
        hide : function () {
            if (this.visible) {
                // release the mouse event for the checkboxes
                // me.input.releasePointerEvent("pointerdown", this);
                this.canvas.removeEventListener("click", this.onClick.bind(this));
                // remove the debug panel from the game world
                me.game.world.removeChild(this);
                // mark it as invisible
                this.visible = false;
            }
        },


        /** @private */
        update : function () {
            if (me.input.isKeyPressed("show")) {
                this.show();
            }
            else if (me.input.isKeyPressed("hide")) {
                this.hide();
            }
            return true;
        },

        /** @private */
        onClick : function (e)  {
            // check the clickable areas
            if (this.area.renderHitBox.containsPoint(e.gameX, e.gameY)) {
                me.debug.renderHitBox = !me.debug.renderHitBox;
            }
            else if (this.area.renderVelocity.containsPoint(e.gameX, e.gameY)) {
                // does nothing for now, since velocity is
                // rendered together with hitboxes (is a global debug flag required?)
                me.debug.renderVelocity = !me.debug.renderVelocity;
            }
            else if (this.area.renderQuadTree.containsPoint(e.gameX, e.gameY)) {
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
            }
            else {
                //has subnodes? drawQuadtree them!
                for (var i = 0; i < node.nodes.length; i++) {
                    this.drawQuadTreeNode(renderer, node.nodes[i]);
                }
            }
        },

        /** @private */
        drawQuadTree : function (renderer) {
            // save the current globalAlpha value
            var _alpha = renderer.globalAlpha();
            var x = me.game.viewport.pos.x;
            var y = me.game.viewport.pos.y;

            renderer.translate(-x, -y);

            this.drawQuadTreeNode(renderer, me.collision.quadTree);

            renderer.translate(x, y);

            renderer.setGlobalAlpha(_alpha);
        },

        /** @private */
        drawMemoryGraph : function (renderer, endX) {
            if (window.performance && window.performance.memory) {
                var usedHeap  = Number.prototype.round(window.performance.memory.usedJSHeapSize / 1048576, 2);
                var totalHeap =  Number.prototype.round(window.performance.memory.totalJSHeapSize / 1048576, 2);
                var maxLen = ~~(endX - this.memoryPositionX - 5);
                var len = maxLen * (usedHeap / totalHeap);

                renderer.setColor("#0065AD");
                renderer.fillRect(this.memoryPositionX, 0, maxLen, 20);
                renderer.setColor("#3AA4F0");
                renderer.fillRect(this.memoryPositionX + 1, 1, len - 1, 17);

                this.font.draw(renderer, "Heap : " + usedHeap + "/" + totalHeap + " MB", this.memoryPositionX + 5, 5 * this.mod);
            }
            else {
                // Heap Memory information not available
                this.font.draw(renderer, "Heap : ??/?? MB", this.memoryPositionX, 5 * this.mod);
            }
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

            this.font.draw(renderer, "#objects : " + me.game.world.children.length, 5 * this.mod, 5 * this.mod);
            this.font.draw(renderer, "#draws   : " + me.game.world.drawCount, 5 * this.mod, 20 * this.mod);

            // debug checkboxes
            this.font.draw(renderer, "?hitbox   [" + (me.debug.renderHitBox ? "x" : " ") + "]",   100 * this.mod, 5 * this.mod);
            this.font.draw(renderer, "?velocity [" + (me.debug.renderVelocity ? "x" : " ") + "]", 100 * this.mod, 20 * this.mod);

            this.font.draw(renderer, "?QuadTree [" + (me.debug.renderQuadTree ? "x" : " ") + "]", 190 * this.mod, 5 * this.mod);

            // draw the update duration
            this.font.draw(renderer, "Update : " + this.frameUpdateTime.toFixed(2) + " ms", 285 * this.mod, 5 * this.mod);
            // draw the draw duration
            this.font.draw(renderer, "Draw   : " + this.frameDrawTime.toFixed(2) + " ms", 285 * this.mod, 20 * this.mod);

            this.font.bold();

            // Draw color code hints
            this.font.fillStyle.copy("red");
            this.font.draw(renderer, "Shapes   : " + this.counters.get("shapes"), 5 * this.mod, 35 * this.mod);

            this.font.fillStyle.copy("green");
            this.font.draw(renderer, "Sprites   : " + this.counters.get("sprites"), 100 * this.mod, 35 * this.mod);

            this.font.fillStyle.copy("blue");
            this.font.draw(renderer, "Velocity  : " + this.counters.get("velocity"), 190 * this.mod, 35 * this.mod);

            this.font.fillStyle.copy("orange");
            this.font.draw(renderer, "Bounds : " + this.counters.get("bounds"), 285 * this.mod, 35 * this.mod);

            this.font.fillStyle.copy("purple");
            this.font.draw(renderer, "Children : " + this.counters.get("children"), 400 * this.mod, 35 * this.mod);

            // Reset font style
            this.font.setFont("courier", this.font_size, "white");

            // draw the memory heap usage
            var endX = this.width - 25;
            this.drawMemoryGraph(renderer, endX - this.help_str_len);

            // some help string
            this.font.draw(renderer, this.help_str, endX - this.help_str_len, 20 * this.mod);

            //fps counter
            var fps_str = me.timer.fps + "/" + me.sys.fps + " fps";
            this.font.draw(renderer, fps_str, this.width - this.fps_str_len - 5, 5 * this.mod);

            renderer.restore();
        },

        /** @private */
        onDestroyEvent : function () {
            // hide the panel
            this.hide();
            // unbind keys event
            me.input.unbindKey(me.input.KEY.S);
            me.input.unbindKey(me.input.KEY.H);
            me.event.unsubscribe(this.keyHandler);
        }
    });

    /**
     * @class
     * @public
     * @extends me.plugin.Base
     * @memberOf me
     * @constructor
     */
    me.debug.Panel = me.plugin.Base.extend(
    /** @scope me.debug.Panel.prototype */
    {

        /** @private */
        init : function (showKey, hideKey) {
            // call the super constructor
            this._super(me.plugin.Base, "init");

            var panel = new DebugPanel(showKey, hideKey);
            panel.show();
        }
    });

    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})();
