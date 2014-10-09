describe("Shape : me.Polygon", function () {

    // define a polygon object (star from the the shape example)
    var stars = new me.Polygon(0, 0, [
        // draw a star
        {x: 0, y: 0},
        {x: 28, y: 60},
        {x: 94, y: 70},
        {x: 46, y: 114},
        {x: 88, y: 180},
        {x: 0, y: 125},
        {x: -88, y: 180},
        {x: -46, y: 114},
        {x: -94, y: 70},
        {x: -28, y: 60}
    ]);

    // get the polygon bounding rect
    var boundingRect = stars.getBounds();

    describe("Polygon", function () {
        it("requires at least 3 points", function () {
            function badPolygon() {
                return new me.Polygon(0, 0, [
                    {x: 0, y: 0},
                    {x: 28, y: 60}
                ]);
            }

            expect(badPolygon).toThrow();
        });

        it("contains the point (75, 75)", function () {
            expect(stars.containsPoint(75, 75)).toEqual(true);
        });

        it("does not contains the point (75, 500)", function () {
            expect(stars.containsPoint(75, 500)).toEqual(false);
        });
    });

    describe("Polygon Bounding Rect", function () {
        it("width is 188", function () {
            expect(boundingRect.width).toEqual(188);
        });

        it("height is 180", function () {
            expect(boundingRect.height).toEqual(180);
        });

        it("pos is (-94,0)", function () {
            expect(boundingRect.pos.equals({x: -94, y: 0})).toEqual(true);
        });
    });

});
