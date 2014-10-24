describe("me.Matrix3d", function () {
    var mat3d = new me.Matrix3d();


    describe("create", function () {
        var identity = "mat3d(1, 0, 0, 0, 1, 0, 0, 0, 1)";
        it("should be initialized to a 2x3 identity matrix", function () {
            expect(mat3d.toString() === identity).toEqual(true);
        });
    });

    describe("multiply", function () {
        var matA = new me.Matrix3d().set(1, 0, 0, 0, 1, 0, 1, 2, 1);
        var matB = new me.Matrix3d().set(1, 0, 0, 0, 1, 0, 3, 4, 1);
        
        var mulResult = "mat3d(1, 0, 0, 0, 1, 0, 4, 6, 1)";
        
        mat3d.copy(matA.multiply(matB));
        
        it("should multiple all values properly", function () {
            expect(matA.toString() === mulResult).toEqual(true);
        });
    });
    
    describe("isIdentity", function () {
        // reset the matrix
        mat3d.identity();
        it("should be true", function () {
            expect(mat3d.isIdentity()).toEqual(true);
        });
    });

    describe("transform", function () {
        
        
        describe("translate", function () {
            var matA = new me.Matrix3d().set(1, 0, 0, 0, 1, 0, 0, 0, 1);
            var translateResult = "mat3d(1, 0, 0, 0, 1, 0, 2, 4, 1)";
            
            matA.translate(2, 4);
            
            it("should translate all values properly", function () {
                expect(matA.toString() === translateResult).toEqual(true);
            });
        });
 
        describe("scale", function () {
            var matA = new me.Matrix3d().set(1, 0, 0, 0, 1, 0, 2, 4, 1);
            var scaleResult = "mat3d(2, 0, 0, 0, 3, 0, 2, 4, 1)";
            
            matA.scale(2, 3);
            
            it("should scale all values properly", function () {
                expect(matA.toString() === scaleResult).toEqual(true);
            });
        });
 
        describe("rotate", function () {
            var matA = new me.Matrix3d().set(1, 0, 0, 0, 1, 0, 0, 0, 1);
            var rotateResult = "mat3d(0.5403022766113281, 0.8414709568023682, 0, -0.8414709568023682, 0.5403022766113281, 0, 0, 0, 1)";
            
            matA.rotate(1);
           
            it("should rotate all values properly", function () {
                expect(matA.toString() === rotateResult).toEqual(true);
            });
        });
        
    });

});
