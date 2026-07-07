import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Mesh,
	Sprite3d,
	Vector2d,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * Sprite3d billboard math — exercised directly through the world-space
 * projection (`_projectVerticesWorld`) and the `Camera3d` orientation basis, so
 * no WebGL / rendering is needed. The visual example validates the on-screen
 * result; these pin the sign-sensitive geometry.
 */

describe("Camera3d.getBasis", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	const r = new Vector3d();
	const u = new Vector3d();
	const f = new Vector3d();

	it("yaw=0, pitch=0 → identity basis (forward = +Z)", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		cam.yaw = 0;
		cam.pitch = 0;
		cam.getBasis(r, u, f);
		expect(r.x).toBeCloseTo(1, 5);
		expect(u.y).toBeCloseTo(1, 5);
		expect(f.z).toBeCloseTo(1, 5);
	});

	it("basis stays orthonormal for arbitrary yaw/pitch", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		cam.yaw = 0.7;
		cam.pitch = -0.4;
		cam.getBasis(r, u, f);
		// unit length
		expect(r.length()).toBeCloseTo(1, 5);
		expect(u.length()).toBeCloseTo(1, 5);
		expect(f.length()).toBeCloseTo(1, 5);
		// mutually orthogonal
		expect(r.x * u.x + r.y * u.y + r.z * u.z).toBeCloseTo(0, 5);
		expect(r.x * f.x + r.y * f.y + r.z * f.z).toBeCloseTo(0, 5);
		expect(u.x * f.x + u.y * f.y + u.z * f.z).toBeCloseTo(0, 5);
	});

	it("yaw swings the forward axis through the XZ plane (pitch 0)", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		cam.pitch = 0;
		cam.yaw = 0.9;
		cam.getForward(f);
		expect(f.y).toBeCloseTo(0, 5); // no vertical component at zero pitch
		expect(f.x !== 0).toBe(true); // yaw introduced a horizontal component
	});
});

