/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
        init : function () {
            if (typeof(this.val) === "undefined") {
                this.val = new Float32Array(9);
            }
            if (arguments.length && arguments[0] instanceof me.Matrix2d) {
                this.copy(arguments[0]);
            }
            else if (arguments.length >= 6) {
                this.setTransform.apply(this, arguments);
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
            this.setTransform(
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            );
            return this;
        },

        /**
         * set the matrix to the specified value
         * @name setTransform
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} a
         * @param {Number} b
         * @param {Number} c
         * @param {Number} d
         * @param {Number} e
         * @param {Number} f
         * @param {Number} [g=0]
         * @param {Number} [h=0]
         * @param {Number} [i=1]
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        setTransform : function () {
            var a = this.val;

            if (arguments.length === 9) {
                a[0] = arguments[0]; // a - m00
                a[1] = arguments[1]; // b - m10
                a[2] = arguments[2]; // c - m20
                a[3] = arguments[3]; // d - m01
                a[4] = arguments[4]; // e - m11
                a[5] = arguments[5]; // f - m21
                a[6] = arguments[6]; // g - m02
                a[7] = arguments[7]; // h - m12
                a[8] = arguments[8]; // i - m22
            } else if (arguments.length === 6) {
                a[0] = arguments[0]; // a
                a[1] = arguments[2]; // c
                a[2] = arguments[4]; // e
                a[3] = arguments[1]; // b
                a[4] = arguments[3]; // d
                a[5] = arguments[5]; // f
                a[6] = 0; // g
                a[7] = 0; // h
                a[8] = 1; // i
            }

            return this;
        },

        /**
         * Copies over the values from another me.Matrix2d.
         * @name copy
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Matrix2d} m the matrix object to copy from
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
         * Transpose the value of this matrix.
         * @name transpose
         * @memberOf me.Matrix2d
         * @function
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        transpose : function () {
            var tmp, a = this.val;

            tmp = a[1];
            a[1] = a[3];
            a[3] = tmp;
            tmp = a[2];
            a[2] = a[6];
            a[6] = tmp;
            tmp = a[5];
            a[5] = a[7];
            a[7] = tmp;

            return this;
        },

        /**
         * invert this matrix, causing it to apply the opposite transformation.
         * @name invert
         * @memberOf me.Matrix2d
         * @function
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        invert : function () {
            var val = this.val;

            var a = val[ 0 ], b = val[ 1 ], c = val[ 2 ],
                d = val[ 3 ], e = val[ 4 ], f = val[ 5 ],
                g = val[ 6 ], h = val[ 7 ], i = val[ 8 ];

            var ta = i * e - f * h,
                td = f * g - i * d,
                tg = h * d - e * g;

            var n = a * ta + b * td + c * tg;

            val[ 0 ] = ta / n;
            val[ 1 ] = ( c * h - i * b ) / n;
            val[ 2 ] = ( f * b - c * e ) / n;

            val[ 3 ] = td / n;
            val[ 4 ] = ( i * a - c * g ) / n;
            val[ 5 ] = ( c * d - f * a ) / n;

            val[ 6 ] = tg / n;
            val[ 7 ] = ( b * g - h * a ) / n;
            val[ 8 ] = ( e * a - b * d ) / n;

            return this;
        },

       /**
        * Transforms the given vector according to this matrix.
        * @name multiplyVector
        * @memberOf me.Matrix2d
        * @function
        * @param {me.Vector2d} vector the vector object to be transformed
        * @return {me.Vector2d} result vector object. Useful for chaining method calls.
        */
        multiplyVector : function (v) {
            var a = this.val,
                x = v.x,
                y = v.y;

            v.x = x * a[0] + y * a[3] + a[6];
            v.y = x * a[1] + y * a[4] + a[7];

            return v;
        },

        /**
         * Transforms the given vector using the inverted current matrix.
         * @name multiplyVector
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Vector2d} vector the vector object to be transformed
         * @return {me.Vector2d} result vector object. Useful for chaining method calls.
         */
        multiplyVectorInverse : function (v) {
            var a = this.val,
                x = v.x,
                y = v.y;

            var invD = 1 / ((a[0] * a[4]) + (a[3] * -a[1]));

            v.x = (a[4] * invD * x) + (-a[3] * invD * y) + (((a[7] * a[3]) - (a[6] * a[4])) * invD);
            v.y = (a[0] * invD * y) + (-a[1] * invD * x) + (((-a[7] * a[0]) + (a[6] * a[1])) * invD);

            return v;
        },

        /**
         * scale the matrix
         * @name scale
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} x a number representing the abscissa of the scaling vector.
         * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        scale : function (x, y) {
            var a = this.val,
               _x = x,
               _y = typeof(y) === "undefined" ? _x : y;

            a[0] *= _x;
            a[1] *= _x;
            a[3] *= _y;
            a[4] *= _y;

            return this;
        },

        /**
         * adds a 2D scaling transformation.
         * @name scaleV
         * @memberOf me.Matrix2d
         * @function
         * @param {me.Vector2d} vector scaling vector
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this.scale(v.x, v.y);
        },

        /**
         * specifies a 2D scale operation using the [sx, 1] scaling vector
         * @name scaleX
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} x x scaling vector
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        scaleX : function (x) {
            return this.scale(x, 1);
        },

        /**
         * specifies a 2D scale operation using the [1,sy] scaling vector
         * @name scaleY
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} y y scaling vector
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        scaleY : function (y) {
            return this.scale(1, y);
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
         * translate the matrix position on the horizontal and vertical axis
         * @name translate
         * @memberOf me.Matrix2d
         * @function
         * @param {Number} x the x coordindates to translate the matrix by
         * @param {Number} y the y coordindates to translate the matrix by
         * @return {me.Matrix2d} Reference to this object for method chaining
         */
        translate : function (x, y) {
            var a = this.val;

            a[6] += a[0] * x + a[3] * y;
            a[7] += a[1] * x + a[4] * y;

            return this;
        },

        /**
         * translate the matrix by a vector on the horizontal and vertical axis
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
            return me.pool.pull("me.Matrix2d", this);
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
