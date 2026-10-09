import { expectTypeOf, it } from "vitest";
import type {
	BitmapText,
	GlyphEffect,
	GlyphEffectContext,
	GlyphEffectOutput,
} from "../src/index.js";

it("exports the callback types used by the public BitmapText API", () => {
	expectTypeOf<BitmapText["glyphEffect"]>().toEqualTypeOf<GlyphEffect | null>();
	expectTypeOf<GlyphEffect>().parameter(0).toEqualTypeOf<GlyphEffectOutput>();
	expectTypeOf<GlyphEffect>().parameter(1).toEqualTypeOf<GlyphEffectContext>();
	expectTypeOf<GlyphEffectContext["time"]>().toEqualTypeOf<number>();
});
