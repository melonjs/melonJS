// https://github.com/melonjs/melonJS/issues/1092
import "core-js/proposals/global-this";

// es10 string trim functions
import "core-js/es/string/trim-start";
import "core-js/es/string/trim-end";

// "built-in" polyfills
import "./console.js";
import "./roundrect.js";

// fetch polyfill
import "whatwg-fetch";
