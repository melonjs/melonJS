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
});