describe("Sprite3d billboard projection", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	const makeTex = () => {
		const c = document.createElement("canvas");
		c.width = 4;
		c.height = 4;
		c.getContext("2d").fillRect(0, 0, 4, 4);
		return c;
	};

	// normal of the projected quad (corners 0,1,3) — should face the camera
	const quadNormal = (v) => {
		const e1 = new Vector3d(
			v[3] - v[0],
			v[4] - v[1],
			v[5] - v[2], // corner1 - corner0
		);
		const e2 = new Vector3d(
			v[9] - v[0],
			v[10] - v[1],
			v[11] - v[2], // corner3 - corner0
		);
		return e1.cross(e2).normalize();
	};

	it("spherical: the quad normal is parallel to the camera forward axis", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		const f = new Vector3d();
		const s = new Sprite3d(100, 50, {
			image: makeTex(),
			width: 20,
			height: 30,
			z: -200,
			billboard: "spherical",
		});
		for (const [yaw, pitch] of [
			[0, 0],
			[0.8, -0.3],
			[-1.2, 0.6],
		]) {
			cam.yaw = yaw;
			cam.pitch = pitch;
			s._billboardCam = cam;
			s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
			const n = quadNormal(s.vertices);
			cam.getForward(f);
			const dot = n.x * f.x + n.y * f.y + n.z * f.z;
			// facing the camera ⇒ normal parallel to forward (|dot| ≈ 1)
			expect(Math.abs(dot)).toBeCloseTo(1, 4);
		}
	});

	it("cylindrical: stays upright — the vertical edge is purely world-up", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		cam.yaw = 1.0;
		cam.pitch = -0.5; // pitched camera must NOT tilt a cylindrical billboard
		const s = new Sprite3d(0, 0, {
			image: makeTex(),
			width: 20,
			height: 30,
			z: -100,
			billboard: "cylindrical",
		});
		s._billboardCam = cam;
		s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
		const v = s.vertices;
		// corner3 - corner0 share the same local x (-hw), differ in local y →
		// the edge must be vertical (no x/z component) regardless of camera pitch
		const dx = v[9] - v[0];
		const dy = v[10] - v[1];
		const dz = v[11] - v[2];
		expect(dx).toBeCloseTo(0, 4);
		expect(dz).toBeCloseTo(0, 4);
		expect(Math.abs(dy)).toBeCloseTo(30, 4); // == height
	});

	// project the quad's 4 corners to screen pixels and check the texture lands
	// upright and unmirrored — the deterministic equivalent of "look at it".
	// corner uvs (see Sprite3d): 0=(left,bottom) 1=(right,bottom) 2=(right,top)
	// 3=(left,top). screen y grows downward, so "top above" = smaller y.
	const screenCorners = (sprite, cam) => {
		sprite._billboardCam = cam;
		sprite._projectVerticesWorld(sprite.pos.x, sprite.pos.y, sprite.depth);
		const v = sprite.vertices;
		const out = [];
		for (let i = 0; i < 4; i++) {
			const s = cam.worldToScreen(
				new Vector3d(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]),
				new Vector2d(),
			);
			out.push(s);
		}
		return out; // [bl, br, tr, tl] by uv
	};

	const facingCam = (z) => {
		const cam = new Camera3d(0, 0, 1024, 768);
		cam.pos.set(0, -130, z);
		cam.lookAt(0, -130, 0);
		return cam;
	};

	for (const mode of ["spherical", "cylindrical"]) {
		it(`${mode}: renders upright and unmirrored on screen (head-on)`, () => {
			const cam = facingCam(600);
			const s = new Sprite3d(0, -130, {
				image: makeTex(),
				width: 150,
				height: 225,
				z: 0,
				billboard: mode,
			});
			const [bl, br, tr, tl] = screenCorners(s, cam);
			// texture top (tl/tr) above bottom (bl/br): smaller screen y
			expect(tl.y).toBeLessThan(bl.y);
			expect(tr.y).toBeLessThan(br.y);
			// texture left (bl/tl) left of right (br/tr): smaller screen x
			expect(bl.x).toBeLessThan(br.x);
			expect(tl.x).toBeLessThan(tr.x);
		});

		it(`${mode}: stays upright and unmirrored when the camera orbits`, () => {
			// camera off to the side, still looking at the sprite
			const cam = new Camera3d(0, 0, 1024, 768);
			cam.pos.set(450, -260, 430);
			cam.lookAt(0, -130, 0);
			const s = new Sprite3d(0, -130, {
				image: makeTex(),
				width: 150,
				height: 225,
				z: 0,
				billboard: mode,
			});
			const [bl, br, tr, tl] = screenCorners(s, cam);
			expect(tl.y).toBeLessThan(bl.y);
			expect(tr.y).toBeLessThan(br.y);
			expect(bl.x).toBeLessThan(br.x);
			expect(tl.x).toBeLessThan(tr.x);
		});
	}

	it("animates frames by remapping the quad UVs (spritesheet)", () => {
		// a 64×32 sheet = two 32×32 frames side by side
		const sheet = document.createElement("canvas");
		sheet.width = 64;
		sheet.height = 32;
		sheet.getContext("2d").fillRect(0, 0, 64, 32);
		const s = new Sprite3d(0, 0, {
			image: sheet,
			framewidth: 32,
			frameheight: 32,
			width: 48,
			height: 48,
			z: 0,
		});
		s.addAnimation("spin", [0, 1], 100);
		s.setCurrentAnimation("spin");

		// frame 0 → left half of the sheet: u in [0, 0.5]
		const uv0 = Array.from(s.uvs);
		expect(uv0[0]).toBeCloseTo(0, 5); // left edge u
		expect(uv0[2]).toBeCloseTo(0.5, 5); // right edge u

		// advance past the frame delay → frame 1 (right half: u in [0.5, 1])
		s.update(120);
		const uv1 = Array.from(s.uvs);
		expect(uv1[0]).toBeCloseTo(0.5, 5);
		expect(uv1[2]).toBeCloseTo(1, 5);

		// world geometry (quad size) is independent of the 32px frame size
		expect(s._halfW).toBeCloseTo(24, 5);
		expect(s._halfH).toBeCloseTo(24, 5);
	});

	it("resolves a usable texture from a plain image (no framewidth)", () => {
		// regression: a plain-image Sprite3d must still resolve an atlas whose
		// getTexture() returns the source (else the mesh batcher reads .width of
		// undefined at draw time). A default frame must also be selected.
		const img = document.createElement("canvas");
		img.width = 48;
		img.height = 64;
		img.getContext("2d").fillRect(0, 0, 48, 64);
		const s = new Sprite3d(0, 0, { image: img, width: 48, height: 64 });
		const tex = s.texture.getTexture();
		expect(tex).toBeDefined();
		expect(tex.width).toBe(48);
		expect(tex.height).toBe(64);
		// the catch-all "default" animation should have been selected
		expect(s.current.name).toBe("default");
	});

	it("defaults alphaCutoff to 0.5 so transparent sprite backgrounds cut out", () => {
		const img = document.createElement("canvas");
		img.width = 32;
		img.height = 32;
		img.getContext("2d").fillRect(0, 0, 32, 32);
		// default → 0.5 (the mesh pass is opaque, so a cutout gives transparency)
		const a = new Sprite3d(0, 0, { image: img, width: 32, height: 32 });
		expect(a.alphaCutoff).toBe(0.5);
		// explicit override is honored, including 0 (fully opaque)
		const b = new Sprite3d(0, 0, {
			image: img,
			width: 32,
			height: 32,
			alphaCutoff: 0,
		});
		expect(b.alphaCutoff).toBe(0);
		const c = new Sprite3d(0, 0, {
			image: img,
			width: 32,
			height: 32,
			alphaCutoff: 0.25,
		});
		expect(c.alphaCutoff).toBe(0.25);
	});

	it("world quad size falls back to the frame size when width is omitted", () => {
		const sheet = document.createElement("canvas");
		sheet.width = 64;
		sheet.height = 32;
		sheet.getContext("2d").fillRect(0, 0, 64, 32);
		const s = new Sprite3d(0, 0, {
			image: sheet,
			framewidth: 32,
			frameheight: 32,
		});
		expect(s._halfW).toBeCloseTo(16, 5);
		expect(s._halfH).toBeCloseTo(16, 5);
	});

	it("billboard:false renders a fixed-orientation quad (no camera facing)", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		cam.yaw = 1.0;
		const s = new Sprite3d(0, 0, {
			image: makeTex(),
			width: 20,
			height: 30,
			z: -100,
			billboard: false,
		});
		s._billboardCam = cam;
		s._projectVerticesWorld(0, 0, -100);
		// fixed quad lives in the XY plane: all corners share the same z
		const v = s.vertices;
		expect(v[2]).toBeCloseTo(v[5], 4);
		expect(v[5]).toBeCloseTo(v[8], 4);
		expect(v[8]).toBeCloseTo(v[11], 4);
	});
});

