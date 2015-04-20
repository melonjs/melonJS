describe("me.ObservableVector2d", function () {
    describe("observable Vector update", function () {
        var vector;
        var _newX, _newY, _oldX, _oldY;
        var callback = function (newX, newY, oldX, oldY) {
            // this will also validate the argument list
            _newX = newX;
            _newY = newY;
            _oldX = oldX;
            _oldY = oldY;
        };
        
        beforeEach(function () {
            vector = new me.ObservableVector2d(50, 100, {
                onUpdate : callback.bind(this)
            });
        });

        it("setting the vector triggers the callback", function () {
            vector.set(10, 100);
            expect(vector.x + vector.y).toEqual(_newX + _newY);
        });

        it("add a vector triggers the callback", function () {
            vector.add(new me.Vector2d(10, 10));
            expect(vector.y).toEqual(_oldY + 10);
        });
        
        it("sub a vector triggers the callback", function () {
            vector.sub(new me.Vector2d(10, 10));
            expect(vector.x).toEqual(_oldX - 10);
        });
    });
});