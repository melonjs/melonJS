import puppeteer from "puppeteer";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { expect } from "expect";
import { toMatchImageSnapshot } from "expect-mocha-image-snapshot";
expect.extend({ toMatchImageSnapshot });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let server;
before(async () => {
    global.browser = await puppeteer.launch({
        headless: "new" // Enable this to see what's going on in the browser
    });
    server = global.server = fastify();
    server.register(fastifyStatic, {
        root: join(__dirname, "..", "public"),
    });
    await server.listen({ port: 8042 });
});

after(() => {
    server?.close();
    process.exit(0);
});

// process.on("uncaughtException", function (err) {
//     console.error(err);
//     process.exit(1);
// });
