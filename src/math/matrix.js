/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, melonJS Team
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a Matrix2d Object.<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {Number} a the m1,1 (m11) value in the matrix
     * @param {Number} b the m1,2 (m12) value in the matrix
     * @param {Number} c the m2,1 (m21) value in the matrix
     * @param {Number} d the m2,2 (m12) value in the matrix
     * @param {Number} e The delta x (dx) value in the matrix
     * @param {Number} f The delta x (dy) value in the matrix
     */
    me.Matrix2d = Object.extend(
    /** @scope me.Matrix2d.prototype */    {

        /** @ignore */
        init : function (a, b, c, d, e, f) {
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
             * the m2,1 value in the matrix (c)
             * @public
             * @type Number
             * @name c
             * @memberOf me.Matrix2d
             */
            this.c = c || 0;

            /**
             * the m2,2 value in the matrix (d)
             * @public
             * @type Number
             * @name d
             * @memberOf me.Matrix2d
             */
            this.d = d || 1;

            /**
             * The delta x value in the matrix (e)
             * @public
             * @type Number
             * @name e
             * @memberOf me.Matrix2d
             */
            this.e = e || 0;

            /**
             * The delta y value in the matrix (f)
             * @public
             * @type Number
             * @name f
             * @memberOf me.Matrix2d
             */
            this.f = f || 0;
        },

        /**
         * reset the transformation matrix to the identity matrix (no transformation).<br>
         * the identity matrix and parameters position : <br>
         * <img src="images/identity-matrix_2x.png"/>
         * @name identity
         * @memberOf me.Matrix2d
         * @function
         * @return {me.Matrix2d} this matrix
         */
        identity : function () {
            this.set(1, 0, 0, 1, 0, 0);
            return this;
        },

        /**
         * set the matrix to the specified value
         * @name set
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} a the m1,1 (m11) value in the matrix
         * @param {Number} b the m1,2 (m12) value in the matrix
         * @param {Number} c the m2,1 (m21) value in the matrix
         * @param {Number} d the m2,2 (m22) value in the matrix
         * @param {Number} [e] The delta x (dx) value in the matrix
         * @param {Number} [f] The delta y (dy) value in the matrix
         * @return {me.Matrix2d} this matrix
         */
        set : function (a, b, c, d, e, f) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.d = d;
            this.e = typeof(e) !== "undefined" ? e : this.e;
            this.f = typeof(f) !== "undefined" ? f : this.f;
            return this;
        },

        /**
         * multiply both matrix
         * @name multiply
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} a the m1,1 (m11) value in the matrix
         * @param {Number} b the m1,2 (m12) value in the matrix
         * @param {Number} c the m2,1 (m21) value in the matrix
         * @param {Number} d the m2,2 (m22) value in the matrix
         * @param {Number} [e] The delta x (dx) value in the matrix
         * @param {Number} [f] The delta y (dy) value in the matrix
         * @return {me.Matrix2d} this matrix
         */
        multiply : function (a, b, c, d, e, f) {
            var a1 = this.a;
            var b1 = this.b;
            var c1 = this.c;
            var d1 = this.d;

            this.a = a * a1 + b * c1;
            this.b = a * b1 + b * d1;
            this.c = c * a1 + d * c1;
            this.d = c * b1 + d * d1;
            this.e = e * a1 + f * c1 + this.e;
            this.f = e * b1 + f * d1 + this.f;
            return this;
        },

        /**
         * scale the matrix
         * @name scale
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} sx a number representing the abscissa of the scaling vector.
         * @param {Number} sy a number representing the abscissa of the scaling vector.
         * @return {me.Matrix2d} this matrix
         */
        scale : function (sx, sy) {
            this.a *= sx;
            this.d *= sy;

            this.e *= sx;
            this.f *= sy;

            return this;
        },

        /**
         * rotate the matrix
         * @name rotate
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} angle an angle in radians representing the angle of the rotation. A positive angle denotes a clockwise rotation, a negative angle a counter-clockwise one.
         * @return {me.Matrix2d} this matrix
         */
        rotate : function (angle) {
            if (angle !== 0) {
                var cos = Math.cos(angle);
                var sin = Math.sin(angle);
                var a = this.a;
                var b = this.b;
                var c = this.c;
                var d = this.d;
                var e = this.e;
                var f = this.f;
                this.a = a * cos - b * sin;
                this.b = a * sin + b * cos;
                this.c = c * cos - d * sin;
                this.d = c * sin + d * cos;
                this.e = e * cos - f * sin;
                this.f = e * sin + f * cos;
            }
            return this;
        },

        /**
         * translate the matrix
         * @name translate
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Vector2d} x the x coordindates to translate the matrix by
         * @param {me.Vector2d} y the y coordindates to translate the matrix by
         * @return {me.Matrix2d} this matrix
         */
        translate : function (x, y) {
            this.e += x;
            this.f += y;

            return this;
        },

        /**
         * translate the matrix the matrix
         * @name translateV
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Vector2d} v the vector to translate the matrix by
         * @return {me.Matrix2d} this matrix
         */
        translateV : function (v) {
            return this.translate(v.x, v.y);
        },

        /**
         * returns true if the matrix is an identity matrix.
         * @name isIdentity
         * @memberOf me.Matrix2d
         * @function
         * @return {Boolean}
         **/
        isIdentity : function () {
            return (this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0);
        },

        /**
         * Clone the Matrix
         * @name clone
         * @memberOf me.Matrix2d
         * @function
         * @return {me.Matrix2d}
         */
        clone : function () {
            return new me.Matrix2d(this.a, this.b, this.c, this.d, this.e, this.f);
        }
    });
})();
