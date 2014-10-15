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
     * @param {me.Matrix2d} an instance of matrix2 to copy from (optional)
     */
    me.Matrix2d = Object.extend(
    /** @scope me.Matrix2d.prototype */    {

        /** @ignore */
        init : function (m) {
            this.val = new Float32Array(6);
            if (m) {
                this.copy(m);
            }
            else {
                this.identity();
            }
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
         * @param {Number} m11
         * @param {Number} m12
         * @param {Number} m21
         * @param {Number} m22
         * @param {Number} dx
         * @param {Number} dy
         * @return {me.Matrix2d} this matrix
         */
        set : function () {
            var a = this.val;
            a[0] = arguments[0];
            a[1] = arguments[1];
            a[2] = arguments[2];
            a[3] = arguments[3];
            a[4] = arguments[4];
            a[5] = arguments[5];
            return this;
        },

        /**
         * multiply both matrix
         * @name multiply
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Matrix2d} otherMat
         * @return {me.Matrix2d} this matrix
         */
        multiply : function (otherMat) {
            var a = this.val, b = otherMat.val;
            var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
            b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];

            a[0] = a0 * b0 + a2 * b1;
            a[1] = a1 * b0 + a3 * b1;
            a[2] = a0 * b2 + a2 * b3;
            a[3] = a1 * b2 + a3 * b3;
            a[4] = a0 * b4 + a2 * b5 + a4;
            a[5] = a1 * b4 + a3 * b5 + a5;
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
            var a = this.val;
            a[0] *= sx;
            a[1] *= sx;
            a[2] *= sy;
            a[3] *= sy;

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
                var a = this.val;
                var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
                    s = Math.sin(angle),
                    c = Math.cos(angle);
                a[0] = a0 * c + a2 * s;
                a[1] = a1 * c + a3 * s;
                a[2] = a0 * -s + a2 * c;
                a[3] = a1 * -s + a3 * c;
            }
            return this;
        },

        /**
         * translate the matrix
         * @name translate
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} x the x coordindates to translate the matrix by
         * @param {Number} y the y coordindates to translate the matrix by
         * @return {me.Matrix2d} this matrix
         */
        translate : function (x, y) {
            var a = this.val;
            /* var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5];
            a[4] = a0 * x + a2 * y + a4;
            a[5] = a1 * x + a3 * y + a5; */

            a[4] += x;
            a[5] += y;

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
            var a = this.a;
            return (a[0] === 1 && a[1] === 0 && a[2] === 0 && a[3] === 1 && a[4] === 0 && a[5] === 0);
        },

        /**
         * Clone the Matrix
         * @name clone
         * @memberOf me.Matrix2d
         * @function
         * @return {me.Matrix2d}
         */
        clone : function () {
            return new me.Matrix2d(this);
        },
        
        /**
         * convert the object to a string representation
         * @name toString
         * @memberOf me.Matrix2d
         * @function
         * @return {String}
         */
        toString : function () {
            var a = this.a;
            return "mat2d(" + a[0] + ", " + a[1] + ", " + a[2] + ", " +
                a[3] + ", " + a[4] + ", " + a[5] + ")";
        }
    });
})();
