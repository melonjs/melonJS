/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, melonJS Team
 * http://www.melonjs.org
 * sourced from: https://github.com/mattdesl/vecmath. To keep in line with other matrix libraries
 */
(function () {
    me.Matrix3d = Object.extend({
        /** @ignore */
        init : function (m) {
            this.val = new Float32Array(9);
            if (m) { //assume Matrix3 with val
                this.copy(m);
            }
            else { //default to identity
                this.identity();
            }
        },

        /**
         * Adjoint the matrix. Returns self
         * @name adjoint
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} this matrix for chaining
         */
        adjoint : function () {
            var a = this.val,
                a00 = a[0], a01 = a[1], a02 = a[2],
                a10 = a[3], a11 = a[4], a12 = a[5],
                a20 = a[6], a21 = a[7], a22 = a[8];

            a[0] = (a11 * a22 - a12 * a21);
            a[1] = (a02 * a21 - a01 * a22);
            a[2] = (a01 * a12 - a02 * a11);
            a[3] = (a12 * a20 - a10 * a22);
            a[4] = (a00 * a22 - a02 * a20);
            a[5] = (a02 * a10 - a00 * a12);
            a[6] = (a10 * a21 - a11 * a20);
            a[7] = (a01 * a20 - a00 * a21);
            a[8] = (a00 * a11 - a01 * a10);
            return this;
        },
        
        /**
         * returns true if the matrix is an identity matrix.
         * @name isIdentity
         * @memberOf me.Matrix3d
         * @function
         * @return {Boolean}
         **/
        isIdentity : function () {
            var a = this.val;
            return (a[0] === 1 && a[1] === 0 && a[2] === 0 &&
                    a[3] === 0 && a[4] === 1 && a[5] === 0 &&
                    a[6] === 0 && a[7] === 0 && a[8] === 1);
        },
        /**
         * Creates a copy of the current matrix, returning that copy
         * @name clone
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} this matrix for chaining
         */
        clone : function () {
            return new me.Matrix3d(this);
        },

        /**
         * Copies over the values from another me.Matrix3d. Returns self
         * @name copy
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} otherMat - the matrix object to copy from
         * @return {me.Matrix3d} this matrix for chaining
         */
        copy : function (otherMat) {
            var out = this.val, a = otherMat.val;
            out[0] = a[0];
            out[1] = a[1];
            out[2] = a[2];
            out[3] = a[3];
            out[4] = a[4];
            out[5] = a[5];
            out[6] = a[6];
            out[7] = a[7];
            out[8] = a[8];
            return this;
        },

        /**
         * Returns the determinant of the matrix.
         * @name determinant
         * @memberOf me.Matrix3d
         * @function
         * @return {Number}
         */
        determinant : function () {
            var a = this.val,
                a00 = a[0], a01 = a[1], a02 = a[2],
                a10 = a[3], a11 = a[4], a12 = a[5],
                a20 = a[6], a21 = a[7], a22 = a[8];

            return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
        },

        /**
         * Set the matrix to identity
         * @name identity
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} this matrix for chaining
         */
        identity : function () {
            var a = this.val;
            a[0] = 1;
            a[1] = 0;
            a[2] = 0;
            a[3] = 0;
            a[4] = 1;
            a[5] = 0;
            a[6] = 0;
            a[7] = 0;
            a[8] = 1;
            return this;
        },

        /**
         * Inverts the matrix, and returns self
         * @name invert
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} this matrix for chaining
         */
        invert : function () {
            var a = this.val,
                a00 = a[0], a01 = a[1], a02 = a[2],
                a10 = a[3], a11 = a[4], a12 = a[5],
                a20 = a[6], a21 = a[7], a22 = a[8],

                b01 = a22 * a11 - a12 * a21,
                b11 = -a22 * a10 + a12 * a20,
                b21 = a21 * a10 - a11 * a20,

                // Calculate the determinant
                det = a00 * b01 + a01 * b11 + a02 * b21;

            if (!det) {
                return null;
            }
            det = 1.0 / det;

            a[0] = b01 * det;
            a[1] = (-a22 * a01 + a02 * a21) * det;
            a[2] = (a12 * a01 - a02 * a11) * det;
            a[3] = b11 * det;
            a[4] = (a22 * a00 - a02 * a20) * det;
            a[5] = (-a12 * a00 + a02 * a10) * det;
            a[6] = b21 * det;
            a[7] = (-a21 * a00 + a01 * a20) * det;
            a[8] = (a11 * a00 - a01 * a10) * det;
            return this;
        },


        /**
         * Multiplies this current matrix by a given Matrix3d object. Returns self
         * @name multiple
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} otherMat
         * @return {me.Matrix3d} this matrix for chaining
         */
        multiply : function (otherMat) {
            return this.multiplyArray(otherMat.val);
        },

        /**
         * @ignore
         */
        multiplyArray : function (array) {
            var a = this.val,
            b = array,
            a00 = a[0], a01 = a[1], a02 = a[2],
            a10 = a[3], a11 = a[4], a12 = a[5],
            a20 = a[6], a21 = a[7], a22 = a[8],

            b00 = b[0], b01 = b[1], b02 = b[2],
            b10 = b[3], b11 = b[4], b12 = b[5],
            b20 = b[6], b21 = b[7], b22 = b[8];

            a[0] = b00 * a00 + b01 * a10 + b02 * a20;
            a[1] = b00 * a01 + b01 * a11 + b02 * a21;
            a[2] = b00 * a02 + b01 * a12 + b02 * a22;

            a[3] = b10 * a00 + b11 * a10 + b12 * a20;
            a[4] = b10 * a01 + b11 * a11 + b12 * a21;
            a[5] = b10 * a02 + b11 * a12 + b12 * a22;

            a[6] = b20 * a00 + b21 * a10 + b22 * a20;
            a[7] = b20 * a01 + b21 * a11 + b22 * a21;
            a[8] = b20 * a02 + b21 * a12 + b22 * a22;
            return this;
        },

        /**
         * Rotates the matrix by the number in radians (rotate the matrix CCW)
         * @name rotate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} rad - degrees to rotate in radians
         * @return {me.Matrix3d} this matrix for chaining
         */
        rotate : function (rad) {
            var a = this.val,
                a00 = a[0], a01 = a[1], a02 = a[2],
                a10 = a[3], a11 = a[4], a12 = a[5],

                s = Math.sin(rad),
                c = Math.cos(rad);

            a[0] = c * a00 + s * a10;
            a[1] = c * a01 + s * a11;
            a[2] = c * a02 + s * a12;

            a[3] = c * a10 - s * a00;
            a[4] = c * a11 - s * a01;
            a[5] = c * a12 - s * a02;
            return this;
        },

        /**
         * Scales the matrix by x & y values. Returns self
         * @name scale
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x to scale by
         * @param {Number} y to scale by
         * @return {me.Matrix3d} this matrix for chaining
         */
        scale : function (x, y) {
            var a = this.val;

            a[0] = x * a[0];
            a[1] = x * a[1];
            a[2] = x * a[2];

            a[3] = y * a[3];
            a[4] = y * a[4];
            a[5] = y * a[5];
            return this;
        },

        /**
         * Set the matrix to the specified values
         * @name set
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} m10
         * @param {Number} m11
         * @param {Number} m12
         * @param {Number} m20
         * @param {Number} m21
         * @param {Number} m22
         * @param {Number} m30
         * @param {Number} m31
         * @param {Number} m32
         * @return {me.Matrix3d} this matrix for chaining
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
         * Translate the matrix by x & y
         * @name translate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x - the x coordinate to translate by
         * @param {Number} y - the y coordinate to translate by
         * @return {me.Matrix3d} this matrix for chaining
         */
        translate : function (x, y) {
            var a = this.val;
            a[6] = x * a[0] + y * a[3] + a[6];
            a[7] = x * a[1] + y * a[4] + a[7];
            a[8] = x * a[2] + y * a[5] + a[8];
            return this;
        },
        
        /**
         * translate the matrix the matrix
         * @name translateV
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Vector2d} v the vector to translate the matrix by
         * @return {me.Matrix3d} this matrix for chaining
         */
        translateV : function (v) {
            return this.translate(v.x, v.y);
        },

        /**
         * Sets the matrix to the specified values from a Matrix2d
         * Created to support the original canvas method on the webgl renderer
         * @name transform
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} a the m1,1 (m11) value in the matrix
         * @param {Number} b the m1,2 (m12) value in the matrix
         * @param {Number} d the m2,1 (m21) value in the matrix
         * @param {Number} e the m2,2 (m12) value in the matrix
         * @param {Number} c the m1,3
         * @param {Number} f the m2,3
         * @return {me.Matrix3d} this matrix for chaining
         */
        transform : function (a, b, c, d, e, f) {
            var m = this.val;
            m[0] = a;
            m[1] = c;
            m[2] = e;
            m[3] = b;
            m[4] = d;
            m[5] = f;
            m[6] = 0;
            m[7] = 0;
            m[8] = 1;
            return this;
        },

        /**
         * Transpose the matrix. Returns self
         * @name transpose
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} this matrix for chaining
         */
        transpose : function () {
            var a = this.val,
                a01 = a[1],
                a02 = a[2],
                a12 = a[5];
            a[1] = a[3];
            a[2] = a[6];
            a[3] = a01;
            a[5] = a[7];
            a[6] = a02;
            a[7] = a12;
            return this;
        },
        
        /**
         * convert the object to a string representation
         * @name toString
         * @memberOf me.Matrix3d
         * @function
         * @return {String}
         */
        toString : function () {
            var a = this.val;
            return "mat3d(" + a[0] + ", " + a[1] + ", " + a[2] + ", " +
                a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ")";
        }
    });
})();
