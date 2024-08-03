import { describe, expect, it } from "vitest";
import { ObservablePoint, Point } from "../src/index.js";

describe("ObservablePoint : constructor", () => {
	it("creates a new ObservablePoint instance with default values", () => {
		const observablePoint = new ObservablePoint();
		expect(observablePoint.x).toEqual(0);
		expect(observablePoint.y).toEqual(0);
	});

	it("creates a new ObservablePoint instance with specified values", () => {
		const observablePoint = new ObservablePoint(10, 20);
		expect(observablePoint.x).toEqual(10);
		expect(observablePoint.y).toEqual(20);
	});

	it("values can be compared with a Point object", () => {
		const observablePoint = new ObservablePoint(10, 30);
		const point = new Point(10, 30);
		expect(observablePoint.equals(point)).toEqual(true);
	});

	it("triggers the callback function when setting values", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observablePoint = new ObservablePoint(0, 0, callback);
		expect(observablePoint.x).toEqual(0);
		expect(observablePoint.y).toEqual(0);
		expect(callbackCalled).toEqual(false);

		observablePoint.x = 10;
		expect(observablePoint.x).toEqual(10);
		expect(callbackCalled).toEqual(true);
	});

	it("triggers the callback function when calling set()", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observablePoint = new ObservablePoint(0, 0, callback);
		expect(observablePoint.x).toEqual(0);
		expect(observablePoint.y).toEqual(0);
		expect(callbackCalled).toEqual(false);

		observablePoint.set(10, 20);
		expect(observablePoint.equals(10, 20)).toEqual(true);
		expect(callbackCalled).toEqual(true);
	});

	it("does not trigger the callback function when using setMuted", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observablePoint = new ObservablePoint(0, 0, callback);
		expect(observablePoint.x).toEqual(0);
		expect(observablePoint.y).toEqual(0);
		expect(callbackCalled).toEqual(false);

		observablePoint.setMuted(10, 20);
		expect(observablePoint.equals(10, 20)).toEqual(true);
		expect(callbackCalled).toEqual(false);
	});

	it("does not trigger the callback function when revoked", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observablePoint = new ObservablePoint(0, 0, callback);
		expect(observablePoint.x).toEqual(0);
		expect(observablePoint.y).toEqual(0);
		expect(callbackCalled).toEqual(false);

		observablePoint.revoke();
		expect(() => {
			observablePoint.set(20, 10);
		}).toThrow();
	});
});
