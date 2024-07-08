import { expect, test, vi } from "vitest";
import { EventEmitter } from "./eventEmitter";

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
