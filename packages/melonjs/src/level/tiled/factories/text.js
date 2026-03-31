import BitmapText from "../../../renderable/text/bitmaptext.js";
import Text from "../../../renderable/text/text.js";

/**
 * create a Text or BitmapText object from TMX settings
 * @param {object} settings - TMX object settings
 * @returns {Renderable} the created text object
 * @ignore
 */
export function createTextObject(settings) {
	if (typeof settings.text.anchorPoint === "undefined") {
		settings.text.anchorPoint = settings.anchorPoint;
	}
	const obj =
		settings.text.bitmap === true
			? new BitmapText(settings.x, settings.y, settings.text)
			: new Text(settings.x, settings.y, settings.text);
	obj.pos.z = settings.z;
	return obj;
}
