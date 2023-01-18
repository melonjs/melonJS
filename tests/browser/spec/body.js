import { expect } from "expect";
import * as me from "./../public/lib/melonjs.module.js";

describe("Physics : me.Body", function () {
    var shape = new me.Rect(10, 10, 32, 64);
    var parent = new me.Renderable(0, 0, 32, 64);
    var body = new me.Body(parent, shape);

    describe("bound coordinates", function () {
        it("body has correct bounds", function () {
            var bounds = body.getBounds();
            expect(bounds.left).toEqual(10);
            expect(bounds.top).toEqual(10);
            expect(bounds.width).toEqual(32);
            expect(bounds.height).toEqual(64);
        });
    });
});
