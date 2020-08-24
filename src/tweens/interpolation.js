/**
* Tween.js - Licensed under the MIT license
* https://github.com/tweenjs/tween.js
*/

/* eslint-disable quotes, keyword-spacing, comma-spacing, no-return-assign */

/**
 * Interpolation Function :<br>
 * <p>
 * Interpolation.Linear<br>
 * Interpolation.Bezier<br>
 * Interpolation.CatmullRom
 * </p>
 * @public
 * @constant
 * @type enum
 * @name Interpolation
 * @memberOf me.Tween
 */
export let Interpolation = {
    /** @ignore */
    Linear: function ( v, k ) {

        var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = Interpolation.Utils.Linear;

        if ( k < 0 ) return fn( v[ 0 ], v[ 1 ], f );
        if ( k > 1 ) return fn( v[ m ], v[ m - 1 ], m - f );

        return fn( v[ i ], v[ i + 1 > m ? m : i + 1 ], f - i );

    },
    /** @ignore */
    Bezier: function ( v, k ) {

        var b = 0, n = v.length - 1, pw = Math.pow, bn = Interpolation.Utils.Bernstein, i;

        for ( i = 0; i <= n; i++ ) {
            b += pw( 1 - k, n - i ) * pw( k, i ) * v[ i ] * bn( n, i );
        }

        return b;

    },
    /** @ignore */
    CatmullRom: function ( v, k ) {

        var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = Interpolation.Utils.CatmullRom;

        if ( v[ 0 ] === v[ m ] ) {

            if ( k < 0 ) i = Math.floor( f = m * ( 1 + k ) );

            return fn( v[ ( i - 1 + m ) % m ], v[ i ], v[ ( i + 1 ) % m ], v[ ( i + 2 ) % m ], f - i );

        } else {

            if ( k < 0 ) return v[ 0 ] - ( fn( v[ 0 ], v[ 0 ], v[ 1 ], v[ 1 ], -f ) - v[ 0 ] );
            if ( k > 1 ) return v[ m ] - ( fn( v[ m ], v[ m ], v[ m - 1 ], v[ m - 1 ], f - m ) - v[ m ] );

            return fn( v[ i ? i - 1 : 0 ], v[ i ], v[ m < i + 1 ? m : i + 1 ], v[ m < i + 2 ? m : i + 2 ], f - i );

        }

    },

    Utils: {
        /** @ignore */
        Linear: function ( p0, p1, t ) {

            return ( p1 - p0 ) * t + p0;

        },
        /** @ignore */
        Bernstein: function ( n , i ) {

            var fc = Interpolation.Utils.Factorial;
            return fc( n ) / fc( i ) / fc( n - i );

        },
        /** @ignore */
        Factorial: ( function () {

            var a = [ 1 ];

            return function ( n ) {

                var s = 1, i;
                if ( a[ n ] ) return a[ n ];
                for ( i = n; i > 1; i-- ) s *= i;
                return a[ n ] = s;

            };

        } )(),
        /** @ignore */
        CatmullRom: function ( p0, p1, p2, p3, t ) {

            var v0 = ( p2 - p0 ) * 0.5, v1 = ( p3 - p1 ) * 0.5, t2 = t * t, t3 = t * t2;
            return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( - 3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;

        }

    }

};

/* eslint-enable quotes, keyword-spacing, comma-spacing, no-return-assign */
