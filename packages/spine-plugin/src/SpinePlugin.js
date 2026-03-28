import { plugin } from "melonjs";
import { name, version, dependencies, homepage, peerDependencies } from "../package.json";
import AssetManager from "./AssetManager";

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
        console.log(`${name} ${version} - spine runtime ${dependencies["@esotericsoftware/spine-core"]} | ${homepage}`);

        // instantiate the asset manager
        this.assetManager = new AssetManager(this.app.renderer);
    }
}
