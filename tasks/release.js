'use strict';
module.exports = function(grunt) {
    var git = require('gift');
    var path = require('path');
    grunt.registerTask('dorelease', 'MelonJS Release', function() {
        var repo = git(path.join(__dirname, '..'));
        var config = grunt.file.readJSON(path.join(repo.path, 'package.json'));
        var buildPath = path.join(__dirname, '..', 'build');
        var version = config.version;

        grunt.log.oklns('ACTUAL VERSION ==> ' + config.version);
        // checkout to the master branch (latest commit)
        repo.checkout('master', function(err) {
            if (err){
               grunt.log.error(err);
            }
        });

        grunt.log.oklns('BUILD FILES');
        var filenames = [
            path.join(buildPath, 'melonjs-' + version + '.js'),
            path.join(buildPath, 'melonjs-' + version + '-min.js')
        ];

        // check the build files from the actual version
        // and add the js files to be commited
        for (var i = 0; i < filenames.length; i++) {
            if (grunt.file.exists(filenames[i])) {
                grunt.log.writeln(filenames[i]);
                repo.add(filenames[i], {'force': true}, function(err) {
                    if (err) {
                        grunt.log.error(err);
                    }
                });
            }
        }

        // commit the new version release
        repo.commit('Release ' + version, function(err) {
            if (err) {
                grunt.log.error(err);
            }
        });

        // create new tag
        repo.create_tag(version, function(err) {
            if (err) {
                grunt.log.error(err);
            }
        });

        // push to master
        repo.sync(function(err) {
            if (err) {
                grunt.log.error(err);
            }
        });
    });
}
