describe("Physics : me.Bounds", function () {

    var bound1 = new me.Bounds([{x:0, y:0}, {x:50, y:0}, {x:50, y:100}, {x:0, y:100}]);

    describe("bound1", function () {

        it("bound1 has finite coordinates", function () {
            expect(bound1.isFinite()).toEqual(true);
        });

        it("bound1 position", function () {
            expect(bound1.left).toEqual(0);
            expect(bound1.top).toEqual(0);
        });

        it("translate bound1", function () {
            bound1.translate(100, 100);
            expect(bound1.left).toEqual(100);
            expect(bound1.top).toEqual(100);
            expect(bound1.right).toEqual(150);
            expect(bound1.bottom).toEqual(200);
        });

        it("bound1 size", function () {
            expect(bound1.width).toEqual(50);
            expect(bound1.height).toEqual(100);
        });

        it("center of bound1", function () {
            expect(bound1.center.x).toEqual(125);
            expect(bound1.center.y).toEqual(150);
            expect(bound1.centerX).toEqual(125);
            expect(bound1.centerY).toEqual(150);
        });

        it("bounds1 contains a point", function () {
            expect(bound1.contains(0, 0)).toEqual(false);
            expect(bound1.contains(125, 150)).toEqual(true);
        });

        it("union with another bound", function () {
            var bound2 = new me.Bounds([{x:0, y:0}, {x:200, y:0}, {x:200, y:150}, {x:0, y:150}]);
            bound1.addBounds(bound2);
            expect(bound1.left).toEqual(0);
            expect(bound1.top).toEqual(0);
            expect(bound1.right).toEqual(200);
            expect(bound1.bottom).toEqual(200);
            expect(bound1.centerX).toEqual(100);
            expect(bound1.centerY).toEqual(100);
            expect(bound1.contains(0, 0)).toEqual(true);
            expect(bound1.contains(125, 150)).toEqual(true);
        });

    });

});
