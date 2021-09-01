describe("Shape : me.Line", function () {

    describe("Line", function () {

        var line, bounds;

        beforeAll(function () {
            line = new me.Line(0, 0, [
                {x: 0, y: 0},
                {x: 28, y: 60}
            ]);
            bounds = line.getBounds();
        });

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

        it("contains the point (0, 0)", function () {
            expect(line.contains(0, 0)).toEqual(true);
        });

        it("contains the point (14, 30)", function () {
            expect(line.contains(14, 30)).toEqual(true);
        });

        it("contains the point (60, -28) after rotating the line by -90 degrees", function () {
            line.rotate(-Math.PI / 2);
            expect(line.points[1].x).toBeCloseTo(60, 3);
            // value is 27.99999996 after rotation
            expect(line.points[1].y).toBeCloseTo(-28, 3);
        });

        it("does not contain the point (60, 28) after rotating back", function () {
            line.rotate(Math.PI / 2);
            expect(line.contains(60, 28)).toEqual(false);
        });

        it("contains the point (28, 60)", function () {
            expect(line.contains(28, 60)).toEqual(true);
        });

        it("does not contain the point (15, 30)", function () {
            expect(line.contains(15, 30)).toEqual(false);
        });

        it("does not contain the point (29, 61)", function () {
            expect(line.contains(29, 61)).toEqual(false);
        });

        it("Line Bounding Rect width is 28", function () {
            expect(bounds.width).toEqual(28);
        });

        it("Line Bounding Rect height is 60", function () {
            expect(bounds.height).toEqual(60);
        });

        it("Line bounding rect contains the point (28, 60)", function () {
            expect(bounds.contains(28, 60)).toEqual(true);
        });

        it("Line Bounding Rect pos is (0,0)", function () {
            expect(bounds.x).toEqual(0);
            expect(bounds.y).toEqual(0);
        });
    });

});
