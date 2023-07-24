export default TextureCache;
/**
 * a basic texture cache object
 * @ignore
 */
declare class TextureCache {
    /**
     * @ignore
     */
    constructor(max_size?: number);
    cache: ArrayMultimap<any, any>;
    tinted: Map<any, any>;
    units: Map<any, any>;
    usedUnits: Set<any>;
    max_size: number;
    /**
     * @ignore
     */
    clear(): void;
    /**
     * @ignore
     */
    allocateTextureUnit(): number;
    /**
     * @ignore
     */
    freeTextureUnit(texture: any): void;
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
