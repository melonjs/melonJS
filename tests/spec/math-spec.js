describe("me.Math", function () {
    describe("degToRad", function () {
        it("0 should be 0", function () {
            expect(me.Math.degToRad(0)).toEqual(0);
        });

        it("180 should be Pi", function () {
            expect(me.Math.degToRad(180)).toEqual(Math.PI);
        });

        it("360 should be Pi * 2", function () {
            expect(me.Math.degToRad(360)).toEqual(Math.PI * 2);
        });
    });
});
