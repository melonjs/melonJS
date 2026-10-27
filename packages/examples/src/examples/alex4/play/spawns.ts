/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Container,
	Renderable,
	registerTiledObjectFactory,
} from "melonjs";

/** a Tiled object as read from the map, with its custom properties */
export type Spawn = {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	facing?: string;
	direction?: string;
	surface?: number;
};

/** the object names used in the Alex4 maps */
const NAMES = [
	"player",
	"cherry",
	"star",
	"heart",
	"oneup",
	"egg",
	"lola",
	"spin",
	"water",
	"spike",
	"exit",
	"letsgo",
	"enemy1",
	"enemy2",
	"crusher",
	"spikefish",
	"jellyfish",
	"cannon",
	"boss1",
	"boss2",
];

/** objects read from the level being loaded */
const spawns: Spawn[] = [];
const markers: Renderable[] = [];

/**
 * The play field drives every actor itself (see field.ts), so the map objects
 * are only spawn points: each one is recorded and stands in the world as an
 * empty marker until the level is loaded.
 */
export function registerSpawns() {
	for (const name of NAMES) {
		registerTiledObjectFactory(name, (settings: Spawn) => {
			spawns.push({ ...settings });
			const marker = new Renderable(0, 0, 1, 1);
			markers.push(marker);
			return marker;
		});
	}
}

/** hand over the objects of the level that just loaded, and clear the markers */
export function takeSpawns(world: Container) {
	for (const m of markers) {
		const parent = m.ancestor as Container | undefined;
		if (parent?.hasChild(m)) {
			parent.removeChildNow(m);
		} else if (world.hasChild(m)) {
			world.removeChildNow(m);
		}
	}
	markers.length = 0;
	const list = spawns.slice();
	spawns.length = 0;
	return list;
}

/** forget anything left from an aborted level load */
export function resetSpawns() {
	spawns.length = 0;
	markers.length = 0;
}
