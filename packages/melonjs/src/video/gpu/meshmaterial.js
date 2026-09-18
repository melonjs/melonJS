/**
 * Mesh material predicates shared by the mesh batchers of both backends —
 * pure CPU code with no imports at all (`meshchunk.ts` sets the precedent for
 * cross-backend sharing here).
 *
 * Deliberately NOT in `renderable/mesh.js`: that module reaches
 * `application.ts`, which reaches the level loaders, which reach
 * `InstancedMesh`, which extends `Mesh` — so importing it from a batcher
 * closes a cycle and the class is read before it is initialized whenever a
 * batcher happens to be the entry point of the module graph.
 *
 * Copyright (C) 2011 - 2026 Olivier Biot (AltByte Pte Ltd)
 */

/**
 * Whether any part of a mesh carries a normal map — its own, or any of its
 * material groups'.
 *
 * One flag covers a mixed multi-material model because a group with no map of
 * its own binds the flat-normal filler, and perturbing by a flat normal is the
 * identity. The alternative is a per-range uniform rewrite for a value that is
 * almost always the same across the mesh.
 * @param {object} mesh - the mesh to test
 * @returns {boolean} true when the normal-map path should run
 * @ignore
 * @internal
 */
export function meshHasNormalMap(mesh) {
	if (mesh.normalMap !== undefined) {
		return true;
	}
	const groups = mesh.textureGroups;
	if (groups === undefined) {
		return false;
	}
	for (const group of groups) {
		if (group.normalMap !== undefined) {
			return true;
		}
	}
	return false;
}
