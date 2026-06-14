// Spine constraint classes — re-exported so user code can do
// `instanceof Slider` (etc.) without a second import from
// `@esotericsoftware/spine-core` (the plugin's runtime is already its
// re-export, so this is the same identity).
//
// Slider classes are new in Spine 4.3; the other four classes existed
// in earlier runtimes but are re-exported here so the union returned
// by `findConstraint()` (see the `SpineConstraint` typedef on
// `Spine.js`) can be narrowed in one import.
export {
	IkConstraint,
	PathConstraint,
	PhysicsConstraint,
	Slider,
	SliderData,
	SliderMixTimeline,
	SliderTimeline,
	TransformConstraint,
} from "@esotericsoftware/spine-core";
export { default, default as Spine } from "./Spine.js";
export { SpinePlugin } from "./SpinePlugin.js";
