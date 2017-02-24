describe("Shape : me.Rect", function () {

    var rect1 = new me.Rect(0, 0, 25, 50);
    // rect 2 overlap rect 1
    var rect2 = new me.Rect(50, 50, 100, 100);
    // rect 3 contains rect 1 and rect 2
    var rect3 = new me.Rect(0, 0, 150, 150);
    // rect 4 does not overlap any rectangle
    var rect4 = new me.Rect(500, 500, 50, 50);
    // rect 5 is the merge of rect 2 and rect 4
    var rect5 = rect2.clone().union(rect4);

    describe("rect1", function () {
        it("scale rect1", function () {
            rect1.scale(4, 2);
            expect(rect1.width).toEqual(100);
            expect(rect1.height).toEqual(100);
        });
        it("rect 1 overlaps rect2", function () {
            expect(rect1.overlaps(rect2)).toEqual(true);
        });

        it("rect 1 overlaps rect3", function () {
            expect(rect1.overlaps(rect3)).toEqual(true);
        });

        it("rect 1 does not overlaps rect4", function () {
            expect(rect1.overlaps(rect4)).toEqual(false);
        });
    });

    describe("rect2", function () {

        it("rect 2 overlaps rect3", function () {
            expect(rect1.overlaps(rect3)).toEqual(true);
        });

        it("rect 2 does not overlaps rect4", function () {
            expect(rect1.overlaps(rect4)).toEqual(false);
        });
    });

    describe("rect3", function () {
        it("rect 3 contains rect1", function () {
            expect(rect3.contains(rect1)).toEqual(true);
        });

        it("rect 3 contains rect2", function () {
            expect(rect3.contains(rect2)).toEqual(true);
        });

        it("rect 3 contains the point (70, 150)", function () {
            expect(rect3.containsPoint(70, 150)).toEqual(true);
        });

        it("rect 3 does not overlaps rect4", function () {
            expect(rect3.overlaps(rect4)).toEqual(false);
        });
    });

    describe("rect5", function () {
        it("rect 5 width is 500", function () {
            expect(rect5.width).toEqual(500);
        });

        it("rect 5 height is 500", function () {
            expect(rect5.width).toEqual(500);
        });

        it("rect 5 pos is (50,50)", function () {
            expect(rect5.pos.equals({x: 50, y: 50})).toEqual(true);
        });

        it("rect 5 overlaps rect1", function () {
            expect(rect5.overlaps(rect1)).toEqual(true);
        });

        it("rect 5 contains rect2", function () {
            expect(rect5.contains(rect2)).toEqual(true);
        });

        it("rect 5 overlaps rect3", function () {
            expect(rect5.overlaps(rect3)).toEqual(true);
        });

        it("rect 5 contains rect4", function () {
            expect(rect5.contains(rect4)).toEqual(true);
        });

    });

});
