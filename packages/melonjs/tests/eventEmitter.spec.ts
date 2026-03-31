import { beforeAll, describe, expect, it, test, vi } from "vitest";
import { boot, event, video } from "../src/index.js";
import { EventEmitter } from "../src/system/eventEmitter";

test("addListener()", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	emitter.addListener("message", listener);

	expect(listener).not.toHaveBeenCalled();

	emitter.emit("message", "Hello world!");
	expect(listener).toHaveBeenCalledWith("Hello world!");
	expect(listener).toHaveBeenCalledTimes(1);

	emitter.emit("another-event");
	expect(listener).toHaveBeenCalledTimes(1);
});

test("addListener() - remove", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	const removeListener = emitter.addListener("message", listener);

	expect(emitter.hasListener("message", listener)).toBe(true);
	removeListener();
	expect(emitter.hasListener("message", listener)).toBe(false);
	emitter.emit("message", "Hello world!");
	expect(listener).toHaveBeenCalledTimes(0);
});

test("removeListener()", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	emitter.addListener("message", listener);
	emitter.emit("message");
	expect(listener).toHaveBeenCalledTimes(1);

	emitter.removeListener("message", listener);
	emitter.emit("message");
	expect(listener).toHaveBeenCalledTimes(1);
});

test("removeListener() - remove a non-existing listener", () => {
	const emitter = new EventEmitter();
	emitter.addListener("message", vi.fn());
	emitter.removeListener("message", vi.fn());
});

test("removeAllListeners()", () => {
	const emitter = new EventEmitter();

	const listener = vi.fn();
	const listener2 = vi.fn();
	const listener3 = vi.fn();

	emitter.addListener("message", listener);
	emitter.addListener("message", listener2);
	emitter.addListener("other-message", listener3);

	emitter.emit("message");
	emitter.emit("other-message");

	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(1);
	expect(listener3).toHaveBeenCalledTimes(1);

	emitter.removeAllListeners();

	emitter.emit("message");
	emitter.emit("other-message");

	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(1);
	expect(listener3).toHaveBeenCalledTimes(1);
});

test("removeAllListeners() - specific event", () => {
	const emitter = new EventEmitter();

	const listener = vi.fn();
	const listener2 = vi.fn();

	emitter.addListener("message", listener);
	emitter.addListener("other-message", listener2);

	emitter.emit("message");
	emitter.emit("other-message");

	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(1);

	emitter.removeAllListeners("message");

	emitter.emit("message");
	emitter.emit("other-message");

	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(2);
});

test("addListenerOnce()", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	const listener2 = vi.fn();
	const listener3 = vi.fn();
	emitter.addListenerOnce("message", listener);
	emitter.addListenerOnce("message", listener2);
	emitter.addListenerOnce("message", listener3);

	expect(listener).not.toHaveBeenCalled();
	expect(listener2).not.toHaveBeenCalled();
	expect(listener3).not.toHaveBeenCalled();

	emitter.emit("message", "A first emit");
	expect(listener).toHaveBeenCalledWith("A first emit");
	expect(listener2).toHaveBeenCalledWith("A first emit");
	expect(listener3).toHaveBeenCalledWith("A first emit");
	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(1);
	expect(listener3).toHaveBeenCalledTimes(1);

	emitter.emit("message", "A second emit");
	expect(listener).toHaveBeenCalledTimes(1);
	expect(listener2).toHaveBeenCalledTimes(1);
	expect(listener3).toHaveBeenCalledTimes(1);
});

test("hasListener()", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	const listener2 = vi.fn();
	const listener3 = vi.fn();
	emitter.addListener("message", listener);
	emitter.addListenerOnce("message", listener2);

	expect(emitter.hasListener("message", listener)).toBe(true);
	expect(emitter.hasListener("message", listener2)).toBe(true);
	expect(emitter.hasListener("message", listener3)).toBe(false);

	expect(emitter.hasListener("message2", listener)).toBe(false);
	expect(emitter.hasListener("message2", listener2)).toBe(false);
	expect(emitter.hasListener("message2", listener3)).toBe(false);
});

test("emit() with multiple arguments", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	emitter.addListener("data", listener);

	emitter.emit("data", "arg1", 42, true);
	expect(listener).toHaveBeenCalledWith("arg1", 42, true);
});

test("emit() on non-existing event does not throw", () => {
	const emitter = new EventEmitter();
	expect(() => {
		emitter.emit("nonexistent");
	}).not.toThrow();
});

test("multiple listeners fire in registration order", () => {
	const emitter = new EventEmitter();
	const order: number[] = [];

	emitter.addListener("message", () => {
		order.push(1);
	});
	emitter.addListener("message", () => {
		order.push(2);
	});
	emitter.addListener("message", () => {
		order.push(3);
	});

	emitter.emit("message");
	expect(order).toEqual([1, 2, 3]);
});

test("removeListener() removes a once-listener before it fires", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	emitter.addListenerOnce("message", listener);

	emitter.removeListener("message", listener);
	emitter.emit("message");
	expect(listener).not.toHaveBeenCalled();
});

