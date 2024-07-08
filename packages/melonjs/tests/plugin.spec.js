import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { plugin, plugins } from "../src/index.js";

describe("plugin", () => {
	describe("patch", () => {
		class BaseObject {
			constructor() {
				this.name = "John Doe";
			}

			setType(t) {
				this.type = t;
			}
		}

		plugin.patch(BaseObject, "setType", function (t) {
			this._patched(t);
			this.name = "John Smith";
		});

		let obj;
		beforeEach(() => {
			obj = new BaseObject();
			obj.setType("something_awesome");
		});

		it("type should be 'something_awesome'", () => {
			expect(obj.type).toEqual("something_awesome");
		});

		it("name should be 'John Smith'", () => {
			expect(obj.name).toEqual("John Smith");
		});
	});

	describe("register", () => {
		class Plugin extends plugin.BasePlugin {
			constructor() {
				super();
				this.name = "myPlugin";
			}
		}

		beforeAll(() => {
			plugin.register(Plugin, "ExamplePlugin");
		});

		it("should register to the plugins namespace", () => {
			expect(plugins.ExamplePlugin).toBeDefined();
		});

		it("should not register to the plugin namespace", () => {
			expect(plugin.ExamplePlugin).not.toBeDefined();
		});
	});
});
