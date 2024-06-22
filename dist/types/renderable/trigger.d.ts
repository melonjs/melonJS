/**
 * additional import for TypeScript
 * @import ResponseObject from "./../physics/response.js";
 */
/**
 * @classdesc
 * trigger an event when colliding with another object
 * @augments Renderable
 */
export default class Trigger extends Renderable {
    /**
     * @param {number} x - the x coordinates of the trigger area
     * @param {number} y - the y coordinates of the trigger area
     * @param {number} [settings.width] - width of the trigger area
     * @param {number} [settings.height] - height of the trigger area
     * @param {Rect[]|Polygon[]|Line[]|Ellipse[]} [settings.shapes] - collision shape(s) that will trigger the event
     * @param {string} [settings.duration] - Fade duration (in ms)
     * @param {string|Color} [settings.color] - Fade color
     * @param {string} [settings.event="level"] - the type of event to trigger (only "level" supported for now)
     * @param {string} [settings.to] - level to load if level trigger
     * @param {string|Container} [settings.container] - Target container. See {@link level.load}
     * @param {Function} [settings.onLoaded] - Level loaded callback. See {@link level.load}
     * @param {boolean} [settings.flatten] - Flatten all objects into the target container. See {@link level.load}
     * @param {boolean} [settings.setViewportBounds] - Resize the viewport to match the level. See {@link level.load}
     * @example
     * world.addChild(new me.Trigger(
     *     x, y, {
     *         shapes: [new me.Rect(0, 0, 100, 100)],
     *         "duration" : 250,
     *         "color" : "#000",
     *         "to" : "mymap2"
     *     }
     * ));
     */
    constructor(x: number, y: number, settings: any);
    fade: any;
    duration: any;
    fading: boolean;
    type: any;
    id: any;
    gotolevel: any;
    triggerSettings: {
        event: string;
    };
    /**
     * @ignore
     */
    getTriggerSettings(): {
        event: string;
    };
    /**
     * @ignore
     */
    onFadeComplete(): void;
    /**
     * trigger this event
     * @name triggerEvent
     * @memberof Trigger
     * @protected
     */
    protected triggerEvent(): void;
}
import Renderable from "./renderable.js";
