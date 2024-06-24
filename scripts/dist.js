import { cp } from "node:fs/promises";

await cp("build", "dist", { recursive: true });
