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

        describe("String", function () {
            var untrimmed_str = " start and end with white space ";

            it("trim left side", function () {
                expect(untrimmed_str.trimLeft()).toEqual("start and end with white space ");
            });

            it("trim right side", function () {
                expect(untrimmed_str.trimRight()).toEqual(" start and end with white space");
            });

        });
    });
});
