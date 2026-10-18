export const ScaleMethods = {
	/**
	 * Manual; no automatic scaling is performed. The canvas keeps the size it
	 * was given and nothing is measured.
	 *
	 * No illustration: there is nothing to show. The one that used to sit
	 * here was `Fit`'s.
	 */
	Manual: "manual",

	/**
	 * Letterboxed; the DESIGN RESOLUTION is kept and the whole frame is scaled
	 * to the largest factor that fits, leaving the rest as margin.
	 *
	 * The one mode where the game always sees exactly the world it was
	 * authored for: every other mode resizes the renderer, so the viewport
	 * grows or shrinks with the window. It is also the only mode
	 * `scaleRounding` applies to, since it is the only one with a fixed
	 * factor to round.
	 * <img src="images/scale-fit.png"/>
	 */
	Fit: "fit",

	/**
	 * Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio
	 * <img src="images/scale-fill-min.png"/>
	 */
	FillMin: "fill-min",

	/**
	 * Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio
	 * <img src="images/scale-fill-max.png"/>
	 */
	FillMax: "fill-max",

	/**
	 * Canvas width & height is resized to fit; content is scaled to design aspect ratio
	 * <img src="images/scale-flex.png"/>
	 */
	Flex: "flex",

	/**
	 * Canvas width is resized to fit; content is scaled to design aspect ratio
	 * <img src="images/scale-flex-width.png"/>
	 */
	FlexWidth: "flex-width",

	/**
	 * Canvas height is resized to fit; content is scaled to design aspect ratio
	 * <img src="images/scale-flex-height.png"/>
	 */
	FlexHeight: "flex-height",

	/**
	 * Canvas is resized to fit; content is scaled to screen aspect ratio
	 * <img src="images/scale-stretch.png"/>
	 */
	Stretch: "stretch",
} as const;

export type ScaleMethod = (typeof ScaleMethods)[keyof typeof ScaleMethods];
