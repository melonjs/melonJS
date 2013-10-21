/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 * @desc Tests the mix functionality which can be used to 'mix in' multiple object properties
 */

(function () {
    'use strict';
    describe('core.mix', function () {
        it('Should be able to mix basic modules', function () {
            var module1 = (function () {
                return {
                    test1: function () {
                        return 'test1';
                    },
                    test2: function () {
                        return 'test2';
                    }
                };
            }());
            var module2 = (function () {
                return {
                    test3: function () {
                        return 'test3';
                    },
                    test4: function () {
                        return 'test4';
                    }
                };
            }());
            var mixin = module1.mix(module2);
            expect(mixin.test1()).toEqual('test1');
            expect(mixin.test2()).toEqual('test2');
            expect(mixin.test3()).toEqual('test3');
            expect(mixin.test4()).toEqual('test4');
        });
        it('Should be able to mix in new abilities', function () {
            var base = (function () {
                return function () {
                    return {
                        base1: function () {
                            return 'base1';
                        },
                        base2: function () {
                            return 'base2';
                        }
                    }
                };
            }());
            var move = (function () {
                return function (obj) {
                    obj.mix({
                        run: function () {
                            return 'running';
                        },
                        walk: function () {
                            return 'walking';
                        }
                    });
                };
            }());
            var mixedEntity = (function (Base, Move) {
                return function (x, y, settings) {
                    var postion = {
                            x: x,
                            y: y
                        },
                        base = Base(),
                        move = base.mix(Move(base)),
                        obj = base.mix({
                            custom1: function () {
                                return 'custom1';
                            },
                            custom2: function () {
                                return 'custom2';
                            },
                            getPosition: function () {
                                return postion;
                            }
                        });
                    return obj;
                };
            }(base, move));

            var entity = mixedEntity(200, 100);

            expect(entity.base1()).toEqual('base1');
            expect(entity.base2()).toEqual('base2');
            expect(entity.run()).toEqual('running');
            expect(entity.walk()).toEqual('walking');
            expect(entity.custom1()).toEqual('custom1');
            expect(entity.custom2()).toEqual('custom2');
            expect(entity.getPosition().x).toEqual(200);
            expect(entity.getPosition().y).toEqual(100);
        });
    });
}());
