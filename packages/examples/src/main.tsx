import React from "react";
import ReactDOM from "react-dom/client";
import { Link, RouterProvider, createBrowserRouter } from "react-router-dom";
import { ExampleAseprite } from "./examples/aseprite/ExampleAseprite";
import { ExampleCollisionTest } from "./examples/collisionTest/ExampleCollisionTest";
import "./index.css";
import { ExampleDeviceTest } from "./examples/deviceTest/ExampleDeviceTest";
import { ExampleDragAndDrop } from "./examples/dragAndDrop/ExampleDragAndDrop";

const Index = () => {
	return (
		<>
			<ul>
				<li>
					<Link to="aseprite" reloadDocument>
						aseprite
					</Link>
				</li>
				<li>
					<Link to="collision-test" reloadDocument>
						collision test
					</Link>
				</li>
				<li>
					<Link to="device-test" reloadDocument>
						device test
					</Link>
				</li>
				<li>
					<Link to="drag-and-drop" reloadDocument>
						drag and drop
					</Link>
				</li>
			</ul>
		</>
	);
};

const router = createBrowserRouter([
	{
		path: "/",
		element: <Index />,
	},
	{
		path: "aseprite",
		element: <ExampleAseprite />,
	},
	{
		path: "collision-test",
		element: <ExampleCollisionTest />,
	},
	{
		path: "device-test",
		element: <ExampleDeviceTest />,
	},
	{
		path: "drag-and-drop",
		element: <ExampleDragAndDrop />,
	},
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
