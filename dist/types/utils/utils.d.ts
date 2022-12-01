export default utils;
declare namespace utils {
    export { agentUtils as agent };
    export { arrayUtils as array };
    export { fileUtils as file };
    export { stringUtils as string };
    export { fnUtils as function };
    export function getPixels(image: HTMLCanvasElement | HTMLImageElement): ImageData;
    export function checkVersion(first: string, second?: string): number;
    export function getUriFragment(url?: string): any;
    export function resetGUID(base: any, index?: number): void;
    export function createGUID(index?: number): string;
}
import * as agentUtils from "./agent.js";
import * as arrayUtils from "./array.js";
import * as fileUtils from "./file.js";
import * as stringUtils from "./string.js";
import * as fnUtils from "./function.js";
