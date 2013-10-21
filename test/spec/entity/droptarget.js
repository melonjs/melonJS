/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Tests if a droptarget entity is able to detect a valid drop
 * of a draggable entity by simulating the system events that would have been triggered by
 * pointer events
 */

(function (Game, BaseEntity, DraggableEntity, DroptargetEntity, Event, Video) {
    'use strict';
    describe('entity.droptarget', function () {
        var canvas,
            draggable,
            droptarget,
            dropped = false,
            // creates a test draggable entity
            createDraggable = function (position, dimensions) {
                var DraggableModule = (function () {
                    return function (x, y, settings) {
                            // construct a new base entity instance
                        var base = new BaseEntity(x, y, settings),
                            // add the draggable ability to the mix
                            draggable = base.mix(DraggableEntity(base)),
                            color = 'white',
                            // mix in some custom methods
                            obj = draggable.mix({
                                draw: function (context) {
                                    context.fillStyle = color;
                                    context.fillRect(
                                        this.pos.x,
                                        this.pos.y,
                                        this.width,
                                        this.height
                                    );
                                },
                                dragStart: function () {
                                    color = 'green';
                                },
                                dragMove: function () {
                                    color = 'red';
                                },
                                dragEnd: function () {
                                    color = 'white';
                                }
                            });
                        // return the square object
                        return obj;
                    }
                }());

                // create a new draggable entity instance
                draggable = DraggableModule(position.x, position.y, {width: dimensions.x, height:
                    dimensions.y});
                // add the test draggable entity to the game
                Game.add(draggable, 1);
            },
            // creates a test droptarget entity
            createDroptarget = function (position, dimensions) {
                var DroptargetModule = (function () {
                    return function (x, y, settings) {
                            // construct a new base entity instance
                        var base = new BaseEntity(x, y, settings),
                            // add the droptarget ability to the mix
                            droptarget = base.mix(DroptargetEntity(base)),
                            // set the initial color to red
                            color = 'red',
                            // set the font we want to use
                            font = new me.Font('Verdana', 15, 'black'),
                            // set the text
                            text = 'Drop on me\n\nAnd I\'ll turn green\n\ncheckmethod: overlap',
                            // mix in some custom methods
                            obj = droptarget.mix({
                                draw: function (context) {
                                    context.fillStyle = color;
                                    context.fillRect(
                                        this.pos.x,
                                        this.pos.y,
                                        this.width,
                                        this.height
                                    );
                                    font.draw(context, text, this.pos.x, this.pos.y);
                                },
                                drop: function (e) {
                                    // set dropped to true
                                    dropped = true;
                                    // indicate a succesful drop, set color to green
                                    color = 'green';
                                    // set the color back to red after a second
                                    window.setTimeout(function () {
                                        color = 'red';
                                    }, 1000);
                                },
                                enableContains: function() {
                                    this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
                                }
                            });

                        // make the font bold
                        font.bold();
                        // return the droptarget entity
                        return obj;
                    }
                }());
                // create a new droptarget entity instance
                droptarget = new DroptargetModule(100, 100, {width: 200, height: 200});
                // add the test droptarget to the game
                Game.add(droptarget, 1);
            },
            // drags an entity from a start to an end location
            drag = function (startFrom, moveTo) {
                // mock user drag events
                Event.publish(Event.DRAGSTART, [{gameX: startFrom.x, gameY: startFrom.y, pointerId: 2}, draggable]);
                Event.publish(Event.MOUSEMOVE, [{gameX: moveTo.x, gameY: moveTo.y, pointerId: 2}, draggable]);
                Event.publish(Event.DRAGEND, [{gameX: moveTo.x, gameY: moveTo.y, pointerId: 2}, draggable]);
            },
            // removes all test entities from the game
            removeEntities = function () {
                // remove entities if they are created
                if (draggable) {
                    Game.remove(draggable);
                }
                if (droptarget) {
                    Game.remove(droptarget);
                }
            };

        beforeAll(function () {
            // get a reference to the canvas element
            canvas = Video.getScreenCanvas();
        });

        afterEach(function () {
            // reset dropped
            dropped = false;
            // remove leftover test entities
            removeEntities();
        });

        describe('checkmethod: contains', function () {
            it('Should be able to detect a valid drop of a draggable', function () {
                var startFrom = {x: 70, y: 70},
                    moveTo = {x: 220, y: 220};
                // create a draggable
                createDraggable({x: 0, y: 0}, {x: 100, y: 100});
                // create a droptarget
                createDroptarget({x: 100, y: 100}, {x: 200, y: 200});
                // enable the contains check method
                droptarget.enableContains();
                // drag the draggable entity to a new location
                drag(startFrom, moveTo);

                expect(dropped).toBeTruthy();
            });
            it('Should not accept a drop outside of the check area', function () {
                var startFrom = {x: 70, y: 70},
                    moveTo = {x: 100, y: 100};
                // create a draggable
                createDraggable({x: 0, y: 0}, {x: 100, y: 100});
                // create a droptarget
                createDroptarget({x: 100, y: 100}, {x: 200, y: 200});
                // enable the contains check method
                droptarget.enableContains();
                // drag the draggable entity to a new location
                drag(startFrom, moveTo);

                expect(dropped).toBeFalsy();
            });
        });

        describe('checkmethod: overlap', function () {
            it('Should be able to detect a valid drop of a draggable', function () {
                var startFrom = {x: 70, y: 70},
                    moveTo = {x: 100, y: 100};
                // create a draggable
                createDraggable({x: 0, y: 0}, {x: 100, y: 100});
                // create a droptarget
                createDroptarget({x: 100, y: 100}, {x: 200, y: 200});
                // drag the draggable entity to a new location
                drag(startFrom, moveTo);

                expect(dropped).toBeTruthy();
            });
            it('Should not accept a drop outside of the check area', function () {
                var startFrom = {x: 70, y: 70},
                    moveTo = {x: 500, y: 500};
                // create a draggable
                createDraggable({x: 0, y: 0}, {x: 100, y: 100});
                // create a droptarget
                createDroptarget({x: 100, y: 100}, {x: 200, y: 200});
                // drag the draggable entity to a new location
                drag(startFrom, moveTo);

                expect(dropped).toBeFalsy();
            });
        });
    });
}(me.game, me.ObjectEntity, me.DraggableEntity, me.DroptargetEntity, me.event, me.video));
