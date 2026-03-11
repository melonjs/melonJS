import React, { type ReactElement } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { ExampleAseprite } from "./examples/aseprite/ExampleAseprite";
import { ExampleBenchmark } from "./examples/benchmark/ExampleBenchmark";
import { ExampleDeviceTest } from "./examples/deviceTest/ExampleDeviceTest";
import { ExampleDragAndDrop } from "./examples/dragAndDrop/ExampleDragAndDrop";
import { ExampleGraphics } from "./examples/graphics/ExampleGraphics";
import { ExampleHelloWorld } from "./examples/helloWorld/ExampleHelloWorld";
import { ExampleIsometricRPG } from "./examples/isometricRpg/ExampleIsometricRPG";
import { ExampleLights } from "./examples/lights/ExampleLights";
import { ExampleLineOfSight } from "./examples/lineOfSight/ExampleLineOfSight";
import { ExampleMasking } from "./examples/masking/ExampleMasking";
import { ExamplePlatformer } from "./examples/platformer/ExamplePlatformer";
import { ExampleSpaceInvaders } from "./examples/spaceInvaders/ExampleSpaceInvaders";
import { ExampleSprite } from "./examples/sprite/ExampleSprite";
import { ExampleSVGShapes } from "./examples/svgShapes/ExampleSVGShapes";
import { ExampleText } from "./examples/text/ExampleText";
import { ExampleTexturePacker } from "./examples/texturePacker/ExampleTexturePacker";
import { ExampleTiledMapLoader } from "./examples/tiledMapLoader/ExampleTiledMapLoader";
import { ExampleUI } from "./examples/ui/ExampleUI";
import { ExampleVideo } from "./examples/video/ExampleVideo";
import { ExampleWhacAMole } from "./examples/whac-a-mole/ExampleWhacAMole";

const examples: {
	label: string;
	path: string;
	sourceDir: string;
	description: string;
	component: ReactElement;
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
		component: <ExamplePlatformer />,
		label: "Platformer",
		path: "platformer",
		sourceDir: "platformer",
		description:
			"Side-scrolling platformer with physics, tile collisions, enemies, and collectibles.",
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
		component: <ExampleSprite />,
		label: "Sprite",
		path: "sprite",
		sourceDir: "sprite",
		description:
			"Displaying and transforming sprites with scaling, rotation, and alpha blending.",
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

const basePath = import.meta.env.BASE_URL;

const ExampleLayout = ({
	label,
	sourceDir,
	children,
}: {
	label: string;
	sourceDir: string;
	children: ReactElement;
}) => {
	return (
		<>
			<div className="example-topbar">
				<Link to={basePath} reloadDocument className="example-back">
					&larr; Examples
				</Link>
				<span className="example-topbar-title">{label}</span>
				<a
					href={`https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/${sourceDir}`}
					target="_blank"
					rel="noopener noreferrer"
					className="example-source"
				>
					View Source
				</a>
			</div>
			{children}
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
					<Link
						key={example.path}
						to={`${basePath}${example.path}`}
						reloadDocument
						className="example-card"
					>
						<h3 className="example-card-title">{example.label}</h3>
						<p className="example-card-desc">{example.description}</p>
					</Link>
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

const router = createBrowserRouter([
	{
		path: basePath,
		element: <Index />,
	},
	...examples.map((example) => {
		return {
			path: `${basePath}${example.path}`,
			element: (
				<ExampleLayout label={example.label} sourceDir={example.sourceDir}>
					{example.component}
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
