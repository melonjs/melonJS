describe("Shape : me.Font", function () {

    // define a font object
    var font = new me.Font("Arial", 8, "white");
    
    describe("font set Size", function () {
        it("default font size is 8", function () {
            expect(font.height).toEqual(8);
        });

        it("default font size is '10'", function () {
            font.setFont("Arial", "10");
            expect(font.height).toEqual(10);
        });

        it("set font size to 12px", function () {
            font.setFont("Arial", "12px");
            expect(font.height).toEqual(12);
        });

        it("set font size to 2ex", function () {
            font.setFont("Arial", "2ex");
            expect(font.height).toEqual(2 * 12);
        });

        it("set font size to 1.5em", function () {
            font.setFont("Arial", "1.5em");
            expect(font.height).toEqual(1.5 * 24);
        });

        it("set font size to 18pt", function () {
            font.setFont("Arial", "18pt");
            expect(font.height).toEqual(18 * 0.75);
        });
    });
});
