import React, {
	lazy,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { createHashRouter, RouterProvider } from "react-router-dom";

// load all example source files as raw strings
const sourceFiles = import.meta.glob("./examples/**/*.{ts,tsx,js}", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

// lazy-load each example so they are code-split into separate chunks
const ExampleAseprite = lazy(() =>
	import("./examples/aseprite/ExampleAseprite").then((m) => ({
		default: m.ExampleAseprite,
	})),
);
const ExampleBenchmark = lazy(() =>
	import("./examples/benchmark/ExampleBenchmark").then((m) => ({
		default: m.ExampleBenchmark,
	})),
);
const ExampleBlendModes = lazy(() =>
	import("./examples/blendModes/ExampleBlendModes").then((m) => ({
		default: m.ExampleBlendModes,
	})),
);
const ExampleCompressedTextures = lazy(() =>
	import("./examples/compressedTextures/ExampleCompressedTextures").then(
		(m) => ({ default: m.ExampleCompressedTextures }),
	),
);
const ExampleDeviceTest = lazy(() =>
	import("./examples/deviceTest/ExampleDeviceTest").then((m) => ({
		default: m.ExampleDeviceTest,
	})),
);
const ExampleDragAndDrop = lazy(() =>
	import("./examples/dragAndDrop/ExampleDragAndDrop").then((m) => ({
		default: m.ExampleDragAndDrop,
	})),
);
const ExampleGradients = lazy(() =>
	import("./examples/gradients/ExampleGradients").then((m) => ({
		default: m.ExampleGradients,
	})),
);
const ExampleGraphics = lazy(() =>
	import("./examples/graphics/ExampleGraphics").then((m) => ({
		default: m.ExampleGraphics,
	})),
);
const ExampleHelloWorld = lazy(() =>
	import("./examples/helloWorld/ExampleHelloWorld").then((m) => ({
		default: m.ExampleHelloWorld,
	})),
);
const ExampleIsometricRPG = lazy(() =>
	import("./examples/isometricRpg/ExampleIsometricRPG").then((m) => ({
		default: m.ExampleIsometricRPG,
	})),
);
const ExampleLights = lazy(() =>
	import("./examples/lights/ExampleLights").then((m) => ({
		default: m.ExampleLights,
	})),
);
const ExampleLineOfSight = lazy(() =>
	import("./examples/lineOfSight/ExampleLineOfSight").then((m) => ({
		default: m.ExampleLineOfSight,
	})),
);
const ExampleMasking = lazy(() =>
	import("./examples/masking/ExampleMasking").then((m) => ({
		default: m.ExampleMasking,
	})),
);
const ExampleMesh3d = lazy(() =>
	import("./examples/mesh3d/ExampleMesh3d").then((m) => ({
		default: m.ExampleMesh3d,
	})),
);
const ExampleMesh3dMaterial = lazy(() =>
	import("./examples/mesh3dMaterial/ExampleMesh3dMaterial").then((m) => ({
		default: m.ExampleMesh3dMaterial,
	})),
);
const ExamplePlatformer = lazy(() =>
	import("./examples/platformer/ExamplePlatformer").then((m) => ({
		default: m.ExamplePlatformer,
	})),
);
const ExampleSpaceInvaders = lazy(() =>
	import("./examples/spaceInvaders/ExampleSpaceInvaders").then((m) => ({
		default: m.ExampleSpaceInvaders,
	})),
);
const ExampleSpine = lazy(() =>
	import("./examples/spine/ExampleSpine").then((m) => ({
		default: m.ExampleSpine,
	})),
);
const ExampleShaderEffects = lazy(() =>
	import("./examples/shaderEffects/ExampleShaderEffects").then((m) => ({
		default: m.ExampleShaderEffects,
	})),
);
const ExampleSprite = lazy(() =>
	import("./examples/sprite/ExampleSprite").then((m) => ({
		default: m.ExampleSprite,
	})),
);
const ExampleTrail = lazy(() =>
	import("./examples/trail/ExampleTrail").then((m) => ({
		default: m.ExampleTrail,
	})),
);
const ExampleSVGShapes = lazy(() =>
	import("./examples/svgShapes/ExampleSVGShapes").then((m) => ({
		default: m.ExampleSVGShapes,
	})),
);
const ExampleText = lazy(() =>
	import("./examples/text/ExampleText").then((m) => ({
		default: m.ExampleText,
	})),
);
const ExampleTexturePacker = lazy(() =>
	import("./examples/texturePacker/ExampleTexturePacker").then((m) => ({
		default: m.ExampleTexturePacker,
	})),
);
const ExampleTiledMapLoader = lazy(() =>
	import("./examples/tiledMapLoader/ExampleTiledMapLoader").then((m) => ({
		default: m.ExampleTiledMapLoader,
	})),
);
const ExampleUI = lazy(() =>
	import("./examples/ui/ExampleUI").then((m) => ({ default: m.ExampleUI })),
);
const ExampleVideo = lazy(() =>
	import("./examples/video/ExampleVideo").then((m) => ({
		default: m.ExampleVideo,
	})),
);
const ExampleWhacAMole = lazy(() =>
	import("./examples/whac-a-mole/ExampleWhacAMole").then((m) => ({
		default: m.ExampleWhacAMole,
	})),
);

const examples: {
	label: string;
	path: string;
	sourceDir: string;
	description: string;
	component: React.ReactElement;
}[] = [
	{
		component: <ExampleAseprite />,
		label: "Aseprite",
		path: "aseprite",
		sourceDir: "aseprite",
		description:
			"Loading and playing animations from Aseprite sprite sheets with tag-based animation control.",
	},
	{
		component: <ExampleBenchmark />,
		label: "Sprite Benchmark",
		path: "benchmark",
		sourceDir: "benchmark",
		description:
			"Stress test rendering thousands of animated sprites to measure engine performance.",
	},
	{
		component: <ExampleBlendModes />,
		label: "Blend Modes",
		path: "blend-modes",
		sourceDir: "blendModes",
		description:
			"Visual comparison of all supported blend modes (normal, multiply, screen, overlay, darken, lighten, etc.).",
	},
	{
		component: <ExampleCompressedTextures />,
		label: "Compressed Textures",
		path: "compressed-textures",
		sourceDir: "compressedTextures",
		description:
			"Detect and display GPU-supported compressed texture formats (S3TC, ASTC, ETC2, PVRTC, BPTC).",
	},
	{
		component: <ExampleDeviceTest />,
		label: "Device Test",
		path: "device-test",
		sourceDir: "deviceTest",
		description:
			"Display device capabilities, screen resolution, and browser feature detection.",
	},
	{
		component: <ExampleDragAndDrop />,
		label: "Drag and Drop",
		path: "drag-and-drop",
		sourceDir: "dragAndDrop",
		description:
			"Interactive drag-and-drop with pointer events, collision detection, and drop zones.",
	},
	{
		component: <ExampleGradients />,
		label: "Gradients",
		path: "gradients",
		sourceDir: "gradients",
		description:
			"Linear and radial gradients for sky backgrounds, health bars, UI buttons, and lighting effects.",
	},
	{
		component: <ExampleGraphics />,
		label: "Graphics",
		path: "graphics",
		sourceDir: "graphics",
		description:
			"Drawing primitives: rectangles, circles, ellipses, lines, polygons, and rounded shapes.",
	},
	{
		component: <ExampleHelloWorld />,
		label: "Hello World",
		path: "hello-world",
		sourceDir: "helloWorld",
		description:
			"Minimal setup showing engine initialization, viewport configuration, and text rendering.",
	},
	{
		component: <ExampleIsometricRPG />,
		label: "Isometric RPG",
		path: "isometric-rpg",
		sourceDir: "isometricRpg",
		description:
			"Isometric tile map rendering with Tiled map support, camera follow, and NPC entities.",
	},
	{
		component: <ExampleLights />,
		label: "Lights",
		path: "lights",
		sourceDir: "lights",
		description:
			"2D lighting system with dynamic light sources, shadows, and blend mode effects.",
	},
	{
		component: <ExampleLineOfSight />,
		label: "Line of Sight",
		path: "line-of-sight",
		sourceDir: "lineOfSight",
		description:
			"Raycasting demo with draggable objects that change color when hit by a rotating line.",
	},
	{
		component: <ExampleMasking />,
		label: "Masking",
		path: "masking",
		sourceDir: "masking",
		description:
			"Sprite masking with different shapes (rounded rectangle, ellipse, star polygon) and blend modes.",
	},
	{
		component: <ExampleMesh3d />,
		label: "3D Mesh",
		path: "mesh-3d",
		sourceDir: "mesh3d",
		description:
			"Rotating textured 3D objects (cube, sphere, teapot) loaded from OBJ files with checkerboard texture and perspective projection.",
	},
	{
		component: <ExampleMesh3dMaterial />,
		label: "3D Material",
		path: "mesh-3d-material",
		sourceDir: "mesh3dMaterial",
		description:
			"3D cube pet models from Kenney with MTL material support — texture and colors auto-resolved from .mtl files.",
	},
	{
		component: <ExamplePlatformer />,
		label: "Platformer",
		path: "platformer",
		sourceDir: "platformer",
		description:
			"Side-scrolling platformer with physics, tile collisions, enemies, collectibles, custom shaders, blend modes, particles, and multi-camera minimap.",
	},
	{
		component: <ExampleSpaceInvaders />,
		label: "Space Invaders",
		path: "space-invaders",
		sourceDir: "spaceInvaders",
		description:
			"Classic space invaders game with player movement, shooting mechanics, and enemy wave patterns.",
	},
	{
		component: <ExampleShaderEffects />,
		label: "Shader Effects",
		path: "shader-effects",
		sourceDir: "shaderEffects",
		description:
			"Showcase of all 16 built-in ShaderEffect presets for per-sprite visual effects (WebGL).",
	},
	{
		component: <ExampleSprite />,
		label: "Sprite",
		path: "sprite",
		sourceDir: "sprite",
		description:
			"Displaying and transforming sprites with scaling, rotation, and alpha blending.",
	},
	{
		component: <ExampleTrail />,
		label: "Trail",
		path: "trail",
		sourceDir: "trail",
		description:
			"Trail renderable that draws a fading, tapering ribbon behind a moving sprite.",
	},
	{
		component: <ExampleSpine />,
		label: "Spine Animation",
		path: "spine",
		sourceDir: "spine",
		description:
			"Loading and playing Spine skeletal animations with the @melonjs/spine-plugin through custom WebGL Batcher integration.",
	},
	{
		component: <ExampleSVGShapes />,
		label: "SVG Shapes",
		path: "svg-shapes",
		sourceDir: "svgShapes",
		description:
			"Rendering complex shapes via SVG path parsing (M, L, Q, C, A commands) on both WebGL and Canvas.",
	},
	{
		component: <ExampleText />,
		label: "Text",
		path: "text",
		sourceDir: "text",
		description:
			"Bitmap fonts, system fonts, text alignment, word wrapping, and styled text rendering.",
	},
	{
		component: <ExampleTexturePacker />,
		label: "Texture Packer",
		path: "texture-packer",
		sourceDir: "texturePacker",
		description:
			"Loading and using TexturePacker atlas for sprite animation and background rendering.",
	},
	{
		component: <ExampleTiledMapLoader />,
		label: "Tiled Map Loader",
		path: "tiled-map-loader",
		sourceDir: "tiledMapLoader",
		description:
			"Loading various Tiled map formats: orthogonal, isometric, hexagonal, and perspective.",
	},
	{
		component: <ExampleUI />,
		label: "UI",
		path: "ui",
		sourceDir: "ui",
		description:
			"Draggable UI panels with buttons, checkboxes, and custom font rendering.",
	},
	{
		component: <ExampleVideo />,
		label: "Video",
		path: "video",
		sourceDir: "video",
		description:
			"Video playback using the asset loader and Sprite class to display an MP4 video on canvas.",
	},
	{
		component: <ExampleWhacAMole />,
		label: "Whac-A-Mole",
		path: "whac-a-mole",
		sourceDir: "whac-a-mole",
		description:
			"Complete mini-game with sprite animations, input handling, scoring, and audio.",
	},
];

const AceEditorPane = ({ value, mode }: { value: string; mode: string }) => {
	const editorRef = useRef<HTMLDivElement>(null);
	const editorInstance = useRef<import("ace-builds").Ace.Editor | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run once on mount; value/mode are read for initial content only
	useEffect(() => {
		if (!editorRef.current || editorInstance.current) return;
		// ace must load first — modes and themes depend on the global `ace` variable
		import("ace-builds/src-noconflict/ace")
			.then(async (aceModule) => {
				await Promise.all([
					import("ace-builds/src-noconflict/mode-javascript"),
					import("ace-builds/src-noconflict/mode-typescript"),
					import("ace-builds/src-noconflict/theme-one_dark"),
				]);
				const aceLib = aceModule.default || aceModule;
				if (!editorRef.current) return;
				const editor = aceLib.edit(editorRef.current);
				editor.setTheme("ace/theme/one_dark");
				editor.setReadOnly(true);
				editor.setShowPrintMargin(false);
				editor.setHighlightActiveLine(false);
				editor.setFontSize(13);
				editor.setOptions({
					showLineNumbers: true,
					tabSize: 2,
					useWorker: false,
				});
				// set the initial content
				editor.setValue(value, -1);
				editor.session.setMode(`ace/mode/${mode}`);
				editorInstance.current = editor;
			})
			.catch((err) => {
				console.warn("Failed to load code editor:", err);
			});
		return () => {
			if (editorInstance.current) {
				editorInstance.current.destroy();
				editorInstance.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (editorInstance.current) {
			editorInstance.current.setValue(value, -1);
			editorInstance.current.session.setMode(`ace/mode/${mode}`);
		}
	}, [value, mode]);

	return <div ref={editorRef} style={{ width: "100%", height: "100%" }} />;
};

const ExampleLayout = ({
	label,
	sourceDir,
	children,
}: {
	label: string;
	sourceDir: string;
	children: ReactElement;
}) => {
	const [showCode, setShowCode] = useState(false);

	// collect source files for this example
	const files = useMemo(() => {
		const prefix = `./examples/${sourceDir}/`;
		return Object.entries(sourceFiles)
			.filter(([path]) => path.startsWith(prefix) && !path.includes("/assets/"))
			.map(([path, content]) => ({
				name: path.replace(prefix, ""),
				content: content as string,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [sourceDir]);

	const [activeFile, setActiveFile] = useState(0);

	return (
		<>
			<div className="example-topbar">
				<a href={import.meta.env.BASE_URL} className="example-back">
					&larr; Examples
				</a>
				<span className="example-topbar-title">{label}</span>
				<button
					type="button"
					className="example-code-toggle"
					onClick={() => setShowCode((prev) => !prev)}
				>
					{showCode ? "Hide Code" : "Show Code"}
				</button>
				<a
					href={`https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/${sourceDir}`}
					target="_blank"
					rel="noopener noreferrer"
					className="example-source"
				>
					GitHub
				</a>
			</div>
			{children}
			{showCode && files.length > 0 && (
				<div className="example-editor">
					{files.length > 1 && (
						<div className="editor-tabs">
							{files.map((file, i) => (
								<button
									type="button"
									key={file.name}
									className={`editor-tab ${i === activeFile ? "active" : ""}`}
									onClick={() => setActiveFile(i)}
								>
									{file.name}
								</button>
							))}
						</div>
					)}
					<AceEditorPane
						value={files[activeFile].content}
						mode={
							files[activeFile].name.endsWith(".ts") ||
							files[activeFile].name.endsWith(".tsx")
								? "typescript"
								: "javascript"
						}
					/>
				</div>
			)}
		</>
	);
};

const Index = () => {
	return (
		<div className="index-page">
			<header className="index-header">
				<img
					src="https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png"
					alt="melonJS"
					className="index-logo"
				/>
				<p className="index-subtitle">
					Interactive examples showcasing engine features and capabilities.
				</p>
			</header>
			<div className="index-grid">
				{examples.map((example) => (
					<a
						key={example.path}
						href={`${import.meta.env.BASE_URL}#/${example.path}`}
						target="_blank"
						rel="noopener noreferrer"
						className="example-card"
					>
						<h3 className="example-card-title">{example.label}</h3>
						<p className="example-card-desc">{example.description}</p>
					</a>
				))}
			</div>
			<footer className="index-footer">
				<a href="https://melonjs.org">melonjs.org</a>
				<span className="separator">|</span>
				<a href="https://github.com/melonjs/melonJS">GitHub</a>
				<span className="separator">|</span>
				<a href="https://melonjs.github.io/melonJS/">API Docs</a>
			</footer>
		</div>
	);
};

const router = createHashRouter([
	{
		path: "/",
		element: <Index />,
	},
	...examples.map((example) => {
		return {
			path: `/${example.path}`,
			element: (
				<ExampleLayout label={example.label} sourceDir={example.sourceDir}>
					<Suspense>{example.component}</Suspense>
				</ExampleLayout>
			),
		};
	}),
]);

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(rootEl).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
);
