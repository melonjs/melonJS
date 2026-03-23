import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, plugin, plugins } from "../src/index.js";

describe("plugin", () => {
	beforeAll(() => {
		boot();
	});

	describe("BasePlugin", () => {
		it("should have a version property", () => {
			const base = new plugin.BasePlugin();
			expect(base.version).toBeDefined();
			expect(typeof base.version).toBe("string");
		});
	});

	describe("patch", () => {
		class BaseObject {
			constructor() {
				this.name = "John Doe";
			}

			setType(t) {
				this.type = t;
			}

			getValue() {
				return 42;
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

		it("should throw when patching a non-existent function", () => {
			expect(() => {
				plugin.patch(BaseObject, "nonExistent", () => {});
			}).toThrow("is not an existing function");
		});

		it("should allow chaining with the original via _patched", () => {
			plugin.patch(BaseObject, "getValue", function () {
				return this._patched() * 2;
			});
			const o = new BaseObject();
			expect(o.getValue()).toBe(84);
		});
	});

	describe("register", () => {
		class TestPlugin extends plugin.BasePlugin {
			constructor() {
				super();
				this.name = "myPlugin";
			}
		}

		beforeAll(() => {
			plugin.register(TestPlugin, "ExamplePlugin");
		});

		it("should register to the plugins namespace", () => {
			expect(plugins.ExamplePlugin).toBeDefined();
		});

		it("should not register to the plugin namespace", () => {
			expect(plugin.ExamplePlugin).not.toBeDefined();
		});

		it("should be retrievable by name", () => {
			const p = plugin.get("ExamplePlugin");
			expect(p).toBeDefined();
			expect(p.name).toBe("myPlugin");
		});

		it("should be retrievable by class type", () => {
			const p = plugin.get(TestPlugin);
			expect(p).toBeDefined();
			expect(p instanceof TestPlugin).toBe(true);
		});

		it("should throw when registering a duplicate name", () => {
			expect(() => {
				plugin.register(TestPlugin, "ExamplePlugin");
			}).toThrow("already registered");
		});

		it("should throw when registering a non-plugin class", () => {
			class NotAPlugin {}
			expect(() => {
				plugin.register(NotAPlugin, "BadPlugin");
			}).toThrow("should extend the BasePlugin");
		});

		it("should return undefined for unknown plugin name", () => {
			expect(plugin.get("NonExistent")).toBeUndefined();
		});

		it("should return undefined for unknown plugin class", () => {
			class UnknownPlugin extends plugin.BasePlugin {}
			expect(plugin.get(UnknownPlugin)).toBeUndefined();
		});
	});
});
