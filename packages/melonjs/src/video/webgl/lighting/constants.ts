/**
 * Constants shared between the lit fragment shaders
 * (`multitexture-lit.js`, `mesh-lit.frag`), the lit batchers
 * (`LitQuadBatcher`, `LitMeshBatcher`), the uniform packers (`pack.ts`,
 * `pack3d.ts`) and the std140 writer (`std140.ts`). Kept in a tiny
 * standalone module so the consumers don't depend on each other
 * transitively for a couple of integers.
 */

/**
 * Maximum number of lights the lit fragment shaders support concurrently
 * per draw call. Lights past this index are ignored.
 *
 * The data travels in a uniform buffer, so this is an allocation rather
 * than a compatibility question: 32 lights cost 1056 bytes against
 * `MAX_UNIFORM_BLOCK_SIZE`, which is at least 16 KB everywhere. Uniform
 * _arrays_, the previous transport, are charged against the much smaller
 * `MAX_FRAGMENT_UNIFORM_VECTORS` — shared with every other uniform the
 * shader declares — which is what held this at 8.
 *
 * It is not a statement about what a device can afford to _shade_: the
 * fragment loop still runs once per pixel per live light. Unused capacity
 * is free — the loop bound is the live count — but filling it is not.
 */
export const MAX_LIGHTS = 32;

/**
 * Indexed `UNIFORM_BUFFER` binding point for `Light2dBlock` (the lit quad
 * path). Binding points are a context-wide resource, so the two light
 * blocks take distinct ones — a 2D lit sprite and a 3D lit mesh can both be
 * drawn in the same frame.
 *
 * Point 0 is used, deliberately. It is tempting to leave it free so that a
 * forgotten `bindTo` fails loudly instead of silently reading whatever owns
 * point 0 — but it does not fail loudly: an *active* uniform block with no
 * buffer bound is `INVALID_OPERATION` at draw time, which takes the whole
 * program down rather than just the lighting. Keeping a correctly-sized
 * buffer on 0 means a program that somehow escaped binding still draws.
 * The binding is established eagerly in each batcher's `init()` so nothing
 * relies on that safety net in the first place.
 */
export const LIGHT2D_BINDING_POINT = 0;

/**
 * Indexed `UNIFORM_BUFFER` binding point for `Light3dBlock` (the lit mesh
 * path). See {@link LIGHT2D_BINDING_POINT}.
 */
export const LIGHT3D_BINDING_POINT = 1;
