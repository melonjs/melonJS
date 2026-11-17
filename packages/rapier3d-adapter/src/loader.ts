/**
 * Loading Rapier: its WebAssembly is downloaded and compiled once, and every
 * adapter shares the result.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";

/** The Rapier module, once {@link loadRapier} has compiled it. */
let rapier: typeof RAPIER | undefined;
/** The load in progress or done, shared by every caller. */
let loading: Promise<void> | undefined;

/**
 * Download and compile Rapier's WebAssembly. Every call returns the same
 * promise; a failed load rejects, and a later call tries again.
 *
 * Rapier is imported with `import()`, so bundlers put it in a chunk of its
 * own, downloaded only when this is called.
 * @returns a promise that resolves once Rapier is ready
 */
export function loadRapier(): Promise<void> {
	loading ??= import("@dimforge/rapier3d-compat")
		.then(async (module) => {
			// decode the embedded bytes and compile the WebAssembly
			await module.init();
			rapier = module;
		})
		.catch((error: unknown) => {
			loading = undefined;
			throw error;
		});
	return loading;
}

/**
 * The Rapier module, if it has been loaded.
 * @returns the module, or `undefined` before {@link loadRapier} finishes
 */
export function loadedRapier(): typeof RAPIER | undefined {
	return rapier;
}
