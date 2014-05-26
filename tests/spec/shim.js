describe("ES5/ES6 Shim", function () {
    var str = "To be, or not to be, that is the question.";

    var untrimmed_str = " start and end with white space ";

    describe("the String 'To be, or not to be, that is the question.'", function () {
        it("contains 'To Be'", function () {
            expect(str.contains("To be")).toEqual(true);
        });

        it("contains 'question'", function () {
            expect(str.contains("question")).toEqual(true);
        });
        
        it("does no contain 'nonexistent'", function () {
            expect(str.contains("nonexistent")).toEqual(false);
        });
        
        it("does not contains 'To be' at index 1", function () {
            expect(str.contains("To be", 1)).toEqual(false);
        });

        it("does not contain 'TO BE'", function () {
            expect(str.contains("TO BE")).toEqual(false);
        });

    });

    describe("trimming functions :", function () {
        it("trim both sides", function () {
            expect(untrimmed_str.trim()).toEqual("start and end with white space");
        });

        it("trim left side", function () {
            expect(untrimmed_str.trimLeft()).toEqual("start and end with white space ");
        });

        it("trim right side", function () {
            expect(untrimmed_str.trimRight()).toEqual(" start and end with white space");
        });

    });

});
