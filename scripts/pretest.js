import { cp } from "node:fs/promises";

await cp(
	"./build/melonjs.module.js",
	"./tests/browser/public/lib/melonjs.module.js",
);
