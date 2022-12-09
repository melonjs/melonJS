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
     * @public
     * @type {string}
     * @name name
     * @memberof TMXGroup
     */
    public name: string;
    /**
     * group width
     * @public
     * @type {number}
     * @name width
     * @memberof TMXGroup
     */
    public width: number;
    /**
     * group height
     * @public
     * @type {number}
     * @name height
     * @memberof TMXGroup
     */
    public height: number;
    /**
     * tint color
     * @public
     * @type {string}
     * @name tintcolor
     * @memberof TMXGroup
     */
    public tintcolor: string;
    /**
     * the group class
     * @public
     * @type {string}
     * @name class
     * @memberof TMXGroup
     */
    public class: string;
    /**
     * group z order
     * @public
     * @type {number}
     * @name z
     * @memberof TMXGroup
     */
    public z: number;
    /**
     * group objects list definition
     * @see TMXObject
     * @public
     * @type {object[]}
     * @name name
     * @memberof TMXGroup
     */
    public objects: object[];
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
