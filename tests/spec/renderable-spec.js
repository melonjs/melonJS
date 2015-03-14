describe("me.Renderable", function () {
    describe("bounds updates", function () {
        var renderable;
        beforeEach(function () {
            renderable = new me.Renderable(50, 50, 100, 100);
        });

        it("setting x position changes x bounds", function () {
            renderable.pos.x = 10;
            expect(renderable._bounds.pos.x).toEqual(10);
        });

        it("setting y position changes y bounds", function () {
            renderable.pos.y = 120;
            expect(renderable._bounds.pos.y).toEqual(120);
        });

        it("resizing the renderable changes its bounds width", function () {
            renderable.resize(20, 20);
            expect(renderable._bounds.width).toEqual(20);
        });

        it("resizing the renderable changes its bounds height", function () {
            renderable.resize(20, 20);
            expect(renderable._bounds.height).toEqual(20);
        });
    });
});