interface EventsMap {
	[event: string]: any;
}

interface DefaultEvents extends EventsMap {
	[event: string]: (...args: any) => void;
}

export class EventEmitter<Events extends EventsMap = DefaultEvents> {
	private eventListeners: Partial<{ [E in keyof Events]: Events[E][] }>;
	private eventListenersOnce: Partial<{ [E in keyof Events]: Events[E][] }>;

	constructor() {
		this.eventListeners = {};
		this.eventListenersOnce = {};
	}

	addListener<E extends keyof Events>(event: E, listener: Events[E]) {
		let eventListenerList = this.eventListeners[event];
		if (!eventListenerList) {
			eventListenerList = [];
			this.eventListeners[event] = eventListenerList;
		}
		eventListenerList.push(listener);

		return () => {
			this.removeListener(event, listener);
		};
	}

	addListenerOnce<E extends keyof Events>(event: E, listener: Events[E]) {
		let eventListenerList = this.eventListenersOnce[event];
		if (!eventListenerList) {
			eventListenerList = [];
			this.eventListenersOnce[event] = eventListenerList;
		}
		eventListenerList.push(listener);
	}

	removeAllListeners(event?: keyof Events) {
		if (event) {
			delete this.eventListeners[event];
		} else {
			this.eventListeners = {};
		}
	}

	removeListener<E extends keyof Events>(event: E, listener: Events[E]) {
		const listeners = this.eventListeners[event];
		if (listeners?.includes(listener)) {
			listeners.splice(listeners.indexOf(listener), 1);
		}

		const listenersOnce = this.eventListenersOnce[event];
		if (listenersOnce?.includes(listener)) {
			listenersOnce.splice(listenersOnce.indexOf(listener), 1);
		}
	}

	emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
		const listeners = this.eventListeners[event];
		if (listeners) {
			for (const listener of listeners) {
				listener(...args);
			}
		}

		const listenersOnce = this.eventListenersOnce[event];
		if (listenersOnce) {
			for (const listener of listenersOnce) {
				listener(...args);
			}
			this.eventListenersOnce[event] = [];
		}
	}

	hasListener<E extends keyof Events>(event: E, listener: Events[E]) {
		return (
			Array.from(this.eventListeners[event]?.values() ?? []).includes(
				listener,
			) ||
			Array.from(this.eventListenersOnce[event]?.values() ?? []).includes(
				listener,
			)
		);
	}
}
