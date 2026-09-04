/**
 * Backend-neutral primitive topologies.
 *
 * Names how a stream of vertices is assembled into primitives, in the GPU
 * vocabulary rather than the GL one. Like {@link VertexFormat}, this lets a
 * draw be described without a live rendering context, and lets a backend read
 * the description directly instead of translating enums.
 *
 * This module holds no GL references, so a non-WebGL backend can import it
 * without pulling in the WebGL layer.
 */

/**
 * How vertices are assembled into primitives.
 *
 * Five of these are portable across backends. `"line-loop"` and
 * `"triangle-fan"` are **engine extensions** with no modern GPU-API
 * equivalent — they exist because the primitive batcher has always accepted
 * them, and a future backend will have to emulate them (a line loop is a line
 * strip plus a closing segment, which is already how the WebGL path draws it).
 * Prefer {@link PORTABLE_TOPOLOGIES} for anything that must survive a backend
 * change.
 */
export type Topology =
	| "point-list"
	| "line-list"
	| "line-strip"
	| "line-loop"
	| "triangle-list"
	| "triangle-strip"
	| "triangle-fan";

/**
 * The topologies with a direct equivalent in modern GPU APIs.
 *
 * `"line-loop"` and `"triangle-fan"` are deliberately absent — see
 * {@link Topology}.
 */
export const PORTABLE_TOPOLOGIES = [
	"point-list",
	"line-list",
	"line-strip",
	"triangle-list",
	"triangle-strip",
] as const satisfies readonly Topology[];

/**
 * Every accepted topology name.
 * @ignore
 * @internal
 */
const TOPOLOGIES: readonly Topology[] = [
	"point-list",
	"line-list",
	"line-strip",
	"line-loop",
	"triangle-list",
	"triangle-strip",
	"triangle-fan",
];

/**
 * Whether a value is a supported topology name.
 * @param value - the value to test
 * @returns `true` when `value` names a topology
 */
export function isTopology(value: unknown): value is Topology {
	return typeof value === "string" && TOPOLOGIES.includes(value as Topology);
}

/**
 * Whether a topology has a direct equivalent in modern GPU APIs.
 * @param topology - the topology to test
 * @returns `false` for the two engine extensions, which a non-WebGL backend must emulate
 */
export function isPortableTopology(topology: Topology): boolean {
	return (PORTABLE_TOPOLOGIES as readonly Topology[]).includes(topology);
}
