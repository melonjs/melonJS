describe("me.ObservableVector2d", function () {

    var x = 1, y = 2;

    var a, b, c;

    var _newX, _newY, _oldX, _oldY;

    var callback = function (newX, newY, oldX, oldY) {
        // this will also validate the argument list
        _newX = newX;
        _newY = newY;
        _oldX = oldX;
        _oldY = oldY;
    };

    it("should be initialized to a (0, 0) 2d vector", function () {
        a = new me.ObservableVector2d(0, 0, {
            onUpdate : callback.bind(this)
        });
        b = new me.ObservableVector2d(0, 0, {
            onUpdate : callback.bind(this)
        });
        c = new me.ObservableVector2d(0, 0, {
            onUpdate : callback.bind(this)
        });

        expect(a.toString()).toEqual("x:0,y:0");
    });

    it("setting the vector triggers the callback", function () {
        a.set(10, 100);
        expect(a.x + a.y).toEqual(_newX + _newY);
    });

    it("add a vector triggers the callback", function () {
        a.add(new me.Vector2d(10, 10));
        expect(a.y).toEqual(_oldY + 10);
    });

    it("sub a vector triggers the callback", function () {
        a.sub(new me.Vector2d(10, 10));
        expect(a.x).toEqual(_oldX - 10);
    });

    it("a(1, 2) should be copied into b", function () {
        a.set(x, y);
        b.copy(a);

        expect(b.equals(a)).toEqual(true);
    });


    it("scale (1, 2) by (-1, -2)", function () {
        a.set(x, y);
        b.set(-x, -y);

        expect(a.scaleV(b).toString()).toEqual("x:"+x*(-x)+",y:"+y*(-y));
    });

    it("negate (1, 2)", function () {
        a.set(x, y);

        expect(a.negateSelf().toString()).toEqual("x:"+-x+",y:"+-y);
    });

    it("dotProduct (1, 2) and (-1, -2)", function () {
        a.set(x, y);
        b.set(-x, -y);

        // calculate the dot product
        expect(a.dotProduct(b)).toEqual((-x*x-y*y));
    });

    it("length/lengthSqrt functions", function () {
        a.set( x, 0);
        b.set( 0, -y);
        c.set( 0, 0);

        expect( a.length() ).toEqual(x);
        expect( a.length2() ).toEqual(x*x);
        expect( b.length() ).toEqual(y);
        expect( b.length2() ).toEqual(y*y);
        expect( c.length() ).toEqual(0);
        expect( c.length2() ).toEqual(0);

        a.set( x, y );
        expect( a.length() ).toEqual(Math.sqrt( x*x + y*y ));
        expect( a.length2() ).toEqual(( x*x + y*y ));
    });

    it("normalize function", function () {
        a.set( x, 0 );
        b.set( 0, -y );

        a.normalize();
        expect( a.length()).toEqual(1);
        expect( a.x ).toEqual(1);

        b.normalize();
        expect( b.length() ).toEqual(1);
        expect( b.y ).toEqual(-1);

    });

    it("distance function", function () {
        a.set( x, 0);
        b.set( 0, -y);
        c.set( 0, 0);

        expect( a.distance( c ) ).toEqual(x);
        expect( b.distance( c ) ).toEqual(y);
    });

    it( "min/max/clamp", function() {
        a.set( x, y );
        b.set( -x, -y );
        c.set( 0, 0);

        c.copy( a ).minV( b );
        expect( c.x ).toEqual(-x);
        expect( c.y ).toEqual(-y);

        c.copy( a ).maxV( b );
        expect( c.x ).toEqual(x);
        expect( c.y ).toEqual(y);

        c.set( -2*x, 2*x );
        c.clampSelf( -x, x );
        expect( c.x ).toEqual(-x);
        expect( c.y ).toEqual(x);
    });

    it( "ceil/floor", function() {
        expect(a.setMuted( -0.1, 0.1 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);
        expect(b.setMuted( -0.5, 0.5 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);
        expect(c.setMuted( -0.9, 0.9 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);

        expect(a.setMuted( -0.1, 0.1 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
        expect(b.setMuted( -0.5, 0.5 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
        expect(c.setMuted( -0.9, 0.9 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
    });

    it("project a on b", function () {
        a.set(x, y);
        b.set(-x, -y);

        // the following only works with (-)1, (-)2style of values
        expect(a.project(b).equals(b)).toEqual(true);
    });

    it("angle between a and b", function () {
        a.set(x, y);
        b.set(-x, -y);

        // why is this not perfectly 180 degrees ?
        expect(Math.round(a.angle(b).radToDeg()) ).toEqual(180);

        b.set(4*x, -y);
        expect(a.angle(b) ).toEqual(Math.PI / 2);
    });

    it("perp and rotate function", function () {
        a.set(x, y);
        b.copy(a).perp();
        // perp rotate the vector by 90 degree clockwise on the z axis
        c.copy(a).rotate(Math.PI/2);

        expect(a.angle(b)).toEqual(a.angle(c));
    });

});