describe("Sprite3d atlas region mapping (trim + rotation)", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	// a 200×200 source so logical (untrimmed) frame = 200 → world scale 1 at
	// width/height 200; setRegion is exercised directly with synthetic regions
	const make = (imgW, imgH, w, h) => {
		const img = document.createElement("canvas");
		img.width = imgW;
		img.height = imgH;
		img.getContext("2d").fillRect(0, 0, imgW, imgH);
		return new Sprite3d(0, 0, { image: img, width: w, height: h });
	};

	it("maps a trimmed region to the correct sub-rect of the quad + UVs", () => {
		const s = make(200, 200, 200, 200); // hw = hh = 100, scale = 1
		// art 120×140 packed at atlas (10,20), offset by trim (40,30) inside a
		// 200×200 logical frame
		s.setRegion({
			offset: { x: 10, y: 20 },
			width: 120,
			height: 140,
			trimmed: true,
			trim: { x: 40, y: 30, w: 120, h: 140 },
			sourceSize: { w: 200, h: 200 },
			angle: 0,
		});
		const v = s.originalVertices;
		// c0 BL, c1 BR, c2 TR, c3 TL — the art rect within the centered frame
		expect([v[0], v[1]]).toEqual([-60, -70]);
		expect([v[3], v[4]]).toEqual([60, -70]);
		expect([v[6], v[7]]).toEqual([60, 70]);
		expect([v[9], v[10]]).toEqual([-60, 70]);
		const uv = s.uvs;
		// atlas AABB: u ∈ [10/200, 130/200], v ∈ [20/200, 160/200]
		expect(uv[0]).toBeCloseTo(0.05, 5); // BL u (left)
		expect(uv[1]).toBeCloseTo(0.8, 5); // BL v (bottom)
		expect(uv[4]).toBeCloseTo(0.65, 5); // TR u (right)
		expect(uv[5]).toBeCloseTo(0.1, 5); // TR v (top)
	});

	it("maps a packer-rotated region with the atlas AABB swapped + UVs permuted 90°", () => {
		const s = make(80, 80, 40, 80); // hw = 20, hh = 40
		// simulate the atlas-first-frame capture (no default frame on a named
		// atlas): logical size comes from this region, not the page image
		s._refLw = 0;
		s._refLh = 0;
		// art 40 wide × 80 tall (unrotated); stored rotated → atlas AABB 80×40
		s.setRegion({
			offset: { x: 0, y: 0 },
			width: 40,
			height: 80,
			trimmed: false,
			trim: null,
			sourceSize: null,
			angle: -Math.PI / 2,
		});
		const uv = s.uvs;
		// atlas AABB is height×width = 80×40 → uR = 80/80 = 1, vB = 40/80 = 0.5
		// rotated permutation: BL→(0,0) BR→(0,0.5) TR→(1,0.5) TL→(1,0)
		expect([uv[0], uv[1]]).toEqual([0, 0]); // BL → atlas top-left
		expect([uv[2], uv[3]]).toEqual([0, 0.5]); // BR → atlas bottom-left
		expect([uv[4], uv[5]]).toEqual([1, 0.5]); // TR → atlas bottom-right
		expect([uv[6], uv[7]]).toEqual([1, 0]); // TL → atlas top-right
		// quad geometry is the full (untrimmed) art: ±hw / ±hh
		const v = s.originalVertices;
		expect([v[0], v[1]]).toEqual([-20, -40]);
		expect([v[6], v[7]]).toEqual([20, 40]);
	});

	it("maps a region that is BOTH rotated and trimmed (UVs + geometry)", () => {
		const s = make(256, 256, 60, 100); // hw = 30, hh = 50
		s._refLw = 0; // logical comes from this region's sourceSize (60×100)
		s._refLh = 0;
		// art 40×80 (unrotated), packed rotated at atlas (5,7) → AABB 80×40;
		// trimmed: art sits at (10,8) inside a 60×100 logical frame
		s.setRegion({
			offset: { x: 5, y: 7 },
			width: 40,
			height: 80,
			trimmed: true,
			trim: { x: 10, y: 8, w: 40, h: 80 },
			sourceSize: { w: 60, h: 100 },
			angle: -Math.PI / 2,
		});
		// geometry: trimmed art sub-rect inside the centered logical frame (scale 1)
		const v = s.originalVertices;
		expect([v[0], v[1]]).toEqual([-20, -38]); // c0 BL
		expect([v[3], v[4]]).toEqual([20, -38]); // c1 BR
		expect([v[6], v[7]]).toEqual([20, 42]); // c2 TR
		expect([v[9], v[10]]).toEqual([-20, 42]); // c3 TL
		// UVs: atlas AABB is height×width = 80×40, with the rotated permutation
		const uv = s.uvs;
		expect(uv[0]).toBeCloseTo(5 / 256, 5); // BL u (atlas left)
		expect(uv[1]).toBeCloseTo(7 / 256, 5); // BL v (atlas top)
		expect(uv[2]).toBeCloseTo(5 / 256, 5); // BR u
		expect(uv[3]).toBeCloseTo(47 / 256, 5); // BR v (atlas bottom = (7+40)/256)
		expect(uv[4]).toBeCloseTo(85 / 256, 5); // TR u (atlas right = (5+80)/256)
		expect(uv[5]).toBeCloseTo(47 / 256, 5);
		expect(uv[6]).toBeCloseTo(85 / 256, 5); // TL u
		expect(uv[7]).toBeCloseTo(7 / 256, 5);
	});
});

