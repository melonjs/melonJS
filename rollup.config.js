import { string } from "rollup-plugin-string";
import replace from "@rollup/plugin-replace";
import image from "@rollup/plugin-image";
import bundleSize from "rollup-plugin-bundle-size";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import rename from "rollup-plugin-rename";

const pkg = require("./package.json");


// credit/license information
const license = [
    "/*!",
    " * " + pkg.description + " - v" + pkg.version,
    " * http://www.melonjs.org",
    " * " + pkg.name + " is licensed under the MIT License.",
    " * http://www.opensource.org/licenses/mit-license",
    " * @copyright (C) 2011 - " + (new Date()).getFullYear() + " " + pkg.author,
    " */"
].join("\n");

export default [
    // ES6 "melonjs.module.js" bundle
    {
        input: "src/index.js",
        plugins: [
            resolve({
                mainFields: ["module"],
                browser: true,
                preferBuiltins: false
            }),
            commonjs({
                include: "node_modules/**",
                sourceMap: false
            }),
            replace({
                values: {
                    __VERSION__: pkg.version
                },
                preventAssignment: true
            }),
            string({
                include: [
                    "**/*.frag",
                    "**/*.vert"
                ]
            }),
            image(),
            bundleSize()
        ],
        output: {
          file: "build/melonjs.module.js",
          banner: license,
          format: "esm"
        }
    },
    // ES6 "melonjs.mjs/" chunk
    {
        input: "src/index.js",
        plugins: [
            resolve({
                mainFields: ["module"],
                browser: true,
                preferBuiltins: false
            }),
            commonjs({
                include: "node_modules/**",
                sourceMap: false
            }),
            replace({
                values: {
                    __VERSION__: pkg.version
                },
                preventAssignment: true
            }),
            string({
                include: [
                    "**/*.frag",
                    "**/*.vert"
                ]
            }),
            image(),
            // workaround while waiting for rollup 3 to be released
            // @see https://github.com/rollup/rollup/issues/3684
            rename({
                include: ["**/*.js"],
                map: (name) => name
                    .replace("src/", "")
                    .replace("node_modules/", "external/")
            })
        ],
        output: {
          dir: "build/melonjs.mjs",
          banner: license,
          format: "es",
          preserveModules: true
        }
    }
];
