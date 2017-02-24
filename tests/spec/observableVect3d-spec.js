describe("me.ObservableVector3d", function () {

    var x = 1, y = 2, z = 3;

    var a, b, c, d;

    var _newX, _newY,  _newZ, _oldX, _oldY, _oldZ;

    var callback = function (newX, newY, newZ, oldX, oldY, oldZ) {
        // this will also validate the argument list
        _newX = newX;
        _newY = newY;
        _newZ = newZ;
        _oldX = oldX;
        _oldY = oldY;
        _oldZ = oldZ;
    };

    it("should be initialized to a (0, 0, 0) 3d vector", function () {
        a = new me.ObservableVector3d(0, 0, 0, {
            onUpdate : callback.bind(this)
        });
        b = new me.ObservableVector3d(x, 0, 0, {
            onUpdate : callback.bind(this)
        });
        c = new me.ObservableVector3d(x, y, 0, {
            onUpdate : callback.bind(this)
        });

        d = new me.ObservableVector3d(x, y, z, {
            onUpdate : callback.bind(this)
        });

        expect(a.toString()).toEqual("x:0,y:0,z:0");
    });

    it("setting the vector triggers the callback", function () {
        a.set(10, 100, 20);

        expect(a.x + a.y + a.z).toEqual(_newX + _newY + _newZ);
    });

    it("add a vector triggers the callback", function () {
        a.add(new me.Vector3d(10, 10, 10));

        expect(a.y).toEqual(_oldY + 10);
    });

    it("sub a vector triggers the callback", function () {
        a.sub(new me.Vector3d(10, 10, 10));

        expect(a.x).toEqual(_oldX - 10);
    });

    it("scale a vector triggers the callback", function () {
        a.scaleV(new me.Vector3d(10, 10, 10));

        expect(a.x).toEqual(_oldX * 10);
        expect(a.y).toEqual(_oldY * 10);
        expect(a.z).toEqual(_oldZ * 10);
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
        c.set( 0, 0, 0 );

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

});
