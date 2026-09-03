/**
 * Mapping authored metallic/roughness onto the lit mesh path's Blinn-Phong
 * terms (#1575).
 *
 * Two formats describe the same material concept — glTF's
 * `pbrMetallicRoughness` and MTL's `Pr` / `Pm` extension, both of which
 * Blender writes by default — and both land here so the two cannot drift
 * apart. What they land ON is a stylized half-Lambert shading model, not a
 * microfacet BRDF, so this is deliberately an APPROXIMATION: the point is to
 * recover the "is this surface glossy, and what colour does it glint"
 * information the asset already carries, rather than to be energy-correct.
 *
 * An explicitly authored specular (`Ks` + `Ns`) always wins over this — it
 * says exactly what the artist wanted, where metallic/roughness only implies
 * it.
 * @ignore
 * @internal
 */

/**
 * The exponent a mirror-smooth surface is clamped to. The Blinn-Phong
 * exponent runs away as roughness approaches 0, and a highlight narrower
 * than a pixel only aliases.
 * @ignore
 * @internal
 */
export const MAX_SHININESS = 256;

/**
 * The specular reflectance of a non-metal, the standard value used by every
 * metallic/roughness workflow. Metals reflect their own base colour instead.
 * @ignore
 * @internal
 */
export const DIELECTRIC_F0 = 0.04;

/**
 * The result of the mapping: a specular colour and exponent ready to hand to
 * a {@link Mesh}, or `undefined` / `0` when the material implies no
 * highlight at all.
 * @ignore
 * @internal
 */
export interface SpecularTerms {
	/** specular colour `[r, g, b]`, or `undefined` for none */
	specular: number[] | undefined;
	/** specular exponent; `0` disables the term outright */
	shininess: number;
}

/**
 * Read a factor that should default to 1 when absent or malformed.
 *
 * Defaulting rather than propagating matters: `NaN` would fail the `> 0`
 * test below and fall into the mirror-smooth branch, turning a broken file
 * into a chrome one.
 * @param value - the authored factor
 * @returns the factor, or 1
 * @ignore
 * @internal
 */
function factor(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

/**
 * Map a metallic/roughness pair onto a Blinn-Phong specular colour and
 * exponent.
 *
 * - **roughness → exponent** through the usual Blinn-Phong/GGX bridge,
 *   `2 / a^4 - 2` for `a = roughness^2`. A roughness of 1 — which is the
 *   glTF default, and what a matte material declares — lands on exactly 0,
 *   so a material that says nothing gets no highlight and shades exactly as
 *   it did before this existed.
 * - **metallic → tint**, interpolating from the dielectric reflectance to
 *   the material's own base colour. Chrome glints in its own hue while
 *   plaster gets a faint neutral sheen, which is the visible half of the
 *   metal/non-metal distinction.
 * @param roughness - authored roughness (0..1); absent or malformed reads as 1
 * @param metallic - authored metalness (0..1); absent or malformed reads as 1
 * @param baseColor - the material's base colour, `[r, g, b, a?]`
 * @returns the specular terms, inert when the material implies no highlight
 * @ignore
 * @internal
 */
export function specularFromMetallicRoughness(
	roughness: unknown,
	metallic: unknown,
	baseColor: number[] = [1, 1, 1, 1],
): SpecularTerms {
	const r = factor(roughness);
	const m = factor(metallic);
	const a = r * r;
	const shininess =
		a > 0 ? Math.min(MAX_SHININESS, 2 / (a * a) - 2) : MAX_SHININESS;
	if (!(shininess > 0)) {
		return { specular: undefined, shininess: 0 };
	}
	const channel = (index: number) => {
		return DIELECTRIC_F0 + ((baseColor[index] || 0) - DIELECTRIC_F0) * m;
	};
	return { specular: [channel(0), channel(1), channel(2)], shininess };
}
