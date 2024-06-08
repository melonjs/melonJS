/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
* The device platform type
* @namespace platform
* @memberof device
* @property {string} ua the user agent string for the current device
* @property {boolean} iOS `true` if the device is an iOS platform
* @property {boolean} android `true` if the device is an Android platform
* @property {boolean} android2 `true` if the device is an Android 2.x platform
* @property {boolean} linux `true` if the device is a Linux platform
* @property {boolean} chromeOS `true` if the device is running on ChromeOS.
* @property {boolean} wp `true` if the device is a Windows Phone platform
* @property {boolean} BlackBerry`true` if the device is a BlackBerry platform
* @property {boolean} Kindle`true` if the device is a Kindle platform
* @property {boolean} ejecta `true` if running under Ejecta
* @property {boolean} isWeixin `true` if running under Wechat
* @property {boolean} nodeJS `true` if running under node.js
* @property {boolean} isMobile `true` if a mobile device
* @property {boolean} webApp `true` if running as a standalone web app
*/

const ua = typeof globalThis.navigator !== "undefined" ? globalThis.navigator.userAgent : "";
const iOS = /iPhone|iPad|iPod/i.test(ua);
const android = /Android/i.test(ua);
const android2 = /Android 2/i.test(ua);
const linux = /Linux/i.test(ua);
const chromeOS = /CrOS/.test(ua);
const wp = /Windows Phone/i.test(ua);
const BlackBerry = /BlackBerry/i.test(ua);
const Kindle = /Kindle|Silk.*Mobile Safari/i.test(ua);
const ejecta = (typeof globalThis.ejecta !== "undefined");
const isWeixin = /MicroMessenger/i.test(ua);
const nodeJS = (typeof globalThis.process !== "undefined") && (typeof globalThis.process.release !== "undefined") && (globalThis.process.release.name === "node");
const isMobile = /Mobi/i.test(ua) || iOS || android || wp || BlackBerry || Kindle || false;
const webApp = (typeof globalThis.navigator !== "undefined" && globalThis.navigator.standalone === true) || (typeof globalThis.matchMedia !== "undefined" && globalThis.matchMedia("(display-mode: standalone)").matches);

export { BlackBerry, Kindle, android, android2, chromeOS, ejecta, iOS, isMobile, isWeixin, linux, nodeJS, ua, webApp, wp };
