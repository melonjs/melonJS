import { rm } from "fs/promises";

await rm("build", { recursive: true, force: true });
await rm("dist", { recursive: true, force: true });
