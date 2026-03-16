import {
	BitmapText,
	Camera2d,
	Container,
	Entity,
	ImageLayer,
	plugin,
	Renderable,
	Text,
} from "melonjs";

/**
 * Monkey-patch melonJS rendering classes to draw debug overlays
 * (hitboxes, bounding boxes, velocity vectors) and collect stats.
 *
 * @param {import("./debugPanel").DebugPanel} panel - the debug panel instance
 */
export function applyPatches(panel) {
	// patch Renderable
	plugin.patch(Renderable, "postDraw", function (renderer) {
		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);

		if (this.image !== undefined) {
			panel.counters.inc("sprites");
		}
		panel.counters.inc("bounds");
		if (this instanceof Container) {
			panel.counters.inc("children");
		}

		// skip types that have their own dedicated patches
		if (
			!panel.visible ||
			!panel.options.hitbox ||
			this instanceof Entity ||
			this.ancestor instanceof Entity ||
			this instanceof Text ||
			this instanceof BitmapText ||
			this instanceof Camera2d ||
			this instanceof ImageLayer
		) {
			return;
		}

		const bounds = this.getBounds();
		if (!bounds.isFinite()) {
			return;
		}

		renderer.save();

		// undo ancestor world transform for non-floating renderables
		if (this.ancestor !== undefined && !this.floating) {
			const absPos = this.ancestor.getAbsolutePosition();
			renderer.translate(-absPos.x, -absPos.y);
		}

		// renderable bounding box (green)
		renderer.setColor("green");
		renderer.stroke(bounds);

		// sprite mask (orange)
		if (this.mask !== undefined) {
			renderer.setColor("orange");
			renderer.stroke(this.mask);
		}

		// body bounds and collision shapes
		if (this.body !== undefined) {
			renderer.translate(bounds.x, bounds.y);

			renderer.setColor("orange");
			renderer.stroke(this.body.getBounds());

			renderer.setColor("red");
			for (const shape of this.body.shapes) {
				renderer.stroke(shape);
				panel.counters.inc("shapes");
			}
		}

		renderer.restore();
	});

	// patch BitmapText
	plugin.patch(BitmapText, "draw", function (renderer) {
		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);

		if (!panel.visible || !panel.options.hitbox) {
			return;
		}

		const bounds = this.getBounds();

		renderer.save();

		// adjust for anchor point offset since bounds position is already anchored
		if (this.ancestor !== undefined) {
			renderer.translate(
				this.anchorPoint.x * bounds.width,
				this.anchorPoint.y * bounds.height,
			);
		}

		renderer.setColor("green");
		renderer.stroke(bounds);

		renderer.restore();
	});

	// patch Text
	plugin.patch(Text, "draw", function (renderer) {
		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);

		if (!panel.visible || !panel.options.hitbox) {
			return;
		}

		const bounds = this.getBounds();

		renderer.save();

		// undo ancestor world transform for floating text
		if (
			this.ancestor !== undefined &&
			!this.root &&
			!this.ancestor.root &&
			this.ancestor.isFloating
		) {
			const absPos = this.ancestor.getAbsolutePosition();
			renderer.translate(-absPos.x, -absPos.y);
		}

		renderer.setColor("green");
		renderer.stroke(bounds);

		renderer.restore();
	});

	// patch Entity
	plugin.patch(Entity, "postDraw", function (renderer) {
		if (panel.visible && panel.options.hitbox) {
			renderer.save();

			const bodyBounds = this.body.getBounds();

			// entity renderable bounding box (green) — drawn in entity's
			// preDraw local space where origin = entity anchor point
			if (this.renderable instanceof Renderable) {
				const r = this.renderable;
				renderer.setColor("green");
				renderer.strokeRect(
					-r.anchorPoint.x * r.width,
					-r.anchorPoint.y * r.height,
					r.width,
					r.height,
				);
			}

			// move from anchor point to body origin for body/collision overlays
			renderer.translate(
				-this.anchorPoint.x * bodyBounds.width,
				-this.anchorPoint.y * bodyBounds.height,
			);

			renderer.setColor("orange");
			renderer.stroke(bodyBounds);

			renderer.setColor("red");
			for (const shape of this.body.shapes) {
				renderer.stroke(shape);
				panel.counters.inc("shapes");
			}

			renderer.restore();
		}

		if (
			panel.visible &&
			panel.options.velocity &&
			(this.body.vel.x || this.body.vel.y)
		) {
			const bodyBounds = this.body.getBounds();
			const hWidth = bodyBounds.width / 2;
			const hHeight = bodyBounds.height / 2;

			renderer.save();
			renderer.lineWidth = 1;
			renderer.setColor("blue");
			renderer.translate(0, -hHeight);
			renderer.strokeLine(
				0,
				0,
				Math.trunc(this.body.vel.x * hWidth),
				Math.trunc(this.body.vel.y * hHeight),
			);
			panel.counters.inc("velocity");
			renderer.restore();
		}

		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);
	});
}