describe("Sprite3d flipX / flipY", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	// 64×32 sheet → two 32×32 frames; sprite sized 1:1 (world unit == frame px)
	const makeAnimated = (settings) => {
		const sheet = document.createElement("canvas");
		sheet.width = 64;
		sheet.height = 32;
		sheet.getContext("2d").fillRect(0, 0, 64, 32);
		const s = new Sprite3d(0, 0, {
			image: sheet,
			framewidth: 32,
			frameheight: 32,
			width: 32,
			height: 32,
			...settings,
		});
		s.addAnimation("walk", [0, 1], 100);
		s.setCurrentAnimation("walk");
		return s;
	};

	it("flipX mirrors the quad horizontally — geometry only, UVs unchanged", () => {
		const s = makeAnimated();
		const ov = Array.from(s.originalVertices);
		const uv = Array.from(s.uvs);
		expect(s.isFlippedX()).toBe(false);
		expect(s.flipX()).toBe(s); // chainable
		expect(s.isFlippedX()).toBe(true);
		for (let i = 0; i < 4; i++) {
			expect(s.originalVertices[i * 3]).toBeCloseTo(-ov[i * 3], 5); // x negated
			expect(s.originalVertices[i * 3 + 1]).toBeCloseTo(ov[i * 3 + 1], 5); // y same
		}
		expect(Array.from(s.uvs)).toEqual(uv); // texture mirrors via geometry
	});

	it("flipY mirrors the quad vertically — geometry only, UVs unchanged", () => {
		const s = makeAnimated();
		const ov = Array.from(s.originalVertices);
		const uv = Array.from(s.uvs);
		s.flipY();
		expect(s.isFlippedY()).toBe(true);
		for (let i = 0; i < 4; i++) {
			expect(s.originalVertices[i * 3]).toBeCloseTo(ov[i * 3], 5); // x same
			expect(s.originalVertices[i * 3 + 1]).toBeCloseTo(-ov[i * 3 + 1], 5); // y neg
		}
		expect(Array.from(s.uvs)).toEqual(uv);
	});

	it("flipX(false) restores the original orientation", () => {
		const s = makeAnimated();
		const ov = Array.from(s.originalVertices);
		s.flipX();
		s.flipX(false);
		expect(s.isFlippedX()).toBe(false);
		for (let i = 0; i < 12; i++) {
			expect(s.originalVertices[i]).toBeCloseTo(ov[i], 5);
		}
	});

	it("settings.flipX applies the flip at construction", () => {
		const a = makeAnimated();
		const b = makeAnimated({ flipX: true });
		expect(b.isFlippedX()).toBe(true);
		expect(b.originalVertices[0]).toBeCloseTo(-a.originalVertices[0], 5);
	});

	it("flip marks the sprite dirty", () => {
		const s = makeAnimated();
		s.isDirty = false;
		s.flipX();
		expect(s.isDirty).toBe(true);
	});

	it("flip persists across animation frames", () => {
		const s = makeAnimated();
		s.flipX();
		const x0 = s.originalVertices[0];
		s.update(100); // advance to frame 1
		expect(s.getCurrentAnimationFrame()).toBe(1);
		expect(s.isFlippedX()).toBe(true);
		// same-size frames → geometry identical, still mirrored to the same side
		expect(s.originalVertices[0]).toBeCloseTo(x0, 5);
		expect(s.originalVertices[0]).toBeGreaterThan(0); // c0 on the mirrored side
	});

	// ── adversarial: flip × texture atlas (trimmed + rotated) ───────────────

	const makeAtlasSprite = (imgW, imgH, w, h) => {
		const img = document.createElement("canvas");
		img.width = imgW;
		img.height = imgH;
		img.getContext("2d").fillRect(0, 0, imgW, imgH);
		return new Sprite3d(0, 0, { image: img, width: w, height: h });
	};

	it("ADVERSARIAL: flipX mirrors a trimmed region (geometry only, UVs intact)", () => {
		const s = makeAtlasSprite(200, 200, 200, 200);
		s.setRegion({
			offset: { x: 10, y: 20 },
			width: 120,
			height: 140,
			trimmed: true,
			trim: { x: 40, y: 30, w: 120, h: 140 },
			sourceSize: { w: 200, h: 200 },
			angle: 0,
		});
		const ov = Array.from(s.originalVertices);
		const uv = Array.from(s.uvs);
		s.flipX();
		for (let i = 0; i < 4; i++) {
			expect(s.originalVertices[i * 3]).toBeCloseTo(-ov[i * 3], 5);
			expect(s.originalVertices[i * 3 + 1]).toBeCloseTo(ov[i * 3 + 1], 5);
		}
		expect(Array.from(s.uvs)).toEqual(uv); // trim UVs untouched by the flip
	});

	it("ADVERSARIAL: flipX mirrors a packer-rotated region, UV permutation intact", () => {
		const s = makeAtlasSprite(80, 80, 40, 80);
		s._refLw = 0; // simulate atlas-first-frame capture (logical from this region)
		s._refLh = 0;
		s.setRegion({
			offset: { x: 0, y: 0 },
			width: 40,
			height: 80,
			trimmed: false,
			trim: null,
			sourceSize: null,
			angle: -Math.PI / 2,
		});
		const ov = Array.from(s.originalVertices);
		const uv = Array.from(s.uvs); // the rotated permutation
		s.flipX();
		for (let i = 0; i < 4; i++) {
			expect(s.originalVertices[i * 3]).toBeCloseTo(-ov[i * 3], 5);
		}
		expect(Array.from(s.uvs)).toEqual(uv); // rotation permutation preserved
	});

	it("ADVERSARIAL: flipX + flipY mirror both axes; toggling each back restores", () => {
		const s = makeAnimated();
		const ov = Array.from(s.originalVertices);
		s.flipX();
		s.flipY();
		for (let i = 0; i < 4; i++) {
			expect(s.originalVertices[i * 3]).toBeCloseTo(-ov[i * 3], 5);
			expect(s.originalVertices[i * 3 + 1]).toBeCloseTo(-ov[i * 3 + 1], 5);
		}
		s.flipX(false);
		s.flipY(false);
		for (let i = 0; i < 12; i++) {
			expect(s.originalVertices[i]).toBeCloseTo(ov[i], 5);
		}
	});

	it("ADVERSARIAL: flipX swaps on-screen left/right under a billboard camera", () => {
		const cam = new Camera3d(0, 0, 1024, 768);
		cam.pos.set(0, 0, 600);
		cam.lookAt(0, 0, 0);
		const s = makeAnimated({ billboard: "cylindrical" });
		const project = () => {
			s._billboardCam = cam;
			s._projectVerticesWorld(0, 0, 0);
			const c0 = cam.worldToScreen(
				new Vector3d(s.vertices[0], s.vertices[1], s.vertices[2]),
				new Vector2d(),
			);
			const c1 = cam.worldToScreen(
				new Vector3d(s.vertices[3], s.vertices[4], s.vertices[5]),
				new Vector2d(),
			);
			return { c0, c1 };
		};
		const before = project();
		expect(before.c0.x).toBeLessThan(before.c1.x); // BL left of BR
		s.flipX();
		const after = project();
		expect(after.c0.x).toBeGreaterThan(after.c1.x); // mirrored on screen
	});

	it("flip is maintained across full animation cycles and animation switches", () => {
		const s = makeAnimated(); // "walk" [0, 1] @ 100ms → wraps every 200ms
		s.addAnimation("idle", [0, 1], 100);
		s.flipX();
		// advance through several full loops (incl. wraps back to frame 0)
		for (let i = 0; i < 6; i++) {
			s.update(100);
			expect(s.isFlippedX()).toBe(true);
			// same-size frames → c0 stays on the mirrored (positive x) side every frame
			expect(s.originalVertices[0]).toBeGreaterThan(0);
		}
		expect(s.getCurrentAnimationFrame()).toBe(0); // 6 × 100ms on a 2-frame loop
		// switching animations keeps the flip
		s.setCurrentAnimation("idle");
		expect(s.isFlippedX()).toBe(true);
		expect(s.originalVertices[0]).toBeGreaterThan(0);
	});
});

