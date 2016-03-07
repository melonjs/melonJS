/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a Matrix2d Object.<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {me.Matrix2d} [mat2d] An instance of me.Matrix2d to copy from
     * @param {Number[]} [arguments...] Matrix elements. See {@link me.Matrix2d.set}
     */
    me.Matrix2d = me.Object.extend(
    /** @scope me.Matrix2d.prototype */    {

        /** @ignore */
        init : function (a, b, c, d, e, f, g, h, i) {
            this.val = new Float32Array(9);
            if (a instanceof me.Matrix2d) {
                this.copy(a);
            }
            else if (arguments.length === 9) {
                this.set(a, b, c, d, e, f, g, h, i);
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
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        identity : function () {
            this.set(
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            );

            return this;
        },

        /**
         * set the matrix to the specified value
         * @name set
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} aX
         * @param {Number} aY
         * @param {Number} aW
         * @param {Number} bX
         * @param {Number} bY
         * @param {Number} bW
         * @param {Number} cX
         * @param {Number} cY
         * @param {Number} cW
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        set : function () {
            var a = this.val;

            a[0] = arguments[0];
            a[1] = arguments[1];
            a[2] = arguments[2];
            a[3] = arguments[3];
            a[4] = arguments[4];
            a[5] = arguments[5];
            a[6] = arguments[6];
            a[7] = arguments[7];
            a[8] = arguments[8];

            return this;
        },

        /**
         * Copies over the values from another me.Matrix2d.
         * @name copy
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Matrix2d} b the matrix object to copy from
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        copy : function (b) {
            this.val.set(b.val);
            return this;
        },

        /**
         * multiply both matrix
         * @name multiply
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Matrix2d} b Other matrix
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        multiply : function (b) {
            b = b.val;
            var a = this.val,
                a0 = a[0],
                a1 = a[1],
                a3 = a[3],
                a4 = a[4],
                b0 = b[0],
                b1 = b[1],
                b3 = b[3],
                b4 = b[4],
                b6 = b[6],
                b7 = b[7];

            a[0] = a0 * b0 + a3 * b1;
            a[1] = a1 * b0 + a4 * b1;
            a[3] = a0 * b3 + a3 * b4;
            a[4] = a1 * b3 + a4 * b4;
            a[6] += a0 * b6 + a3 * b7;
            a[7] += a1 * b6 + a4 * b7;

            return this;
        },

        /**
         * Multiply this matrix into a vector
         * @ignore
         */
        vectorMultiply : function (v) {
            var a = this.val,
                x = v.x,
                y = v.y;

            v.x = x * a[0] + y * a[3] + a[6];
            v.y = x * a[1] + y * a[4] + a[7];

            return v;
        },

        /**
         * scale the matrix
         * @name scale
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} x a number representing the abscissa of the scaling vector.
         * @param {Number} y a number representing the ordinate of the scaling vector.
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        scale : function (x, y) {
            var a = this.val;

            a[0] *= x;
            a[1] *= x;
            a[3] *= y;
            a[4] *= y;

            return this;
        },

        /**
         * rotate the matrix (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} angle Rotation angle in radians.
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        rotate : function (angle) {
            if (angle !== 0) {
                var a = this.val,
                    a0 = a[0],
                    a1 = a[1],
                    a3 = a[3],
                    a4 = a[4],
                    s = Math.sin(angle),
                    c = Math.cos(angle);

                a[0] = a0 * c + a3 * s;
                a[1] = a1 * c + a4 * s;
                a[3] = a0 * -s + a3 * c;
                a[4] = a1 * -s + a4 * c;
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
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        translate : function (x, y) {
            var a = this.val;

            a[6] += x * a[0] + y * a[3];
            a[7] += x * a[1] + y * a[4];

            return this;
        },

        /**
         * translate the matrix by a vector
         * @name translateV
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Vector2d} v the vector to translate the matrix by
         * @return {me.Matrix2d} Reference to this object for method chaining
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
            var a = this.val;

            return (
                a[0] === 1 &&
                a[1] === 0 &&
                a[2] === 0 &&
                a[3] === 0 &&
                a[4] === 1 &&
                a[5] === 0 &&
                a[6] === 0 &&
                a[7] === 0 &&
                a[8] === 1
            );
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
            var a = this.val;

            return "me.Matrix2d(" +
                a[0] + ", " + a[1] + ", " + a[2] + ", " +
                a[3] + ", " + a[4] + ", " + a[5] + ", " +
                a[6] + ", " + a[7] + ", " + a[8] +
            ")";
        }
    });
})();
