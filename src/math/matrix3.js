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
        },

        /**
         * Set the matrix to identity
         * @name identity
         * @memberOf me.Matrix3d
         * @function
         */
        identity : function () {
            this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        },


        /**
         * Multiplies this current matrix by a given Matrix3d object.
         * @name multiple
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} mat
         */
        multiply : function (mat) {
            var m11 = this.a, m12 = this.b, m13 = this.c,
            m21 = this.d, m22 = this.e, m23 = this.f,
            m31 = this.g, m32 = this.h, m33 = this.i;

            this.a = m11 * mat.a + m12 * mat.d + m13 * mat.g;
            this.b = m11 * mat.b + m12 * mat.e + m13 * mat.h;
            this.c = m11 * mat.c + m12 * mat.f + m13 * mat.i;

            this.d = m21 * mat.a + m22 * mat.d + m23 * mat.g;
            this.e = m21 * mat.b + m22 * mat.e + m23 * mat.h;
            this.f = m21 * mat.c + m22 * mat.f + m23 * mat.i;

            this.g = m31 * mat.a + m32 * mat.d + m33 * mat.g;
            this.h = m31 * mat.b + m32 * mat.e + m33 * mat.h;
            this.i = m31 * mat.c + m32 * mat.f + m33 * mat.i;
        },

        /**
         * Rotates the matrix by the number in radians
         * @name rotate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} rad - degrees to rotate in radians
         */
        rotate : function (rad) {
            var s = Math.sin(rad),
            c = Math.cos(rad),
            m11 = this.a, m12 = this.b, m13 = this.c,
            m21 = this.d, m22 = this.e, m23 = this.f;

            this.a = c * m11 + s * m21;
            this.b = c * m12 + s * m22;
            this.c = c * m13 + s * m23;

            this.d = c * m21 - s * m11;
            this.e = c * m22 - s * m12;
            this.f = c * m23 - s * m13;
        },

        /**
         * Scales the matrix by x & y values
         * @name scale
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x to scale by
         * @param {Number} y to scale by
         */
        scale : function (x, y) {
            this.a *= x;
            this.b *= x;
            this.c *= x;

            this.d *= y;
            this.e *= y;
            this.f *= y;
        },

        /**
         * Set the matrix to the specified values
         * @name set
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} M1,1
         * @param {Number} M1,2
         * @param {Number} M1,3
         * @param {Number} M2,1
         * @param {Number} M2,2
         * @param {Number} M2,3
         * @param {Number} M3,1
         * @param {Number} M3,2
         * @param {Number} M3,3
         */
        set : function (a, b, c, d, e, f, g, h, i) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.d = d;
            this.e = e;
            this.f = f;
            this.g = g;
            this.h = h;
            this.i = i;
        },

        /**
         * Translate the matrix by x & y
         * @name translate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x - the x coordinate to translate by
         * @param {Number} y - the y coordinate to translate by
         */
        translate : function (x, y) {
            var m11 = this.a, m12 = this.b, m13 = this.c,
            m21 = this.d, m22 = this.e, m23 = this.f,
            m31 = this.g, m32 = this.h, m33 = this.i;

            this.g = x * m11 + y * m21 + m31;
            this.h = x * m12 + y * m22 + m32;
            this.i = x * m13 + y * m23 + m33;
        }
    });
})();