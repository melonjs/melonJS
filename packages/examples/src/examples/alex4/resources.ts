/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { LEVELS } from "./constants";

const base = `${import.meta.env.BASE_URL}assets/alex4/`;

const image = (name: string, dir = "img") => ({
	name,
	type: "image",
	src: `${base}${dir}/${name}.png`,
});
const sfx = (name: string) => ({ name, type: "audio", src: `${base}sfx/` });
const bgm = (name: string) => ({ name, type: "audio", src: `${base}bgm/` });

export const resources = [
	// sprites, converted from the original game data
	image("sprites"),
	{ name: "sprites", type: "json", src: `${base}img/sprites.json` },

	// parallax backgrounds & HUD, from Alex4 Web Edition
	image("layer1"),
	image("layer2"),
	image("layer3"),
	image("hud_egg"),
	image("hud_heart"),
	image("hud_life"),
	image("menu_title"),
	image("menu_arrow"),
	image("lets_go_msg"),
	image("gameover"),
	image("levelcomplete"),

	// the treetops of the cut scenes, from the original game
	image("treetops"),

	// tilesets
	image("a4_tileset", "map"),
	image("a4_tiles", "map"),
	image("a4_water", "map"),

	// particles
	image("dust"),

	// bitmap fonts
	image("atascii32", "fnt"),
	{ name: "atascii32", type: "binary", src: `${base}fnt/atascii32.fnt` },
	image("atascii40", "fnt"),
	{ name: "atascii40", type: "binary", src: `${base}fnt/atascii40.fnt` },

	// levels
	...LEVELS.map((name) => ({
		name,
		type: "tmx",
		src: `${base}map/${name}.tmx`,
	})),
	{ name: "a4_intro", type: "tmx", src: `${base}map/a4_intro.tmx` },
	{ name: "a4_outro", type: "tmx", src: `${base}map/a4_outro.tmx` },

	// sound effects
	...[
		"startup",
		"menu",
		"jump",
		"cherry",
		"xtralife",
		"heart",
		"star",
		"eat",
		"stomp",
		"hurt",
		"die",
		"turn",
		"impact",
		"point",
		"crush",
		"hit",
		"kill",
		"spit",
		"shoot",
		"engine",
		"ship",
		"energy",
		"chopper",
		"talk",
	].map(sfx),

	// music
	...[
		"menu_song",
		"level_start",
		"level_song",
		"boss_start",
		"boss_song",
		"game_over",
		"level_done",
		"player_dies",
		// from the original game
		"intro_song",
		"outro_song",
	].map(bgm),
];
