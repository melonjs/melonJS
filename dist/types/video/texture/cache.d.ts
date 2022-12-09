export default TextureCache;
/**
 * a basic texture cache object
 * @ignore
 */
declare class TextureCache {
    /**
     * @ignore
     */
    constructor(max_size: any);
    cache: ArrayMultimap<any, any>;
    tinted: Map<any, any>;
    units: Map<any, any>;
    max_size: any;
    /**
     * @ignore
     */
    clear(): void;
    length: number | undefined;
    /**
     * @ignore
     */
    validate(): void;
    /**
     * @ignore
     */
    get(image: any, atlas: any): any;
    /**
     * @ignore
     */
    delete(image: any): void;
    /**
     * @ignore
     */
    tint(src: any, color: any): any;
    /**
     * @ignore
     */
    set(image: any, texture: any): boolean;
    /**
     * @ignore
     */
    getUnit(texture: any): any;
}
import { ArrayMultimap } from "@teppeis/multimaps";
