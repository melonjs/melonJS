(function () {
    /**
     * a 4x4 Matrix3d Object<br>
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {me.Matrix3d} [mat3d] An instance of me.Matrix3d to copy from
     * @param {Number[]} [arguments...] Matrix elements. See {@link me.Matrix3d.setTransform}
     */
    me.Matrix3d = me.Object.extend({
        /**
         * @ignore
         */
        init : function () {
            if (typeof this.val === "undefined") {
                this.val = new Float32Array(16);
            }

            if (arguments.length && arguments[0] instanceof me.Matrix3d) {
                this.copy(arguments[0]);
            }
            else if (arguments.length === 16) {
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
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        identity : function () {
            return this.setTransform(
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            );
        },

        /**
         * set the matrix to the specified value
         * @name setTransform
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} m00
         * @param {Number} m01
         * @param {Number} m02
         * @param {Number} m03
         * @param {Number} m10
         * @param {Number} m11
         * @param {Number} m12
         * @param {Number} m13
         * @param {Number} m20
         * @param {Number} m21
         * @param {Number} m22
         * @param {Number} m23
         * @param {Number} m30
         * @param {Number} m31
         * @param {Number} m32
         * @param {Number} m33
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        setTransform : function (m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
            var a = this.val;

            a[0] = m00;
            a[1] = m01;
            a[2] = m02;
            a[3] = m03;
            a[4] = m10;
            a[5] = m11;
            a[6] = m12;
            a[7] = m13;
            a[8] = m20;
            a[9] = m21;
            a[10] = m22;
            a[11] = m23;
            a[12] = m30;
            a[13] = m31;
            a[14] = m32;
            a[15] = m33;

            return this;
        },

        /**
         * Copies over the values from another me.Matrix3d.
         * @name copy
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} m the matrix object to copy from
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        copy : function (b) {
            this.val.set(b.val);
            return this;
        },

        /**
         * multiply both matrix
         * @name multiply
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} b Other matrix
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        multiply : function (b) {
            var a = this.val;

            var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

            b = b.val;
            var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];

            a[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            a[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            a[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            a[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[4];
            b1 = b[5];
            b2 = b[6];
            b3 = b[7];

            a[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            a[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            a[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            a[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[8];
            b1 = b[9];
            b2 = b[10];
            b3 = b[11];

            a[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            a[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            a[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            a[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[12];
            b1 = b[13];
            b2 = b[14];
            b3 = b[15];

            a[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            a[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            a[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            a[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            return this;
        },

        /**
         * Transpose the value of this matrix.
         * @name transpose
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        transpose : function () {
            var a = this.val,
                a01 = a[1],
                a02 = a[2],
                a03 = a[3],
                a12 = a[6],
                a13 = a[7],
                a23 = a[11];

             a[1] = a[4];
             a[2] = a[8];
             a[3] = a[12];
             a[4] = a01;
             a[6] = a[9];
             a[7] = a[13];
             a[8] = a02;
             a[9] = a12;
             a[11] = a[14];
             a[12] = a03;
             a[13] = a13;
             a[14] = a23;

             return this;
        },

        /**
         * invert this matrix, causing it to apply the opposite transformation.
         * @name invert
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        invert : function () {
             var a = this.val;

             var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
             var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
             var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
             var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

             var b00 = a00 * a11 - a01 * a10;
             var b01 = a00 * a12 - a02 * a10;
             var b02 = a00 * a13 - a03 * a10;
             var b03 = a01 * a12 - a02 * a11;

             var b04 = a01 * a13 - a03 * a11;
             var b05 = a02 * a13 - a03 * a12;
             var b06 = a20 * a31 - a21 * a30;
             var b07 = a20 * a32 - a22 * a30;

             var b08 = a20 * a33 - a23 * a30;
             var b09 = a21 * a32 - a22 * a31;
             var b10 = a21 * a33 - a23 * a31;
             var b11 = a22 * a33 - a23 * a32;

             // Calculate the determinant
             var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

             if (!det)
             {
                 return null;
             }

             det = 1 / det;

             a[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
             a[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
             a[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
             a[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
             a[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
             a[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
             a[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
             a[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
             a[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
             a[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
             a[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
             a[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
             a[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
             a[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
             a[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
             a[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

             return this;
        },

        /**
         * apply the current transform to the given 3d vector
         * @name apply
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Vector3d} vector the vector object to be transformed
         * @return {me.Vector3d} result vector object.
         */
         apply : function (v) {
            var a = this.val,
            x = v.x,
            y = v.y,
            z = v.z;

            var w = (a[3] * x + a[7] * y + a[11] * z + a[15]) || 1.0;

            v.x = (a[0] * x + a[4] * y + a[8] * z + a[12]) / w;
            v.y = (a[1] * x + a[5] * y + a[9] * z + a[13]) / w;
            v.z = (a[2] * x + a[6] * y + a[10] * z + a[14]) / w;

            return v;
         },

         /**
          * apply the inverted current transform to the given 3d vector
          * @name applyInverse
          * @memberOf me.Matrix3d
          * @function
          * @param {me.Vector3d} vector the vector object to be transformed
          * @return {me.Vector3d} result vector object.
          */
         applyInverse : function (v) {
             // XXX : TODO
             return v;
         },

        /**
         * generate an orthogonal projection matrix, with the result replacing the current matrix
         * <img src="images/glOrtho.gif"/><br>
         * @name ortho
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} left farthest left on the x-axis
         * @param {Number} right farthest right on the x-axis
         * @param {Number} bottom farthest down on the y-axis
         * @param {Number} top farthest up on the y-axis
         * @param {Number} near distance to the near clipping plane along the -Z axis
         * @param {Number} far distance to the far clipping plane along the -Z axis
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        ortho : function (left, right, bottom, top, near, far) {
            var a = this.val;
            var leftRight = 1.0 / (left - right);
            var bottomTop = 1.0 / (bottom - top);
            var nearFar = 1.0 / (near - far);

            a[0] = -2.0 * leftRight;
            a[1] = 0.0;
            a[2] = 0.0;
            a[3] = 0.0;
            a[4] = 0.0;
            a[5] = -2.0 * bottomTop;
            a[6] = 0.0;
            a[7] = 0.0;
            a[8] = 0.0;
            a[9] = 0.0;
            a[10] = 2.0 * nearFar;
            a[11] = 0.0;
            a[12] = (left + right) * leftRight;
            a[13] = (top + bottom) * bottomTop;
            a[14] = (far + near) * nearFar;
            a[15] = 1.0;

            return this;
        },

        /**
         * scale the matrix
         * @name scale
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x a number representing the abscissa of the scaling vector.
         * @param {Number} [y=x] a number representing the ordinate of the scaling vector.
         * @param {Number} [z=0] a number representing the depth vector
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        scale : function (x, y, z) {
            var a = this.val,
               _x = x,
               _y = typeof(y) === "undefined" ? _x : y,
               _z = typeof(z) === "undefined" ?  0 : z;

            a[0] = a[0] * _x;
            a[1] = a[1] * _x;
            a[2] = a[2] * _x;
            a[3] = a[3] * _x;

            a[4] = a[4] * _y;
            a[5] = a[5] * _y;
            a[6] = a[6] * _y;
            a[7] = a[7] * _y;

            a[8] = a[8] * _z;
            a[9] = a[9] * _z;
            a[10] = a[10] * _z;
            a[11] = a[11] * _z;

            return this;
        },

        /**
         * adds a 2D scaling transformation.
         * @name scaleV
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Vector2d|me.Vector3d} vector scaling vector
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this.scale(v.x, v.y, v.z);
        },

        /**
         * specifies a 2D scale operation using the [sx, 1] scaling vector
         * @name scaleX
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x x scaling vector
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        scaleX : function (x) {
            return this.scale(x, 1);
        },

        /**
         * specifies a 2D scale operation using the [1,sy] scaling vector
         * @name scaleY
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} y y scaling vector
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        scaleY : function (y) {
            return this.scale(1, y);
        },

        /**
         * rotate this matrix (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} angle Rotation angle in radians.
         * @param {me.Vector3d} axis the axis to rotate around
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        rotate : function (angle, v) {
            var a = this.val,
                x = v.x,
                y = v.y,
                z = v.z;

            var len = Math.sqrt(x * x + y * y + z * z);

            var s, c, t;
            var a00, a01, a02, a03;
            var a10, a11, a12, a13;
            var a20, a21, a22, a23;
            var b00, b01, b02;
            var b10, b11, b12;
            var b20, b21, b22;

            if (len < me.Math.EPSILON) {
                return null;
            }

            len = 1 / len;
            x *= len;
            y *= len;
            z *= len;

            s = Math.sin(angle);
            c = Math.cos(angle);
            t = 1 - c;

            a00 = a[0];
            a01 = a[1];
            a02 = a[2];
            a03 = a[3];
            a10 = a[4];
            a11 = a[5];
            a12 = a[6];
            a13 = a[7];
            a20 = a[8];
            a21 = a[9];
            a22 = a[10];
            a23 = a[11];

            // Construct the elements of the rotation matrix
            b00 = x * x * t + c;
            b01 = y * x * t + z * s;
            b02 = z * x * t - y * s;
            b10 = x * y * t - z * s;
            b11 = y * y * t + c;
            b12 = z * y * t + x * s;
            b20 = x * z * t + y * s;
            b21 = y * z * t - x * s;
            b22 = z * z * t + c;

            // Perform rotation-specific matrix multiplication
            a[0] = a00 * b00 + a10 * b01 + a20 * b02;
            a[1] = a01 * b00 + a11 * b01 + a21 * b02;
            a[2] = a02 * b00 + a12 * b01 + a22 * b02;
            a[3] = a03 * b00 + a13 * b01 + a23 * b02;
            a[4] = a00 * b10 + a10 * b11 + a20 * b12;
            a[5] = a01 * b10 + a11 * b11 + a21 * b12;
            a[6] = a02 * b10 + a12 * b11 + a22 * b12;
            a[7] = a03 * b10 + a13 * b11 + a23 * b12;
            a[8] = a00 * b20 + a10 * b21 + a20 * b22;
            a[9] = a01 * b20 + a11 * b21 + a21 * b22;
            a[10] = a02 * b20 + a12 * b21 + a22 * b22;
            a[11] = a03 * b20 + a13 * b21 + a23 * b22;

            return this;
        },

        /**
         * translate the matrix position using the given vector
         * @name translate
         * @memberOf me.Matrix3d
         * @function
         * @param {Number} x a number representing the abscissa of the vector.
         * @param {Number} [y=x] a number representing the ordinate of the vector.
         * @param {Number} [z=0] a number representing the depth of the vector
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        translate : function (x, y, z) {
            var a = this.val,
               _x = x,
               _y = typeof(y) === "undefined" ? _x : y,
               _z = typeof(z) === "undefined" ?  0 : z;

             a[12] = a[0] * _x + a[4] * _y + a[8] * _z + a[12];
             a[13] = a[1] * _x + a[5] * _y + a[9] * _z + a[13];
             a[14] = a[2] * _x + a[6] * _y + a[10] * _z + a[14];
             a[15] = a[3] * _x + a[7] * _y + a[11] * _z + a[15];

             return this;
        },

        /**
         * translate the matrix by a vector on the horizontal and vertical axis
         * @name translateV
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v the vector to translate the matrix by
         * @return {me.Matrix3d} Reference to this object for method chaining
         */
        translateV : function (v) {
            return this.translate(v.x, v.y, v.z);
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

            return (
                (a[0] === 1) &&
                (a[1] === 0) &&
                (a[2] === 0) &&
                (a[3] === 0) &&
                (a[4] === 0) &&
                (a[5] === 1) &&
                (a[6] === 0) &&
                (a[7] === 0) &&
                (a[8] === 0) &&
                (a[9] === 0) &&
                (a[10] === 1) &&
                (a[11] === 0) &&
                (a[12] === 0) &&
                (a[13] === 0) &&
                (a[14] === 0) &&
                (a[15] === 1)
            );
        },

        /**
         * return true if the two matrices are identical
         * @name equals
         * @memberOf me.Matrix3d
         * @function
         * @param {me.Matrix3d} b the other matrix
         * @return {Boolean} true if both are equals
         */
        equals : function (b) {
            b = b.val;
            var a = this.val;

            return (
                (a[0] === b[0]) &&
                (a[1] === b[1]) &&
                (a[2] === b[2]) &&
                (a[3] === b[3]) &&
                (a[4] === b[4]) &&
                (a[5] === b[5]) &&
                (a[6] === b[6]) &&
                (a[7] === b[7]) &&
                (a[8] === b[8]) &&
                (a[9] === b[9]) &&
                (a[10] === b[10]) &&
                (a[11] === b[11]) &&
                (a[12] === b[12]) &&
                (a[13] === b[13]) &&
                (a[14] === b[14]) &&
                (a[15] === b[15])
            );
        },

        /**
         * Clone the Matrix
         * @name clone
         * @memberOf me.Matrix3d
         * @function
         * @return {me.Matrix3d}
         */
        clone : function () {
            return me.pool.pull("me.Matrix3d", this);
        },

        /**
         * return an array representation of this Matrix
         * @name toArray
         * @memberOf me.Matrix3d
         * @function
         * @return {Float32Array}
         */
        toArray : function () {
            return this.val;
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

            return "me.Matrix3d(" +
                a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " +
                a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " +
                a[8] + ", " + a[9] + ", " + a[10] + ", " + a[11] + ", " +
                a[12] + ", " + a[13] + ", " + a[14] + ", " + a[15] +
            ")";
        }
    });

    /**
     * tx component of the matrix
     * @public
     * @type {Number}
     * @readonly
     * @name tx
     * @memberOf me.Matrix3d
     */
    Object.defineProperty(me.Matrix3d.prototype, "tx", {
        /**
         * @ignore
         */
        get : function () {
            return this.val[12];
        },
        configurable : true
    });

    /**
     * ty component of the matrix
     * @public
     * @type {Number}
     * @readonly
     * @name ty
     * @memberOf me.Matrix3d
     */
    Object.defineProperty(me.Matrix3d.prototype, "ty", {
        /**
         * @ignore
         */
        get : function () {
            return this.val[13];
        },
        configurable : true
    });

    /**
     * ty component of the matrix
     * @public
     * @type {Number}
     * @readonly
     * @name tz
     * @memberOf me.Matrix3d
     */
    Object.defineProperty(me.Matrix3d.prototype, "tz", {
        /**
         * @ignore
         */
        get : function () {
            return this.val[14];
        },
        configurable : true
    });

})();
