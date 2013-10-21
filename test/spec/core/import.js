/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Tests the me.import functionality can be used
 * @note This test should be updated as soon as all Class objects are refactored to modules
 */

(function () {
    'use strict';
    describe('core.import', function () {
        it('Should be able to import modules', function () {
            me.import([
                'DraggableEntity',
                'DroptargetEntity'
            ],
            function (DraggableEntity, DroptargetEntity) {
                expect(DraggableEntity(new me.ObjectEntity(0, 0, {}))).toEqual(jasmine.any(Object));
                expect(DroptargetEntity(new me.ObjectEntity(0, 0, {}))).toEqual(jasmine.any(Object));
            });
        });
        it('Should throw an error when a module can\'t be found', function () {
            expect(function () {
                me.import([
                    'NonExistingModule'
                ],
                function () {});
            }).toThrow('melonJS: Module NonExistingModule not found');
        });
    });
}());
