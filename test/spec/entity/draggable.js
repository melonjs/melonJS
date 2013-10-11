describe('entity.draggable', function () {
    var square,
        canvas,
        startFrom = {
            x: 70,
            y: 70
        },
        moveTo = {
            x: 700,
            y: 500
        };

    beforeAll(function () {
        // get a reference to the canvas element
        canvas = me.video.getScreenCanvas();
        // create test square entity
        var Square = me.DraggableEntity.extend({
            init: function (x, y, settings) {
                this.parent(x, y, settings);
                this.color = "white";
            },
            update: function () {
                return true;
            },
            draw: function (context) {
                context.fillStyle = this.color;
                context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
            }
        });
        // create a new square entity instance
        square = new Square(10, 10, {width: 100, height: 100});
        // add the test square to the game
        me.game.add(square, 1);
    });

    it('Should be able to drag an entity to a new location', function () {
        // Mouse event parameters:
        // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
        dispatchMouseEvent(canvas, 'mousedown', true, true, window, 1, 0, 0, startFrom.x,
            startFrom.y, null, null, null, null, 0, null);
        dispatchMouseEvent(canvas, 'mousemove', true, true, window, 1, 0, 0, moveTo.x, moveTo.y,
            null, null, null, null, 0, null);
        dispatchMouseEvent(canvas, 'mouseup', true, true, window, 1, 0, 0, moveTo.x, moveTo.y,
            null, null, null, null, 0, null);

        // We need the greater than check because browsers give different end postion results
        // This could be improved/refined, but at least we have a check if dragging works
        expect(square.pos.x).toBeGreaterThan(moveTo.x - square.width * 2);
        expect(square.pos.y).toBeGreaterThan(moveTo.y - square.height * 2);
    });
    afterAll(function () {
        me.game.remove(square);
    });
});
