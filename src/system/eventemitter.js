const prefix = "~";

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 * @private
 */
function Events() {}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn - The listener function.
 * @param {*} context - The context to invoke the listener with.
 * @param {Boolean} [once=false] - Specify if the listener is a one-time listener.
 * @private
 */
function EE(fn, context, once) {
	this.fn = fn;
	this.context = context;
	this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter - Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event - The event name.
 * @param {Function} fn - The listener function.
 * @param {*} context - The context to invoke the listener with.
 * @param {Boolean} once - Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
	if (typeof fn !== "function") {
		throw new TypeError("The listener must be a function");
	}

	const listener = new EE(fn, context || emitter, once);
	const evt = prefix ? prefix + event : event;

	if (!emitter._events[evt]) {
		emitter._events[evt] = listener;
		emitter._eventsCount++;
	} else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
	else emitter._events[evt] = [emitter._events[evt], listener];

	return emitter;
}

/**
 * Clear event by name.
 * @param {EventEmitter} emitter - Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt - The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
	if (--emitter._eventsCount === 0) emitter._events = new Events();
	else delete emitter._events[evt];
}

/** @ignore */
export class EventEmitter {
	constructor() {
		/** @ignore */
		this._events = new Events();
		/** @ignore */
		this._eventsCount = 0;
	}

	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event - The event name.
	 * @returns {Boolean} `true` if the event had listeners, else `false`.
	 * @public
	 */
	emit(event, a1, a2, a3, a4, a5) {
		const evt = prefix ? prefix + event : event;

		if (!this._events[evt]) return false;

		const listeners = this._events[evt];
		const len = arguments.length;
		let args;
		let i;

		if (listeners.fn) {
			if (listeners.once)
				this.removeListener(event, listeners.fn, undefined, true);

			switch (len) {
				case 1:
					return listeners.fn.call(listeners.context), true;
				case 2:
					return listeners.fn.call(listeners.context, a1), true;
				case 3:
					return listeners.fn.call(listeners.context, a1, a2), true;
				case 4:
					return listeners.fn.call(listeners.context, a1, a2, a3), true;
				case 5:
					return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
				case 6:
					return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
			}

			for (i = 1, args = new Array(len - 1); i < len; i++) {
				args[i - 1] = arguments[i];
			}

			listeners.fn.apply(listeners.context, args);
		} else {
			const length = listeners.length;
			let j;

			for (i = 0; i < length; i++) {
				if (listeners[i].once)
					this.removeListener(event, listeners[i].fn, undefined, true);

				switch (len) {
					case 1:
						listeners[i].fn.call(listeners[i].context);
						break;
					case 2:
						listeners[i].fn.call(listeners[i].context, a1);
						break;
					case 3:
						listeners[i].fn.call(listeners[i].context, a1, a2);
						break;
					case 4:
						listeners[i].fn.call(listeners[i].context, a1, a2, a3);
						break;
					default:
						if (!args)
							for (j = 1, args = new Array(len - 1); j < len; j++) {
								args[j - 1] = arguments[j];
							}

						listeners[i].fn.apply(listeners[i].context, args);
				}
			}
		}

		return true;
	}

	/**
	 * Add a listener for a given event.
	 *
	 * @param {(String|Symbol)} event - The event name.
	 * @param {Function} fn - The listener function.
	 * @param {*} [context=this] - The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	on(event, fn, context) {
		return addListener(this, event, fn, context, false);
	}

	/**
	 * Add a one-time listener for a given event.
	 *
	 * @param {(String|Symbol)} event - The event name.
	 * @param {Function} fn - The listener function.
	 * @param {*} [context=this] - The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	once(event, fn, context) {
		return addListener(this, event, fn, context, true);
	}

	/**
	 * Remove the listeners of a given event.
	 *
	 * @param {(String|Symbol)} event - The event name.
	 * @param {Function} fn - Only remove the listeners that match this function.
	 * @param {*} context - Only remove the listeners that have this context.
	 * @param {Boolean} once - Only remove one-time listeners.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	removeListener(event, fn, context, once) {
		const evt = prefix ? prefix + event : event;

		if (!this._events[evt]) return this;
		if (!fn) {
			clearEvent(this, evt);
			return this;
		}

		const listeners = this._events[evt];

		if (listeners.fn) {
			if (
				listeners.fn === fn &&
				(!once || listeners.once) &&
				(!context || listeners.context === context)
			) {
				clearEvent(this, evt);
			}
		} else {
			const events = [];
			for (let i = 0, length = listeners.length; i < length; i++) {
				if (
					listeners[i].fn !== fn ||
					(once && !listeners[i].once) ||
					(context && listeners[i].context !== context)
				) {
					events.push(listeners[i]);
				}
			}

			//
			// Reset the array, or remove it completely if we have no more listeners.
			//
			if (events.length)
				this._events[evt] = events.length === 1 ? events[0] : events;
			else clearEvent(this, evt);
		}

		return this;
	}
}
