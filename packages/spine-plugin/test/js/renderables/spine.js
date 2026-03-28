import * as me from 'melonjs';
import Spine from 'spinePlugin'

export default class SpineRenderable extends Spine {
	constructor(x, y, settings = {}){
		super(x, y, Object.assign(settings));

		// add a physic body
		this.body = new me.Body(this);
		this.body.addShape(me.pool.pull("me.Rect", 0, 0, this.width, this.height));
		this.body.gravityScale = 0;
		this.isKinematic = false;

		// rotate the object when clicking within the object bounds
		me.input.registerPointerEvent("pointerdown", this, () => {
			this.rotate(1.5707970000000002);
		});

		// set true to enable the debug mode when rendering the spine object
		this.skeletonRenderer.debugRendering = false;
	}

	update(dt) {
		// call the parent update method
		super.update(dt);

		// update the body size to match with the spine object bounds
		if (this.body) {
			let bounds = this.getBounds();
			let w = bounds.width;
			let h = bounds.height;
			this.body.setVertices([
				{x: 0, y: 0}, // 0, 0
				{x: w, y: 0}, // 1, 0
				{x: w, y: h}, // 1, 1
				{x: 0, y: h}, // 0, 1
			]);
		}
		
		return true;
	}
};
