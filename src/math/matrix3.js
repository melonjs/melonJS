/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, melonJS Team
 * http://www.melonjs.org
 *
 */
(function () {
    me.Matrix3d = Object.extend({
        /** @ignore */
        init : function (a, b, c, d, e, f, g, h, i) {
            /**
             * the m1,1 value in the matrix (a)
             * @public
             * @type Number
             * @name a
             * @memberOf me.Matrix2d
             */
            this.a = a || 1;
            /**
             * the m1,2 value in the matrix (b)
             * @public
             * @type Number
             * @name b
             * @memberOf me.Matrix2d
             */
            this.b = b || 0;
            /**
             * the m1,3 value in the matrix (c)
             * @public
             * @type Number
             * @name c
             * @memberOf me.Matrix2d
             */
            this.c = c || 0;

            /**
             * the m2,1 value in the matrix (d)
             * @public
             * @type Number
             * @name d
             * @memberOf me.Matrix2d
             */
            this.d = d || 0;
            /**
             * the m2,2 value in the matrix (e)
             * @public
             * @type Number
             * @name e
             * @memberOf me.Matrix2d
             */
            this.e = e || 1;
            /**
             * the m2,3 value in the matrix (f)
             * @public
             * @type Number
             * @name f
             * @memberOf me.Matrix2d
             */
            this.f = f || 0;

            /**
             * the m3,1 value in the matrix (g)
             * @public
             * @type Number
             * @name g
             * @memberOf me.Matrix2d
             */
            this.g = g || 0;
            /**
             * the m3,2 value in the matrix (h)
             * @public
             * @type Number
             * @name h
             * @memberOf me.Matrix2d
             */
            this.h = h || 0;
            /**
             * the m3,3 value in the matrix (i)
             * @public
             * @type Number
             * @name i
             * @memberOf me.Matrix2d
             */
            this.i = i || 1;
        }
    })
})();