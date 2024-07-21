import React, { type ReactElement } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Link, RouterProvider, createBrowserRouter } from "react-router-dom";
import { ExampleAseprite } from "./examples/aseprite/ExampleAseprite";
import { ExampleBenchmark } from "./examples/benchmark/ExampleBenchmark";
import { ExampleDeviceTest } from "./examples/deviceTest/ExampleDeviceTest";
import { ExampleDragAndDrop } from "./examples/dragAndDrop/ExampleDragAndDrop";
import { ExampleGraphics } from "./examples/graphics/ExampleGraphics";
import { ExampleHelloWorld } from "./examples/helloWorld/ExampleHelloWorld";
import { ExampleIsometricRPG } from "./examples/isometricRpg/ExampleIsometricRPG";
import { ExampleLights } from "./examples/lights/ExampleLights";
import { ExamplePlatformer } from "./examples/platformer/ExamplePlatformer";
import { ExampleText } from "./examples/text/ExampleText";
import { ExampleWhacAMole } from "./examples/whac-a-mole/ExampleWhacAMole";

const examples: { label: string; path: string; component: ReactElement }[] = [
	{
		component: <ExampleAseprite />,
		label: "aseprite",
		path: "aseprite",
	},
	{
		component: <ExampleBenchmark />,
		label: "Sprite benchmark",
		path: "benchmark",
	},
	{
		component: <ExampleDeviceTest />,
		label: "device test",
		path: "device-test",
	},
	{
		component: <ExampleDragAndDrop />,
		label: "drag and drop",
		path: "drag-and-drop",
	},
	{
		component: <ExampleGraphics />,
		label: "graphics",
		path: "graphics",
	},
	{
		component: <ExampleHelloWorld />,
		label: "hello world",
		path: "hello-world",
	},
	{
		component: <ExampleIsometricRPG />,
		label: "isometric rpg",
		path: "isometric-rpg",
	},
	{
		component: <ExampleLights />,
		label: "lights",
		path: "lights",
	},
	{
		component: <ExamplePlatformer />,
		label: "platformer",
		path: "platformer",
	},
	{
		component: <ExampleText />,
		label: "text",
		path: "text",
	},
	{
		component: <ExampleWhacAMole />,
		label: "Whac-A-Mole",
		path: "whac-a-mole",
	},
];

const Index = () => {
	return (
		<>
			<ul>
				{examples.map((example) => {
					return (
						<li key={example.path}>
							<Link to={example.path} reloadDocument>
								{example.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</>
	);
};

const router = createBrowserRouter([
	{
		path: "/",
		element: <Index />,
	},
	...examples.map((example) => {
		return {
			path: example.path,
			element: example.component,
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
