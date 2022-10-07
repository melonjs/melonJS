import { expect } from "expect";
import * as me from "./../public/lib/melonjs.module.js";

describe("Shape : me.RoundRect", function () {
    var rrect = new me.RoundRect(50, 50, 100, 100, 40);

    describe("RoundRect", function () {
        it("rrect has finite coordinates", function () {
            expect(rrect.pos.x).toEqual(50);
            expect(rrect.pos.y).toEqual(50);
            expect(rrect.centerX).toEqual(100);
            expect(rrect.centerY).toEqual(100);
            expect(rrect.width).toEqual(100);
            expect(rrect.height).toEqual(100);
            expect(rrect.radius).toEqual(40);
        });

        describe("contains point", function () {
            var rect = new me.Rect(50, 50, 100, 100);
            it("a rect of the same dimension does contain 51, 51", function () {
                expect(rect.contains(51, 51)).toEqual(true);
            });
            it("a rect of the same dimension does contain 51, 149", function () {
                expect(rect.contains(51, 149)).toEqual(true);
            });
            it("a rect of the same dimension does contain 149, 51", function () {
                expect(rect.contains(149, 51)).toEqual(true);
            });
            it("a rect of the same dimension does contain 149, 149", function () {
                expect(rect.contains(149, 149)).toEqual(true);
            });

            it("rrect does not contain 51, 51", function () {
                expect(rrect.contains(51, 51)).toEqual(false);
            });
            it("rrect does not contain 51, 149", function () {
                expect(rrect.contains(51, 149)).toEqual(false);
            });
            it("rrect does not contain 149, 51", function () {
                expect(rrect.contains(149, 51)).toEqual(false);
            });
            it("rrect does not contain 149, 149", function () {
                expect(rrect.contains(149, 149)).toEqual(false);
            });
        });

        describe("copy, clone & equality", function () {
            var _rect = new me.RoundRect(1, 1, 1, 1);
            _rect.copy(rrect);
            it("copy rrect size, position radius", function () {
                expect(_rect.equals(rrect)).toEqual(true);
            });
            var cloneRect = _rect.clone();
            it("clone rect and test radius", function () {
                expect(cloneRect.radius).toEqual(40);
            });
        });
    });
});
