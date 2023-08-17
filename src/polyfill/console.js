if (typeof globalThis !== "undefined") {
    if (typeof globalThis.console === "undefined") {
        globalThis.console = {};
        globalThis.console.log = function() {};
        globalThis.console.assert = function() {};
        globalThis.console.warn = function() {};
        globalThis.console.error = function() {
            alert(Array.prototype.slice.call(arguments).join(", "));
        };
    }
}
