import { rm } from "fs/promises";

await rm("build", { recursive: true, force: true });
