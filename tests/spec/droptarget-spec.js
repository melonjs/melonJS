/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier BIOT
 * http://www.melonjs.org
 * @desc Tests if a droptarget entity is able to detect a valid drop
 * of a draggable entity by simulating the system events that would have been triggered by
 * pointer events
 */

/* eslint-disable no-unused-vars, object-property-newline */

(function (DraggableEntity, DroptargetEntity, Event, Video) {
    "use strict";
    describe("entity.droptarget", function () {
        var canvas,
            draggable,
            droptarget,
            dropped = false,
            // creates a test draggable entity
            createDraggable = function (position, dimensions) {
                var Draggable = DraggableEntity.extend({
                    init: function (x, y, settings) {
                        this._super(DraggableEntity, "init", [x, y, settings]);
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
                me.game.world.addChild(draggable, 1);
            },
            // creates a test droptarget entity
            createDroptarget = function () {
                var Droptarget = DroptargetEntity.extend({
                    init: function (x, y, settings) {
                        this._super(me.DroptargetEntity, "init", [x, y, settings]);
                        this.color = "red";
                    },
                    enableContains: function () {
                        this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
                    },
                    update: function () {
                        return true;
                    },
                    draw: function (context) {
                        context.fillStyle = this.color;
                        context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
                    },
                    drop: function () {
                        dropped = true;
                    }
                });
                // create a new droptarget entity instance
                droptarget = new Droptarget(100, 100, {width: 200, height: 200});
                // add the test droptarget to the game
                me.game.world.addChild(droptarget, 1);
            },
            // drags an entity from a start to an end location
            drag = function (startFrom, moveTo) {
                // mock user drag events
                Event.publish(Event.DRAGSTART, [{gameX: startFrom.x, gameY: startFrom.y, pointerId: 2}, draggable]);
                Event.publish(Event.POINTERMOVE, [{gameX: moveTo.x, gameY: moveTo.y, pointerId: 2}, draggable]);
                Event.publish(Event.DRAGEND, [{gameX: moveTo.x, gameY: moveTo.y, pointerId: 2}, draggable]);
            },
            // removes all test entities from the game
            removeEntities = function () {
                // remove entities if they are created
                if (draggable) {
                    me.game.world.removeChild(draggable);
                }
                if (droptarget) {
                    me.game.world.removeChild(droptarget);
                }
            };

        beforeEach(function () {
            // get a reference to the canvas element
            canvas = Video.renderer.getScreenCanvas();
        });

        afterEach(function () {
            // reset dropped
            dropped = false;
            // remove leftover test entities
            removeEntities();
        });

        describe("checkmethod: contains", function () {
            it("Should be able to detect a valid drop of a draggable", function () {
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
            it("Should not accept a drop outside of the check area", function () {
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

        describe("checkmethod: overlap", function () {
            it("Should be able to detect a valid drop of a draggable", function () {
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
            it("Should not accept a drop outside of the check area", function () {
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
}(me.DraggableEntity, me.DroptargetEntity, me.event, me.video));
/* eslint-enable no-unused-vars, object-property-newline */
