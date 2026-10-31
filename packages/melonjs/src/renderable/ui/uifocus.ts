import { GAMEPAD, readGamepads } from "../../input/gamepad.ts";
import { KEY } from "../../input/key.ts";
import {
	GAME_BEFORE_UPDATE,
	KEYDOWN,
	KEYUP,
	off,
	on,
	POINTERMOVE,
} from "../../system/event.ts";
import type Renderable from "../renderable.js";
import type UIBaseElement from "./uibaseelement.ts";

/**
 * A direction the player moves the focus in.
 * @category UI
 */
export type UINavAction = "up" | "down" | "left" | "right";

/*
 * The keyboard and gamepad focus of UI elements, behind
 * `UIBaseElement#focus()`. Internal: a game only ever sees the methods on
 * the elements. Nothing listens until an element takes the focus, and the
 * listeners go when none has it, so a game that never calls `focus()` pays
 * nothing and finds its arrow keys untouched.
 */

/** the directions, as unit steps */
const DIRECTIONS: Record<UINavAction, [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/** the key for each direction */
const KEYS: Record<UINavAction, number> = {
	up: KEY.UP,
	down: KEY.DOWN,
	left: KEY.LEFT,
	right: KEY.RIGHT,
};

/** the keys that press the focused element */
const ACCEPT_KEYS: readonly number[] = [KEY.ENTER, KEY.SPACE];

/** the elements in the scene */
const elements = new Set<UIBaseElement>();
/** the element with the focus */
let owner: UIBaseElement | undefined;
/** whether the ring shows: after a key, the pad or `focus()`, until the mouse */
let ringShown = false;
/** whether the listeners are on */
let listening = false;
/** the input holding accept down, if any, and the element it pressed */
let accepting: "key" | "pad" | undefined;
let pressed: UIBaseElement | undefined;
/** the pads' D-pad direction and A button on the last frame */
const pad = { held: "", accept: false };

/**
 * The element with the focus, if any.
 * @returns the focus owner
 * @ignore
 * @internal
 */
export function focusOwner(): UIBaseElement | undefined {
	return owner;
}

/**
 * Whether the focus ring shows.
 * @returns true after keyboard or pad input, until the mouse moves
 * @ignore
 * @internal
 */
export function ringVisible(): boolean {
	return ringShown;
}

/**
 * Whether a key presses the focused element.
 * @param keyCode - the key
 * @returns true for Enter and Space
 * @ignore
 * @internal
 */
export function isAcceptKey(keyCode: number): boolean {
	return ACCEPT_KEYS.includes(keyCode);
}

/**
 * Give an element the focus, or take it away with `undefined`. The ring
 * shows, and a scrolling panel holding the element scrolls it into view.
 * @param element - the element
 * @ignore
 * @internal
 */
export function setFocus(element: UIBaseElement | undefined): void {
	if (element === owner) {
		ringShown = element !== undefined;
		return;
	}
	if (owner !== undefined) {
		owner.isDirty = true;
	}
	// a press held on the element losing the focus is called off, or it
	// stays down with nothing to let it go
	cancelAccept();
	owner = element;
	if (element !== undefined) {
		element.isDirty = true;
		ringShown = true;
		scrollIntoView(element);
		listen(true);
	} else {
		ringShown = false;
		listen(false);
	}
}

/**
 * Track an element joining the scene.
 * @param element - the element
 * @ignore
 * @internal
 */
export function trackElement(element: UIBaseElement): void {
	elements.add(element);
}

/**
 * Track an element leaving the scene; it loses the focus.
 * @param element - the element
 * @ignore
 * @internal
 */
export function untrackElement(element: UIBaseElement): void {
	elements.delete(element);
	if (pressed === element) {
		cancelAccept();
	}
	if (owner === element) {
		setFocus(undefined);
	}
}

/**
 * Move the focus as an arrow key would. The focused element is asked
 * first, through `onNavigate`, so a slider steps instead.
 * @param action - which way
 * @ignore
 * @internal
 */
export function navigate(action: UINavAction): void {
	const from = owner;
	if (from === undefined) {
		return;
	}
	ringShown = true;
	if (!isCandidate(from)) {
		// disabled or hidden since: move on from where it is
		setFocus(next(from, action) ?? first());
		return;
	}
	if (!from.onNavigate(action)) {
		const to = next(from, action);
		if (to !== undefined) {
			setFocus(to);
		}
	}
}

/**
 * turn the key, pointer and pad listeners on or off
 * @param value - on or off
 */
function listen(value: boolean): void {
	if (value === listening) {
		return;
	}
	listening = value;
	if (value) {
		// a button already held, the A that opened this menu say, is not a
		// fresh press
		readPad();
		on(KEYDOWN, onKeyDown);
		on(KEYUP, onKeyUp);
		on(POINTERMOVE, onPointer);
		on(GAME_BEFORE_UPDATE, onFrame);
	} else {
		off(KEYDOWN, onKeyDown);
		off(KEYUP, onKeyUp);
		off(POINTERMOVE, onPointer);
		off(GAME_BEFORE_UPDATE, onFrame);
	}
}

/** call off a press held by accept, without a click */
function cancelAccept(): void {
	const element = pressed;
	accepting = undefined;
	pressed = undefined;
	element?.cancelPress();
}

/**
 * whether an element can take the focus now
 * @param element - the element
 * @returns true when focusable, enabled, in the scene, and shown along with
 * everything holding it
 */
function isCandidate(element: UIBaseElement): boolean {
	if (!element.focusable || !element.enabled || !elements.has(element)) {
		return false;
	}
	for (
		let node: Renderable | undefined = element;
		node !== undefined && node !== null;
		node = node.ancestor as Renderable | undefined
	) {
		if (!node.isRenderable || node.alpha <= 0) {
			return false;
		}
	}
	return true;
}

/**
 * the elements that can take the focus now
 * @returns them, in no particular order
 */
function candidates(): UIBaseElement[] {
	return [...elements].filter((element) => {
		return isCandidate(element);
	});
}

/**
 * The first candidate in reading order, row by row, left to right; two
 * whose tops are within half a height are on the same row.
 * @returns the element, or undefined when there is none
 */
function first(): UIBaseElement | undefined {
	let best: UIBaseElement | undefined;
	for (const candidate of candidates()) {
		if (best === undefined) {
			best = candidate;
			continue;
		}
		const a = candidate.getBounds();
		const b = best.getBounds();
		const sameRow = Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;
		if (sameRow ? a.left < b.left : a.top < b.top) {
			best = candidate;
		}
	}
	return best;
}

/**
 * The nearest candidate in a direction, edge to edge, a step sideways
 * counting double, so a narrow widget right below a wide one beats a wide
 * one further down.
 * @param from - the focused element
 * @param direction - which way
 * @returns the next element, or undefined when there is none that way
 */
function next(
	from: UIBaseElement,
	direction: UINavAction,
): UIBaseElement | undefined {
	const [dx, dy] = DIRECTIONS[direction];
	const origin = from.getBounds();
	let best: UIBaseElement | undefined;
	let bestScore = Infinity;
	for (const candidate of candidates()) {
		if (candidate === from) {
			continue;
		}
		const bounds = candidate.getBounds();
		// past the focused one, centre to centre, that way
		const ahead =
			(bounds.centerX - origin.centerX) * dx +
			(bounds.centerY - origin.centerY) * dy;
		if (ahead <= 1) {
			continue;
		}
		const gap =
			dx !== 0
				? Math.max(
						0,
						dx > 0 ? bounds.left - origin.right : origin.left - bounds.right,
					)
				: Math.max(
						0,
						dy > 0 ? bounds.top - origin.bottom : origin.top - bounds.bottom,
					);
		const side =
			dx !== 0
				? Math.max(0, bounds.top - origin.bottom, origin.top - bounds.bottom)
				: Math.max(0, bounds.left - origin.right, origin.left - bounds.right);
		// the centres break a tie
		const score = gap + side * 2 + ahead * 0.01;
		if (score < bestScore) {
			bestScore = score;
			best = candidate;
		}
	}
	return best;
}

/**
 * scroll each scrolling panel holding an element to show it, with room for
 * the ring
 * @param element - the element
 */
function scrollIntoView(element: UIBaseElement): void {
	let child: Renderable = element;
	for (
		let node = element.ancestor as Renderable | undefined;
		node !== undefined && node !== null;
		node = node.ancestor as Renderable | undefined
	) {
		const panel = node as Renderable & {
			scroll?: string;
			scrollToChild?: (child: Renderable, margin?: number) => unknown;
		};
		if (
			panel.scroll !== undefined &&
			panel.scroll !== "none" &&
			typeof panel.scrollToChild === "function"
		) {
			panel.scrollToChild(child, 10);
		}
		child = node;
	}
}

/**
 * press accept on the focused element: it goes down, as under a pointer
 * @param source - the input pressing it, so only that one releases it
 */
function acceptDown(source: "key" | "pad"): void {
	ringShown = true;
	if (
		accepting === undefined &&
		owner !== undefined &&
		isCandidate(owner) &&
		owner.focusPress()
	) {
		accepting = source;
		pressed = owner;
	}
}

/**
 * release accept: the element comes up and acts, as on a click
 * @param source - the input letting it go
 */
function acceptUp(source: "key" | "pad"): void {
	if (accepting === source) {
		const element = pressed;
		accepting = undefined;
		pressed = undefined;
		element?.focusRelease();
	}
}

/**
 * a key down
 * @param _action - the action bound to it, unused
 * @param keyCode - the key
 */
function onKeyDown(_action: string | undefined, keyCode: number): void {
	if (isAcceptKey(keyCode)) {
		acceptDown("key");
		return;
	}
	for (const action of Object.keys(KEYS) as UINavAction[]) {
		if (KEYS[action] === keyCode) {
			navigate(action);
		}
	}
}

/**
 * a key up
 * @param _action - the action bound to it, unused
 * @param keyCode - the key
 */
function onKeyUp(_action: string | undefined, keyCode: number): void {
	if (isAcceptKey(keyCode)) {
		acceptUp("key");
	}
}

/** the mouse moved: the ring hides until the next key */
function onPointer(): void {
	ringShown = false;
}

/** read the D-pad direction and the A button, across every pad */
function readPad(): void {
	const B = GAMEPAD.BUTTONS;
	let held = "";
	let accept = false;
	for (const gamepad of readGamepads()) {
		if (gamepad === null) {
			continue;
		}
		const down = (code: number) => {
			return gamepad.buttons[code]?.pressed ?? false;
		};
		if (down(B.UP)) {
			held = "up";
		} else if (down(B.DOWN)) {
			held = "down";
		} else if (down(B.LEFT)) {
			held = "left";
		} else if (down(B.RIGHT)) {
			held = "right";
		}
		accept ||= down(B.FACE_1);
	}
	pad.held = held;
	pad.accept = accept;
}

/** once a frame: a D-pad press moves once, A presses and releases */
function onFrame(): void {
	const before = { held: pad.held, accept: pad.accept };
	readPad();
	if (pad.held !== "" && pad.held !== before.held) {
		navigate(pad.held as UINavAction);
	}
	if (pad.accept && !before.accept) {
		acceptDown("pad");
	} else if (!pad.accept && before.accept) {
		acceptUp("pad");
	}
}
