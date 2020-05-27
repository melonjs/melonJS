describe("utils", function () {

    describe("TMX Parsing", function () {

        it("correctly decodes single-line csv", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, 2");
            expect(decodedString).toEqual([1, 2]);

            decodedString = me.TMXUtils.decodeCSV("1,2");
            expect(decodedString).toEqual([1, 2]);

            decodedString = me.TMXUtils.decodeCSV("1,          2");
            expect(decodedString).toEqual([1, 2]);
        });

        it("only processes numbers", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, value, 3");
            expect(decodedString).toEqual([1, NaN, 3]);
        });

        //ToDo I think this is a bug, next line should be treated as a comma, not as a space, since csv line doesn't end
        // with a comma by itself
        xit("correctly decodes multiple-line csv", function () {
            var decodedString = me.TMXUtils.decodeCSV("1, 2\n3, 4");
            expect(decodedString).toEqual([1, 2, 3, 4]);
        });

    });

    describe("String", function () {
        var untrimmed_str = " start and end with white space ";

        it("trim left side", function () {
            expect(me.utils.string.trimLeft(untrimmed_str)).toEqual("start and end with white space ");
        });

        it("trim right side", function () {
            expect(me.utils.string.trimRight(untrimmed_str)).toEqual(" start and end with white space");
        });

        it("capitalize", function () {
            expect(me.utils.string.capitalize("capitalize")).toEqual("Capitalize");
        });


    });
});
