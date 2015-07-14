describe("me.Vector2d", function () {

    var x = 1, y = 2;

    it("should be initialized to a (0, 0) 2d vector", function () {
        var vec = new me.Vector2d();
        var result = "x:0,y:0";
        expect(vec.toString() === result).toEqual(true);
    });

    it("a(1, 2) should be copied into b", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d().copy(a);
        expect(b.equals(a)).toEqual(true);
    });
    
    it("set (1, 2) into a defined vector", function () {
        var vec = new me.Vector2d().set(x, y);
        var result = "x:"+x+",y:"+y;
        expect(vec.toString() === result).toEqual(true);
    });
    
    it("add (1, 2) to (-1, -2)", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        var result = "x:0,y:0";
        expect(a.add(b).toString() === result).toEqual(true);
    });
    
    it("sub (1, 2) to (-1, -2)", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        var result = "x:"+(x-(-x))+",y:"+(y-(-y));
        expect(a.sub(b).toString() === result).toEqual(true);
    });
    
    it("scale (1, 2) by (-1, -2)", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        var result = "x:"+x*(-x)+",y:"+y*(-y);
        expect(a.scaleV(b).toString() === result).toEqual(true);
    });
    
    it("negate (1, 2)", function () {
        var a = new me.Vector2d(x, y);
        var result = "x:"+-x+",y:"+-y;
        expect(a.negateSelf().toString() === result).toEqual(true);
    });
    
    it("dotProduct (1, 2) and (-1, -2)", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        // calculate the dot product
        expect(a.dotProduct(b) === (-x*x-y*y)).toEqual(true);
    });
    
    it("length/lengthSqrt functions", function () {
        var a = new me.Vector2d( x, 0);
        var b = new me.Vector2d( 0, -y);
        var c = new me.Vector2d();

        expect( a.length() === x).toEqual(true);
        expect( a.length2() === x*x).toEqual(true);
        expect( b.length() === y).toEqual(true);
        expect( b.length2() === y*y).toEqual(true);
        expect( c.length() === 0).toEqual(true);
        expect( c.length2() === 0).toEqual(true);

        a.set( x, y);
        expect( a.length() === Math.sqrt( x*x + y*y )).toEqual(true);
        expect( a.length2() === ( x*x + y*y )).toEqual(true);
    });
    
    it("normalize function", function () {
        var a = new me.Vector2d( x, 0 );
        var b = new me.Vector2d( 0, -y );

        a.normalize();
        expect( a.length() === 1).toEqual(true);
        expect( a.x === 1).toEqual(true);

        b.normalize();
        expect( b.length() === 1).toEqual(true);
        expect( b.y === -1).toEqual(true);

    });
    
    it("distance function", function () {
        var a = new me.Vector2d( x, 0);
        var b = new me.Vector2d( 0, -y);
        var c = new me.Vector2d( 0, 0);

        expect( a.distance( c ) === x).toEqual(true);
        expect( b.distance( c ) === y).toEqual(true);
    });
    
    it( "min/max/clamp", function() {
        var a = new me.Vector2d( x, y );
        var b = new me.Vector2d( -x, -y );
        var c = new me.Vector2d();

        c.copy( a ).minV( b );
        expect( c.x === -x).toEqual(true);
        expect( c.y === -y).toEqual(true);

        c.copy( a ).maxV( b );
        expect( c.x === x).toEqual(true);
        expect( c.y === y).toEqual(true);

        c.set( -2*x, 2*x );
        c.clampSelf( -x, x );
        expect( c.x === -x).toEqual(true);
        expect( c.y === x).toEqual(true);
    });
    
    it( "ceil/floor", function() {
        expect( new me.Vector2d( -0.1, 0.1 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);
        expect( new me.Vector2d( -0.5, 0.5 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);
        expect( new me.Vector2d( -0.9, 0.9 ).floorSelf().equals(new me.Vector2d( -1, 0 ))).toEqual(true);

        expect( new me.Vector2d( -0.1, 0.1 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
        expect( new me.Vector2d( -0.5, 0.5 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
        expect( new me.Vector2d( -0.9, 0.9 ).ceilSelf().equals(new me.Vector2d( 0, 1 ))).toEqual(true);
    });
    
    it("project a on b", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        
        // the following only works with (-)1, (-)2style of values
        expect(a.project(b).equals(b)).toEqual(true);
    });
    
    it("angle between a and b", function () {
        var a = new me.Vector2d(x, y);
        var b = new me.Vector2d(-x, -y);
        
        // why is this not perfectly 180 degrees ?
        expect(Math.round(a.angle(b).radToDeg()) === 180).toEqual(true);
        
        b.set(4*x, -y);
        expect(a.angle(b) === Math.PI / 2).toEqual(true);
    });
    
});
