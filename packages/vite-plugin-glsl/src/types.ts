export type GlobPattern = string | string[];

type Compress = boolean | ((shader: string) => string);

export type LoadingOptions = {
	// Warn if the same chunk was imported multiple times
	warnDuplicatedImports: boolean;

	// Shader suffix when no extension is specified
	defaultExtension: string;

	// Compress output shader code
	compress: Compress;

	// Directory for root imports
	root: string;
};

export type PluginOptions = Partial<LoadingOptions> & {
	// Glob pattern(s array) to import
	include?: GlobPattern;

	// Glob pattern(s array) to ignore
	exclude?: GlobPattern;

	// Recompile shader on change
	watch?: boolean;
};

export type LoadingOutput = {
	// Map of shaders that import other chunks
	dependentChunks: Map<string, string[]>;

	// Shader file with included chunks
	outputShader: string;
};
