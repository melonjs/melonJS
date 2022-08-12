describe("Shape : me.Point", function () {

    describe("Point", function () {

        var point;

        beforeAll(function () {
            point = new me.Point(1, 2);
        });

        it("point is initialized to is (1,2)", function () {
            expect(point.x).toEqual(1);
            expect(point.y).toEqual(2);
        });
    });

});
