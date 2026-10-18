/**
 * melonJS — Jungle Rabbit: the asset manifest.
 *
 * The terrain, the river surface and every texture are still generated at
 * boot — what is loaded here is the authored geometry. Each model is a single
 * merged primitive sharing one palette-strip material, which is what lets a
 * whole scatter of them draw as one `InstancedMesh` call; the palette itself
 * is embedded in the files, so it has to stay in step with `props.ts`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { flare } from "./shaders/flare";
import { ripples } from "./shaders/ripples";

const base = `${import.meta.env.BASE_URL}assets/jungleRabbit/`;

export const resources = [
	/* The display face, baked to hard-edged BitmapText atlases.

	   Crang is an outline face with no pixel grid — measured, every size from
	   6 to 40 leaves 18% to 80% of its ink on partial alpha — so `Text` hands
	   back glyphs the browser has already anti-aliased, and the upscale to the
	   window magnifies each grey edge pixel into a grey block beside sprites
	   that stayed hard-edged. The atlases are two colours and nothing in
	   between, so they survive magnification the way every other
	   nearest-sampled texture here does.

	   Each size is baked AT that size and drawn at a ratio of 1. Doubling a
	   smaller atlas would halve the detail, and Crang's counters are the first
	   thing to go: the outline is dilated a pixel into every hole, which reads
	   as a rim at 30 but closes an "A" solid at 15.

	   `CrangHot` is the same geometry under the combo ramp, so it is a second
	   PAGE against the one descriptor rather than a second font. */
	{ name: "CrangTitle", type: "binary", src: `${base}font/CrangTitle.fnt` },
	{ name: "CrangTitle", type: "image", src: `${base}font/CrangTitle.png` },
	{ name: "Crang", type: "binary", src: `${base}font/Crang.fnt` },
	{ name: "Crang", type: "image", src: `${base}font/Crang.png` },
	{ name: "CrangHot", type: "image", src: `${base}font/CrangHot.png` },
	{ name: "CrangSmall", type: "binary", src: `${base}font/CrangSmall.fnt` },
	{ name: "CrangSmall", type: "image", src: `${base}font/CrangSmall.png` },

	/* The label ramp, as an inline shader asset rather than a hand-built
	   effect: a "shader" resource is compiled AT LOAD TIME and the loader owns
	   it as a shared instance, so the GLSL compile lands inside the loading
	   screen and every label can share the one program. */

	/* The river's travelling crests — a ShaderEffect hosted on the water
	   MESH, which needs the engine to splice it into the mesh shader. */
	{ name: "ripples", type: "shader", data: ripples },

	/* The sun's lens flare, hosted on a screen-filling quad rather than on the
	   camera, so it lands under the HUD instead of over it. */
	{ name: "flare", type: "shader", data: flare },

	/* Background music. `src` is a DIRECTORY for audio: the loader appends the
	   name plus each format given to `audio.init()`, and takes the first that
	   decodes. Credited on the title screen. */
	{ name: "jungle-theme", type: "audio", src: `${base}bgm/` },

	/* The rider — rabbit, hull and paddle as one rig, carrying a "paddle" clip. */
	{ name: "boat", type: "glb", src: `${base}boat.glb` },

	/* Bank planting, in layers: palms overhead, leaves and blooms at mid
	   height, ferns down at the waterline. */
	{ name: "palm", type: "glb", src: `${base}palm.glb` },
	{ name: "bigleaf", type: "glb", src: `${base}bigleaf.glb` },
	{ name: "fern", type: "glb", src: `${base}fern.glb` },
	{ name: "flower-red", type: "glb", src: `${base}flower-red.glb` },
	{ name: "flower-pink", type: "glb", src: `${base}flower-pink.glb` },

	/* In the channel: boulders to dodge, carrots to collect, leaves adrift. */
	{ name: "rock", type: "glb", src: `${base}rock.glb` },
	{ name: "log", type: "glb", src: `${base}log.glb` },
	{ name: "carrot", type: "glb", src: `${base}carrot.glb` },
	{ name: "leaf", type: "glb", src: `${base}leaf.glb` },

	/* Overhead: birds crossing the gorge. */
	{ name: "bird", type: "glb", src: `${base}bird.glb` },
];
