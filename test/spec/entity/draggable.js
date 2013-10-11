/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Tests if a draggable entity can be dragged to a different location
 * by simulating mouse events
 */

(function (win) {
    describe('entity.draggable', function () {
        var draggable,
            // creates a test draggable entity
            createDraggable = function (position, dimensions) {
                var Draggable = me.DraggableEntity.extend({
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
                // create a new draggable entity instance
                draggable = new Draggable(position.x, position.y, {width: dimensions.x, height:
                    dimensions.y});
                // add the test draggable entity to the game
                me.game.add(draggable, 1);
            },
            // drags an entity from a start to an end location
            drag = function (startFrom, moveTo) {
                // mouse event parameters:
                // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
                dispatchMouseEvent(canvas, 'mousedown', true, true, win, 1, 0, 0, startFrom.x,
                    startFrom.y, null, null, null, null, 0, null);
                dispatchMouseEvent(canvas, 'mousemove', true, true, win, 1, 0, 0, moveTo.x, moveTo.y,
                    null, null, null, null, 0, null);
                dispatchMouseEvent(canvas, 'mouseup', true, true, win, 1, 0, 0, moveTo.x, moveTo.y,
                    null, null, null, null, 0, null);
            };

        beforeAll(function () {
            // get a reference to the canvas element
            canvas = me.video.getScreenCanvas();
        });

        afterEach(function () {
            if (draggable) {
                me.game.remove(draggable);
            }
        });

        it('Should be able to drag an entity to a new location', function () {
            var startFrom = {x: 70, y: 70},
                moveTo = {x: 700, y: 500};
            // create a draggable
            createDraggable({x: 10, y: 10}, {x: 100, y: 100});
            // drag the draggable entity to a new location
            drag(startFrom, moveTo);

            expect(draggable.pos.x).toEqual(640);
            expect(draggable.pos.y).toEqual(440);
        });
    });
}(window));