test("removeAllListeners() clears once-listeners too", () => {
	const emitter = new EventEmitter();
	const listener = vi.fn();
	const onceListener = vi.fn();

	emitter.addListener("message", listener);
	emitter.addListenerOnce("message", onceListener);

	emitter.removeAllListeners();

	emitter.emit("message");
	expect(listener).not.toHaveBeenCalled();
	expect(onceListener).not.toHaveBeenCalled();
});

test("removeAllListeners(event) clears once-listeners for that event", () => {
	const emitter = new EventEmitter();
	const onceListener = vi.fn();
	const otherListener = vi.fn();

	emitter.addListenerOnce("message", onceListener);
	emitter.addListenerOnce("other", otherListener);

	emitter.removeAllListeners("message");

	emitter.emit("message");
	emitter.emit("other");

	expect(onceListener).not.toHaveBeenCalled();
	expect(otherListener).toHaveBeenCalledTimes(1);
});

test("addListener() with context applies correct this", () => {
	const emitter = new EventEmitter();
	const context = { name: "test-context", value: 0 };

	// eslint-disable-next-line @typescript-eslint/no-this-alias
	emitter.addListener(
		"message",
		function (this: any) {
			context.value = this === context ? 1 : 0;
		},
		context,
	);

	emitter.emit("message");
	expect(context.value).toBe(1);
});

test("addListenerOnce() with context applies correct this", () => {
	const emitter = new EventEmitter();
	const context = { name: "once-context", value: 0 };

	// eslint-disable-next-line @typescript-eslint/no-this-alias
	emitter.addListenerOnce(
		"message",
		function (this: any) {
			context.value = this === context ? 1 : 0;
		},
		context,
	);

	emitter.emit("message");
	expect(context.value).toBe(1);
});

test("removeListener() works with original reference and context", () => {
	const emitter = new EventEmitter();
	const context = { name: "ctx" };
	const listener = vi.fn();

	emitter.addListener("message", listener, context);
	expect(emitter.hasListener("message", listener, context)).toBe(true);

	// remove by original function reference + context
	emitter.removeListener("message", listener, context);
	expect(emitter.hasListener("message", listener, context)).toBe(false);

	emitter.emit("message");
	expect(listener).not.toHaveBeenCalled();
});

test("same listener with different contexts are independent", () => {
	const emitter = new EventEmitter();
	const ctxA = { name: "A" };
	const ctxB = { name: "B" };
	const listener = vi.fn();

	emitter.addListener("message", listener, ctxA);
	emitter.addListener("message", listener, ctxB);

	// removing one context doesn't affect the other
	emitter.removeListener("message", listener, ctxA);
	expect(emitter.hasListener("message", listener, ctxA)).toBe(false);
	expect(emitter.hasListener("message", listener, ctxB)).toBe(true);

	emitter.emit("message");
	expect(listener).toHaveBeenCalledTimes(1);
});

test("listener without context has undefined this", () => {
	const emitter = new EventEmitter();
	const result = { value: "not-set" };

	// eslint-disable-next-line @typescript-eslint/no-this-alias
	emitter.addListener("message", function (this: any) {
		result.value = typeof this === "undefined" ? "undefined" : "defined";
	});

	emitter.emit("message");
	expect(result.value).toBe("undefined");
});

// ---------------------------------------------------------------
// event.ts public API (on/off/once/emit/has)
// ---------------------------------------------------------------
describe("event.ts public API", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("on() should register a listener and return unsubscribe function", () => {
		const listener = vi.fn();
		const unsub = event.on("testEvent", listener);

		event.emit("testEvent");
		expect(listener).toHaveBeenCalledTimes(1);

		unsub();
		event.emit("testEvent");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("once() should fire listener only once", () => {
		const listener = vi.fn();
		event.once("testOnce", listener);

		event.emit("testOnce");
		event.emit("testOnce");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("off() should remove a listener", () => {
		const listener = vi.fn();
		event.on("testOff", listener);

		event.emit("testOff");
		expect(listener).toHaveBeenCalledTimes(1);

		event.off("testOff", listener);
		event.emit("testOff");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("emit() should pass arguments to listeners", () => {
		const listener = vi.fn();
		event.on("testArgs", listener);

		event.emit("testArgs", "hello", 42);
		expect(listener).toHaveBeenCalledWith("hello", 42);

		event.off("testArgs", listener);
	});

	it("has() should check listener registration", () => {
		const listener = vi.fn();

		expect(event.has("testHas", listener)).toBe(false);

		event.on("testHas", listener);
		expect(event.has("testHas", listener)).toBe(true);

		event.off("testHas", listener);
		expect(event.has("testHas", listener)).toBe(false);
	});

	it("on() with context should pass correct this to listener", () => {
		const context = { value: 0 };

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		event.on(
			"testCtx",
			function (this: any) {
				context.value = this === context ? 1 : 0;
			},
			context,
		);

		event.emit("testCtx");
		expect(context.value).toBe(1);

		event.off("testCtx", function () {}, context);
	});
});
