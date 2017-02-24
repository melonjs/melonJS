module.exports = function (grunt) {
    function task() {
        var dot     = require("dot"),
            options = this.options({
                "varname"           : "ctx",
            });

        this.files.forEach(function (file) {
            var dots = dot.process({
                "path"              : file.src,
                "destination"       : file.dest,
                "templateSettings"  : options,
            });

            Object.keys(dots).forEach(function (name) {
                grunt.file.write(
                    file.dest + name,
                    dots[name].toString()
                );
            });

        });
    }

    grunt.registerMultiTask("dot", "Compile templates with doT", task);
};
