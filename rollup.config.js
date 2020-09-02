import buble from '@rollup/plugin-buble';
import { string } from 'rollup-plugin-string';
import replace from '@rollup/plugin-replace';
import bundleSize from 'rollup-plugin-bundle-size';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

const pkg = require('./package.json');

// credit/license information
const license = [
    `/*!`,
    ` * ${pkg.description} - v${pkg.version}`,
    ` * http://www.melonjs.org`,
    ` * ${pkg.name} is licensed under the MIT License.`,
    ` * http://www.opensource.org/licenses/mit-license`,
    ` * @copyright (C) 2011 - ${(new Date()).getFullYear()} ${pkg.author.name}`,
    ` */`,
].join('\n');

export default [
    {
        input: 'src/index.js',
        plugins: [
            resolve({
                mainFields: ['main'],
                browser: true,
                preferBuiltins: false
            }),
            commonjs({
                include: 'node_modules/**',
                sourceMap: false
            }),
            replace({
                '__VERSION__': pkg.version,
                delimiters: ['', '']
            }
            //, {
            //    '/this\._super\(\s*([\w\.]+)\s*,\s*"(\w+)"\s*(,\s*)?/g' : '$1.prototype.$2.apply(this$3',
            //    delimiters: ['', '']
            //  }
            ),
            string({
                include: [
                    '**/*.frag',
                    '**/*.vert',
                ],
            }),
            buble(),
            bundleSize()
        ],
        output: {
          file: 'build/melonjs.js',
          banner: license,
          footer : 'me.deprecated.apply();',
          name : "me",
          format: 'umd'
        }
    },
    {
        input: 'src/index.js',
        plugins: [
            resolve({
                mainFields: ['module'],
                browser: true,
                preferBuiltins: false
            }),
            commonjs({
                include: 'node_modules/**',
                sourceMap: false
            }),
            replace({
                '__VERSION__': pkg.version,
                delimiters: ['', '']
            }
            //, {
            //    '/this\._super\(\s*([\w\.]+)\s*,\s*"(\w+)"\s*(,\s*)?/g' : '$1.prototype.$2.apply(this$3',
            //    delimiters: ['', '']
            //  }
            ),
            string({
                include: [
                    '**/*.frag',
                    '**/*.vert',
                ],
            }),
            bundleSize()
        ],
        output: {
          file: 'build/melonjs-module.js',
          banner: license,
          format: 'esm'
        }
    }
];
