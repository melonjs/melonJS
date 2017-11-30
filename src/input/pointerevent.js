/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org/
 *
 */
(function (api) {

    /**
     * A pool of `Pointer` objects to cache pointer/touch event coordinates.
     * @type {Array.<Vector>}
     */
    var T_POINTERS = [];
    for (var v = 0; v < 10; v++) { T_POINTERS.push(new me.Pointer()); }

    // list of registered Event handlers
    var eventHandlers = new Map();

    // a cache rect represeting the current pointer area
    var currentPointer = new me.Rect(0, 0, 1, 1);

    // some useful flags
    var pointerInitialized = false;

    // Track last event timestamp to prevent firing events out of order
    var lastTimeStamp = 0;

    // "active" list of supported events
    var activeEventList = [];

    // internal constants
    var WHEEL           = ["wheel"];
    var POINTER_MOVE    = ["pointermove",   "mousemove",    "touchmove"];
    var POINTER_DOWN    = ["pointerdown",   "mousedown",    "touchstart"];
    var POINTER_UP      = ["pointerup",     "mouseup",      "touchend"];
    var POINTER_CANCEL  = ["pointercancel", "mousecancel",  "touchcancel"];
    var POINTER_ENTER   = ["pointerenter",  "mouseenter",   "touchenter"];
    var POINTER_LEAVE   = ["pointerleave",  "mouseleave",   "touchleave"];

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

    // legacy mouse event type
    var mouseEventList = [
        WHEEL[0],
        POINTER_MOVE[1],
        POINTER_DOWN[1],
        POINTER_UP[1],
        POINTER_CANCEL[1],
        POINTER_ENTER[1],
        POINTER_LEAVE[1]
    ];

    // iOS style touch event type
    var touchEventList = [
        POINTER_MOVE[2],
        POINTER_DOWN[2],
        POINTER_UP[2],
        POINTER_CANCEL[2],
        POINTER_ENTER[2],
        POINTER_LEAVE[2]
    ];

    var pointerEventMap = {
        wheel : WHEEL,
        pointermove: POINTER_MOVE,
        pointerdown: POINTER_DOWN,
        pointerup: POINTER_UP,
        pointercancel: POINTER_CANCEL,
        pointerenter: POINTER_ENTER,
        pointerleave: POINTER_LEAVE
    };

    /**
     * Array of normalized events (mouse, touch, pointer)
     * @ignore
     */
    var normalizedEvents = [];

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
     * enable pointer event (Pointer/Mouse/Touch)
     * @ignore
     */
    function enablePointerEvent() {
        if (!pointerInitialized) {
            // check standard PointerEvent support
            if (window.PointerEvent) {
                activeEventList = pointerEventList;
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
    function triggerEvent(handlers, type, pointer, pointerId) {
        var callback;
        if (handlers.callbacks[type]) {
            handlers.pointerId = pointerId;
            for (var i = handlers.callbacks[type].length - 1; (i >= 0) && (callback = handlers.callbacks[type][i]); i--) {
                if (callback(pointer) === false) {
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
    function dispatchEvent(normalizedEvents) {
        var handled = false;

        while (normalizedEvents.length > 0) {

            // keep a reference to the last item
            var pointer = normalizedEvents.pop();
            // and put it back into our cache
            T_POINTERS.push(pointer);

            // Do not fire older events
            if (typeof(pointer.event.timeStamp) !== "undefined") {
                if (pointer.event.timeStamp < lastTimeStamp) {
                    continue;
                }
                lastTimeStamp = pointer.event.timeStamp;
            }

            currentPointer.setShape(
                pointer.gameWorldX,
                pointer.gameWorldY,
                pointer.width,
                pointer.height
            );

            var candidates = me.collision.quadTree.retrieve(currentPointer, me.Container.prototype._sortReverseZ);

            // add the viewport to the list of candidates
            candidates = candidates.concat([ me.game.viewport ]);

            for (var c = candidates.length, candidate; c--, (candidate = candidates[c]);) {

                if (eventHandlers.has(candidate) && (candidate.isKinematic !== true)) {
                    var handlers = eventHandlers.get(candidate);
                    var region = handlers.region;
                    var ancestor = region.ancestor;
                    var bounds = region.getBounds();

                    if (region.floating === true) {
                        pointer.gameX = pointer.gameLocalX = pointer.gameScreenX;
                        pointer.gameY = pointer.gameLocalY = pointer.gameScreenY;
                    } else {
                        pointer.gameX = pointer.gameLocalX = pointer.gameWorldX;
                        pointer.gameY = pointer.gameLocalY = pointer.gameWorldY;
                    }
                    // adjust gameLocalX to specify coordinates
                    // within the region ancestor container
                    if (typeof ancestor !== "undefined") {
                        var parentPos = ancestor.getBounds().pos;
                        pointer.gameLocalX = pointer.gameX - parentPos.x;
                        pointer.gameLocalY = pointer.gameY - parentPos.y;
                    }

                    var eventInBounds =
                        // check the shape bounding box first
                        bounds.containsPoint(pointer.gameX, pointer.gameY) &&
                        // then check more precisely if needed
                        (bounds === region || region.containsPoint(pointer.gameLocalX, pointer.gameLocalY));

                    switch (pointer.type) {
                        case POINTER_MOVE[0]:
                        case POINTER_MOVE[1]:
                        case POINTER_MOVE[2]:
                        case POINTER_MOVE[3]:
                            // moved out of bounds: trigger the POINTER_LEAVE callbacks
                            if (handlers.pointerId === pointer.pointerId && !eventInBounds) {
                                if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_LEAVE), pointer, null)) {
                                    handled = true;
                                    break;
                                }
                            }
                            // no pointer & moved inside of bounds: trigger the POINTER_ENTER callbacks
                            else if (handlers.pointerId === null && eventInBounds) {
                                if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_ENTER), pointer, pointer.pointerId)) {
                                    handled = true;
                                    break;
                                }
                            }

                            // trigger the POINTER_MOVE callbacks
                            if (eventInBounds && triggerEvent(handlers, pointer.type, pointer, pointer.pointerId)) {
                                handled = true;
                                break;
                            }
                            break;

                        case POINTER_UP[0]:
                        case POINTER_UP[1]:
                        case POINTER_UP[2]:
                        case POINTER_UP[3]:
                            // pointer defined & inside of bounds: trigger the POINTER_UP callback
                            if (handlers.pointerId === pointer.pointerId && eventInBounds) {
                                // trigger the corresponding callback
                                if (triggerEvent(handlers, pointer.type, pointer, null)) {
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
                            if (handlers.pointerId === pointer.pointerId) {
                                // trigger the corresponding callback
                                if (triggerEvent(handlers, pointer.type, pointer, null)) {
                                    handled = true;
                                    break;
                                }
                            }
                            break;

                        default:
                            // event inside of bounds: trigger the POINTER_DOWN or WHEEL callback
                            if (eventInBounds) {

                                // trigger the corresponding callback
                                if (triggerEvent(handlers, pointer.type, pointer, pointer.pointerId)) {
                                    handled = true;
                                    if (pointer.type === "wheel") {
                                        api._preventDefaultFn(pointer.event);
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
    function normalizeEvent(event) {
        var pointer;

        // PointerEvent or standard Mouse event
        if (!event.touches) {
            pointer = T_POINTERS.pop();
            pointer.setEvent(
                event,
                event.clientX,
                event.clientY,
                event.pointerId
            );
            normalizedEvents.push(pointer);
        }
        // iOS/Android like touch event
        else {
            for (var i = 0, l = event.changedTouches.length; i < l; i++) {
                var touchEvent = event.changedTouches[i];
                pointer = T_POINTERS.pop();
                pointer.setEvent(
                    event,
                    touchEvent.clientX,
                    touchEvent.clientY,
                    touchEvent.identifier
                );
                normalizedEvents.push(pointer);
            }
        }
        // if event.isPrimary is defined and false, return
        if (event.isPrimary === false) {
            return normalizedEvents;
        }

        // Else use the first entry to simulate mouse event
        Object.assign(api.pointer, normalizedEvents[0]);

        return normalizedEvents;
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
            e.type = "wheel";
            // dispatch mouse event to registered object
            return dispatchEvent(normalizeEvent(e));
        }
        return true;
    }


    /**
     * mouse/touch/pointer event management (move)
     * @ignore
     */
    function onMoveEvent(e) {
        // dispatch mouse event to registered object
        if (dispatchEvent(normalizeEvent(e)) || api.preventDefault) {
            // prevent default action
            return api._preventDefaultFn(e);
        }
        return true;
    }

    /**
     * mouse/touch/pointer event management (start/down, end/up)
     * @ignore
     */
    function onPointerEvent(e) {
        // dispatch event to registered objects
        if (dispatchEvent(normalizeEvent(e)) || api.preventDefault) {
            // prevent default action
            return api._preventDefaultFn(e);
        }

        var button = e.button;
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
    api.pointer = new me.Pointer(0, 0, 1, 1);

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
     * onMouseEvent : function (pointer) {
     *    // convert the given into local (viewport) relative coordinates
     *    var pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
     *    // do something with pos !
     * };
     */
    api.globalToLocal = function (x, y, v) {
        v = v || new me.Vector2d();
        var offset = me.video.getPos();
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
     * melonJS will pass a me.Pointer object to the defined callback.
     * @see me.Pointer
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
     *  pointerDown: function (pointer) {
     *    // do something
     *    ....
     *    // don"t propagate the event to other objects
     *    return false;
     *  },
     */
    api.registerPointerEvent = function (eventType, region, callback) {
        // make sure the mouse/touch events are initialized
        enablePointerEvent();

        if (pointerEventList.indexOf(eventType) === -1) {
            throw new me.Error("invalid event type : " + eventType);
        }

        var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

        // register the event
        if (!eventHandlers.has(region)) {
            eventHandlers.set(region, {
                region : region,
                callbacks : {},
                pointerId : null
            });
        }

        // allocate array if not defined
        var handlers = eventHandlers.get(region);
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
        if (pointerEventList.indexOf(eventType) === -1) {
            throw new me.Error("invalid event type : " + eventType);
        }

        // convert to supported event type if pointerEvent not natively supported
        var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

        var handlers = eventHandlers.get(region);
        if (typeof (handlers) !== "undefined") {
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
                eventHandlers.delete(region);
            }
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
