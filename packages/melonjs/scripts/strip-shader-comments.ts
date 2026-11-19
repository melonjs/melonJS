/**
 * Shader source without its comments.
 *
 * A minifier never looks inside a string, and a shader is one: without this,
 * every comment of every `.vert`, `.frag` and `.wgsl` file is in the published
 * build, and in every game made with it. They were two thirds of the shader
 * text.
 *
 * Used by the build (`scripts/build.ts`) and by the tests (`vitest.config.ts`),
 * so that the tests compile the text that ships.
 *
 * Line breaks are kept, those inside a block comment too: a line of the result
 * is the same line of the source file, which is what a shader compiler's error
 * message points at. Nothing else is touched: no line is joined to the next (a
 * preprocessor directive stays on its own), and no spacing is squeezed.
 * @param source - the shader source, GLSL or WGSL
 * @returns the source with its `//` and block comments removed
 */
export function stripShaderComments(source: string): string {
	// One pass, whichever comment starts first: a `/*` written inside a `//`
	// comment opens nothing, and a `//` inside a block comment ends nothing.
	// The spaces before a comment go with it.
	return source.replace(
		/[ \t]*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g,
		(comment: string, offset: number) => {
			const lineBreaks = comment.replace(/[^\n]/g, "");
			if (lineBreaks !== "" || !comment.trimStart().startsWith("/*")) {
				return lineBreaks;
			}
			// a block comment on one line: with code after it, the words
			// either side of it stay apart
			const next = source[offset + comment.length] as string | undefined;
			return next === undefined || next === "\n" || next === "\r" ? "" : " ";
		},
	);
}
