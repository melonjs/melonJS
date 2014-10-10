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

    describe("Line", function () {
        it("contains the point (0, 0)", function () {
            expect(line.containsPoint(0, 0)).toEqual(true);
        });
        
        it("contains the point (14, 30)", function () {
            expect(line.containsPoint(14, 30)).toEqual(true);
        });

        it("contains the point (28, 60)", function () {
            expect(line.containsPoint(28, 60)).toEqual(true);
        });

        it("does not contains the point (15, 30)", function () {
            expect(line.containsPoint(15, 30)).toEqual(false);
        });
        
        it("does not contains the point (29, 61)", function () {
            expect(line.containsPoint(29, 61)).toEqual(false);
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
