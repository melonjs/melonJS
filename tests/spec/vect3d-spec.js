describe("me.Vector3d", function () {

    var x = 1, y = 2, z = 3;

    it("should be initialized to a (0, 0, 0) 3d vector", function () {
        var vec = new me.Vector3d();
        var result = "x:0,y:0,z:0";
        expect(vec.toString() === result).toEqual(true);
    });

    it("a(1, 2, 3) should be copied into b", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d().copy(a);
        expect(b.equals(a)).toEqual(true);
    });
    
    it("set (1, 2, 3) into a defined vector", function () {
        var vec = new me.Vector3d().set(x, y, z);
        var result = "x:"+x+",y:"+y+",z:"+z;
        expect(vec.toString() === result).toEqual(true);
    });
    
    it("add (1, 2, 3) to (-1, -2, -3)", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);
        var result = "x:0,y:0,z:0";
        expect(a.add(b).toString() === result).toEqual(true);
    });
    
    it("sub (1, 2, 3) to (-1, -2, -3)", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);
        var result = "x:"+(x-(-x))+",y:"+(y-(-y))+",z:"+(z-(-z));
        expect(a.sub(b).toString() === result).toEqual(true);
    });
    
    it("scale (1, 2, 3) by (-1, -2, -3)", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);
        var result = "x:"+x*(-x)+",y:"+y*(-y)+",z:"+z*(-z);
        expect(a.scaleV(b).toString() === result).toEqual(true);

        a.set(x, y, z);
        expect(a.scale(-1).equals(b)).toEqual(true);
    });
    
    it("negate (1, 2, 3)", function () {
        var a = new me.Vector3d(x, y, z);
        var result = "x:"+-x+",y:"+-y+",z:"+-z;
        expect(a.negateSelf().toString() === result).toEqual(true);
    });
    
    it("dotProduct (1, 2, 3) and (-1, -2, -3)", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);
        // calculate the dot product
        expect(a.dotProduct(b) === (-x*x-y*y-z*z)).toEqual(true);
    });
    
    it("length/lengthSqrt functions", function () {
        var a = new me.Vector3d( x, 0, 0 );
        var b = new me.Vector3d( 0, -y, 0 );
        var c = new me.Vector3d( 0, 0, z );
        var d = new me.Vector3d();

        expect( a.length() === x).toEqual(true);
        expect( a.length2() === x*x).toEqual(true);
        expect( b.length() === y).toEqual(true);
        expect( b.length2() === y*y).toEqual(true);
        expect( c.length() === z).toEqual(true);
        expect( c.length2() === z*z).toEqual(true);
        expect( d.length() === 0).toEqual(true);
        expect( d.length2() === 0).toEqual(true);

        a.set( x, y, z );
        expect( a.length() === Math.sqrt( x*x + y*y + z*z )).toEqual(true);
        expect( a.length2() === ( x*x + y*y + z*z )).toEqual(true);
    });
    
    it("normalize function", function () {
        var a = new me.Vector3d( x, 0, 0 );
        var b = new me.Vector3d( 0, -y, 0 );
        var c = new me.Vector3d( 0, 0, z );

        a.normalize();
        expect( a.length() === 1).toEqual(true);
        expect( a.x === 1).toEqual(true);

        b.normalize();
        expect( b.length() === 1).toEqual(true);
        expect( b.y === -1).toEqual(true);

        c.normalize();
        expect( c.length() === 1).toEqual(true);
        expect( c.z === 1).toEqual(true);
    });
    
    it("distance function", function () {
        var a = new me.Vector3d( x, 0, 0 );
        var b = new me.Vector3d( 0, -y, 0 );
        var c = new me.Vector3d( 0, 0, z );
        var d = new me.Vector3d();

        expect( a.distance( d ) === x).toEqual(true);
        expect( b.distance( d ) === y).toEqual(true);
        expect( c.distance( d ) === z).toEqual(true);
    });

    it("angle between a and b is 180deg", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);

        expect(a.angle(b) === Math.PI).toEqual(true);
    });

    it("project a on b", function () {
        var a = new me.Vector3d(x, y, z);
        var b = new me.Vector3d(-x, -y, -z);
        
        // the following only works with (-)1, (-)2, (-)3 style of values
        expect(a.project(b).equals(b)).toEqual(true);
    });
        
});
