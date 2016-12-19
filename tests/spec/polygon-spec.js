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
        // get the polygon bounding rect
        var boundingRect = stars.getBounds();

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

    describe("Polygon transformation", function () {
        var rect = new me.Polygon(0, 0, [
            // draw a square
            {x: 0, y: 0},
            {x: 32, y: 0},
            {x: 32, y: 32},
            {x: 0, y: 32}
        ]);
        var boundingRect = rect.getBounds();

        it("Bounds should be updated when scaled or rotated", function () {
            // scale the polygon and rotate it by 45deg
            rect.transform((new me.Matrix2d()).scale(2.0).rotate(Math.PI/4));
            expect(Math.floor(boundingRect.width)).toEqual(90);
            expect(Math.floor(boundingRect.height)).toEqual(90);
        });
    });

    describe("Isometric transformation", function () {
        var shape = new me.Polygon(0, 0, [
            // draw a square
            new me.Vector2d(0, 0),
            new me.Vector2d(32, 0),
            new me.Vector2d(32, 32),
            new me.Vector2d(0, 32)
        ]);

        it("shape should have an isometric diamond shape", function () {
            shape.toIso();
            // test a few points
            expect(~~shape.points[1].y).toEqual(16);
            expect(~~shape.points[3].x).toEqual(-32);
            expect(~~shape.points[3].y).toEqual(16);

            // convert it back
            shape.to2d();
            expect(~~shape.points[1].y).toEqual(0);
            expect(~~shape.points[3].x).toEqual(0);
            expect(~~shape.points[3].y).toEqual(32);
        });
    });
});
