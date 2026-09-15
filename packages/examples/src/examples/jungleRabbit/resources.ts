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
import { flare } from "./flare";
import { ripples } from "./ripples";

const base = `${import.meta.env.BASE_URL}assets/jungleRabbit/`;

export const resources = [
	/* Font. */
	{ name: "Crang", type: "fontface", src: `${base}font/Crang.woff2` },

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
