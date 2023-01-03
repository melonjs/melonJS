/**
 * @classdesc
 * object group definition as defined in Tiled.
 * (group definition is translated into the virtual `me.game.world` using `me.Container`)
 * @ignore
 */
export default class TMXGroup {
    constructor(map: any, data: any, z: any);
    /**
     * group name
     * @type {string}
     */
    name: string;
    /**
     * group width
     * @type {number}
     */
    width: number;
    /**
     * group height
     * @type {number}
     */
    height: number;
    /**
     * tint color
     * @type {string}
     */
    tintcolor: string;
    /**
     * the group class
     * @type {string}
     */
    class: string;
    /**
     * group z order
     * @type {number}
     */
    z: number;
    /**
     * group objects list definition
     * @see TMXObject
     * @type {object[]}
     */
    objects: object[];
    opacity: number;
    /**
     * reset function
     * @ignore
     */
    destroy(): void;
    /**
     * return the object count
     * @ignore
     */
    getObjectCount(): number;
    /**
     * returns the object at the specified index
     * @ignore
     */
    getObjectByIndex(idx: any): object;
}
