'use strict';
module.exports = function(grunt) {
    var git = require('gift');
    grunt.registerTask('release', 'MelonJS Release', function() {
        var repo = git('./');
        var config = grunt.file.readJSON('./package.json');
        var version = config.version;
        console.log(config.version);
    });
}
