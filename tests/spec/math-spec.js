describe("me.Math", function () {
    describe("degToRad", function () {
        it("0 should be 0", function () {
            expect(me.Math.degToRad(0)).toEqual(0);
        });

        it("180 should be Pi", function () {
            expect(me.Math.degToRad(180)).toEqual(Math.PI);
        });

        it("360 should be Pi * 2", function () {
            expect(me.Math.degToRad(360)).toEqual(Math.PI * 2);
        });
    });

    describe("clamp", function () {
        it("should clamp low", function () {
            expect(me.Math.clamp(-30, 1, 10)).toEqual(1);
        });

        it("should clamp high", function () {
            expect(me.Math.clamp(30, 1, 10)).toEqual(10);
        });

        it("should not clamp", function () {
            expect(me.Math.clamp(Math.PI, 1, 10)).toEqual(Math.PI);
        });
    })

    describe("random", function () {
        var a = me.Math.random(1, 10);

        it("should be >= 1", function () {
            expect(a).not.toBeLessThan(1);
        });

        it("should be < 10", function () {
            expect(a).toBeLessThan(10);
        });

        it("should be a whole number", function () {
            expect(Math.floor(a)).toEqual(a);
        });
    });

    describe("randomFloat", function () {
        var a = me.Math.randomFloat(1, 10);

        it("should be >= 1", function () {
            expect(a).not.toBeLessThan(1);
        });

        it("should be < 10", function () {
            expect(a).toBeLessThan(10);
        });
    });

    describe("weightedRandom", function () {
        var a = me.Math.weightedRandom(1, 10);

        it("should be >= 1", function () {
            expect(a).not.toBeLessThan(1);
        });

        it("should be < 10", function () {
            expect(a).toBeLessThan(10);
        });

        it("should be a whole number", function () {
            expect(Math.floor(a)).toEqual(a);
        });
    });

    describe("round", function () {
        var a = me.Math.round(Math.PI, 4);

        it("Pi should be 3.1416", function () {
            expect(a).toEqual(3.1416);
        });
    });

    describe("POT", function () {
        it("32 is a Power of 2", function () {
            expect(me.Math.isPowerOfTwo(32)).toEqual(true);
        });
        it("1027 is not a Power of 2", function () {
            expect(me.Math.isPowerOfTwo(1027)).toEqual(false);
        });

        it("next Power of 2 for 1000", function () {
            expect(me.Math.nextPowerOfTwo(1000)).toEqual(1024);
        });
        it("next Power of 2 for 32", function () {
            expect(me.Math.nextPowerOfTwo(32)).toEqual(32);
        });
    });

    describe("toBeCloseTo", function () {

        it("4.3546731 is closed to 4.3547", function () {
            var value = 4.3546731;
            expect(me.Math.toBeCloseTo(4.3547, value, 0)).toEqual(true);
            expect(me.Math.toBeCloseTo(4.3547, value, 1)).toEqual(true);
            expect(me.Math.toBeCloseTo(4.3547, value, 2)).toEqual(true);
            expect(me.Math.toBeCloseTo(4.3547, value, 3)).toEqual(true);
            expect(me.Math.toBeCloseTo(4.3547, value, 4)).toEqual(true);
            expect(me.Math.toBeCloseTo(4.3547, value, 5)).toEqual(false);
            expect(me.Math.toBeCloseTo(4.3547, value, 6)).toEqual(false);
        });

        it("4.8 is closed to 5 but not to 4", function () {
            var value = 4.8;
            expect(me.Math.toBeCloseTo(5, value, 0)).toEqual(true);
            expect(me.Math.toBeCloseTo(4, value, 0)).toEqual(false);
        });
    });

});
