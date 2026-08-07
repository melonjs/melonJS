import { describe, expect, it } from "vitest";
import forestUrl from "../../examples/public/assets/gltf/forest.glb?url";
import { parseGLB } from "../src/loader/parsers/gltf.js";

/**
 * Asset integrity for the forest example (#1508).
 *
 * The example proves nothing by itself: if `forest.glb` ever stopped
 * carrying `EXT_mesh_gpu_instancing` it would still render — as 400
 * separate meshes, or as one tree — and the loader path the example exists
 * to exercise would be silently untested.
 *
 * That is not hypothetical. The asset is meant to be re-authored in
 * Blender, whose glTF exporter only writes the extension for **linked
 * duplicates** (`Alt+D`, sharing one mesh data-block) with its GPU-instances
 * option enabled; `Shift+D` copies, or an object-level modifier, silently
 * produce N separate meshes instead. So the invariants are pinned here
 * rather than left to a one-time check at authoring time.
 *
 * These assertions describe the asset's CONTRACT, not the generator that
 * currently produces it — a Blender export satisfying them passes unchanged.
 */
describe("forest.glb", () => {
	const load = async () => {
		const response = await fetch(forestUrl);
		expect(response.ok, "forest.glb should be reachable").toBe(true);
		return parseGLB(await response.arrayBuffer());
	};

	it("is a valid GLB carrying a JSON and a binary chunk", async () => {
		const { json, bin } = await load();
		expect(json).toBeDefined();
		expect(json.asset.version).toBe("2.0");
		expect(bin).not.toBe(null);
		expect(bin.byteLength).toBeGreaterThan(0);
	});

	it("declares EXT_mesh_gpu_instancing", async () => {
		const { json } = await load();
		expect(json.extensionsUsed).toContain("EXT_mesh_gpu_instancing");
	});

	it("has a node carrying per-instance TRANSLATION", async () => {
		const { json } = await load();
		const instanced = json.nodes.filter((node) => {
			return node.extensions?.EXT_mesh_gpu_instancing !== undefined;
		});
		expect(instanced.length).toBeGreaterThan(0);
		for (const node of instanced) {
			const attributes = node.extensions.EXT_mesh_gpu_instancing.attributes;
			expect(attributes.TRANSLATION, node.name).toBeDefined();
			// and it references a real VEC3 accessor with instances in it
			const accessor = json.accessors[attributes.TRANSLATION];
			expect(accessor.type, node.name).toBe("VEC3");
			expect(accessor.count, node.name).toBeGreaterThan(1);
		}
	});

	it("every instance attribute has the SAME count — the spec requires it", async () => {
		const { json } = await load();
		for (const node of json.nodes) {
			const attributes =
				node.extensions?.EXT_mesh_gpu_instancing?.attributes ?? null;
			if (attributes === null) {
				continue;
			}
			const counts = Object.values(attributes).map((index) => {
				return json.accessors[index].count;
			});
			expect(new Set(counts).size, `${node.name} attribute counts`).toBe(1);
		}
	});

	it("carries the tree geometry ONCE, not once per instance", async () => {
		// the regression that matters: an export that lost the extension
		// would come back as N nodes over N meshes, and the whole point of
		// the example would be gone with nothing failing
		const { json } = await load();
		const instanced = json.nodes.find((node) => {
			return node.extensions?.EXT_mesh_gpu_instancing !== undefined;
		});
		const instanceCount =
			json.accessors[
				instanced.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION
			].count;

		// a handful of meshes (the tree, the ground), NOT one per instance
		expect(json.meshes.length).toBeLessThan(8);
		expect(json.meshes.length).toBeLessThan(instanceCount);
		expect(json.nodes.length).toBeLessThan(instanceCount);

		// and the instanced node's own mesh has real geometry behind it
		const primitive = json.meshes[instanced.mesh].primitives[0];
		expect(primitive.attributes.POSITION).toBeDefined();
		expect(json.accessors[primitive.attributes.POSITION].count).toBeGreaterThan(
			3,
		);
	});

	it("scatters enough trees to be worth instancing", async () => {
		// a two-instance asset would pass every structural check above while
		// demonstrating nothing
		const { json } = await load();
		const instanced = json.nodes.find((node) => {
			return node.extensions?.EXT_mesh_gpu_instancing !== undefined;
		});
		const count =
			json.accessors[
				instanced.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION
			].count;
		expect(count).toBeGreaterThanOrEqual(100);
	});

	it("costs records per instance, not geometry per instance", async () => {
		// The memory claim, asserted RELATIVE to the instance count rather
		// than as a fixed ceiling — a fixed one silently becomes either
		// meaningless or an obstacle as the scatter grows.
		//
		// An instance record is 32 bytes on disk (float translation + short
		// quaternion + float scale) and 48 on the GPU. Baking the same tree out N
		// times would cost its whole vertex set each time (52 verts of
		// position + normal + uv + colour ≈ 2.3 KB), so the file must stay
		// FAR closer to the former than the latter.
		const { json } = await load();
		const instanced = json.nodes.find((node) => {
			return node.extensions?.EXT_mesh_gpu_instancing !== undefined;
		});
		const count =
			json.accessors[
				instanced.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION
			].count;
		const response = await fetch(forestUrl);
		const bytes = (await response.arrayBuffer()).byteLength;

		// generous headroom over the ~40 B/instance the records actually
		// cost, while still an order of magnitude under baked-out geometry
		expect(bytes).toBeLessThan(count * 200);
	});
});
