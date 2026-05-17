import {
	BitmapText,
	Bounds,
	Camera2d,
	Container,
	Entity,
	game,
	ImageLayer,
	plugin,
	Renderable,
	Text,
	Vector2d,
} from "melonjs";

/**
 * Shared scratch `Bounds` for `adapter.getBodyAABB()` and `Vector2d`
 * for `adapter.getVelocity()`. Both adapter methods take an `out`
 * parameter so the debug plugin can poll every frame without
 * allocating — across many renderables a single reused scratch is
 * fine because we draw immediately after the call and never hand the
 * reference outside the patch.
 */
const sharedBodyAABB = new Bounds();
const sharedBodyVel = new Vector2d();

/**
 * Stroke the orange body AABB and the red collision shapes for the
 * given renderable. Caller is responsible for positioning the renderer
 * at the body's local-coordinate origin (i.e. the renderable origin
 * for general renderables, or the anchor-shifted body origin for
 * entities). Used by both the Renderable and Entity patches.
 * @param {*} renderer
 * @param {import("./index").DebugPanelPlugin} panel
 * @param {import("melonjs").PhysicsAdapter} adapter
 * @param {import("melonjs").default.Renderable} renderable
 * @param {Bounds} aabb
 */
function strokeBodyHitbox(renderer, panel, adapter, renderable, aabb) {
	renderer.setColor("orange");
	renderer.stroke(aabb);
	renderer.setColor("red");
	for (const shape of adapter.getBodyShapes(renderable)) {
		renderer.stroke(shape);
		panel.counters.inc("shapes");
	}
}

/**
 * Stroke a blue velocity arrow from `(originX, originY)` along the
 * body's current velocity vector. Scales by `(hW, hH)` so the arrow
 * length is visually proportional to the body's size regardless of
 * scale. Skips the draw entirely (and the counter increment) when
 * the body is at rest. Used by both the Renderable and Entity patches.
 * @param {*} renderer
 * @param {import("./index").DebugPanelPlugin} panel
 * @param {import("melonjs").PhysicsAdapter} adapter
 * @param {import("melonjs").default.Renderable} renderable
 * @param {number} originX
 * @param {number} originY
 * @param {number} hW
 * @param {number} hH
 */
function strokeBodyVelocity(
	renderer,
	panel,
	adapter,
	renderable,
	originX,
	originY,
	hW,
	hH,
) {
	const v = adapter.getVelocity(renderable, sharedBodyVel);
	if (v.x === 0 && v.y === 0) {
		return;
	}
	renderer.save();
	renderer.lineWidth = 1;
	renderer.setColor("blue");
	renderer.translate(originX, originY);
	renderer.strokeLine(0, 0, Math.trunc(v.x * hW), Math.trunc(v.y * hH));
	panel.counters.inc("velocity");
	renderer.restore();
}

/**
 * Monkey-patch melonJS rendering classes to draw debug overlays
 * (hitboxes, bounding boxes, velocity vectors) and collect stats.
 *
 * @param {import("./index").DebugPanelPlugin} panel - the debug panel instance
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
		// `draws` mirrors what `Container.draw` does — count renderables
		// that got past the world's viewport/floating gate, since postDraw
		// only fires for children the world actually draws.
		if (this.ancestor === game.world) {
			panel.counters.inc("draws");
		}

		// skip types that have their own dedicated patches, or when no
		// overlay is enabled (hitbox AND velocity both off ⇒ nothing
		// would be drawn). Note that hitbox and velocity are now
		// independent flags — flipping just velocity on will draw the
		// blue arrow without any other overlays. The panel's *visible*
		// state is NOT consulted: enabled overlays keep rendering even
		// when the user closes the panel window, so the panel is a
		// configuration UI rather than a master "everything off" switch.
		if (
			(!panel.options.hitbox && !panel.options.velocity) ||
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

		if (panel.options.hitbox) {
			// renderable bounding box (green)
			renderer.setColor("green");
			renderer.stroke(bounds);
			// sprite mask (orange)
			if (this.mask !== undefined) {
				renderer.setColor("orange");
				renderer.stroke(this.mask);
			}
		}

		// body bounds, collision shapes, and velocity — go through the
		// active physics adapter rather than reading `this.body.*`
		// directly. `getBodyAABB` and `getBodyShapes` are required on
		// the adapter contract and return geometry in renderable-local
		// coordinates regardless of which engine is driving it (builtin
		// SAT, matter, future ports), so this drawing code stays
		// adapter-agnostic.
		const adapter = this.parentApp?.world.adapter;
		if (this.body !== undefined && adapter !== undefined) {
			// Translate to the renderable's `pos` in world space, not to
			// `bounds.x/y`. The two only agree when anchorPoint is (0, 0):
			// `bounds.x = pos.x + ancestor.absPos.x - anchor.x * width`,
			// whereas the adapter returns the body's AABB in coords local
			// to `renderable.pos` (so we must offset by `pos`, not by the
			// anchored bounds origin). Using `bounds` here mis-drew the
			// hitbox by `-anchor * size` for any renderable with a non-zero
			// anchor (e.g., default-anchored 0.5/0.5 statics like a pool
			// table's invisible rails and pocket sensors).
			const absPos = this.getAbsolutePosition();
			renderer.translate(absPos.x, absPos.y);

			const aabb = adapter.getBodyAABB(this, sharedBodyAABB);
			if (aabb !== undefined) {
				if (panel.options.hitbox) {
					strokeBodyHitbox(renderer, panel, adapter, this, aabb);
				}
				if (panel.options.velocity) {
					const hW = aabb.width / 2;
					const hH = aabb.height / 2;
					strokeBodyVelocity(
						renderer,
						panel,
						adapter,
						this,
						aabb.x + hW,
						aabb.y + hH,
						hW,
						hH,
					);
				}
			}
		}

		renderer.restore();
	});

	// patch BitmapText
	plugin.patch(BitmapText, "draw", function (renderer) {
		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);

		if (!panel.options.hitbox) {
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

		if (!panel.options.hitbox) {
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

	// patch Entity — same adapter-API usage as the Renderable patch, but
	// with the anchor-point-aware translation Entity needs (its
	// renderable + body share an anchor point relative to which both
	// the green renderable box and the orange/red body overlays are
	// drawn).
	plugin.patch(Entity, "postDraw", function (renderer) {
		const adapter = this.parentApp?.world.adapter;
		if (adapter !== undefined) {
			const aabb = adapter.getBodyAABB(this, sharedBodyAABB);

			if (panel.options.hitbox && aabb !== undefined) {
				renderer.save();

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
					-this.anchorPoint.x * aabb.width,
					-this.anchorPoint.y * aabb.height,
				);

				strokeBodyHitbox(renderer, panel, adapter, this, aabb);
				renderer.restore();
			}

			if (panel.options.velocity && aabb !== undefined) {
				const hW = aabb.width / 2;
				const hH = aabb.height / 2;
				strokeBodyVelocity(renderer, panel, adapter, this, 0, -hH, hW, hH);
			}
		}

		// biome-ignore lint/complexity/noArguments: needed to forward all arguments to patched method
		this._patched.apply(this, arguments);
	});
}
