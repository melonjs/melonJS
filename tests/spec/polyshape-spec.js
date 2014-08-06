describe("Shape : me.PolyShape", function () {

    // define a polygone object (star from the the shape example)
    var stars = new me.PolyShape(0, 0, [
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
    ], true);
    
    // get the polyshape bounding rect
    var boundingRect = stars.getBounds();

    describe("PolyShape ", function () {
        it("PolyShape contains the point (75, 75)", function () {
            expect(stars.containsPoint(75, 75)).toEqual(true);
        });

        it("PolyShape does not contains the point (75, 500)", function () {
            expect(stars.containsPoint(75, 500)).toEqual(false);
        });
    });
    
    describe("PolyShape Bounding Rect", function () {
        it("PolyShape Bounding Rect width is 188", function () {
            expect(boundingRect.width).toEqual(188);
        });

        it("PolyShape Bounding Rect height is 180", function () {
            expect(boundingRect.height).toEqual(180);
        });

        it("PolyShape Bounding Rect pos is (-94,0)", function () {
            expect(boundingRect.pos.equals({x: -94, y: 0})).toEqual(true);
        });
    });

});
