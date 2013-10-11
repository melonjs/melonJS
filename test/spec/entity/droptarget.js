describe('entity.droptarget', function () {
    var draggable,
        droptarget,
        dropped = false,
        canvas,
        startFrom = {
            x: 70,
            y: 70
        },
        overlapHit = {
            x: 100,
            y: 100
        },
        overlapMiss = {
            x: 500,
            y: 500
        },
        overlapHit = {
            x: 100,
            y: 100
        },
        overlapMiss = {
            x: 500,
            y: 500
        };

    beforeAll(function () {
        // get a reference to the canvas element
        canvas = me.video.getScreenCanvas();
        // create test draggable entity
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
        }),
        Droptarget = me.DroptargetEntity.extend({
            /**
             * constructor
             */
            init: function (x, y, settings) {
                this.parent(x, y, settings);
                this.color = "red";
            },
            enableContains: function() {
                this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
            },
            update: function () {
                return true;
            },
            draw: function (context) {
                context.fillStyle = this.color;
                context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
            },
            drop: function (e) {
                dropped = true;
            }
        });
        // create a new draggable entity instance
        draggable = new Draggable(0, 0, {width: 100, height: 100});
        // create a new draggable entity instance
        droptarget = new Droptarget(100, 100, {width: 200, height: 200});
        // add the test draggable and droptarget to the game
        me.game.add(draggable, 1);
        me.game.add(droptarget, 1);
    });
    afterEach(function () {
        dropped = false;
    });
    describe('checkmethod: overlap', function () {
        it('Should be able to detect a drop of a draggable', function () {
            // Mouse event parameters:
            // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
            // and all the rest of the parameters which are needed to satisfy Firefox
            dispatchMouseEvent(canvas, 'mousedown', true, true, window, 1, 0, 0, startFrom.x,
                startFrom.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mousemove', true, true, window, 1, 0, 0, overlapHit.x,
                overlapHit.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mouseup', true, true, window, 1, 0, 0, overlapHit.x,
                overlapHit.y, null, null, null, null, 0, null);

            expect(dropped).toBeTruthy();
        });
    });
    describe('Checkmethod: overlap', function () {
        it('Should be to detect a drop outside of the check area', function () {
            // Mouse event parameters:
            // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
            // and all the rest of the parameters which are needed to satisfy Firefox
            dispatchMouseEvent(canvas, 'mousedown', true, true, window, 1, 0, 0, startFrom.x,
                startFrom.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mousemove', true, true, window, 1, 0, 0, overlapMiss.x,
                overlapMiss.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mouseup', true, true, window, 1, 0, 0, overlapMiss.x,
                overlapMiss.y, null, null, null, null, 0, null);

            expect(dropped).toBeFalsy();
        });
    });
    describe('checkmethod: contains', function () {
        it('Should be able to detect a drop of a draggable', function () {
            // enable contains check method
            droptarget.enableContains();
            // Mouse event parameters:
            // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
            // and all the rest of the parameters which are needed to satisfy Firefox
            dispatchMouseEvent(canvas, 'mousedown', true, true, window, 1, 0, 0, startFrom.x,
                startFrom.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mousemove', true, true, window, 1, 0, 0, moveTo.x, moveTo.y,
                null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mouseup', true, true, window, 1, 0, 0, moveTo.x, moveTo.y,
                null, null, null, null, 0, null);

            expect(dropped).toBeTruthy();
        });
    });
    describe('Checkmethod: overlap', function () {
        it('Should be to detect a drop outside of the check area', function () {
            // enable contains check method
            droptarget.enableContains();
            // Mouse event parameters:
            // type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY
            // and all the rest of the parameters which are needed to satisfy Firefox
            dispatchMouseEvent(canvas, 'mousedown', true, true, window, 1, 0, 0, startFrom.x,
                startFrom.y, null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mousemove', true, true, window, 1, 0, 0, moveTo2.x, moveTo2.y,
                null, null, null, null, 0, null);
            dispatchMouseEvent(canvas, 'mouseup', true, true, window, 1, 0, 0, moveTo2.x, moveTo2.y,
                null, null, null, null, 0, null);

            expect(dropped).toBeFalsy();
        });
    });
    afterAll(function () {
        me.game.remove(draggable);
        me.game.remove(droptarget);
    });
});
