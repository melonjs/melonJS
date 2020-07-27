describe("me.Matrix3d", function () {
    it("should be initialized to a 4x4 identity matrix", function () {
        var matA = new me.Matrix3d();
        var result = "me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)";

        expect(matA.toString() === result).toEqual(true);
    });

    it("should be initialized to a 4x4 accordingly to given parameters", function () {
        var matA = new me.Matrix3d(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
        var result = "me.Matrix3d(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)";

        expect(matA.toString() === result).toEqual(true);
    });

    it("should multiply all values properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var matB = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1);
        var result = "me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 7, 9, 1)";

        matA.multiply(matB);

        expect(matA.toString() === result).toEqual(true);
    });

    it("should copy all values properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var matB = new me.Matrix3d();

        matA.copy(matB);

        expect(matA.equals(matB)).toEqual(true);
    });

    it("should reset to an identity matrix", function () {
        var matA = new me.Matrix3d(1, 2, 3, 4, 5, 6, 7, 8, 9);

        matA.identity();

        expect(matA.isIdentity()).toEqual(true);
    });

    it("should rotate all values properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var angle = Math.PI * 0.5
        var axis = new me.Vector3d(1, 0, 0);
        var result = new me.Matrix3d(
            1, 0, 0, 0,
            0, Math.cos(angle), Math.sin(angle), 0,
            0, -Math.sin(angle), Math.cos(angle), 0,
            1, 2, 3, 1
        );

        matA.rotate(angle, axis);

        expect(matA.equals(result)).toEqual(true);
    });

    it("should scale all values properly", function () {
        var matA = new me.Matrix3d().setTransform(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var result = "me.Matrix3d(4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 6, 0, 1, 2, 3, 1)";

        matA.scale(4, 5, 6);

        expect(matA.toString() === result).toEqual(true);
    });

    it("should translate all values properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var result = "me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 4, 6, 1)";

        matA.translate(1, 2, 3);

        expect(matA.toString() === result).toEqual(true);
        expect(matA.tx === 2).toEqual(true);
        expect(matA.ty === 4).toEqual(true);
        expect(matA.tz === 6).toEqual(true);
    });

    it("should transpose the matrix properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var result = "me.Matrix3d(1, 0, 0, 1, 0, 1, 0, 2, 0, 0, 1, 3, 0, 0, 0, 1)";

        matA.transpose();

        expect(matA.toString() === result).toEqual(true);
    });

    it("should invert the matrix properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1);
        var result = "me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, -2, -3, 1)";

        matA.invert();

        expect(matA.toString() === result).toEqual(true);
    });

    it("should multiply a 3d vector properly", function () {
        var matA = new me.Matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        var vecA = new me.Vector3d(1, 2, 3);

        matA.apply(vecA);
        //multiply back with the inverted matrix
        matA.invert().apply(vecA);

        // and we should have back the original vector values
        expect(vecA.toString()).toEqual("x:1,y:2,z:3");
    });

    it("should be clonable", function () {
        var matA = new me.Matrix3d(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
        var matB = matA.clone();

        // and we should have back the original vector values
        expect(matA.equals(matB)).toEqual(true);
    });

    it("should be copiable", function () {
        var matA = new me.Matrix3d(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
        var matB = (new me.Matrix3d).copy(matA);

        // and we should have back the original vector values
        expect(matA.equals(matB)).toEqual(true);
    });

});
