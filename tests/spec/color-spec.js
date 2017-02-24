describe("me.Color", function () {

    var red_color = new me.Color(255, 0, 0, 0.5);
    var green_color = new me.Color().parseCSS("green");
    var blue_color = new me.Color().parseHex("#0000FF");

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

    describe("color clone function", function () {
        var clone = blue_color.clone();
        it("clone color hex value is #0000FF", function () {
            expect(clone.toHex()).toEqual("#0000FF");
        });
    });
});
