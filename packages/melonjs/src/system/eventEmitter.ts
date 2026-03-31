interface EventsMap {
	[event: string]: any;
}

interface DefaultEvents extends EventsMap {
	[event: string]: (...args: any) => void;
}

type ListenerEntry<F> = { fn: F; ctx: any };

export class EventEmitter<Events extends EventsMap = DefaultEvents> {
	private eventListeners: Partial<{
		[E in keyof Events]: ListenerEntry<Events[E]>[];
	}>;
	private eventListenersOnce: Partial<{
		[E in keyof Events]: ListenerEntry<Events[E]>[];
	}>;

	constructor() {
		this.eventListeners = {};
		this.eventListenersOnce = {};
	}

	addListener<E extends keyof Events>(
		event: E,
		listener: Events[E],
		context?: any,
	) {
		let eventListenerList = this.eventListeners[event];
		if (!eventListenerList) {
			eventListenerList = [];
			this.eventListeners[event] = eventListenerList;
		}
		eventListenerList.push({ fn: listener, ctx: context });

		return () => {
			this.removeListener(event, listener);
		};
	}

	addListenerOnce<E extends keyof Events>(
		event: E,
		listener: Events[E],
		context?: any,
	) {
		let eventListenerList = this.eventListenersOnce[event];
		if (!eventListenerList) {
			eventListenerList = [];
			this.eventListenersOnce[event] = eventListenerList;
		}
		eventListenerList.push({ fn: listener, ctx: context });
	}

	removeAllListeners(event?: keyof Events) {
		if (event) {
			delete this.eventListeners[event];
			delete this.eventListenersOnce[event];
		} else {
			this.eventListeners = {};
			this.eventListenersOnce = {};
		}
	}

	removeListener<E extends keyof Events>(event: E, listener: Events[E]) {
		const listeners = this.eventListeners[event];
		if (listeners) {
			const idx = listeners.findIndex((entry) => entry.fn === listener);
			if (idx !== -1) {
				listeners.splice(idx, 1);
			}
		}

		const listenersOnce = this.eventListenersOnce[event];
		if (listenersOnce) {
			const idx = listenersOnce.findIndex((entry) => entry.fn === listener);
			if (idx !== -1) {
				listenersOnce.splice(idx, 1);
			}
		}
	}

	emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
		const listeners = this.eventListeners[event];
		if (listeners) {
			for (const entry of listeners) {
				entry.fn.apply(entry.ctx, args);
			}
		}

		const listenersOnce = this.eventListenersOnce[event];
		if (listenersOnce) {
			for (const entry of listenersOnce) {
				entry.fn.apply(entry.ctx, args);
			}
			this.eventListenersOnce[event] = [];
		}
	}

	hasListener<E extends keyof Events>(event: E, listener: Events[E]) {
		return (
			!!this.eventListeners[event]?.some((entry) => entry.fn === listener) ||
			!!this.eventListenersOnce[event]?.some((entry) => entry.fn === listener)
		);
	}
}
