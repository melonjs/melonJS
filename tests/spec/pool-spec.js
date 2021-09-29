describe("pool", function () {

    // test fail without this
    me.pool.register("Vector2d", me.Vector2d, true);

    describe("push & pull", function () {
        var vec2 = me.pool.pull("Vector2d");

        it("pulled object is of the correct instance", function () {
            expect(vec2).toBeInstanceOf(me.Vector2d);
        });

        it("object is properly recycled when pushed back", function () {
            // modify vec2
            vec2.set(1, 2);
            // add a hidden property
            vec2._recycled = true;
            // push it back to the object pool
            me.pool.push(vec2);
            // pull it again
            vec2 = me.pool.pull("Vector2d");

            // should be the same object
            expect(vec2._recycled).toEqual(true);

            // object should have been reinitialazed
            expect(vec2.toString()).toEqual("x:0,y:0");
        });
    });
});
