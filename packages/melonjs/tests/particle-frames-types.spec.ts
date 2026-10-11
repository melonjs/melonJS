import { expectTypeOf, it } from "vitest";
import type { ParticleEmitter } from "../src/index.js";

type Settings = NonNullable<ConstructorParameters<typeof ParticleEmitter>[2]>;

it("accepts readonly particle frame sequences and optional sheet dimensions", () => {
	expectTypeOf<Settings["frames"]>().toEqualTypeOf<
		readonly number[] | undefined
	>();
	expectTypeOf<Settings["framewidth"]>().toEqualTypeOf<number | undefined>();
	expectTypeOf<Settings["frameheight"]>().toEqualTypeOf<number | undefined>();
	expectTypeOf<Settings["randomFrame"]>().toEqualTypeOf<boolean | undefined>();
});
