describe("me.Matrix2d", function () {
    var mat2d = new me.Matrix2d();


    describe("create", function () {
        var identity = "mat2d(1, 0, 0, 1, 0, 0)";
        it("should be initialized to a 2x3 identity matrix", function () {
            expect(mat2d.toString() === identity).toEqual(true);
        });
    });

    describe("multiply", function () {
        var matA = new me.Matrix2d().set(1, 2, 3, 4, 5, 6);
        var matB = new me.Matrix2d().set(7, 8, 9, 10, 11, 12);
        
        var mulResult = "mat2d(31, 46, 39, 58, 52, 76)";
        
        matA.multiply(matB);
        
        it("should multiple all values properly", function () {
            expect(matA.toString() === mulResult).toEqual(true);
        });
    });
    
    describe("isIdentity", function () {
        // reset the matrix
        mat2d.identity();
        it("should be true", function () {
            expect(mat2d.isIdentity()).toEqual(true);
        });
    });
    
    describe("rotate", function () {
        var matA = new me.Matrix2d().set(1, 2, 3, 4, 5, 6);
        var rotateResult = "mat2d(3, 4, -1, -2, 5, 6)";
        
        matA.rotate(Math.PI * 0.5);
        
        it("should rotate all values properly", function () {
            expect(matA.toString() === rotateResult).toEqual(true);
        });
    });
    
    describe("scale", function () {
        var matA = new me.Matrix2d().set(1, 2, 3, 4, 5, 6);
        var scaleResult = "mat2d(2, 4, 9, 12, 5, 6)";
        
        matA.scale(2, 3);
        
        it("should scale all values properly", function () {
            expect(matA.toString() === scaleResult).toEqual(true);
        });
    });

    
    describe("translate", function () {
        var matA = new me.Matrix2d().set(1, 2, 3, 4, 5, 6);
        var transResult = "mat2d(1, 2, 3, 4, 7, 9)";
        
        // is this CORRECT ??
        matA.translate(2, 3);
        
        it("should translate all values properly", function () {
            expect(matA.toString() === transResult).toEqual(true);
        });
    });

});
