import { utils, loader } from "melonjs";
import * as spineWebGL from "@esotericsoftware/spine-webgl";
import * as spineCanvas from "@esotericsoftware/spine-canvas";

/**
 * @classdesc
 * An Asset Manager class to load spine assets
 */
export default class AssetManager {
    asset_manager;
    pathPrefix;

    /**
     * @param {CanvasRenderer|WebGLRenderer} renderer - a melonJS renderer instance
     * @param {string} [pathPrefix=""] - a default path prefix for assets location
     */
    constructor(renderer, pathPrefix = "") {
        this.pathPrefix = pathPrefix;
        if (renderer.WebGLVersion >= 1) {
            this.asset_manager = new spineWebGL.AssetManager(renderer.getContext(), this.pathPrefix);
        } else {
            // canvas renderer
            this.asset_manager = new spineCanvas.AssetManager(this.pathPrefix);
        }

        // set the spine custom parser
        loader.setParser("spine", (data, onload, onerror) => {
            // decompose data.src for the spine loader
            const ext = utils.file.getExtension(data.src);
            const basename = utils.file.getBasename(data.src);
            const path = utils.file.getPath(data.src);
            const filename = basename + "." + ext;

            this.setPrefix(path);

            // load asset
            switch (ext) {
                case "atlas":
                    this.loadTextureAtlas(filename, onload, onerror);
                    break;
                case "json":
                    this.loadText(filename, onload, onerror);
                    break;
                case "skel":
                    this.loadBinary(filename, onload, onerror);
                    break;
                default:
                    throw "Spine plugin: unknown extension when preloading spine assets";
            }

            return 1;
        });

    }

    /**
     * set a default path prefix for assets location
     * @see loadAsset
     * @param {string} pathPrefix
     */
    setPrefix(pathPrefix) {
        this.asset_manager.pathPrefix =  this.pathPrefix = pathPrefix;
    }

    /**
     * define all spine assets to be loaded
     * @see setPrefix
     * @see loadAll
     * @param {string} atlas
     * @param {string} skel
     * @example
     * // "manually" load spine assets
     * Spine.assetManager.setPrefix("data/spine/");
     * Spine.assetManager.loadAsset("alien.atlas", "alien-ess.json");
     * await Spine.assetManager.loadAll();
     */
    loadAsset(atlas, skel) {
        if (atlas) {
            this.loadTextureAtlas(atlas);
        }

        if (skel.endsWith(".skel")) {
            this.loadBinary(skel);
        } else {
            this.loadText(skel);
        }
    }

    /**
     * load the given texture atlas
     * @param {string} atlas
     */
    loadTextureAtlas(atlas, onload, onerror) {
        return this.asset_manager.loadTextureAtlas(atlas, onload, onerror);
    }


    /**
     * load the given skeleton .skel file
     * @param {string} skel
     */
    loadBinary(skel, onload, onerror) {
        return this.asset_manager.loadBinary(skel, onload, onerror);
    }

    /**
     * load the given skeleton binary file
     * @param {string} skel
     */
    loadText(skel, onload, onerror) {
        return this.asset_manager.loadText(skel, onload, onerror);
    }

    /**
     * load all defined spine assets
     * @see loadAsset
     */
    loadAll() {
        return this.asset_manager.loadAll();
    }

    /**
     * get the loaded skeleton data
     * @param {string} path
     */
    require(path) {
        return this.asset_manager.require(path);
    }
}
