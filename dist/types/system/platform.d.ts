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
export const ua: string;
export const iOS: boolean;
export const android: boolean;
export const android2: boolean;
export const linux: boolean;
export const chromeOS: boolean;
export const wp: boolean;
export const BlackBerry: boolean;
export const Kindle: boolean;
export const ejecta: boolean;
export const isWeixin: boolean;
export const nodeJS: boolean;
export const isMobile: boolean;
export const webApp: boolean;
