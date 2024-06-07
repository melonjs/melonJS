/**
 * @classdesc
 * a QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * @see game.world.broadphase
 */
export default class QuadTree {
    /**
     * @param {World} world - the physic world this QuadTree belongs to
     * @param {Bounds} bounds - bounds of the node
     * @param {number} [max_objects=4] - max objects a node can hold before splitting into 4 subnodes
     * @param {number} [max_levels=4] - total max levels inside root Quadtree
     * @param {number} [level] - deepth level, required for subnodes
     */
    constructor(world: World, bounds: Bounds, max_objects?: number | undefined, max_levels?: number | undefined, level?: number | undefined);
    world: World;
    bounds: Bounds;
    max_objects: number;
    max_levels: number;
    level: number;
    objects: any[];
    nodes: any[];
    split(): void;
    getIndex(item: any): number;
    /**
     * Insert the given object container into the node.
     * @name insertContainer
     * @memberof QuadTree
     * @param {Container} container - group of objects to be added
     */
    insertContainer(container: Container): void;
    /**
     * Insert the given object into the node. If the node
     * exceeds the capacity, it will split and add all
     * objects to their corresponding subnodes.
     * @name insert
     * @memberof QuadTree
     * @param {object} item - object to be added
     */
    insert(item: object): void;
    /**
     * Return all objects that could collide with the given object
     * @name retrieve
     * @memberof QuadTree
     * @param {object} item - object to be checked against
     * @param {object} [fn] - a sorting function for the returned array
     * @returns {object[]} array with all detected objects
     */
    retrieve(item: object, fn?: object | undefined): object[];
    /**
     * Remove the given item from the quadtree.
     * (this function won't recalculate the impacted node)
     * @name remove
     * @memberof QuadTree
     * @param {object} item - object to be removed
     * @returns {boolean} true if the item was found and removed.
     */
    remove(item: object): boolean;
    /**
     * return true if the node is prunable
     * @name isPrunable
     * @memberof QuadTree
     * @returns {boolean} true if the node is prunable
     */
    isPrunable(): boolean;
    /**
     * return true if the node has any children
     * @name hasChildren
     * @memberof QuadTree
     * @returns {boolean} true if the node has any children
     */
    hasChildren(): boolean;
    /**
     * clear the quadtree
     * @name clear
     * @memberof QuadTree
     * @param {Bounds} [bounds=this.bounds] - the bounds to be cleared
     */
    clear(bounds?: Bounds | undefined): void;
}
import type World from "./world.js";
import type Bounds from "./bounds.js";
import type Container from "./../renderable/container.js";
