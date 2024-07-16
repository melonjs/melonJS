import { Vector2d } from "../math/vector2d.ts";
import * as input from "./../input/input.js";
import Renderable from "./../renderable/renderable.js";
import {
	DRAGEND,
	DRAGSTART,
	eventEmitter,
	POINTERMOVE,
} from "../system/event.ts";

/**
 * A Draggable base object
 * @see DropTarget
 */
export class Draggable extends Renderable {
	/**
	 * @param {number} x - the x coordinates of the draggable object
	 * @param {number} y - the y coordinates of the draggable object
	 * @param {number} width - draggable object width
	 * @param {number} height - draggable object height
	 */
	constructor(x, y, width, height) {
		super(x, y, width, height);
		this.isKinematic = false;
		this.dragging = false;
		this.dragId = null;
		this.grabOffset = new Vector2d(0, 0);
		this.initEvents();
	}

	/**
	 * Initializes the events the modules needs to listen to
	 * It translates the pointer events to me.events
	 * in order to make them pass through the system and to make
	 * this module testable. Then we subscribe this module to the
	 * transformed events.
	 * @private
	 */
	initEvents() {
		input.registerPointerEvent("pointerdown", this, (e) => {
			eventEmitter.emit(DRAGSTART, e, this);
		});
		input.registerPointerEvent("pointerup", this, (e) => {
			eventEmitter.emit(DRAGEND, e, this);
		});
		input.registerPointerEvent("pointercancel", this, (e) => {
			eventEmitter.emit(DRAGEND, e, this);
		});

		this.handlePointerMove = (e) => {
			this.dragMove(e);
		};

		this.handleDragStart = (e, draggable) => {
			if (draggable === this) {
				this.dragStart(e);
			}
		};

		this.handleDragEnd = (e, draggable) => {
			if (draggable === this) {
				this.dragEnd(e);
			}
		};

		eventEmitter.addListener(POINTERMOVE, this.handlePointerMove);
		eventEmitter.addListener(DRAGSTART, this.handleDragStart);
		eventEmitter.addListener(DRAGEND, this.handleDragEnd);
	}

	/**
	 * Gets called when the user starts dragging the entity
	 * @param {object} e - the pointer event
	 * @returns {boolean} false if the object is being dragged
	 */
	dragStart(e) {
		if (this.dragging === false) {
			this.dragging = true;
			this.grabOffset.set(e.gameX, e.gameY);
			this.grabOffset.sub(this.pos);
			return false;
		}
	}

	/**
	 * Gets called when the user drags this entity around
	 * @param {object} e - the pointer event
	 */
	dragMove(e) {
		if (this.dragging === true) {
			this.pos.set(e.gameX, e.gameY, this.pos.z); //TODO : z ?
			this.pos.sub(this.grabOffset);
		}
	}

	/**
	 * Gets called when the user stops dragging the entity
	 * @returns {boolean} false if the object stopped being dragged
	 */
	dragEnd() {
		if (this.dragging === true) {
			this.dragging = false;
			return false;
		}
	}

	/**
	 * Destructor
	 * @ignore
	 */
	destroy() {
		eventEmitter.removeListener(POINTERMOVE, this.handlePointerMove);
		eventEmitter.removeListener(DRAGSTART, this.handleDragStart);
		eventEmitter.removeListener(DRAGEND, this.handleDragEnd);
		input.releasePointerEvent("pointerdown", this);
		input.releasePointerEvent("pointerup", this);
		input.releasePointerEvent("pointercancel", this);
		super.destroy();
	}
}