describe("Sprite3d resource cleanup", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	it("destroy() releases the engine's pooled current.offset", () => {
		const img = document.createElement("canvas");
		img.width = 32;
		img.height = 32;
		img.getContext("2d").fillRect(0, 0, 32, 32);
		const s = new Sprite3d(0, 0, { image: img, width: 32, height: 32 });
		const offset = s._frameAnim.current.offset;
		expect(offset).not.toBeNull();
		s.destroy();
		// the pooled Vector2d is returned and the reference cleared
		expect(s._frameAnim.current.offset).toBeNull();
	});
});

describe("Sprite3d anchorPoint (vertex-baked anchor)", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	const makeTex = (w = 4, h = 4) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		c.getContext("2d").fillRect(0, 0, w, h);
		return c;
	};

	// 20×30 quad at (100, 50): hw = 10, hh = 15
	const mk = (anchor, extra = {}) => {
		const settings = {
			image: makeTex(),
			width: 20,
			height: 30,
			z: -200,
			...extra,
		};
		if (anchor !== undefined) {
			settings.anchorPoint = anchor;
		}
		return new Sprite3d(100, 50, settings);
	};

	const localXs = (v) => {
		return [v[0], v[3], v[6], v[9]];
	};
	const localYs = (v) => {
		return [v[1], v[4], v[7], v[10]];
	};

	it('"bottom" bakes the local quad shifted so the bottom edge is at the origin', () => {
		const v = mk("bottom").originalVertices;
		// offsetY = (1 - 0.5) * 30 = +15 → local y ∈ {0, 30} (local +Y = art top)
		expect(new Set(localYs(v))).toEqual(new Set([0, 30]));
		expect(new Set(localXs(v))).toEqual(new Set([-10, 10]));
	});

	it('"top-left" bakes both offsets', () => {
		const v = mk("top-left").originalVertices;
		// offsetX = (0.5 - 0) * 20 = +10; offsetY = (0 - 0.5) * 30 = -15
		expect(new Set(localXs(v))).toEqual(new Set([0, 20]));
		expect(new Set(localYs(v))).toEqual(new Set([-30, 0]));
	});

	it('"bottom": feet land exactly at pos on the fixed-orientation path', () => {
		const s = mk("bottom");
		s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
		const ys = [s.vertices[1], s.vertices[4], s.vertices[7], s.vertices[10]];
		// world Y is negated local Y: feet (local 0) at pos.y, head at pos.y - h
		expect(Math.max(...ys)).toBeCloseTo(50, 5);
		expect(Math.min(...ys)).toBeCloseTo(20, 5);
		const xs = [s.vertices[0], s.vertices[3], s.vertices[6], s.vertices[9]];
		expect(Math.min(...xs)).toBeCloseTo(90, 5);
		expect(Math.max(...xs)).toBeCloseTo(110, 5);
	});

	it('"bottom" + cylindrical billboard: feet stay planted and upright at any yaw/pitch', () => {
		const cam = new Camera3d(0, 0, 64, 64);
		const s = mk("bottom", { billboard: "cylindrical" });
		for (const [yaw, pitch] of [
			[0, 0],
			[0.8, -0.3],
			[-1.2, 0.6],
		]) {
			cam.yaw = yaw;
			cam.pitch = pitch;
			s._billboardCam = cam;
			s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
			const v = s.vertices;
			const ys = [v[1], v[4], v[7], v[10]];
			// two corners at the feet (pos.y), two at the head (pos.y - h)
			expect(
				ys.filter((y) => {
					return Math.abs(y - 50) < 1e-4;
				}).length,
			).toBe(2);
			expect(
				ys.filter((y) => {
					return Math.abs(y - 20) < 1e-4;
				}).length,
			).toBe(2);
			// the vertical edge (c0 → c3) is purely world-up: no x/z drift
			expect(Math.abs(v[9] - v[0])).toBeLessThan(1e-4);
			expect(Math.abs(v[11] - v[2])).toBeLessThan(1e-4);
		}
	});

	it('"bottom-left" + flipX: anchor stays pinned, extents unchanged, toggle restores', () => {
		const s = mk("bottom-left");
		const before = Array.from(s.originalVertices);
		expect(new Set(localXs(s.originalVertices))).toEqual(new Set([0, 20]));
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([0, 30]));

		s.flipX();
		// mirrored about the art's own center, then re-pinned: same extents
		expect(new Set(localXs(s.originalVertices))).toEqual(new Set([0, 20]));
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([0, 30]));

		s.flipX(false);
		expect(Array.from(s.originalVertices)).toEqual(before);
	});

	it('trimmed atlas region + "bottom": trim mapping plus the anchor offset', () => {
		const img = makeTex(200, 200);
		const s = new Sprite3d(0, 0, {
			image: img,
			width: 200,
			height: 200,
			anchorPoint: "bottom",
		});
		// same trimmed region as the un-anchored mapping test above
		s.setRegion({
			offset: { x: 10, y: 20 },
			width: 120,
			height: 140,
			trimmed: true,
			trim: { x: 40, y: 30, w: 120, h: 140 },
			sourceSize: { w: 200, h: 200 },
			angle: 0,
		});
		const v = s.originalVertices;
		// offsetY = +100 on top of the (-60,-70)…(60,70) trim mapping
		expect([v[0], v[1]]).toEqual([-60, 30]);
		expect([v[6], v[7]]).toEqual([60, 170]);
		// UVs are untouched by the anchor
		expect(v && s.uvs[0]).toBeCloseTo(0.05, 5);
		expect(s.uvs[5]).toBeCloseTo(0.1, 5);
	});

	it("runtime anchorPoint.set() re-bakes the quad and grows the cull bounds (region path)", () => {
		const s = mk(undefined); // centered default
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([-15, 15]));
		expect(s.width).toBe(30); // max(w, h), legacy centered bounds

		s.isDirty = false;
		s.anchorPoint.set(0.5, 1);

		expect(s._anchorOffsetX).toBe(0);
		expect(s._anchorOffsetY).toBe(15);
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([0, 30]));
		expect(s.isDirty).toBe(true);
		// circumradius about pos: √2 · hypot(hw + |ox|, hh + |oy|)
		expect(s.width).toBeCloseTo(Math.SQRT2 * Math.hypot(10, 30), 5);
		expect(s.height).toBeCloseTo(Math.SQRT2 * Math.hypot(10, 30), 5);
	});

	it("runtime anchorPoint.set() re-bakes the plain quad on the no-region path", () => {
		const s = mk("bottom");
		// force the named-atlas path where no frame region ever landed
		s._region = null;
		s.anchorPoint.set(0.5, 0.5);
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([-15, 15]));
		expect(new Set(localXs(s.originalVertices))).toEqual(new Set([-10, 10]));
	});

	it("cull bounds: grown exactly for the bottom anchor, unchanged for the centered default", () => {
		const centered = new Sprite3d(0, 0, {
			image: makeTex(),
			width: 130,
			height: 225,
		});
		expect(centered.width).toBe(225);

		const anchored = new Sprite3d(0, 0, {
			image: makeTex(),
			width: 130,
			height: 225,
			anchorPoint: "bottom",
		});
		// √2 · hypot(65, 112.5 + 112.5) ≈ 331.22 — the sphere derived from
		// this (radius = side/√2) exactly encloses the billboard sweep
		expect(anchored.width).toBeCloseTo(Math.SQRT2 * Math.hypot(65, 225), 4);
		expect(anchored.width).toBeGreaterThan(225);
	});

	it("the anchor is never applied as a renderer transform, on either camera path", () => {
		const noop = () => {};
		const fakeRenderer = {
			save: noop,
			restore: noop,
			resetTransform: noop,
			translate: noop,
			transform: noop,
			setColor: noop,
			setBlendMode: noop,
			getBlendMode: () => {
				return "normal";
			},
			setTint: noop,
			clearTint: noop,
			setDepth: noop,
			setGlobalAlpha: noop,
			globalAlpha: () => {
				return 1;
			},
			getGlobalAlpha: () => {
				return 1;
			},
			setCustomShader: noop,
			clearCustomShader: noop,
			beginPostEffect: noop,
			endPostEffect: noop,
			currentTransform: {
				isIdentity: () => {
					return true;
				},
			},
		};

		for (const sprite of [mk("bottom"), mk(undefined)]) {
			sprite._useWorldSpace = true;
			sprite.preDraw(fakeRenderer);
			expect(sprite.applyAnchorTransform).toBe(false);
			sprite._useWorldSpace = false;
			sprite.preDraw(fakeRenderer);
			expect(sprite.applyAnchorTransform).toBe(false);
		}

		// a plain Mesh keeps the legacy 2D anchor behavior
		const mesh = new Mesh(0, 0, {
			vertices: [0, 0, 0, 10, 0, 0, 10, 10, 0],
			uvs: [0, 0, 1, 0, 1, 1],
			indices: [0, 1, 2],
			width: 10,
			normalize: false,
		});
		mesh._useWorldSpace = false;
		mesh.preDraw(fakeRenderer);
		expect(mesh.applyAnchorTransform).toBe(true);
	});
});

