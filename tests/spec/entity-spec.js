describe("Entity", function () {
    var entity;

    it("can load the image", function (done) {
        me.loader.load({
            "name"  : "rect",
            "type"  : "image",
            "src"   : "tests/data/img/rect.png"
        },
        function () {
            expect(true).toBe(true);
            done();
        },
        function () {
            throw new Error("Failed to load `rect.png`");
        });
    });

    it("can be created", function () {
        entity = new me.Entity(100, 100, {
            "width" : 32,
            "height" : 64,
            "image" : "rect",
            "shapes" : []
        });
        expect(entity).toBeInstanceOf(me.Entity);
    });

    it("has an empty set of shapes", function () {
        expect(entity.body.shapes.length).toEqual(0);
    });

    it("has a first shape", function () {
        expect(entity.body.addShape(new me.Rect(10, 10, 32, 64))).toEqual(1);
    });

    it("has the correct body bounds: A", function () {
        var bounds = entity.body.getBounds();
        expect(bounds.x).toEqual(10);
        expect(bounds.y).toEqual(10);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });

    it("has the correct renderable bounds: A", function () {
        expect(entity.renderable.pos.x).toEqual(0);
        expect(entity.renderable.pos.y).toEqual(0);
        expect(entity.renderable.width).toEqual(32);
        expect(entity.renderable.height).toEqual(64);
    });

    it("has the correct entity bounds: A", function () {
        var bounds = entity.getBounds();
        expect(bounds.x).toEqual(100);
        expect(bounds.y).toEqual(100);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });

    /*
     * XXX: Disabled until #580 is fixed:
     * https://github.com/melonjs/melonJS/issues/580
     */
    xit("has the correct entity geometry: A", function () {
        expect(entity.pos.x).toEqual(100);
        expect(entity.pos.y).toEqual(100);
        expect(entity.width).toEqual(42);
        expect(entity.height).toEqual(74);
    });

    it("has a second shape", function () {
        expect(entity.body.addShape(new me.Rect(-10, -10, 32, 64))).toEqual(2);
    });

    it("has the correct body bounds: B", function () {
        var bounds = entity.body.getBounds();
        expect(bounds.x).toEqual(-10);
        expect(bounds.y).toEqual(-10);
        expect(bounds.width).toEqual(42);
        expect(bounds.height).toEqual(74);
    });

    it("has the correct renderable bounds: B", function () {
        expect(entity.renderable.pos.x).toEqual(0);
        expect(entity.renderable.pos.y).toEqual(0);
        expect(entity.renderable.width).toEqual(32);
        expect(entity.renderable.height).toEqual(64);
    });

    it("has the correct entity bounds: B", function () {
        var bounds = entity.getBounds();
        expect(bounds.x).toEqual(100);
        expect(bounds.y).toEqual(100);
        expect(bounds.width).toEqual(42);
        expect(bounds.height).toEqual(74);
    });

    /*
     * XXX: Disabled until #580 is fixed:
     * https://github.com/melonjs/melonJS/issues/580
     */
    xit("has the correct entity geometry: B", function () {
        expect(entity.pos.x).toEqual(90);
        expect(entity.pos.y).toEqual(90);
        expect(entity.width).toEqual(42);
        expect(entity.height).toEqual(74);
    });

    it("removes the second shape", function () {
        expect(entity.body.removeShapeAt(1)).toEqual(1);
    });

    it("has the correct body bounds: C", function () {
        var bounds = entity.body.getBounds();
        expect(bounds.x).toEqual(10);
        expect(bounds.y).toEqual(10);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });

    it("has the correct renderable bounds: C", function () {
        expect(entity.renderable.pos.x).toEqual(0);
        expect(entity.renderable.pos.y).toEqual(0);
        expect(entity.renderable.width).toEqual(32);
        expect(entity.renderable.height).toEqual(64);
    });

    it("has the correct entity bounds: C", function () {
        var bounds = entity.getBounds();
        expect(bounds.x).toEqual(100);
        expect(bounds.y).toEqual(100);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });

    xit("has the correct entity geometry: C", function () {
        expect(entity.pos.x).toEqual(100);
        expect(entity.pos.y).toEqual(100);
        expect(entity.width).toEqual(42);
        expect(entity.height).toEqual(74);
    });

    it("moves properly", function () {
        entity.pos.set(120, 150, 0);
        expect(entity.pos.x).toEqual(120);
        expect(entity.pos.y).toEqual(150);
    });

    it("has the correct body bounds: D", function () {
        var bounds = entity.body.getBounds();
        expect(bounds.x).toEqual(10);
        expect(bounds.y).toEqual(10);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });

    it("has the correct renderable bounds: D", function () {
        expect(entity.renderable.pos.x).toEqual(0);
        expect(entity.renderable.pos.y).toEqual(0);
        expect(entity.renderable.width).toEqual(32);
        expect(entity.renderable.height).toEqual(64);
    });

    it("has the correct entity bounds: D", function () {
        var bounds = entity.getBounds();
        expect(bounds.x).toEqual(120);
        expect(bounds.y).toEqual(150);
        expect(bounds.width).toEqual(32);
        expect(bounds.height).toEqual(64);
    });
});
