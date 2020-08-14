/* eslint-disable no-global-assign, no-native-reassign */
if (typeof console === "undefined") {
    /**
     * Dummy console.log to avoid crash
     * in case the browser does not support it
     * @ignore
     */
    console = {
        log : function () {},
        info : function () {},
        error : function () {
            alert(Array.prototype.slice.call(arguments).join(", "));
        }
    };
}
/* eslint-enable no-global-assign, no-native-reassign */
