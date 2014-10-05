describe("Shape : me.Line", function () {

    // define a line object
    var line = new me.Line(0, 0, [
        {x: 0, y: 0},
        {x: 28, y: 60}
    ]);

    // get the polyshape bounding rect
    var boundingRect = line.getBounds();

    describe("Line", function () {
        it("requires exactly 2 points", function () {
            function badLine1() {
                return new me.Line(0, 0, [
                    {x: 0, y: 0}
                ]);
            }

            function badLine2() {
                return new me.Line(0, 0, [
                    {x: 0, y: 0},
                    {x: 0, y: 0},
                    {x: 28, y: 60}
                ]);
            }

            expect(badLine1).toThrow();
            expect(badLine2).toThrow();
        });
    });

    describe("Line Bounding Rect", function () {
        it("Polygon Bounding Rect width is 28", function () {
            expect(boundingRect.width).toEqual(28);
        });

        it("Polygon Bounding Rect height is 60", function () {
            expect(boundingRect.height).toEqual(60);
        });

        it("Polygon Bounding Rect pos is (0,0)", function () {
            expect(boundingRect.pos.equals({x: 0, y: 0})).toEqual(true);
        });
    });

});
