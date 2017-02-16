/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org/
 *
 */
(function (api) {
    /**
     * The built in Event Object
     * @external Event
     * @see {@link https://developer.mozilla.org/en/docs/Web/API/Event|Event}
     */

    /**
     * Event normalized X coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @memberof! external:Event#
     * @name external:Event#gameX
     * @type {Number}
     */

    /**
     * Event normalized Y coordinate within the game canvas itself<br>
     * <img src="images/event_coord.png"/>
     * @memberof! external:Event#
     * @name external:Event#gameY
     * @type {Number}
     */

    /**
     * Event X coordinate relative to the viewport
     * @memberof! external:Event#
     * @name external:Event#gameScreenX
     * @type {Number}
     */

    /**
     * Event Y coordinate relative to the viewport
     * @memberof! external:Event#
     * @name external:Event#gameScreenY
     * @type {Number}
     */

    /**
     * Event X coordinate relative to the map
     * @memberof! external:Event#
     * @name external:Event#gameWorldX
     * @type {Number}
     */

    /**
     * Event Y coordinate relative to the map
     * @memberof! external:Event#
     * @name external:Event#gameWorldY
     * @type {Number}
     */

     /**
      * Event X coordinate relative to the holding container
      * @memberof! external:Event#
      * @name external:Event#gameLocalX
      * @type {Number}
      */

     /**
      * Event Y coordinate relative to the holding container
      * @memberof! external:Event#
      * @name external:Event#gameLocalY
      * @type {Number}
      */

    /**
     * The unique identifier of the contact for a touch, mouse or pen <br>
     * (This id is also defined on non Pointer Event Compatible platform like pure mouse or iOS-like touch event)
     * @memberof! external:Event#
     * @name external:Event#pointerId
     * @type {Number}
     * @see http://msdn.microsoft.com/en-us/library/windows/apps/hh466123.aspx
     */

    /*
     * PRIVATE STUFF
     */

    /**
     * A pool of `Vector` objects to cache pointer/touch event coordinates.
     * @type {Array.<Vector>}
     */
    var T_VECTORS = [];
    for (var v = 0; v < 10; v++) { T_VECTORS.push(new me.Vector2d()); }

    // list of registered Event handlers
    var evtHandlers = new Map();

    // current pointer
    var currentPointer = new me.Rect(0, 0, 1, 1);

    // some useful flags
    var pointerInitialized = false;

    // Track last event timestamp to prevent firing events out of order
    var lastTimeStamp = 0;

    // "active" list of supported events
    var activeEventList = [];

    // internal constants
    var WHEEL = ["wheel"];
    var POINTER_MOVE = ["pointermove", "MSPointerMove", "mousemove", "touchmove"];
    var POINTER_DOWN = ["pointerdown", "MSPointerDown", "mousedown", "touchstart"];
    var POINTER_UP = ["pointerup", "MSPointerUp", "mouseup", "touchend"];
    var POINTER_CANCEL = ["pointercancel", "MSPointerCancel", "mousecancel", "touchcancel"];
    var POINTER_ENTER = ["pointerenter", "MSPointerEnter", "mouseenter", "touchenter"];
    var POINTER_LEAVE = ["pointerleave", "MSPointerLeave", "mouseleave", "touchleave"];

    // list of standard pointer event type
    var pointerEventList = [
        WHEEL[0],
        POINTER_MOVE[0],
        POINTER_DOWN[0],
        POINTER_UP[0],
        POINTER_CANCEL[0],
        POINTER_ENTER[0],
        POINTER_LEAVE[0]
    ];

    // previous MS prefixed pointer event type
    var MSPointerEventList = [
        WHEEL[0],
        POINTER_MOVE[1],
        POINTER_DOWN[1],
        POINTER_UP[1],
        POINTER_CANCEL[1],
        POINTER_ENTER[1],
        POINTER_LEAVE[1]
    ];

    // legacy mouse event type
    var mouseEventList = [
        WHEEL[0],
        POINTER_MOVE[2],
        POINTER_DOWN[2],
        POINTER_UP[2],
        POINTER_CANCEL[2],
        POINTER_ENTER[2],
        POINTER_LEAVE[2]
    ];

    // iOS style touch event type
    var touchEventList = [
        POINTER_MOVE[3],
        POINTER_DOWN[3],
        POINTER_UP[3],
        POINTER_CANCEL[3],
        POINTER_ENTER[3],
        POINTER_LEAVE[3]
    ];

    var pointerEventMap = {
        wheel : WHEEL,
        mousewheel : WHEEL, /* XXX: mousewheel is deprecated */
        pointermove: POINTER_MOVE,
        pointerdown: POINTER_DOWN,
        pointerup: POINTER_UP,
        pointercancel: POINTER_CANCEL,
        pointerenter: POINTER_ENTER,
        pointerleave: POINTER_LEAVE
    };

    /**
     * cache value for the offset of the canvas position within the page
     * @ignore
     */
    var viewportOffset = new me.Vector2d();

    /**
     * Array of object containing changed touch information (iOS event model)
     * @ignore
     */
    var changedTouches = [];

    /**
     * cache value for the offset of the canvas position within the page
     * @ignore
     */
    api._offset = null;

    /**
     * addEventListerner for the specified event list and callback
     * @ignore
     */
    function registerEventListener(eventList, callback) {
        for (var x = 0; x < eventList.length; x++) {
            if (POINTER_MOVE.indexOf(eventList[x]) === -1) {
                me.video.renderer.getScreenCanvas().addEventListener(eventList[x], callback, false);
            }
        }
    }

    /**
     * enable pointer event (MSPointer/Mouse/Touch)
     * @ignore
     */
    function enablePointerEvent() {
        if (!pointerInitialized) {
            // get relative canvas position in the page
            api._offset = me.video.getPos();
            // Automatically update relative canvas position on scroll
            window.addEventListener("scroll", throttle(100, false,
                function (e) {
                    api._offset = me.video.getPos();
                    me.event.publish(me.event.WINDOW_ONSCROLL, [ e ]);
                }
            ), false);

            // check standard
            if (window.PointerEvent) {
                activeEventList = pointerEventList;
            }
            else if (window.MSPointerEvent) { // check for backward compatibility with the 'MS' prefix
                activeEventList = MSPointerEventList;
            }
            else { // Regular Mouse events
                activeEventList = mouseEventList;
            }

            if (me.device.touch && me.device.isMobile) { //  `touch****` events for iOS/Android devices
                activeEventList = activeEventList.concat(touchEventList);
            }

            registerEventListener(activeEventList, onPointerEvent);

            // If W3C standard wheel events are not available, use non-standard
            if (!me.device.wheel) {
                window.addEventListener("mousewheel", onMouseWheel, false);
            }

            // set the PointerMove/touchMove/MouseMove event
            if (typeof(api.throttlingInterval) === "undefined") {
                // set the default value
                api.throttlingInterval = ~~(1000 / me.sys.fps);
            }
            // if time interval <= 16, disable the feature
            var i;
            var events = findAllActiveEvents(activeEventList, POINTER_MOVE);
            if (api.throttlingInterval < 17) {
                for (i = 0; i < events.length; i++) {
                    if (activeEventList.indexOf(events[i]) !== -1) {
                        me.video.renderer.getScreenCanvas().addEventListener(
                            events[i],
                            onMoveEvent,
                            false
                        );
                    }

                }
            }
            else {
                for (i = 0; i < events.length; i++) {
                    if (activeEventList.indexOf(events[i]) !== -1) {
                        me.video.renderer.getScreenCanvas().addEventListener(
                            events[i],
                            throttle(
                                api.throttlingInterval,
                                false,
                                onMoveEvent
                            ),
                            false
                        );
                    }
                }
            }
            pointerInitialized = true;
        }
    }

    /**
     * @ignore
     */
    function findActiveEvent(activeEventList, eventTypes) {
        for (var i = 0; i < eventTypes.length; i++) {
            var event = activeEventList.indexOf(eventTypes[i]);
            if (event !== -1) {
                return eventTypes[i];
            }
        }
    }

    /**
     * @ignore
     */
    function findAllActiveEvents(activeEventList, eventTypes) {
        var events = [];
        for (var i = 0; i < eventTypes.length; i++) {
            var event = activeEventList.indexOf(eventTypes[i]);
            if (event !== -1) {
                events.push(eventTypes[i]);
            }
        }

        return events;
    }

    /**
     * @ignore
     */
    function triggerEvent(handlers, type, e, pointerId) {
        var callback;
        if (handlers.callbacks[type]) {
            handlers.pointerId = pointerId;
            for (var i = handlers.callbacks[type].length - 1; (i >= 0) && (callback = handlers.callbacks[type][i]); i--) {
                if (callback(e) === false) {
                    // stop propagating the event if return false
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * propagate events to registered objects
     * @ignore
     */
    function dispatchEvent(e) {
        var handled = false;

        // get the current screen to world offset
        me.game.viewport.localToWorld(0, 0, viewportOffset);

        while (changedTouches.length > 0) {

            // keep a reference to the last item
            var changedTouch = changedTouches.pop();
            // and put it back into our cache
            T_VECTORS.push(changedTouch);

            // Do not fire older events
            if (typeof(e.timeStamp) !== "undefined") {
                if (e.timeStamp < lastTimeStamp) {
                    continue;
                }
                lastTimeStamp = e.timeStamp;
            }

            // if PointerEvent is not supported
            if (!me.device.pointerEvent) {
                // -> define pointerId to simulate the PointerEvent standard
                e.pointerId = changedTouch.id;
            }

            /* Initialize the two coordinate space properties. */
            e.gameScreenX = changedTouch.x;
            e.gameScreenY = changedTouch.y;
            e.gameWorldX = e.gameScreenX + viewportOffset.x;
            e.gameWorldY = e.gameScreenY + viewportOffset.y;

            currentPointer.setShape(
                e.gameWorldX,
                e.gameWorldY,
                e.width || 1,
                e.height || 1
            );

            var candidates = me.collision.quadTree.retrieve(currentPointer, me.Container.prototype._sortReverseZ);

            // add the viewport to the list of candidates
            candidates = candidates.concat([ me.game.viewport ]);

            for (var c = candidates.length, candidate; c--, (candidate = candidates[c]);) {

                if (evtHandlers.has(candidate)) {
                    var handlers = evtHandlers.get(candidate);
                    var region = handlers.region;
                    var ancestor = region.ancestor;
                    var bounds = region.getBounds();

                    if (region.floating === true) {
                        e.gameX = e.gameLocalX = e.gameScreenX;
                        e.gameY = e.gameLocalY = e.gameScreenY;
                    } else {
                        e.gameX = e.gameLocalX = e.gameWorldX;
                        e.gameY = e.gameLocalY = e.gameWorldY;
                    }
                    // adjust gameLocalX to specify coordinates
                    // within the region ancestor container
                    if (typeof ancestor !== "undefined") {
                        var parentPos = ancestor.getBounds().pos;
                        e.gameLocalX = e.gameX - parentPos.x;
                        e.gameLocalY = e.gameY - parentPos.y;
                    }

                    var eventInBounds =
                        // check the shape bounding box first
                        bounds.containsPoint(e.gameX, e.gameY) &&
                        // then check more precisely if needed
                        (bounds === region || region.containsPoint(e.gameLocalX, e.gameLocalY));

                    switch (e.type) {
                        case POINTER_MOVE[0]:
                        case POINTER_MOVE[1]:
                        case POINTER_MOVE[2]:
                        case POINTER_MOVE[3]:
                            // moved out of bounds: trigger the POINTER_LEAVE callbacks
                            if (handlers.pointerId === e.pointerId && !eventInBounds) {
                                if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_LEAVE), e, null)) {
                                    handled = true;
                                    break;
                                }
                            }
                            // no pointer & moved inside of bounds: trigger the POINTER_ENTER callbacks
                            else if (handlers.pointerId === null && eventInBounds) {
                                if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_ENTER), e, e.pointerId)) {
                                    handled = true;
                                    break;
                                }
                            }

                            // trigger the POINTER_MOVE callbacks
                            if (eventInBounds && triggerEvent(handlers, e.type, e, e.pointerId)) {
                                handled = true;
                                break;
                            }
                            break;

                        case POINTER_UP[0]:
                        case POINTER_UP[1]:
                        case POINTER_UP[2]:
                        case POINTER_UP[3]:
                            // pointer defined & inside of bounds: trigger the POINTER_UP callback
                            if (handlers.pointerId === e.pointerId && eventInBounds) {
                                // trigger the corresponding callback
                                if (triggerEvent(handlers, e.type, e, null)) {
                                    handled = true;
                                    break;
                                }
                            }
                            break;

                        case POINTER_CANCEL[0]:
                        case POINTER_CANCEL[1]:
                        case POINTER_CANCEL[2]:
                        case POINTER_CANCEL[3]:
                            // pointer defined: trigger the POINTER_CANCEL callback
                            if (handlers.pointerId === e.pointerId) {
                                // trigger the corresponding callback
                                if (triggerEvent(handlers, e.type, e, null)) {
                                    handled = true;
                                    break;
                                }
                            }
                            break;

                        default:
                            // event inside of bounds: trigger the POINTER_DOWN or WHEEL callback
                            if (eventInBounds) {

                                // trigger the corresponding callback
                                if (triggerEvent(handlers, e.type, e, e.pointerId)) {
                                    handled = true;
                                    if (e.type === "wheel") {
                                        api._preventDefault(e);
                                    }
                                    break;
                                }
                            }
                            break;
                    }
                }
                if (handled === true) {
                    // stop iterating through this list of candidates
                    break;
                }
            }
        }
        return handled;
    }

    /**
     * translate event coordinates
     * @ignore
     */
    function updateCoordFromEvent(event) {
        // PointerEvent or standard Mouse event
        if (!event.touches) {
            var pointerV = T_VECTORS.pop();
            api.globalToLocal(event.clientX, event.clientY, pointerV);
            pointerV.id = event.pointerId || 1;
            changedTouches.push(pointerV);
        }
        // iOS/Android like touch event
        else {
            for (var i = 0, l = event.changedTouches.length; i < l; i++) {
                var touchV = T_VECTORS.pop();
                var t = event.changedTouches[i];
                api.globalToLocal(t.clientX, t.clientY, touchV);
                touchV.id = t.identifier;
                changedTouches.push(touchV);
            }
        }
        // if event.isPrimary is defined and false, return
        if (event.isPrimary === false) {
            return;
        }

        // Else use the first entry to simulate mouse event
        api.pointer.pos.set(
            changedTouches[0].x,
            changedTouches[0].y
        );

        if (typeof(event.width) === "number") {
            // resize the pointer object if necessary
            if (event.width !== api.pointer.width || event.height !== api.pointer.height) {
                api.pointer.resize(event.width || 1, event.height || 1);
            }
        }
    }


    /**
     * mouse event management (mousewheel)
     * XXX: mousewheel is deprecated
     * @ignore
     */
    function onMouseWheel(e) {
        /* jshint expr:true */
        if (e.target === me.video.renderer.getScreenCanvas()) {
            // create a (fake) normalized event object
            updateCoordFromEvent(e);
            e.type = "wheel";
            e.deltaMode = 1;
            e.deltaY = - 1 / 40 * e.wheelDelta;
            // Webkit also support wheelDeltaX
            e.wheelDeltaX && (e.deltaX = - 1 / 40 * e.wheelDeltaX);
            // dispatch mouse event to registered object
            return dispatchEvent(e);
        }
        return true;
    }


    /**
     * mouse/touch/pointer event management (move)
     * @ignore
     */
    function onMoveEvent(e) {
        // update position
        updateCoordFromEvent(e);
        // dispatch mouse event to registered object
        if (dispatchEvent(e)) {
            // prevent default action
            return api._preventDefault(e);
        }
        return true;
    }

    /**
     * mouse/touch/pointer event management (start/down, end/up)
     * @ignore
     */
    function onPointerEvent(e) {
        // update the pointer position
        updateCoordFromEvent(e);

        // dispatch event to registered objects
        if (dispatchEvent(e)) {
            // prevent default action
            return api._preventDefault(e);
        }

        // in case of touch event button is undefined
        var button = e.button || 0;
        var keycode = api.pointer.bind[button];

        // check if mapped to a key
        if (keycode) {
            if (POINTER_DOWN.indexOf(e.type) !== -1) {
                return api._keydown(e, keycode, button + 1);
            }
            else { // 'mouseup' or 'touchend'
                return api._keyup(e, keycode, button + 1);
            }
        }

        return true;
    }

    /*
     * PUBLIC STUFF
     */

    /**
     * Pointer information (current position and size) <br>
     * properties : <br>
     * LEFT : constant for left button <br>
     * MIDDLE : constant for middle button <br>
     * RIGHT : constant for right button
     * @public
     * @type {me.Rect}
     * @name pointer
     * @memberOf me.input
     */
    api.pointer = new me.Rect(0, 0, 1, 1);

    // bind list for mouse buttons
    api.pointer.bind = [ 0, 0, 0 ];

    // W3C button constants
    api.pointer.LEFT = 0;
    api.pointer.MIDDLE = 1;
    api.pointer.RIGHT = 2;

    /**
     * time interval for event throttling in milliseconds<br>
     * default value : "1000/me.sys.fps" ms<br>
     * set to 0 ms to disable the feature
     * @public
     * @type Number
     * @name throttlingInterval
     * @memberOf me.input
     */
    api.throttlingInterval = undefined;

    /**
     * Translate the specified x and y values from the global (absolute)
     * coordinate to local (viewport) relative coordinate.
     * @name globalToLocal
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} x the global x coordinate to be translated.
     * @param {Number} y the global y coordinate to be translated.
     * @param {Number} [v] an optional vector object where to set the
     * @return {me.Vector2d} A vector object with the corresponding translated coordinates.
     * @example
     * onMouseEvent : function (e) {
     *    // convert the given into local (viewport) relative coordinates
     *    var pos = me.input.globalToLocal(e.clientX, e,clientY);
     *    // do something with pos !
     * };
     */
    api.globalToLocal = function (x, y, v) {
        v = v || new me.Vector2d();
        var offset = api._offset;
        var pixelRatio = me.device.getPixelRatio();
        x -= offset.left;
        y -= offset.top;
        var scale = me.sys.scale;
        if (scale.x !== 1.0 || scale.y !== 1.0) {
            x /= scale.x;
            y /= scale.y;
        }
        return v.set(x * pixelRatio, y * pixelRatio);
    };

    /**
     * Associate a pointer event to a keycode<br>
     * Left button – 0
     * Middle button – 1
     * Right button – 2
     * @name bindPointer
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
     * @param {me.input.KEY} keyCode
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * // map the left button click on the X key (default if the button is not specified)
     * me.input.bindPointer(me.input.KEY.X);
     * // map the right button click on the X key
     * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
     */
    api.bindPointer = function () {
        var button = (arguments.length < 2) ? api.pointer.LEFT : arguments[0];
        var keyCode = (arguments.length < 2) ? arguments[0] : arguments[1];

        // make sure the mouse is initialized
        enablePointerEvent();

        // throw an exception if no action is defined for the specified keycode
        if (!api._KeyBinding[keyCode]) {
            throw new me.Error("no action defined for keycode " + keyCode);
        }
        // map the mouse button to the keycode
        api.pointer.bind[button] = keyCode;
    };
    /**
     * unbind the defined keycode
     * @name unbindPointer
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
     * @example
     * me.input.unbindPointer(me.input.pointer.LEFT);
     */
    api.unbindPointer = function (button) {
        // clear the event status
        api.pointer.bind[
            typeof(button) === "undefined" ?
            api.pointer.LEFT : button
        ] = null;
    };


    /**
     * allows registration of event listeners on the object target. <br>
     * melonJS defines the additional `gameX` and `gameY` properties when passing the Event object to the defined callback (see below)<br>
     * @see external:Event
     * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
     * @name registerPointerEvent
     * @memberOf me.input
     * @public
     * @function
     * @param {String} eventType The event type for which the object is registering <br>
     * melonJS currently supports: <br>
     * <ul>
     *   <li><code>"pointermove"</code></li>
     *   <li><code>"pointerdown"</code></li>
     *   <li><code>"pointerup"</code></li>
     *   <li><code>"pointerenter"</code></li>
     *   <li><code>"pointerleave"</code></li>
     *   <li><code>"pointercancel"</code></li>
     *   <li><code>"wheel"</code></li>
     *   <li><code>"mousewheel"</code> (Deprecated)</li>
     * </ul>
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region a shape representing the region to register on
     * @param {Function} callback methods to be called when the event occurs.
     * Returning `false` from the defined callback will prevent the event to be propagated to other objects
     * @example
     *  // onActivate function
     *  onActivateEvent: function () {
     *     // register on the 'pointerdown' event
     *     me.input.registerPointerEvent('pointerdown', this, this.pointerDown.bind(this));
     *  },
     *
     *  // pointerDown event callback
     *  pointerDown: function (event) {
     *    // do something
     *    ....
     *    // don"t propagate the event to other objects
     *    return false;
     *  },
     */
    api.registerPointerEvent = function (eventType, region, callback) {
        // make sure the mouse/touch events are initialized
        enablePointerEvent();

        // XXX: mousewheel is deprecated
        if (eventType === "mousewheel") {
            console.error("`mousewheel` events are deprecated; use `wheel`")
        } else if (pointerEventList.indexOf(eventType) === -1) {
            throw new me.Error("invalid event type : " + eventType);
        }

        var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

        // register the event
        if (!evtHandlers.has(region)) {
            evtHandlers.set(region, {
                region : region,
                callbacks : {},
                pointerId : null
            });
        }

        // allocate array if not defined
        var handlers = evtHandlers.get(region);
        for (var i = 0; i < eventTypes.length; i++) {
            eventType = eventTypes[i];
            if (handlers.callbacks[eventType]) {
                handlers.callbacks[eventType].push(callback);
            } else {
                handlers.callbacks[eventType] = [callback];
            }
        }
    };

    /**
     * allows the removal of event listeners from the object target.
     * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
     * @name releasePointerEvent
     * @memberOf me.input
     * @public
     * @function
     * @param {String} eventType The event type for which the object was registered. See {@link me.input.registerPointerEvent}
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release for this event
     * @param {Function} [callback="all"] if specified unregister the event only for the specific callback
     * @example
     * // release the registered region on the 'pointerdown' event
     * me.input.releasePointerEvent('pointerdown', this);
     */
    api.releasePointerEvent = function (eventType, region, callback) {
        // XXX: mousewheel is deprecated
        if (eventType === "mousewheel") {
            console.error("`mousewheel` events are deprecated; use `wheel`")
        } else if (pointerEventList.indexOf(eventType) === -1) {
            throw new me.Error("invalid event type : " + eventType);
        }

        // convert to supported event type if pointerEvent not natively supported
        var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

        var handlers = evtHandlers.get(region);
        for (var i = 0; i < eventTypes.length; i++) {
            eventType = eventTypes[i];
            if (handlers.callbacks[eventType]) {
                if (typeof (callback) !== "undefined") {
                    handlers.callbacks[eventType].remove(callback);
                } else {
                    while (handlers.callbacks[eventType].length > 0) {
                        handlers.callbacks[eventType].pop();
                    }
                }
                // free the array if empty
                if (handlers.callbacks[eventType].length === 0) {
                    delete handlers.callbacks[eventType];
                }
            }
        }
        if (Object.keys(handlers.callbacks).length === 0) {
            evtHandlers.delete(region);
        }
    };

    /**
     * Will translate global (frequently used) pointer events
     * which should be catched at root level, into minipubsub system events
     * @name _translatePointerEvents
     * @memberOf me.input
     * @ignore
     * @function
     */
    api._translatePointerEvents = function () {
        // listen to mouse move (and touch move) events on the viewport
        // and convert them to a system event by default
        api.registerPointerEvent("pointermove", me.game.viewport, function (e) {
            me.event.publish(me.event.POINTERMOVE, [e]);
        });
    };
})(me.input);
