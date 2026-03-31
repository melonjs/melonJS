import { plugin, registerTiledObjectClass } from "melonjs";
import {
	dependencies,
	homepage,
	name,
	peerDependencies,
	version,
} from "../package.json";
import AssetManager from "./AssetManager";
import Spine from "./Spine.js";

/**
 * @classdesc
 * a Spine 4.x plugin implementation for melonJS
 * @augments plugin.BasePlugin
 */
export class SpinePlugin extends plugin.BasePlugin {
	constructor() {
		// call the super constructor
		super();

		// minimum melonJS version expected to run this plugin
		this.version = peerDependencies["melonjs"];

		// hello world
		console.log(
			`${name} ${version} - spine runtime ${dependencies["@esotericsoftware/spine-core"]} | ${homepage}`,
		);

		// instantiate the asset manager
		this.assetManager = new AssetManager(this.app.renderer);

		// register Spine as a Tiled object class
		// (set the object class to "Spine" in Tiled)
		registerTiledObjectClass("Spine", Spine);
	}
}
