if (typeof globalThis !== "undefined") {
	if (typeof globalThis.console === "undefined") {
		globalThis.console = {} as Console;
		globalThis.console.log = function () {};
		globalThis.console.assert = function () {};
		globalThis.console.warn = function () {};
		globalThis.console.error = function (...args: any[]) {
			alert(Array.prototype.slice.call(args).join(", "));
		};
	}
}
