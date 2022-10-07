import { expect } from "expect";
import * as me from "./../public/lib/melonjs.module.js";

describe("Shape : me.Point", function () {
    describe("Point", function () {
        var point;

        before(function () {
            point = new me.Point(1, 2);
        });

        it("point is initialized to is (1,2)", function () {
            expect(point.x).toEqual(1);
            expect(point.y).toEqual(2);
        });

        it("point is equal or not to another one", function () {
            var point2 = new me.Point(1, 2);
            expect(point.equals(point2)).toEqual(true);
            expect(point.equals(point2.x, point2.y)).toEqual(true);
            point2.set(3, 4);
            expect(point.equals(point2)).toEqual(false);
            expect(point.equals(point2.x, point2.y)).toEqual(false);
        });
    });
});
