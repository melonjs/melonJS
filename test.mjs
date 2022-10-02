import puppeteer from "puppeteer";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let server;
global.browser = await puppeteer.launch();
server = global.server = fastify();
server.register(fastifyStatic, {
    root: join(__dirname, "tests/browser/public"),
});
await server.listen({ port: 8042 });
