// external import
import MinPubSub from "minpubsub";

(function () {
    /**
     * an event system based on a micro publish/subscribe messaging framework
     * @namespace event
     * @memberOf me
     */
    me.event = (function () {
        // hold public stuff inside the singleton
        var api = {};

        /*
         * PUBLIC
         */

        /**
         * Channel Constant when the game is paused <br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name STATE_PAUSE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.STATE_PAUSE = "me.state.onPause";

        /**
         * Channel Constant for when the game is resumed <br>
         * Data passed : {Number} time in ms the game was paused
         * @public
         * @constant
         * @type String
         * @name STATE_RESUME
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.STATE_RESUME = "me.state.onResume";

        /**
         * Channel Constant when the game is stopped <br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name STATE_STOP
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.STATE_STOP = "me.state.onStop";

        /**
         * Channel Constant for when the game is restarted <br>
         * Data passed : {Number} time in ms the game was stopped
         * @public
         * @constant
         * @type String
         * @name STATE_RESTART
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.STATE_RESTART = "me.state.onRestart";

        /**
         * Channel Constant for when the video is initialized<br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name VIDEO_INIT
         * @memberOf me.event
         * @see me.video.init
         * @see me.event.subscribe
         */
        api.VIDEO_INIT = "me.video.onInit";


        /**
         * Channel Constant for when the game manager is initialized <br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name GAME_INIT
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAME_INIT = "me.game.onInit";

        /**
         * Channel Constant for when the game manager is resetted <br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name GAME_RESET
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAME_RESET = "me.game.onReset";

        /**
         * Channel Constant for when the game manager is updated (start of the update loop) <br>
         * Data passed : {Number} time the current time stamp
         * @public
         * @constant
         * @type String
         * @name GAME_UPDATE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAME_UPDATE = "me.game.onUpdate";

        /**
         * Channel Constant for when a level is loaded <br>
         * Data passed : {String} Level Name
         * @public
         * @constant
         * @type String
         * @name LEVEL_LOADED
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.LEVEL_LOADED = "me.game.onLevelLoaded";

        /**
         * Channel Constant for when everything has loaded <br>
         * Data passed : none <br>
         * @public
         * @constant
         * @type String
         * @name LOADER_COMPLETE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.LOADER_COMPLETE = "me.loader.onload";

        /**
         * Channel Constant for displaying a load progress indicator <br>
         * Data passed : {Number} [0 .. 1], {Resource} resource object<br>
         * @public
         * @constant
         * @type String
         * @name LOADER_PROGRESS
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.LOADER_PROGRESS = "me.loader.onProgress";

        /**
         * Channel Constant for pressing a binded key <br>
         * Data passed : {String} user-defined action, {Number} keyCode,
         * {Boolean} edge state <br>
         * Edge-state is for detecting "locked" key bindings. When a locked key
         * is pressed and held, the first event will have the third argument
         * set true. Subsequent events will continue firing with the third
         * argument set false.
         * @public
         * @constant
         * @type String
         * @name KEYDOWN
         * @memberOf me.event
         * @see me.event.subscribe
         * @example
         * me.input.bindKey(me.input.KEY.X, "jump", true); // Edge-triggered
         * me.input.bindKey(me.input.KEY.Z, "shoot"); // Level-triggered
         * me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
         *   // Checking bound keys
         *   if (action === "jump") {
         *       if (edge) {
         *           this.doJump();
         *       }
         *
         *       // Make character fall slower when holding the jump key
         *       this.vel.y = this.body.gravity;
         *   }
         * });
         */
        api.KEYDOWN = "me.input.keydown";

        /**
         * Channel Constant for releasing a binded key <br>
         * Data passed : {String} user-defined action, {Number} keyCode
         * @public
         * @constant
         * @type String
         * @name KEYUP
         * @memberOf me.event
         * @see me.event.subscribe
         * @example
         * me.event.subscribe(me.event.KEYUP, function (action, keyCode) {
         *   // Checking unbound keys
         *   if (keyCode == me.input.KEY.ESC) {
         *       if (me.state.isPaused()) {
         *           me.state.resume();
         *       }
         *       else {
         *           me.state.pause();
         *       }
         *   }
         * });
         */
        api.KEYUP = "me.input.keyup";

        /**
         * Channel Constant for when a gamepad is connected <br>
         * Data passed : {Object} gamepad object
         * @public
         * @constant
         * @type String
         * @name GAMEPAD_CONNECTED
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAMEPAD_CONNECTED = "gamepad.connected";

        /**
         * Channel Constant for when a gamepad is disconnected <br>
         * Data passed : {Object} gamepad object
         * @public
         * @constant
         * @type String
         * @name GAMEPAD_DISCONNECTED
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAMEPAD_DISCONNECTED = "gamepad.disconnected";

        /**
         * Channel Constant for when gamepad button/axis state is updated <br>
         * Data passed : {Number} index <br>
         * Data passed : {String} type : "axes" or "buttons" <br>
         * Data passed : {Number} button <br>
         * Data passed : {Number} current.value <br>
         * Data passed : {Boolean} current.pressed
         * @public
         * @constant
         * @type String
         * @name GAMEPAD_UPDATE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.GAMEPAD_UPDATE = "gamepad.update";

        /**
         * Channel Constant for pointermove events on the screen area <br>
         * Data passed : {me.Pointer} a Pointer object
         * @public
         * @constant
         * @type String
         * @name POINTERMOVE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.POINTERMOVE = "me.event.pointermove";

        /**
         * Channel Constant for dragstart events on a Draggable entity <br>
         * Data passed:
         * {Object} the drag event <br>
         * {Object} the Draggable entity
         * @public
         * @constant
         * @type String
         * @name DRAGSTART
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.DRAGSTART = "me.game.dragstart";

        /**
         * Channel Constant for dragend events on a Draggable entity <br>
         * Data passed:
         * {Object} the drag event <br>
         * {Object} the Draggable entity
         * @public
         * @constant
         * @type String
         * @name DRAGEND
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.DRAGEND = "me.game.dragend";

        /**
         * Channel Constant for when the (browser) window is resized <br>
         * Data passed : {Event} Event object
         * @public
         * @constant
         * @type String
         * @name WINDOW_ONRESIZE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.WINDOW_ONRESIZE = "window.onresize";

        /**
         * Channel Constant for when the canvas is resized <br>
         * (this usually follows a WINDOW_ONRESIZE event).<br>
         * Data passed : {Number} canvas width <br>
         * Data passed : {Number} canvas height
         * @public
         * @constant
         * @type String
         * @name CANVAS_ONRESIZE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.CANVAS_ONRESIZE = "canvas.onresize";

        /**
         * Channel Constant for when the viewport is resized <br>
         * (this usually follows a WINDOW_ONRESIZE event, when using the `flex` scaling mode is used and after the viewport was updated).<br>
         * Data passed : {Number} viewport width <br>
         * Data passed : {Number} viewport height
         * @public
         * @constant
         * @type String
         * @name VIEWPORT_ONRESIZE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.VIEWPORT_ONRESIZE = "viewport.onresize";

        /**
         * Channel Constant for when the device is rotated <br>
         * Data passed : {Event} Event object <br>
         * @public
         * @constant
         * @type String
         * @name WINDOW_ONORIENTATION_CHANGE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.WINDOW_ONORIENTATION_CHANGE = "window.orientationchange";

        /**
         * Channel Constant for when the (browser) window is scrolled <br>
         * Data passed : {Event} Event object
         * @public
         * @constant
         * @type String
         * @name WINDOW_ONSCROLL
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.WINDOW_ONSCROLL = "window.onscroll";

        /**
         * Channel Constant for when the viewport position is updated <br>
         * Data passed : {me.Vector2d} viewport position vector
         * @public
         * @constant
         * @type String
         * @name VIEWPORT_ONCHANGE
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.VIEWPORT_ONCHANGE = "viewport.onchange";

        /**
         * Channel Constant for when WebGL context is lost <br>
         * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
         * @public
         * @constant
         * @type String
         * @name WEBGL_ONCONTEXT_LOST
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.WEBGL_ONCONTEXT_LOST = "renderer.webglcontextlost";

        /**
         * Channel Constant for when WebGL context is restored <br>
         * Data passed : {me.WebGLRenderer} the current webgl renderer instance`
         * @public
         * @constant
         * @type String
         * @name WEBGL_ONCONTEXT_RESTORED
         * @memberOf me.event
         * @see me.event.subscribe
         */
        api.WEBGL_ONCONTEXT_RESTORED = "renderer.webglcontextrestored";

        /**
         * Publish some data on a channel
         * @name publish
         * @memberOf me.event
         * @public
         * @function
         * @param {String} channel The channel to publish on
         * @param {Array} arguments The data to publish
         *
         * @example Publish stuff on '/some/channel'.
         * Anything subscribed will be called with a function
         * signature like: function (a,b,c){ ... }
         *
         * me.event.publish("/some/channel", ["a","b","c"]);
         *
         */
        api.publish = MinPubSub.publish;

        /**
         * Register a callback on a named channel.
         * @name subscribe
         * @memberOf me.event
         * @public
         * @function
         * @param {String} channel The channel to subscribe to
         * @param {Function} callback The event handler, any time something is
         * published on a subscribed channel, the callback will be called
         * with the published array as ordered arguments
         * @return {handle} A handle which can be used to unsubscribe this
         * particular subscription
         * @example
         * me.event.subscribe("/some/channel", function (a, b, c){ doSomething(); });
         */

        api.subscribe = MinPubSub.subscribe;

        /**
         * Disconnect a subscribed function for a channel.
         * @name unsubscribe
         * @memberOf me.event
         * @see me.event.subscribe
         * @public
         * @function
         * @param {Array|String} handle The return value from a subscribe call or the
         * name of a channel as a String
         * @param {Function} [callback] The callback to be unsubscribed.
         * @example
         * var handle = me.event.subscribe("/some/channel", function (){});
         * me.event.unsubscribe(handle);
         *
         * // Or alternatively ...
         *
         * var callback = function (){};
         * me.event.subscribe("/some/channel", callback);
         * me.event.unsubscribe("/some/channel", callback);
         */
        api.unsubscribe = MinPubSub.unsubscribe;

        // return our object
        return api;
    })();
})();
