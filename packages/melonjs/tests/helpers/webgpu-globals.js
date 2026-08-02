/**
 * Spec-defined WebGPU constant namespaces, polyfilled for runners whose
 * browser doesn't expose the WebGPU API surface at all (the mock-device
 * unit suites must stay green with zero GPU support). Values are the
 * WebGPU spec constants — a real browser's own namespaces always win.
 */
globalThis.GPUBufferUsage ??= {
	MAP_READ: 0x0001,
	MAP_WRITE: 0x0002,
	COPY_SRC: 0x0004,
	COPY_DST: 0x0008,
	INDEX: 0x0010,
	VERTEX: 0x0020,
	UNIFORM: 0x0040,
	STORAGE: 0x0080,
	INDIRECT: 0x0100,
	QUERY_RESOLVE: 0x0200,
};

globalThis.GPUShaderStage ??= {
	VERTEX: 0x1,
	FRAGMENT: 0x2,
	COMPUTE: 0x4,
};

globalThis.GPUTextureUsage ??= {
	COPY_SRC: 0x01,
	COPY_DST: 0x02,
	TEXTURE_BINDING: 0x04,
	STORAGE_BINDING: 0x08,
	RENDER_ATTACHMENT: 0x10,
};
