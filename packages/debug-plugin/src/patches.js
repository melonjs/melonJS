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
const _bodyMin = new Vector3d();
const _bodyMax = new Vector3d();
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
	strokeBoxWireframe(renderer, panel, camera, box.min, box.max, "green");
}

/**
 * Stroke an axis-aligned world-space box as a wireframe, in SCREEN space.
 *
 * Under a `Camera3d` the renderer is mid-perspective-projection, so the flat
 * `renderer.stroke(shape)` the 2D overlay uses draws nothing meaningful — the
 * box has to be projected corner by corner and stroked against a screen ortho.
 * That is why a 3D scene's debug overlay cannot simply reuse the 2D path.
 * @param {*} renderer
 * @param {import("./index").DebugPanelPlugin} panel
 * @param {Camera3d} camera
 * @param {Vector3d} min - world-space minimum corner
 * @param {Vector3d} max - world-space maximum corner
 * @param {string} color
 */
function strokeBoxWireframe(renderer, panel, camera, min, max, color) {
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
	renderer.setColor(color);
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
 * Stroke a renderable's collision shapes as 3D wireframes, for a scene under a
 * `Camera3d`.
 *
 * The 2D overlay strokes `shape` directly, which a perspective projection
 * turns into nothing viewable — and a `Box3d` has a DEPTH the flat path could
 * not show even if it drew. Shapes come from the adapter in renderable-local
 * coordinates, so world space is the renderable's absolute position plus the
 * shape's own offset.
 *
 * A 2D shape in a 3D scene is drawn as a flat box at the renderable's depth,
 * which is what it collides as.
 * @param {*} renderer
 * @param {import("./index").DebugPanelPlugin} panel
 * @param {import("melonjs").PhysicsAdapter} adapter
 * @param {import("melonjs").default.Renderable} renderable
 * @param {Camera3d} camera
 */
function strokeBodyShapes3d(renderer, panel, adapter, renderable, camera) {
	const origin = renderable.getAbsolutePosition();
	// `getAbsolutePosition()` only carries z from melonJS 20.2; before that it
	// was 2D, and reading `.z` off it would project the whole box to NaN. The
	// renderable's own depth is the same value for anything not nested under a
	// depth-shifted ancestor, which is the overlay's common case.
	const originZ = origin.z ?? renderable.depth ?? 0;
	for (const shape of adapter.getBodyShapes(renderable)) {
		if (shape.type === "Box3d") {
			const half = shape.halfExtents;
			_bodyMin.set(
				origin.x + shape.pos.x - half.x,
				origin.y + shape.pos.y - half.y,
				originZ + shape.pos.z - half.z,
			);
			_bodyMax.set(
				origin.x + shape.pos.x + half.x,
				origin.y + shape.pos.y + half.y,
				originZ + shape.pos.z + half.z,
			);
		} else {
			// flat: its footprint, sitting at the renderable's own depth
			const box = shape.getBounds();
			_bodyMin.set(origin.x + box.left, origin.y + box.top, originZ);
			_bodyMax.set(
				origin.x + box.left + box.width,
				origin.y + box.top + box.height,
				originZ,
			);
		}
		strokeBoxWireframe(renderer, panel, camera, _bodyMin, _bodyMax, "red");
	}
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
		if (shape.type === "Box3d") {
			// `Renderer#stroke` only learned this shape in melonJS 20.5, and
			// threw `Invalid geometry` before that. The plugin supports older
			// engines, so it draws the XY footprint itself rather than making
			// the overlay depend on which engine is underneath.
			const footprint = shape.getBounds();
			renderer.strokeRect(
				footprint.left,
				footprint.top,
				footprint.width,
				footprint.height,
			);
		} else {
			renderer.stroke(shape);
		}
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

		// Under a Camera3d the renderer is mid-perspective-projection, so the
		// flat 2D overlay below draws nothing viewable — every box has to be
		// projected corner by corner and stroked against a screen ortho. That
		// applies to the BODY as much as to the geometry: a `GLTFModel` is a
		// Container, not a Mesh, so it used to fall through to the 2D path and
		// render nothing at all, and a mesh returned after its green geometry
		// box without ever drawing the collision shapes.
		//
		// Under a Camera2d a mesh self-projects to 2D, so it still falls
		// through to the generic box below.
		if (panel.options.hitbox) {
			const cam = this.parentApp?.viewport ?? game.viewport;
			if (cam instanceof Camera3d) {
				// green: the mesh's own geometry box
				if (this instanceof Mesh) {
					strokeMeshWireframe(renderer, panel, this, cam);
				}
				// red: what it actually collides as
				const adapter3d = this.parentApp?.world.adapter;
				if (this.body !== undefined && adapter3d !== undefined) {
					strokeBodyShapes3d(renderer, panel, adapter3d, this, cam);
				}
				if (this instanceof Mesh || this.body !== undefined) {
					return;
				}
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
