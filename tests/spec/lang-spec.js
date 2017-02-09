describe("Language extensions", function () {
    describe("Number.prototype", function () {
        describe("clamp", function () {
            it("should clamp low", function () {
                expect((-30).clamp(1, 10)).toEqual(1);
            });

            it("should clamp high", function () {
                expect((30).clamp(1, 10)).toEqual(10);
            });

            it("should not clamp", function () {
                expect((Math.PI).clamp(1, 10)).toEqual(Math.PI);
            });
        })

        describe("random", function () {
            var a = (1).random(10);
            var b = Number.prototype.random(1, 10);

            it("should be >= 1", function () {
                expect(a).not.toBeLessThan(1);
                expect(b).not.toBeLessThan(1);
            });

            it("should be < 10", function () {
                expect(a).toBeLessThan(10);
                expect(b).toBeLessThan(10);
            });

            it("should be a whole number", function () {
                expect(Math.floor(a)).toEqual(a);
                expect(Math.floor(b)).toEqual(b);
            });
        });

        describe("randomFloat", function () {
            var a = (1).randomFloat(10);
            var b = Number.prototype.randomFloat(1, 10);

            it("should be >= 1", function () {
                expect(a).not.toBeLessThan(1);
                expect(b).not.toBeLessThan(1);
            });

            it("should be < 10", function () {
                expect(a).toBeLessThan(10);
                expect(b).toBeLessThan(10);
            });
        });

        describe("weightedRandom", function () {
            var a = (1).weightedRandom(10);
            var b = Number.prototype.weightedRandom(1, 10);

            it("should be >= 1", function () {
                expect(a).not.toBeLessThan(1);
                expect(b).not.toBeLessThan(1);
            });

            it("should be < 10", function () {
                expect(a).toBeLessThan(10);
                expect(b).toBeLessThan(10);
            });

            it("should be a whole number", function () {
                expect(Math.floor(a)).toEqual(a);
                expect(Math.floor(b)).toEqual(b);
            });
        });

        describe("round", function () {
            var a = (Math.PI).round(4);
            var b = Number.prototype.round(Math.PI, 4);

            it("Pi should be 3.1416", function () {
                expect(a).toEqual(3.1416);
                expect(b).toEqual(3.1416);
            });
        });

        describe("toHex", function () {
            it("0 should be '00'", function () {
                expect((0).toHex()).toEqual("00");
            });

            it("128 should be '80'", function () {
                expect((128).toHex()).toEqual("80");
            });

            it("255 should be 'FF'", function () {
                expect((255).toHex()).toEqual("FF");
            });
        });

        describe("degToRad", function () {
            it("0 should be 0", function () {
                expect((0).degToRad()).toEqual(0);
            });

            it("180 should be Pi", function () {
                expect((180).degToRad()).toEqual(Math.PI);
            });

            it("360 should be Pi * 2", function () {
                expect((360).degToRad()).toEqual(Math.PI * 2);
            });
        });
    });
});
