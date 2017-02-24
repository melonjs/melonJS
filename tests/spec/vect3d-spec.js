describe("me.Vector3d", function () {

    var x = 1, y = 2, z = 3;

    var a, b, c, d;

    it("should be initialized to a (0, 0, 0) 3d vector", function () {
        a = new me.Vector3d();
        b = new me.Vector3d();
        c = new me.Vector3d();
        d = new me.Vector3d();

        expect(a.toString()).toEqual("x:0,y:0,z:0");
    });

    it("a(1, 2, 3) should be copied into b", function () {
        a.set(x, y, z);
        b.copy(a);

        expect(b.equals(a)).toEqual(true);
    });

    it("set (1, 2, 3) into a defined vector", function () {
        a.set(x, y, z);

        expect(a.toString()).toEqual("x:"+x+",y:"+y+",z:"+z);
    });

    it("add (1, 2, 3) to (-1, -2, -3)", function () {
        a.set(x, y, z);
        b.set(-x, -y, -z);

        expect(a.add(b).toString()).toEqual("x:0,y:0,z:0");
    });

    it("sub (1, 2, 3) to (-1, -2, -3)", function () {
        a.set(x, y, z);
        b.set(-x, -y, -z);

        expect(a.sub(b).toString()).toEqual("x:"+(x-(-x))+",y:"+(y-(-y))+",z:"+(z-(-z)));
    });

    it("scale (1, 2, 3) by (-1, -2, -3)", function () {
        a.set(x, y, z);
        b.set(-x, -y, -z);

        expect(a.scaleV(b).toString()).toEqual("x:"+x*(-x)+",y:"+y*(-y)+",z:"+z*(-z));

        a.set(x, y, z);

        expect(a.scale(-1).equals(b)).toEqual(true);
    });

    it("negate (1, 2, 3)", function () {
        a.set(x, y, z);

        expect(a.negateSelf().toString()).toEqual("x:"+-x+",y:"+-y+",z:"+-z);
    });

    it("dotProduct (1, 2, 3) and (-1, -2, -3)", function () {
        a.set(x, y, z);
        b.set(-x, -y, -z);

        // calculate the dot product
        expect(a.dotProduct(b)).toEqual(-x*x-y*y-z*z);
    });

    it("length/lengthSqrt functions", function () {
        a.set( x, 0, 0 );
        b.set( 0, -y, 0 );
        c.set( 0, 0, z );
        d.set(0, 0, 0);

        expect( a.length() ).toEqual(x);
        expect( a.length2() ).toEqual(x*x);
        expect( b.length() ).toEqual(y);
        expect( b.length2() ).toEqual(y*y);
        expect( c.length() ).toEqual(z);
        expect( c.length2() ).toEqual(z*z);
        expect( d.length() ).toEqual(0);
        expect( d.length2() ).toEqual(0);

        a.set( x, y, z );

        expect( a.length() ).toEqual(Math.sqrt( x*x + y*y + z*z ));
        expect( a.length2() ).toEqual(( x*x + y*y + z*z ));
    });

    it("normalize function", function () {
        a.set( x, 0, 0 );
        b.set( 0, -y, 0 );
        c.set( 0, 0, z );

        a.normalize();
        expect( a.length()).toEqual(1);
        expect( a.x ).toEqual(1);

        b.normalize();
        expect( b.length() ).toEqual(1);
        expect( b.y ).toEqual(-1);

        c.normalize();
        expect( c.length() ).toEqual(1);
        expect( c.z ).toEqual(1);
    });

    it("distance function", function () {
        a.set( x, 0, 0 );
        b.set( 0, -y, 0 );
        c.set( 0, 0, z );
        d.set(0, 0, 0);

        expect( a.distance( d ) ).toEqual(x);
        expect( b.distance( d ) ).toEqual(y);
        expect( c.distance( d ) ).toEqual(z);
    });

    it( "min/max/clamp", function() {
        a.set( x, y, z );
        b.set( -x, -y, -z );
        c.set(0, 0, 0);

        c.copy( a ).minV( b );
        expect( c.x ).toEqual(-x);
        expect( c.y ).toEqual(-y);
        expect( c.z ).toEqual(-z);

        c.copy( a ).maxV( b );
        expect( c.x ).toEqual(x);
        expect( c.y ).toEqual(y);
        expect( c.z ).toEqual(z);

        c.set( -2*x, 2*x, 2*z );
        c.clampSelf( -x, x );
        expect( c.x ).toEqual(-x);
        expect( c.y ).toEqual(x);
        expect( c.z ).toEqual(x);
    });

    it( "ceil/floor", function() {
        expect( a.set( -0.1, 0.1, 0.3 ).floorSelf().equals(new me.Vector3d( -1, 0, 0 ))).toEqual(true);
        expect( a.set( -0.5, 0.5, 0.6 ).floorSelf().equals(new me.Vector3d( -1, 0, 0 ))).toEqual(true);
        expect( a.set( -0.9, 0.9, 0.8 ).floorSelf().equals(new me.Vector3d( -1, 0, 0 ))).toEqual(true);

        expect( a.set( -0.1, 0.1, 0.3 ).ceilSelf().equals(new me.Vector3d( 0, 1, 1 ))).toEqual(true);
        expect( a.set( -0.5, 0.5, 0.6 ).ceilSelf().equals(new me.Vector3d( 0, 1, 1 ))).toEqual(true);
        expect( a.set( -0.9, 0.9, 0.9 ).ceilSelf().equals(new me.Vector3d( 0, 1, 1 ))).toEqual(true);
    });

    it("project a on b", function () {
        a.set(x, y, z);
        b.set(-x, -y, -z);

        // the following only works with (-)1, (-)2, (-)3 style of values
        expect(a.project(b).equals(b)).toEqual(true);
    });

    it("angle between a and b", function () {

        a.set( 0, -0.18851655680720186, 0.9820700116639124 );
        b.set( 0, 0.18851655680720186, -0.9820700116639124 );

        expect( a.angle( a ) ).toEqual(0);
        expect( a.angle( b ) ).toEqual(Math.PI);

        a.set(x, y, 0);
        b.set(-x, -y, 0);

        // why is this not perfectly 180 degrees ?
        expect(Math.round(a.angle(b).radToDeg()) ).toEqual(180);

        b.set(4*x, -y, 0);
        expect(a.angle(b) ).toEqual(Math.PI / 2);
    });


    it("perp and rotate function", function () {
        a.set(x, y, z);
        b.copy(a).perp();
        // perp rotate the vector by 90 degree clockwise on the z axis
        c.copy(a).rotate(Math.PI/2);

        expect(a.angle(b)).toEqual(a.angle(c));
    });

    it("convert vector to iso coordinates", function () {
        a.set(32, 32, 1);

        a.toIso();
        expect(a.toString()).toEqual("x:0,y:32,z:1");

        a.to2d();
        expect(a.toString()).toEqual("x:32,y:32,z:1");
    });

});
