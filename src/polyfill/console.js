if (typeof window !== "undefined") {
    if (typeof window.console === "undefined") {
        window.console = {};
        window.console.log = function() {};
        window.console.assert = function() {};
        window.console.warn = function() {};
        window.console.error = function() {
            alert(Array.prototype.slice.call(arguments).join(", "));
        };
    }
}
