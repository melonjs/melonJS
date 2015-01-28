describe("Shape : me.Ellipse", function () {

    // define a ellipse object
    var circle = new me.Ellipse(50, 50, 100, 100);

    // get the polyshape bounding rect
    var boundingRect = circle.getBounds();

    describe("Ellipse ", function () {
        it("Ellipse max radius is 50", function () {
            expect(circle.radius).toEqual(50);
        });

        it("Ellipse x radius is 50", function () {
            expect(circle.radiusV.x).toEqual(50);
        });

        it("Ellipse y radius is 50", function () {
            expect(circle.radiusV.y).toEqual(50);
        });

        it("Ellipse pos is (50, 50)", function () {
            expect(circle.pos.equals({x: 50, y: 50})).toEqual(true);
        });

        it("Ellipse contains the point (75, 75)", function () {
            expect(circle.containsPoint(75, 75)).toEqual(true);
        });

        it("Ellipse does not contains the point (75, 500)", function () {
            expect(circle.containsPoint(75, 500)).toEqual(false);
        });

        it("collision response is correct", function () {
            expect(me.collision.testEllipseEllipse(
                new me.Renderable(0, 0, 100, 100), circle,
                new me.Renderable(0, 50, 100, 100), circle,
                me.collision.response.clear()
            )).toEqual(true);
            expect(me.collision.response.overlap).toEqual(50);
        });
    });

    describe("Ellipse Bounding Rect", function () {
        it("Ellipse Bounding Rect width is 100", function () {
            expect(boundingRect.width).toEqual(100);
        });

        it("Ellipse Bounding Rect height is 100", function () {
            expect(boundingRect.height).toEqual(100);
        });

        it("Ellipse Bounding Rect pos is (0,0)", function () {
            expect(boundingRect.pos.equals({x: 0, y: 0})).toEqual(true);
        });
    });

});
