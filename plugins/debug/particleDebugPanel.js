/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * a simple particle debug panel plugin
 * usage : me.plugin.register.defer(this, me.debug.ParticlePanel, "particledebug");
 *
 * note :
 * Heap Memory information is available under Chrome when using
 * the "--enable-memory-info" parameter to launch Chrome
 */

(function () {

    // ensure that me.debug is defined
    me.debug = me.debug || {};

    var ParticlePanel = me.Renderable.extend({

        /** @private */
        init : function () {
            // call the super constructor
            this._super(me.Renderable, "init", [ 0, me.video.renderer.getHeight() - 60, 200, 60 ]);

            // minimum melonJS version expected
            this.version = "2.2.0";

            // to hold the debug options
            // clickable rect area
            this.area = {};

            // for z ordering
            // make it ridiculously high
            this.pos.z = Infinity;

            // visibility flag
            this.visible = true;

            // set the object GUID value
            this.GUID = "particledebug-" + me.utils.createGUID();

            // set the object entity name
            this.name = "me.particleDebugPanel";

            // persistent
            this.isPersistent = true;

            // a floating object
            this.floating = true;

            // always update, even when not visible
            this.alwaysUpdate = true;

            // create a default font, with fixed char width
            this.font = new me.Font("courier", 10, "white");

            // sample points
            this.frameUpdateTimeSamples = [];
            this.frameDrawTimeSamples = [];
            this.updateTimeSamples = [];
            this.drawTimeSamples = [];
            this.updateTime = 0;
            this.drawTime = 0;
            this.updateTimeAvg = 0;
            this.drawTimeAvg = 0;
            this.frameUpdateTimeAvg = 0;
            this.frameDrawTimeAvg = 0;

            this.emitterCount = 0;
            this.particleCount = 0;

            //patch patch patch !
            this.patchSystemFn();

            // add the debug panel to the game world
            me.game.world.addChild(this, Infinity);
        },


        /**
         * patch system fn to draw debug information
         */
        patchSystemFn : function () {
            var _this = this;
            var now = Date.now;
            if (window.performance && window.performance.now) {
                now = window.performance.now.bind(window.performance);
            }

            // patch me.ParticleEmitter.init
            me.plugin.patch(me.ParticleEmitter, "init", function (x, y, image) {
                this._patched(x, y, image);
                _this.emitterCount++;
            });

            // patch me.ParticleEmitter.destroy
            me.plugin.patch(me.ParticleEmitter, "destroy", function () {
                this._patched();
                _this.emitterCount--;
            });

            // patch me.Particle.init
            me.plugin.patch(me.Particle, "init", function (emitter) {
                this._patched(emitter);
                _this.particleCount++;
            });

            // patch me.Particle.destroy
            me.Particle.prototype.destroy = function () {
                _this.particleCount--;
            };

            // patch me.game.update
            me.plugin.patch(me.game, "update", function (dt) {
                var startTime = now();
                this._patched(dt);
                // calculate the update time (can't we use [dt] here ?)
                _this.frameUpdateTimeSamples.push(now() - startTime);
            });

            // patch me.game.draw
            me.plugin.patch(me.game, "draw", function () {
                var startTime = now();
                this._patched();
                // calculate the drawing time
                _this.frameDrawTimeSamples.push(now() - startTime);
            });

            // patch me.ParticleContainer.update
            me.plugin.patch(me.ParticleContainer, "update", function (dt) {
                var startTime = now();
                var value = this._patched(dt);
                // calculate the update time (can't we use [dt] here ?)
                _this.updateTime += now() - startTime;
                return value;
            });

            // patch me.ParticleContainer.draw
            me.plugin.patch(me.ParticleContainer, "draw", function (renderer, rect) {
                var startTime = now();
                this._patched(renderer, rect);
                // calculate the drawing time
                _this.drawTime += now() - startTime;
            });
        },

        /** @private */
        update : function () {
            return true;
        },


        /**
         * @private
         */
        drawGraph : function (renderer) {
            var updateTimeSamples = this.updateTimeSamples;
            var drawTimeSamples = this.drawTimeSamples;
            var frameUpdateTimeSamples = this.frameUpdateTimeSamples;
            var frameDrawTimeSamples = this.frameDrawTimeSamples;
            var width = this._bounds.width, height = this._bounds.height;

            while (updateTimeSamples.length > width) {
                updateTimeSamples.shift();
            }
            while (drawTimeSamples.length > width) {
                drawTimeSamples.shift();
            }
            while (frameUpdateTimeSamples.length > width) {
                frameUpdateTimeSamples.shift();
            }
            while (frameDrawTimeSamples.length > width) {
                frameDrawTimeSamples.shift();
            }

            var maxTime = 60, scale = height / maxTime, len = updateTimeSamples.length;
            var frameTimeLimit = 1000 / me.sys.fps, where = height - frameTimeLimit * scale;

            renderer.setColor("#80808080");
            renderer.strokeLine(0, where, width, where);
            renderer.setColor("#FFFFFFFF");


            var updateTimeSum = 0, drawTimeSum = 0, frameUpdateTimeSum = 0, frameDrawTimeSum = 0, update = [], slowUpdate = [], draw = [], slowDraw = [];
            // prepare data
            for (var x = 0, updateTime, drawTime, slow; x < len; ++x) {
                updateTime = updateTimeSamples[x] || 0;
                drawTime = drawTimeSamples[x] || 0;
                slow = (updateTime + drawTime > frameTimeLimit);
                updateTimeSum += updateTime;
                drawTimeSum += drawTime;
                frameUpdateTimeSum += frameUpdateTimeSamples[x] || 0;
                frameDrawTimeSum += frameDrawTimeSamples[x] || 0;

                updateTime *= scale;
                update.push(slow ? 0 : updateTime);
                slowUpdate.push(slow ? updateTime : 0);

                drawTime = updateTime + drawTime * scale;
                draw.push(slow ? 0 : drawTime);
                slowDraw.push(slow ? drawTime : 0);
            }
            this.updateTimeAvg = updateTimeSum / len;
            this.drawTimeAvg = drawTimeSum / len;
            this.frameUpdateTimeAvg = frameUpdateTimeSum / len;
            this.frameDrawTimeAvg = frameDrawTimeSum / len;

            // draw the graph
            this.fillArea(renderer, width, height, draw, "lightblue");
            this.fillArea(renderer, width, height, slowDraw, "lightcoral");
            this.fillArea(renderer, width, height, update, "lightgreen");
            this.fillArea(renderer, width, height, slowUpdate, "lightsalmon");

            renderer.setGlobalAlpha(1.0);
        },

        /**
         * @private
         */
        fillArea : function (renderer, width, height, data, color) {
            var i, x, y, len = data.length;
            var context = renderer.getContext();
            context.fillStyle = color;
            context.beginPath();
            context.moveTo(width, height);
            for (i = len; i--;) {
                x = width - (len - i);
                y = height - data[i];
                context.lineTo(x, y < 0 ? 0 : y);
                context.lineTo(x - 1, y < 0 ? 0 : y);
            }
            context.lineTo(0, height);
            context.closePath();
            context.fill();
        },

        /** @private */
        draw : function (renderer) {
            renderer.save();

            // draw the panel
            renderer.setColor("#00000080");

            renderer.fillRect(this._bounds.left, this._bounds.top,
                              this._bounds.width, this._bounds.height);
            renderer.translate(this._bounds.left, this._bounds.top);

            renderer.setColor("#FFFFFFFF");

            // # entities / draw
            this.font.draw(renderer, "emitters : " + this.emitterCount, 5, 5);
            this.font.draw(renderer, "particles : " + this.particleCount, 5, 18);

            // draw the update duration
            this.font.draw(renderer, "update: " + this.updateTimeAvg.toFixed(2) + "ms / " + this.frameUpdateTimeAvg.toFixed(2) + "ms", 5, 31);

            // draw the draw duration
            this.font.draw(renderer, "draw: " + this.drawTimeAvg.toFixed(2) + "ms / " + this.frameDrawTimeAvg.toFixed(2) + "ms", 5, 44);

            this.updateTimeSamples.push(this.updateTime);
            this.updateTime = 0;
            this.drawTimeSamples.push(this.drawTime);
            this.drawTime = 0;

            // draw the graph
            this.drawGraph(renderer);

            renderer.restore();
        }
    });

    /**
     * @class
     * @public
     * @extends me.plugin.Base
     * @memberOf me
     * @constructor
     */
    me.debug.ParticlePanel = me.plugin.Base.extend(
    /** @scope me.debug.ParticlePanel.prototype */
    {

        /** @private */
        init : function () {
            // call the super constructor
            this._super(me.plugin.Base, "init");

            this.panel = new ParticlePanel();
        }
    });

    // automatically register the debug panel
    window.onReady(function () {
        me.plugin.register.defer(this, me.debug.ParticlePanel, "particleDebugPanel");
    });

    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})();