describe("Sprite3d anchorPoint — adversarial", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	const makeTex = (w = 4, h = 4) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		c.getContext("2d").fillRect(0, 0, w, h);
		return c;
	};

	const mk = (anchor, extra = {}) => {
		const settings = {
			image: makeTex(),
			width: 20,
			height: 30,
			z: -200,
			...extra,
		};
		if (anchor !== undefined) {
			settings.anchorPoint = anchor;
		}
		return new Sprite3d(100, 50, settings);
	};

	// 64×32 sheet → two 32×32 frames, sprite 1:1
	const makeAnimated = (anchor) => {
		const sheet = document.createElement("canvas");
		sheet.width = 64;
		sheet.height = 32;
		sheet.getContext("2d").fillRect(0, 0, 64, 32);
		const settings = {
			image: sheet,
			framewidth: 32,
			frameheight: 32,
			width: 32,
			height: 32,
		};
		if (anchor !== undefined) {
			settings.anchorPoint = anchor;
		}
		const s = new Sprite3d(0, 0, settings);
		s.addAnimation("walk", [0, 1], 100);
		s.setCurrentAnimation("walk");
		return s;
	};

	const xs = (v) => {
		return [v[0], v[3], v[6], v[9]];
	};
	const ys = (v) => {
		return [v[1], v[4], v[7], v[10]];
	};

	it("the anchor survives animation frame changes", () => {
		const s = makeAnimated("bottom"); // 32×32 → offsetY = +16
		const before = Array.from(s.originalVertices);
		s.setAnimationFrame(1);
		// same geometry (untrimmed equal-size frames), only UVs move
		expect(Array.from(s.originalVertices)).toEqual(before);
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([0, 32]));
	});

	it("combined torture: anchor + flipX + frame change + runtime re-anchor", () => {
		const s = makeAnimated("bottom");
		s.flipX();
		s.setAnimationFrame(1);
		// bottom anchor, flipped: x mirrored about art center, feet pinned
		expect(new Set(xs(s.originalVertices))).toEqual(new Set([-16, 16]));
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([0, 32]));

		// re-anchor at runtime to top-right while flipped mid-animation
		s.anchorPoint.set(1, 0);
		// offsets: ox = (0.5-1)*32 = -16, oy = (0-0.5)*32 = -16
		expect(new Set(xs(s.originalVertices))).toEqual(new Set([-32, 0]));
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([-32, 0]));
		expect(s.isFlippedX()).toBe(true);

		// unflip: geometry extents identical (mirror about art center), UVs revert
		s.flipX(false);
		expect(new Set(xs(s.originalVertices))).toEqual(new Set([-32, 0]));
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([-32, 0]));
	});

	it("anchor on a BOTH rotated and trimmed region (offsets on top of the mapping)", () => {
		const img = makeTex(256, 256);
		const s = new Sprite3d(0, 0, {
			image: img,
			width: 60,
			height: 100,
			anchorPoint: "bottom", // offsetY = +50
		});
		s._refLw = 0;
		s._refLh = 0;
		s.setRegion({
			offset: { x: 5, y: 7 },
			width: 40,
			height: 80,
			trimmed: true,
			trim: { x: 10, y: 8, w: 40, h: 80 },
			sourceSize: { w: 60, h: 100 },
			angle: -Math.PI / 2,
		});
		const v = s.originalVertices;
		// base mapping (see the un-anchored rotated+trimmed test) + (0, +50)
		expect([v[0], v[1]]).toEqual([-20, 12]);
		expect([v[3], v[4]]).toEqual([20, 12]);
		expect([v[6], v[7]]).toEqual([20, 92]);
		expect([v[9], v[10]]).toEqual([-20, 92]);
	});

	it("round-tripping anchors restores the centered geometry and bounds exactly", () => {
		const s = mk("bottom");
		s.anchorPoint.set(0.25, 0.75);
		s.anchorPoint.set(2, -1); // out of range on purpose
		s.anchorPoint.set(0.5, 0.5); // back to center
		const fresh = mk(undefined);
		expect(Array.from(s.originalVertices)).toEqual(
			Array.from(fresh.originalVertices),
		);
		expect(s.width).toBe(fresh.width);
		expect(s.height).toBe(fresh.height);
		expect(s.getBounds().width).toBeCloseTo(fresh.getBounds().width, 5);
	});

	it("single-axis anchorPoint.y = 1 writes re-bake too", () => {
		const s = mk(undefined);
		s.anchorPoint.y = 1;
		expect(s._anchorOffsetY).toBe(15);
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([0, 30]));
	});

	it("out-of-range anchors: the cull sphere still encloses every projected corner", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		for (const anchor of ["bottom", "top-left", { x: 2, y: -1 }]) {
			const s = mk(anchor, { billboard: "cylindrical" });
			// Camera3d derives the cull radius from the bounds like this:
			const radius = Math.hypot(s.width, s.height) / 2;
			for (const [yaw, pitch] of [
				[0, 0],
				[0.8, -0.3],
				[-1.2, 0.6],
			]) {
				cam.yaw = yaw;
				cam.pitch = pitch;
				s._billboardCam = cam;
				s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
				const v = s.vertices;
				for (let i = 0; i < 4; i++) {
					const d = Math.hypot(
						v[i * 3] - s.pos.x,
						v[i * 3 + 1] - s.pos.y,
						v[i * 3 + 2] - s.depth,
					);
					expect(d).toBeLessThanOrEqual(radius + 1e-3);
				}
			}
		}
	});

	it("spherical billboard + anchor: corner distances from pos are rotation-invariant", () => {
		const cam = new Camera3d(0, 0, 64, 64);
		const s = mk("bottom", { billboard: "spherical" });
		// local corner distances: (±10, 0) → 10, (±10, 30) → hypot(10, 30)
		const expected = [10, 10, Math.hypot(10, 30), Math.hypot(10, 30)].sort(
			(a, b) => {
				return a - b;
			},
		);
		for (const [yaw, pitch] of [
			[0, 0],
			[0.8, -0.3],
			[-1.2, 0.6],
		]) {
			cam.yaw = yaw;
			cam.pitch = pitch;
			s._billboardCam = cam;
			s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
			const v = s.vertices;
			const dists = [0, 1, 2, 3]
				.map((i) => {
					return Math.hypot(
						v[i * 3] - s.pos.x,
						v[i * 3 + 1] - s.pos.y,
						v[i * 3 + 2] - s.depth,
					);
				})
				.sort((a, b) => {
					return a - b;
				});
			for (let i = 0; i < 4; i++) {
				expect(dists[i]).toBeCloseTo(expected[i], 4);
			}
		}
	});

	it("frame-derived size (no explicit width): offsets computed from the frame size", () => {
		const sheet = document.createElement("canvas");
		sheet.width = 64;
		sheet.height = 32;
		sheet.getContext("2d").fillRect(0, 0, 64, 32);
		const s = new Sprite3d(0, 0, {
			image: sheet,
			framewidth: 32,
			frameheight: 32,
			anchorPoint: "bottom",
		});
		// w = h = 32 from the frame grid → offsetY = +16
		expect(s._anchorOffsetY).toBe(16);
		expect(new Set(ys(s.originalVertices))).toEqual(new Set([0, 32]));
	});
});

