describe("Language extensions", function () {
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
