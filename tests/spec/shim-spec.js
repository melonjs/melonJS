describe("ES5/ES6 Shim", function () {
    var str = "To be, or not to be, that is the question.";

    var untrimmed_str = " start and end with white space ";

    describe("the String 'To be, or not to be, that is the question.'", function () {
        it("contains 'To Be'", function () {
            expect(str.includes("To be")).toEqual(true);
        });

        it("contains 'question'", function () {
            expect(str.includes("question")).toEqual(true);
        });

        it("does no contain 'nonexistent'", function () {
            expect(str.includes("nonexistent")).toEqual(false);
        });

        it("does not contains 'To be' at index 1", function () {
            expect(str.includes("To be", 1)).toEqual(false);
        });

        it("does not contain 'TO BE'", function () {
            expect(str.includes("TO BE")).toEqual(false);
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

    describe("math functions :", function () {
        it("123 is positive", function () {
            expect(Math.sign(123)).toEqual(1);
        });
        it("-123 is negative", function () {
            expect(Math.sign(-123)).toEqual(-1);
        });
        it("0 is 0", function () {
            expect(Math.sign(0)).toEqual(0);
        });
    });

});
