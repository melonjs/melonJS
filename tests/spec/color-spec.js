describe("me.Color", function () {

    var red_color;
    var green_color;
    var blue_color;
    //ToDo changing this to 'beforeEach' shows that currently tests leak their state into other tests, which is not good
    beforeAll(function () {
        red_color = new me.Color(255, 0, 0, 0.5);
        green_color = new me.Color().parseCSS("green");
        blue_color = new me.Color().parseHex("#0000FF");
    });

    describe("parseHex Function", function () {
        // #RGB
        it("#00F value is rgb(0, 0, 255)", function () {
            expect(blue_color.parseHex("#0000FF").toRGB()).toEqual("rgb(0,0,255)");
        });
        // #RGBA
        it("#0F08 value is rgba(0, 255, 0, 0.5)", function () {
            expect(blue_color.parseHex("#0F08").toRGBA()).toEqual("rgba(0,255,0,0.5)");
        });
        // #RRGGBB
        it("#FF00FF value is rgba(255, 0, 255, 1)", function () {
            expect(blue_color.parseHex("#FF00FF").toRGBA()).toEqual("rgba(255,0,255,1)");
        });
        // #RRGGBBAA (finish with the blue color so that the test below passes)
        it("#0000FF80 value is rgba(0, 0, 255, 0.5)", function () {
            expect(blue_color.parseHex("#0000FF80").toRGBA()).toEqual("rgba(0,0,255,0.5)");
        });
    });

    describe("red_color", function () {
        it("is an instance of me.Color", function () {
            expect(red_color).toBeInstanceOf(me.Color);
        });

        it("red_color.r == 255", function () {
            expect(red_color.r).toEqual(255);
        });

        it("red_color.g == 0", function () {
            expect(red_color.g).toEqual(0);
        });

        it("red_color.b == 0", function () {
            expect(red_color.b).toEqual(0);
        });

        it("red_color.alpha == 0.5", function () {
            expect(red_color.alpha).toEqual(0.5);
        });

        it("red_color hex value is #FF0000", function () {
            expect(red_color.toHex()).toEqual("#FF0000");
        });

        it("red_color RGBA hex value is #FF0000FF", function () {
            expect(red_color.toHex8()).toEqual("#FF00007F");
        });

        it("red_color rgba value is rgba(255,0,0,0.5)", function () {
            expect(red_color.toRGBA()).toEqual("rgba(255,0,0,0.5)");
        });

    });

    describe("green_color", function () {
        it("green_color.r == 0", function () {
            expect(green_color.r).toEqual(0);
        });

        it("green_color.g == 128", function () {
            expect(green_color.g).toEqual(128);
        });

        it("green_color.b == 0", function () {
            expect(green_color.b).toEqual(0);
        });

        it("green_color.alpha == 1", function () {
            expect(green_color.alpha).toEqual(1);
        });

        it("green_color hex value is #008000", function () {
            expect(green_color.toHex()).toEqual("#008000");
        });

        it("(green_color + red_color) hex value is #FF8000", function () {
            expect(red_color.add(green_color).toHex()).toEqual("#FF8000");
        });

        it("darken (green_color + red_color) by 0.5 hex value is #7F4000", function () {
            expect(red_color.darken(0.5).toHex()).toEqual("#7F4000");
        });

        it("final red_color rgba value is rgba(127,64,0,0.75)", function () {
            expect(red_color.toRGBA()).toEqual("rgba(127,64,0,0.75)");
        });

    });

    describe("blue_color", function () {
        it("blue_color hex value is #0000FF", function () {
            expect(blue_color.toHex()).toEqual("#0000FF");
        });

        it("blue_color rgb value is rgb(0, 0, 255)", function () {
            expect(blue_color.toRGB()).toEqual("rgb(0,0,255)");
        });

        it("blue_color rgba value is rgba(0, 0, 255, 0.5)", function () {
            expect(blue_color.toRGBA()).toEqual("rgba(0,0,255,0.5)");
        });

        it("lighten blue_color hex by 0.5 value is #7F7FFF", function () {
            expect(blue_color.lighten(0.5).toHex()).toEqual("#7F7FFF");
        });
    });

    describe("color lerp function", function () {
        it("Linearly interpolates between colors", function () {
            var _colorA = new me.Color(0, 0, 0);
            var _colorB = new me.Color(255, 128, 64);

            _colorA.lerp(_colorB, 0.5);

            expect(_colorA.r).toEqual(127);
            expect(_colorA.g).toEqual(64);
            expect(_colorA.b).toEqual(32);
        });
    });

    describe("color random function", function () {
        it("generate random colors using different ranges", function () {
            var _colorA = new me.Color().random();
            var _colorB = new me.Color().random(64, 127);
            var _colorC = new me.Color().random(-1, 256);

            // they should all be between 0 and 255
            expect(_colorA.r).toBeGreaterThan(-1);
            expect(_colorA.g).toBeGreaterThan(-1);
            expect(_colorA.b).toBeGreaterThan(-1);
            expect(_colorA.r).toBeLessThan(256);
            expect(_colorA.g).toBeLessThan(256);
            expect(_colorA.b).toBeLessThan(256);

            expect(_colorB.r).toBeGreaterThan(63);
            expect(_colorB.g).toBeGreaterThan(63);
            expect(_colorB.b).toBeGreaterThan(63);
            expect(_colorB.r).toBeLessThan(128);
            expect(_colorB.g).toBeLessThan(128);
            expect(_colorB.b).toBeLessThan(128);

            expect(_colorC.r).toBeGreaterThan(-1);
            expect(_colorC.g).toBeGreaterThan(-1);
            expect(_colorC.b).toBeGreaterThan(-1);
            expect(_colorC.r).toBeLessThan(256);
            expect(_colorC.g).toBeLessThan(256);
            expect(_colorC.b).toBeLessThan(256);
        });
    });

    describe("color clone function", function () {
        it("cloned color hex value is #2060FF", function () {
            var _color = new me.Color().parseHex("#2060FF");
            var clone = _color.clone();
            expect(clone.r).toEqual(32);
            expect(clone.g).toEqual(96);
            expect(clone.b).toEqual(255);
        });
    });

    describe("color copy function", function () {
        it("copied color hex value is #8040FF", function () {
            var _color = new me.Color().parseHex("#8040FF");
            var copy = new me.Color().copy(_color);
            expect(copy.toHex()).toEqual("#8040FF");
        });
    });
});
