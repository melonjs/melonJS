(function (api) {

    /**
     * a collection of file utility functions
     * @namespace me.utils.file
     * @memberOf me
     */
    var file = (function () {
        // hold public stuff in our singleton
        var api = {};

        // regexp to deal with file name & path
        var REMOVE_PATH = /^.*(\\|\/|\:)/;
        var REMOVE_EXT = /\.[^\.]*$/;

        /**
         * return the base name of the file without path info
         * @public
         * @function
         * @memberOf me.utils.file
         * @name getBasename
         * @param  {String} path path containing the filename
         * @return {String} the base name without path information.
         */
        api.getBasename = function (path) {
            return path.replace(REMOVE_PATH, "").replace(REMOVE_EXT, "");
        };

        /**
         * return the extension of the file in the given path
         * @public
         * @function
         * @memberOf me.utils.file
         * @name getExtension
         * @param  {String} path path containing the filename
         * @return {String} filename extension.
         */
        api.getExtension = function (path) {
            return path.substring(path.lastIndexOf(".") + 1, path.length);
        };

        // return our object
        return api;
    })();

    api.file = file;

})(me.utils);
