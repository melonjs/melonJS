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

export const ua = typeof globalThis.navigator !== "undefined" ? globalThis.navigator.userAgent : "";
export const iOS = /iPhone|iPad|iPod/i.test(ua);
export const android = /Android/i.test(ua);
export const android2 = /Android 2/i.test(ua);
export const linux = /Linux/i.test(ua);
export const chromeOS = /CrOS/.test(ua);
export const wp = /Windows Phone/i.test(ua);
export const BlackBerry = /BlackBerry/i.test(ua);
export const Kindle = /Kindle|Silk.*Mobile Safari/i.test(ua);
export const ejecta = (typeof globalThis.ejecta !== "undefined");
export const isWeixin = /MicroMessenger/i.test(ua);
export const nodeJS = (typeof globalThis.process !== "undefined") && (typeof globalThis.process.release !== "undefined") && (globalThis.process.release.name === "node");
export const isMobile = /Mobi/i.test(ua) || iOS || android || wp || BlackBerry || Kindle || false;
export const webApp = (typeof globalThis.navigator !== "undefined" && globalThis.navigator.standalone === true) || (typeof globalThis.matchMedia !== "undefined" && globalThis.matchMedia("(display-mode: standalone)").matches);