describe("Sprite3d anchorPoint — remaining gap coverage", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	const makeTex = () => {
		const c = document.createElement("canvas");
		c.width = 4;
		c.height = 4;
		c.getContext("2d").fillRect(0, 0, 4, 4);
		return c;
	};

	const localYs = (v) => {
		return [v[1], v[4], v[7], v[10]];
	};

	it('flipY keeps a "bottom" anchor pinned (art mirrors inside the box)', () => {
		const s = new Sprite3d(100, 50, {
			image: makeTex(),
			width: 20,
			height: 30,
			anchorPoint: "bottom",
		});
		const before = Array.from(s.originalVertices);
		s.flipY();
		// mirrored about the art's own center, then re-pinned: same extents
		expect(new Set(localYs(s.originalVertices))).toEqual(new Set([0, 30]));
		s.flipY(false);
		expect(Array.from(s.originalVertices)).toEqual(before);
	});

	it("REGRESSION GUARD: the legacy centered bounds would NOT enclose a bottom-anchored quad", () => {
		// the review scenario: a 130×225 bottom-anchored character. The old
		// bounds side max(w, h) = 225 gives a cull radius of √(225²+225²)/2 ≈
		// 159.1, while the head corners sit hypot(65, 225) ≈ 234.2 from pos —
		// the sprite culled while a third of it was still on screen. This
		// pins that the shipped bounds DO enclose it and the old ones don't.
		const w = 130;
		const h = 225;
		const farthestCorner = Math.hypot(w / 2, h);
		const legacyRadius = Math.hypot(Math.max(w, h), Math.max(w, h)) / 2;
		expect(farthestCorner).toBeGreaterThan(legacyRadius); // the old bug

		const s = new Sprite3d(0, 0, {
			image: makeTex(),
			width: w,
			height: h,
			anchorPoint: "bottom",
		});
		const shippedRadius = Math.hypot(s.width, s.height) / 2;
		expect(shippedRadius).toBeGreaterThanOrEqual(farthestCorner - 1e-6);
	});
});
