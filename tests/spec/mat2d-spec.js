describe("me.Matrix2d", function () {
    it("should be initialized to a 3x3 identity matrix", function () {
        var matA = new me.Matrix2d();
        var result = "me.Matrix2d(1, 0, 0, 0, 1, 0, 0, 0, 1)";

        expect(matA.toString() === result).toEqual(true);
    });

    it("should multiply all values properly", function () {
        var matA = new me.Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
        var matB = new me.Matrix2d(7, 8, 0, 9, 10, 0, 11, 12, 1);
        var result = "me.Matrix2d(31, 46, 0, 39, 58, 0, 52, 76, 1)";

        matA.multiply(matB);

        expect(matA.toString() === result).toEqual(true);
    });

    it("should reset to an identity matrix", function () {
        var matA = new me.Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);

        matA.identity();

        expect(matA.isIdentity()).toEqual(true);
    });

    it("should rotate all values properly", function () {
        var matA = new me.Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
        var result = "me.Matrix2d(3, 4, 0, -1, -2, 0, 5, 6, 1)";

        matA.rotate(Math.PI * 0.5);

        expect(matA.toString() === result).toEqual(true);
    });

    it("should scale all values properly", function () {
        var matA = new me.Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
        var result = "me.Matrix2d(2, 4, 0, 9, 12, 0, 5, 6, 1)";

        matA.scale(2, 3);

        expect(matA.toString() === result).toEqual(true);
    });

    it("should translate all values properly", function () {
        var matA = new me.Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
        var result = "me.Matrix2d(1, 2, 0, 3, 4, 0, 16, 22, 1)";

        matA.translate(2, 3);

        expect(matA.toString() === result).toEqual(true);
    });
});
