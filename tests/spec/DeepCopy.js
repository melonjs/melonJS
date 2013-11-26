describe("DeepCopy", function () {
    var myVect1 = me.Vector2d.extend({
        a : new me.Vector2d(0.5, 0.5),
        b : [1,2,3],
        c : new me.Vector2d()
    });

    var myVect2 = myVect1.extend({
        a : new me.Vector2d(1.5, 1.5)
    });

    var vec1 = new myVect1(25, 25);
    var vec2 = new myVect2(50, 50);

    describe("vec1", function () {
        it("is an instance of me.Vector2d", function () {
            expect(vec1).toBeInstanceOf(me.Vector2d);
        });

        it("is not an instance of myVect2", function () {
            expect(vec1).not.toBeInstanceOf(myVect2);
        });

        it("has an instance of me.Vector2d", function () {
            expect(vec1.a).toBeInstanceOf(me.Vector2d);
        });

        it("has an instance of Array", function () {
            expect(vec1.b).toBeInstanceOf(Array);
        });

        it("has different object references", function () {
            expect(vec1.a).not.toBe(vec2.a);
            expect(vec1.b).not.toBe(vec2.b);
        });
    });

    describe("vec2", function () {
        it("is an instance of me.Vector2d", function () {
            expect(vec2).toBeInstanceOf(me.Vector2d);
        });

        it("is an instance of myVect1", function () {
            expect(vec2).toBeInstanceOf(myVect1);
        });

        it("has an instance of me.Vector2d", function () {
            expect(vec2.a).toBeInstanceOf(me.Vector2d);
        });

        it("has an instance of Array", function () {
            expect(vec2.b).toBeInstanceOf(Array);
        });

        it("does not effect vec1 when changed", function () {
            vec2.b[0] = 3;
            expect(vec1.b[0]).not.toEqual(vec2.b[0]);

            vec2.c.set(1, 0);
            expect(vec1.c.x).not.toEqual(vec2.c.x);
        });
    });
});
