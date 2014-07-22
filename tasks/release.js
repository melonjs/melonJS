"use strict";
var path = require("path");
var Q = require("q");
var shell = require("shelljs");

module.exports = function (grunt) {
    grunt.registerTask("dorelease", "MelonJS Release", function () {
        var repo = path.join(__dirname, "..");
        var config = grunt.file.readJSON(path.join(repo, "package.json"));
        var buildPath = path.join(__dirname, "..", "build");
        var version = config.version;
        var done = this.async();

        function run(cmd, msg) {
            var deferred = Q.defer();
            var success;
            grunt.verbose.writeln("Running: " + cmd);
            if (!grunt.option("verbose")) {
              success = shell.exec(cmd, {silent: true}).code === 0;
            } else {
              success = shell.exec(cmd).code === 0;
            }

            if (success) {
                grunt.log.ok(msg || cmd);
                deferred.resolve();
            } else {
                // fail and stop execution of further tasks
                deferred.reject("Failed when executing: `" + cmd + "`\n");
            }
            return deferred.promise;
        }

        function checkout() {
            run("git checkout --detach", "Detaching from current tree");
        }

        function add() {
            grunt.log.oklns("ACTUAL VERSION ==> " + config.version);
            grunt.log.oklns("BUILD FILES");
            var filenames = [
                path.join(buildPath, "melonjs-" + version + ".js"),
                path.join(buildPath, "melonjs-" + version + "-min.js")
            ];
            // check the build files from the actual version
            // and add the js files to be commited
            var stringFiles = "";
            for (var i = 0; i < filenames.length; i++) {
                if (!grunt.file.exists(filenames[i])) {
                    grunt.fail.fatal("Missing file " + filenames[i] + " is required");
                }
                stringFiles += filenames[i] + " ";
            }
            run("git add -f " + stringFiles, "Adding build files");
        }

        function commit() {
            run("git commit -am 'Release " + version + " '", "Commiting release");
        }

        function tag() {
            run("git tag " + version, "Tagging new version");
        }

        function push() {
            run("git push origin " + version, "Pushing to new version branch");
        }

        function rollback() {
            run("git checkout master", "Getting back to master branch");
        }
        // using Q for promises. Using the grunt-release project"s same idea
        Q.fcall(checkout)
        .then(add)
        .then(commit)
        .then(tag)
        .then(push)
        .then(rollback)
        .catch(function (msg) {
            grunt.fail.warn(msg || "release failed");
        }).finally(done);
    });
};
