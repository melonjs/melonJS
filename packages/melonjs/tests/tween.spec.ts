import { beforeEach, describe, expect, it } from "vitest";
import { Tween } from "../src/index.js";
import { Easing } from "../src/tweens/easing.js";
import { Interpolation } from "../src/tweens/interpolation.js";

describe("Tween", () => {
	let obj: { x: number; y: number };
	let tween: Tween;

	beforeEach(() => {
		obj = { x: 0, y: 0 };
		tween = new Tween(obj);
	});

	// --- construction ---

	describe("constructor", () => {
		it("creates a tween with default properties", () => {
			expect(tween).toBeDefined();
			expect(tween._object).toBe(obj);
			expect(tween._duration).toEqual(1000);
			expect(tween._repeat).toEqual(0);
			expect(tween._yoyo).toBe(false);
			expect(tween._delayTime).toEqual(0);
			expect(tween._isRunning).toBe(false);
			expect(tween._isPaused).toBe(false);
			expect(tween.isPersistent).toBe(false);
			expect(tween.updateWhenPaused).toBe(false);
		});
	});

	// --- to() ---

	describe("to()", () => {
		it("sets target values", () => {
			tween.to({ x: 100, y: 200 });
			expect(tween._valuesEnd).toEqual({ x: 100, y: 200 });
		});

		it("sets duration from options", () => {
			tween.to({ x: 100 }, { duration: 2000 });
			expect(tween._duration).toEqual(2000);
		});

		it("sets easing from options", () => {
			tween.to({ x: 100 }, { easing: Easing.Quadratic.In });
			expect(tween._easingFunction).toBe(Easing.Quadratic.In);
		});

		it("sets delay from options", () => {
			tween.to({ x: 100 }, { delay: 500 });
			expect(tween._delayTime).toEqual(500);
		});

		it("sets repeat from options", () => {
			tween.to({ x: 100 }, { repeat: 3 });
			expect(tween._repeat).toEqual(3);
		});

		it("sets yoyo from options", () => {
			tween.to({ x: 100 }, { yoyo: true });
			expect(tween._yoyo).toBe(true);
		});

		it("sets interpolation from options", () => {
			tween.to(
				{ x: [0, 50, 100] },
				{ interpolation: Interpolation.CatmullRom },
			);
			expect(tween._interpolationFunction).toBe(Interpolation.CatmullRom);
		});

		it("returns this for chaining", () => {
			expect(tween.to({ x: 100 })).toBe(tween);
		});
	});

	// --- start / stop ---

	describe("start() / stop()", () => {
		it("start sets _isRunning to true", () => {
			tween.to({ x: 100 });
			tween.start();
			expect(tween._isRunning).toBe(true);
		});

		it("stop sets _isRunning to false", () => {
			tween.to({ x: 100 });
			tween.start();
			tween.stop();
			expect(tween._isRunning).toBe(false);
		});

		it("start initializes _valuesStart from the object", () => {
			obj.x = 50;
			tween.to({ x: 200 });
			tween.start();
			expect(tween._valuesStart.x).toEqual(50);
		});

		it("start returns this for chaining", () => {
			tween.to({ x: 100 });
			expect(tween.start()).toBe(tween);
		});

		it("stop returns this for chaining", () => {
			tween.to({ x: 100 });
			tween.start();
			expect(tween.stop()).toBe(tween);
		});

		it("double start does not double-subscribe", () => {
			tween.to({ x: 100 });
			tween.start();
			tween.start();
			expect(tween._isRunning).toBe(true);
			tween.stop();
			expect(tween._isRunning).toBe(false);
		});

		it("stop without start is safe", () => {
			expect(() => {
				tween.stop();
			}).not.toThrow();
		});
	});

	// --- update ---

	describe("update()", () => {
		it("interpolates values over time", () => {
			tween.to({ x: 100 }, { duration: 1000 });
			tween.start(0);

			tween.update(500);
			expect(obj.x).toBeGreaterThan(0);

			tween.update(500);
			expect(obj.x).toBeCloseTo(100, 0);
		});

		it("fires onStart callback once", () => {
			let callCount = 0;
			tween.to({ x: 100 }, { duration: 1000 }).onStart(() => {
				callCount++;
			});
			tween.start(0);

			tween.update(100);
			tween.update(100);
			tween.update(100);
			expect(callCount).toEqual(1);
		});

		it("fires onUpdate callback each frame", () => {
			let callCount = 0;
			tween.to({ x: 100 }, { duration: 1000 }).onUpdate(() => {
				callCount++;
			});
			tween.start(0);

			tween.update(100);
			tween.update(100);
			tween.update(100);
			expect(callCount).toEqual(3);
		});

		it("fires onComplete callback when finished", () => {
			let completed = false;
			tween.to({ x: 100 }, { duration: 100 }).onComplete(() => {
				completed = true;
			});
			tween.start(0);

			tween.update(100);
			expect(completed).toBe(true);
		});

		it("returns false when complete", () => {
			tween.to({ x: 100 }, { duration: 100 });
			tween.start(0);

			const result = tween.update(100);
			expect(result).toBe(false);
		});

		it("returns true while in progress", () => {
			tween.to({ x: 100 }, { duration: 1000 });
			tween.start(0);

			const result = tween.update(500);
			expect(result).toBe(true);
		});

		it("unsubscribes on completion", () => {
			tween.to({ x: 100 }, { duration: 100 });
			tween.start(0);

			tween.update(100);
			expect(tween._isRunning).toBe(false);
		});
	});

	// --- delay ---

	describe("delay()", () => {
		it("delays the start of interpolation", () => {
			tween.to({ x: 100 }, { duration: 1000, delay: 500 });
			tween.start(0);

			// during delay, value should not change
			tween.update(16);
			const xDuringDelay = obj.x;

			// after enough updates to pass delay + some duration
			for (let i = 0; i < 100; i++) {
				tween.update(16);
			}
			expect(obj.x).toBeGreaterThan(xDuringDelay);
		});

		it("returns this for chaining", () => {
			expect(tween.delay(100)).toBe(tween);
		});
	});

	// --- repeat ---

	describe("repeat()", () => {
		it("repeats the tween", () => {
			let completeCount = 0;
			tween.to({ x: 100 }, { duration: 100, repeat: 2 }).onComplete(() => {
				completeCount++;
			});
			tween.start(0);

			// first pass
			tween.update(100);
			expect(obj.x).toBeCloseTo(100, 0);
			expect(completeCount).toEqual(0); // not complete yet, still repeating

			// second pass
			tween.update(100);
			expect(completeCount).toEqual(0);

			// third pass (final)
			tween.update(100);
			expect(completeCount).toEqual(1);
		});

		it("returns this for chaining", () => {
			expect(tween.repeat(3)).toBe(tween);
		});
	});

	// --- yoyo ---

	describe("yoyo()", () => {
		it("reverses direction on repeat", () => {
			tween.to({ x: 100 }, { duration: 100, repeat: 1, yoyo: true });
			tween.start(0);

			// forward pass
			tween.update(100);
			expect(obj.x).toBeCloseTo(100, 0);

			// yoyo back
			tween.update(100);
			expect(obj.x).toBeCloseTo(0, 0);
		});

		it("returns this for chaining", () => {
			expect(tween.yoyo(true)).toBe(tween);
		});
	});

	// --- easing ---

	describe("easing()", () => {
		it("applies the easing function", () => {
			// Quadratic.In produces slower start than Linear
			const linearObj = { x: 0 };
			const quadObj = { x: 0 };

			const linearTween = new Tween(linearObj).to(
				{ x: 100 },
				{ duration: 1000, easing: Easing.Linear.None },
			);
			const quadTween = new Tween(quadObj).to(
				{ x: 100 },
				{ duration: 1000, easing: Easing.Quadratic.In },
			);

			linearTween.start(0);
			quadTween.start(0);

			// run both for the same number of frames
			for (let i = 0; i < 20; i++) {
				linearTween.update(16);
				quadTween.update(16);
			}

			// Quadratic.In should be behind Linear at the midpoint
			expect(quadObj.x).toBeLessThan(linearObj.x);
			expect(quadObj.x).toBeGreaterThan(0);
		});

		it("returns this for chaining", () => {
			expect(tween.easing(Easing.Linear.None)).toBe(tween);
		});
	});

	// --- chain ---

	describe("chain()", () => {
		it("starts chained tweens on completion", () => {
			const obj2 = { x: 0 };
			const chained = new Tween(obj2).to({ x: 100 }, { duration: 100 });

			tween.to({ x: 100 }, { duration: 100 }).chain(chained);
			tween.start(0);

			tween.update(100);
			// chained tween should have started
			expect(chained._isRunning).toBe(true);
		});

		it("returns this for chaining", () => {
			expect(tween.chain(new Tween({}))).toBe(tween);
		});
	});

	// --- callbacks ---

	describe("callbacks", () => {
		it("onStart returns this for chaining", () => {
			expect(tween.onStart(() => {})).toBe(tween);
		});

		it("onUpdate returns this for chaining", () => {
			expect(tween.onUpdate(() => {})).toBe(tween);
		});

		it("onComplete returns this for chaining", () => {
			expect(tween.onComplete(() => {})).toBe(tween);
		});

		it("onUpdate receives the easing value", () => {
			let receivedValue = -1;
			tween.to({ x: 100 }, { duration: 1000 }).onUpdate(function (value) {
				receivedValue = value;
			});
			tween.start(0);

			tween.update(500);
			expect(receivedValue).toBeGreaterThan(0);
			expect(receivedValue).toBeLessThanOrEqual(1);
		});
	});

	// --- setProperties / reset ---

	describe("setProperties()", () => {
		it("resets all tween state", () => {
			tween.to({ x: 100 }, { duration: 2000, delay: 500 });
			tween.start(0);
			tween.update(100);

			const newObj = { x: 0, y: 0 };
			tween.setProperties(newObj);

			expect(tween._object).toBe(newObj);
			expect(tween._duration).toEqual(1000); // default
			expect(tween._delayTime).toEqual(0);
			expect(tween._isRunning).toBe(false);
			expect(tween._onStartCallback).toBeNull();
			expect(tween._onUpdateCallback).toBeNull();
			expect(tween._onCompleteCallback).toBeNull();
		});

		it("unsubscribes a running tween", () => {
			tween.to({ x: 100 });
			tween.start();
			expect(tween._isRunning).toBe(true);

			tween.setProperties({ x: 0 });
			expect(tween._isRunning).toBe(false);
		});
	});

	// --- isPersistent ---

	describe("isPersistent", () => {
		it("defaults to false", () => {
			expect(tween.isPersistent).toBe(false);
		});

		it("can be set to true", () => {
			tween.isPersistent = true;
			expect(tween.isPersistent).toBe(true);
		});
	});

	// --- updateWhenPaused ---

	describe("updateWhenPaused", () => {
		it("defaults to false", () => {
			expect(tween.updateWhenPaused).toBe(false);
		});

		it("can be set to true", () => {
			tween.updateWhenPaused = true;
			expect(tween.updateWhenPaused).toBe(true);
		});
	});

	// --- static accessors ---

	describe("static Easing / Interpolation", () => {
		it("Tween.Easing is accessible", () => {
			expect(Tween.Easing).toBeDefined();
			expect(Tween.Easing.Linear.None).toBeTypeOf("function");
			expect(Tween.Easing.Bounce.Out).toBeTypeOf("function");
		});

		it("Tween.Interpolation is accessible", () => {
			expect(Tween.Interpolation).toBeDefined();
			expect(Tween.Interpolation.Linear).toBeTypeOf("function");
			expect(Tween.Interpolation.CatmullRom).toBeTypeOf("function");
		});
	});

	// --- interpolation with arrays ---

	describe("array interpolation", () => {
		it("interpolates through array values", () => {
			tween.to({ x: [50, 100] }, { duration: 1000 });
			tween.start(0);

			// after a few frames, should be between start and end
			for (let i = 0; i < 10; i++) {
				tween.update(16);
			}
			expect(obj.x).toBeGreaterThan(0);

			// run to completion
			for (let i = 0; i < 100; i++) {
				tween.update(16);
			}
			expect(obj.x).toBeCloseTo(100, 0);
		});
	});

	// --- relative values ---

	describe("relative string values", () => {
		it("supports relative +/- string values", () => {
			obj.x = 50;
			tween.to({ x: "+100" }, { duration: 100 });
			tween.start(0);

			tween.update(100);
			expect(obj.x).toBeCloseTo(150, 0);
		});
	});
});
