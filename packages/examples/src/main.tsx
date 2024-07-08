import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ExampleAseprite } from "./examples/aseprite/ExampleAseprite";
import { Index } from "./Index";

const router = createBrowserRouter([
	{
		path: "/",
		element: <Index />,
	},
	{
		path: "aseprite",
		element: <ExampleAseprite />,
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
