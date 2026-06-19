import {
	BitmapText,
	Bounds,
	Camera2d,
	Camera3d,
	Container,
	Entity,
	game,
	ImageLayer,
	Matrix3d,
	Mesh,
	plugin,
	Renderable,
	Text,
	Vector2d,
	Vector3d,
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

// Scratch for the Mesh 3D bounding-box wireframe overlay. The 8 box corners
// (world space) and their projected screen positions are reused every frame;
// the two matrices save/restore the perspective projection around the
// screen-space line pass. Single-instance is safe — drawing is synchronous.
const _meshCorners = Array.from({ length: 8 }, () => {
	return new Vector3d();
});
const _meshScreen = Array.from({ length: 8 }, () => {
	return new Vector2d();
});
const _meshSavedProj = new Matrix3d();
const _meshScreenProj = new Matrix3d();
// the 12 edges of a box, indexing the 8 corners laid out by
// `strokeMeshWireframe`: near face (z=min) 0-3, far face (z=max) 4-7.
const BOX_EDGES = [
	[0, 1],
	[1, 2],
	[2, 3],
	[3, 0], // near face
	[4, 5],
	[5, 6],
	[6, 7],
	[7, 4], // far face
	[0, 4],
	[1, 5],
	[2, 6],
	[3, 7], // connecting edges
];

/**
 * Draw a {@link Mesh}'s world-space 3D bounding box as a green wireframe
 * under a `Camera3d`. The 8 corners of `mesh.getBounds3d()` are projected to
 * screen via `camera.worldToScreen`, then the 12 edges are stroked in a
 * screen-space pass (identity transform + a screen-ortho projection) so the
 * lines land exactly where the perspective-projected mesh is drawn.
 *
 * This replaces the flat 2D `getBounds()` rectangle the generic overlay would
 * draw, which cannot describe a 3D mesh's extent.
 * @param {*} renderer
 * @param {import("./index").DebugPanelPlugin} panel
 * @param {import("melonjs").Mesh} mesh
 * @param {import("melonjs").Camera3d} camera
 */
function strokeMeshWireframe(renderer, panel, mesh, camera) {
	const box = mesh.getBounds3d();
	if (!box.isFinite()) {
		return;
	}
	const min = box.min;
	const max = box.max;
	// near face (z = min): 0..3, far face (z = max): 4..7
	_meshCorners[0].set(min.x, min.y, min.z);
	_meshCorners[1].set(max.x, min.y, min.z);
	_meshCorners[2].set(max.x, max.y, min.z);
	_meshCorners[3].set(min.x, max.y, min.z);
	_meshCorners[4].set(min.x, min.y, max.z);
	_meshCorners[5].set(max.x, min.y, max.z);
	_meshCorners[6].set(max.x, max.y, max.z);
	_meshCorners[7].set(min.x, max.y, max.z);
	for (let i = 0; i < 8; i++) {
		// worldToScreen returns null for a corner at/behind the camera —
		// projecting it would mirror the point and draw edges shooting across
		// the screen, so skip the whole box when the mesh straddles the camera.
		if (camera.worldToScreen(_meshCorners[i], _meshScreen[i]) === null) {
			return;
		}
	}

	// stroke the edges in screen space: drop the camera view transform and
	// swap the perspective projection for a screen ortho, so the already-
	// projected pixel coordinates draw 1:1. The projection isn't part of the
	// save/restore stack, so it's saved/restored explicitly (same pattern as
	// the renderer's own blit path).
	renderer.save();
	_meshSavedProj.copy(renderer.projectionMatrix);
	renderer.currentTransform.identity();
	_meshScreenProj.ortho(0, camera.width, camera.height, 0, -1, 1);
	renderer.setProjection(_meshScreenProj);
	renderer.setColor("green");
	renderer.lineWidth = 1;
	for (const [a, b] of BOX_EDGES) {
		renderer.strokeLine(
			_meshScreen[a].x,
			_meshScreen[a].y,
			_meshScreen[b].x,
			_meshScreen[b].y,
		);
	}
	// flush the lines under the screen projection before restoring the
	// perspective projection, or they'd be re-projected on the next flush.
	renderer.flush();
	renderer.setProjection(_meshSavedProj);
	renderer.restore();
	panel.counters.inc("shapes");
}

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

		// Mesh under a Camera3d: draw the proper 3D bounding-box wireframe
		// instead of the flat, oversized 2D getBounds() box (which can't
		// describe 3D geometry). Under a Camera2d a mesh self-projects to 2D,
		// so it falls through to the generic box below.
		if (this instanceof Mesh && panel.options.hitbox) {
			const cam = this.parentApp?.viewport ?? game.viewport;
			if (cam instanceof Camera3d) {
				strokeMeshWireframe(renderer, panel, this, cam);
				return;
			}
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
