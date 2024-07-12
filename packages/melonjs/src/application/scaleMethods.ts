export const ScaleMethods = {
	/**
	 * Manual; no scaling is performed
	 * <img src="images/scale-fit.png"/>
	 */
	Manual: "manual",

	/**
	 * Letterboxed; content is scaled to design aspect ratio
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
