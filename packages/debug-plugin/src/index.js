import { event, input, plugin, utils } from "melonjs";
import { homepage, name, version } from "../package.json";
import { DebugPanel } from "./debugPanel.js";

/**
 * @classdesc
 * a simple debug panel plugin <br>
 * <img src="images/debugPanel.png"/> <br>
 * <b>usage : </b><br>
 * &bull; upon loading the debug panel, it will be automatically registered under me.plugins.debugPanel <br>
 * &bull; you can then press the default "s" key to show or hide the panel, or use me.plugins.debugPanel.show() and me.plugins.debugPanel.show(), or add #debug as a parameter to your URL e.g. http://myURL/index.html#debug <br>
 * &bull; default key can be configured using the following parameters in the url : e.g. http://myURL/index.html#debugToggleKey=d <br>
 * <b>the debug panel provides the following information : </b><br>
 * &bull; amount of total objects currently active in the current stage <br>
 * &bull; amount of draws operation <br>
 * &bull; amount of body shape (for collision) <br>
 * &bull; amount of bounding box <br>
 * &bull; amount of sprites objects <br>
 * &bull; amount of objects currently inactive in the the object pool <br>
 * &bull; memory usage (Heap Memory information is only available under Chrome) <br>
 * &bull; frame update time (in ms) <br>
 * &bull; frame draw time (in ms) <br>
 * &bull; current fps rate vs target fps <br>
 * additionally, using the checkbox in the panel it is also possible to display : <br>
 * &bull; the hitbox or bounding box for all objects <br>
 * &bull; current velocity vector <br>
 * &bull; quadtree spatial visualization <br>
 * @augments plugin.BasePlugin
 */
export class DebugPanelPlugin extends plugin.BasePlugin {
	/**
	 * @param {number} [debugToggle=input.KEY.S] - a default key to toggle the debug panel visibility state
	 * @see input.KEY for default key options
	 */
	constructor(debugToggle = input.KEY.S) {
		// call the super constructor
		super();

		// minimum melonJS version expected
		this.version = "15.12.0";

		// hello world
		console.log(`${name} ${version} | ${homepage}`);

		this.debugToggle = debugToggle;

		this.panel = new DebugPanel(debugToggle);

		this.keyHandler = event.on(event.KEYDOWN, (action, keyCode) => {
			if (keyCode === this.debugToggle) {
				this.toggle();
			}
		});

		// if "#debug" is present in the URL
		if (utils.getUriFragment().debug === true) {
			this.show();
		} // else keep it hidden
	}

	/**
	 * show the debug panel
	 */
	show() {
		this.panel.show();
	}

	/**
	 * hide the debug panel
	 */
	hide() {
		this.panel.hide();
	}

	/**
	 * toggle the debug panel visibility state
	 */
	toggle() {
		if (this.panel.visible) {
			this.panel.hide();
		} else {
			this.panel.show();
		}
	}
}
