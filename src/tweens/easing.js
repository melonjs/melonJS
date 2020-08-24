/**
* Tween.js - Licensed under the MIT license
* https://github.com/tweenjs/tween.js
*/

/* eslint-disable quotes, keyword-spacing, comma-spacing, no-return-assign */

/**
 * Easing Function :<br>
 * <p>
 * Easing.Linear.None<br>
 * Easing.Quadratic.In<br>
 * Easing.Quadratic.Out<br>
 * Easing.Quadratic.InOut<br>
 * Easing.Cubic.In<br>
 * Easing.Cubic.Out<br>
 * Easing.Cubic.InOut<br>
 * Easing.Quartic.In<br>
 * Easing.Quartic.Out<br>
 * Easing.Quartic.InOut<br>
 * Easing.Quintic.In<br>
 * Easing.Quintic.Out<br>
 * Easing.Quintic.InOut<br>
 * Easing.Sinusoidal.In<br>
 * Easing.Sinusoidal.Out<br>
 * Easing.Sinusoidal.InOut<br>
 * Easing.Exponential.In<br>
 * Easing.Exponential.Out<br>
 * Easing.Exponential.InOut<br>
 * Easing.Circular.In<br>
 * Easing.Circular.Out<br>
 * Easing.Circular.InOut<br>
 * Easing.Elastic.In<br>
 * Easing.Elastic.Out<br>
 * Easing.Elastic.InOut<br>
 * Easing.Back.In<br>
 * Easing.Back.Out<br>
 * Easing.Back.InOut<br>
 * Easing.Bounce.In<br>
 * Easing.Bounce.Out<br>
 * Easing.Bounce.InOut
 * </p>
 * @public
 * @constant
 * @type enum
 * @name Easing
 * @memberOf me.Tween
 */
export let Easing = {

    Linear: {
        /** @ignore */
        None: function ( k ) {

            return k;

        }

    },

    Quadratic: {
        /** @ignore */
        In: function ( k ) {

            return k * k;

        },
        /** @ignore */
        Out: function ( k ) {

            return k * ( 2 - k );

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
            return - 0.5 * ( --k * ( k - 2 ) - 1 );

        }

    },

    Cubic: {
        /** @ignore */
        In: function ( k ) {

            return k * k * k;

        },
        /** @ignore */
        Out: function ( k ) {

            return --k * k * k + 1;

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
            return 0.5 * ( ( k -= 2 ) * k * k + 2 );

        }

    },

    Quartic: {
        /** @ignore */
        In: function ( k ) {

            return k * k * k * k;

        },
        /** @ignore */
        Out: function ( k ) {

            return 1 - ( --k * k * k * k );

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
            return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

        }

    },

    Quintic: {
        /** @ignore */
        In: function ( k ) {

            return k * k * k * k * k;

        },
        /** @ignore */
        Out: function ( k ) {

            return --k * k * k * k * k + 1;

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
            return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

        }

    },

    Sinusoidal: {
        /** @ignore */
        In: function ( k ) {

            return 1 - Math.cos( k * Math.PI / 2 );

        },
        /** @ignore */
        Out: function ( k ) {

            return Math.sin( k * Math.PI / 2 );

        },
        /** @ignore */
        InOut: function ( k ) {

            return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

        }

    },

    Exponential: {
        /** @ignore */
        In: function ( k ) {

            return k === 0 ? 0 : Math.pow( 1024, k - 1 );

        },
        /** @ignore */
        Out: function ( k ) {

            return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( k === 0 ) return 0;
            if ( k === 1 ) return 1;
            if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
            return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

        }

    },

    Circular: {
        /** @ignore */
        In: function ( k ) {

            return 1 - Math.sqrt( 1 - k * k );

        },
        /** @ignore */
        Out: function ( k ) {

            return Math.sqrt( 1 - ( --k * k ) );

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
            return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

        }

    },

    Elastic: {
        /** @ignore */
        In: function ( k ) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
        },
        /** @ignore */
        Out: function ( k ) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;

        },
        /** @ignore */
        InOut: function ( k ) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            k *= 2;
            if (k < 1) {
                return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
            }
            return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;
        }

    },

    Back: {
        /** @ignore */
        In: function ( k ) {

            var s = 1.70158;
            return k * k * ( ( s + 1 ) * k - s );

        },
        /** @ignore */
        Out: function ( k ) {

            var s = 1.70158;
            return --k * k * ( ( s + 1 ) * k + s ) + 1;

        },
        /** @ignore */
        InOut: function ( k ) {

            var s = 1.70158 * 1.525;
            if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
            return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

        }

    },

    Bounce: {
        /** @ignore */
        In: function ( k ) {

            return 1 - Easing.Bounce.Out( 1 - k );

        },
        /** @ignore */
        Out: function ( k ) {

            if ( k < ( 1 / 2.75 ) ) {

                return 7.5625 * k * k;

            } else if ( k < ( 2 / 2.75 ) ) {

                return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

            } else if ( k < ( 2.5 / 2.75 ) ) {

                return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

            } else {

                return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

            }

        },
        /** @ignore */
        InOut: function ( k ) {

            if ( k < 0.5 ) return Easing.Bounce.In( k * 2 ) * 0.5;
            return Easing.Bounce.Out( k * 2 - 1 ) * 0.5 + 0.5;

        }

    }

};

/* eslint-enable quotes, keyword-spacing, comma-spacing, no-return-assign */
