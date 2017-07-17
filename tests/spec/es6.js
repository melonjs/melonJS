describe("ES6 Features", function () {

    describe("String functions :", function () {
        var str = "To be, or not to be, that is the question.";

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
