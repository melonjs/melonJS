/**
 * `@melonjs/rapier3d-adapter`: Rapier 3D physics for melonJS.
 *
 * The adapter is {@link Rapier3dAdapter}; the rest of `src/` is its parts,
 * one concern per file (see the top of `Rapier3dAdapter.ts`).
 */
export { Rapier3dAdapter } from "./Rapier3dAdapter";
export {
	type Rapier3dAdapterOptions,
	type Rapier3dJointDefinition,
	REQUIRED_MELONJS_VERSION,
	type Vector3Like,
} from "./types";
