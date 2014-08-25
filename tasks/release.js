"use strict";
var path = require("path");
var shell = require("shelljs");

module.exports = function (grunt) {
    grunt.registerTask("dorelease", "MelonJS Release", function () {
        var repo = path.join(__dirname, "..");
        var config = grunt.file.readJSON(path.join(repo, "package.json"));
        var version = config.version;
        var currBranch;
        var verbose = grunt.option("verbose");
        // we could add more options here later
        var shellOpts = {};
        if (verbose) {
            shellOpts['verbose'] = true;
        }

        function run(cmd, msg) {
            grunt.verbose.writeln("Running: " + cmd);
            var success = shell.exec(cmd, shellOpts).code === 0;

            if (success) {
                grunt.log.ok(msg || cmd);
            } else {
                // fail and stop execution of further tasks
                grunt.fail.fatal("Failed when executing '" + cmd  + "'");
            }
        }

        function checkout() {
            var symbolicRef = shell.exec("git symbolic-ref HEAD", shellOpts).output;
            if (symbolicRef) {
                var splitted = symbolicRef.split('/');
                // symbolic ref must contain 3 steps
                // e.g ref/heads/master
                if (splitted.length !== 3) {
                    grunt.fail.fatal("Could not get the actual branch from symbolic ref");
                }
                // the branch name is the last item of the array
                currBranch = splitted[splitted.length - 1];
            }
            run("git checkout --detach", "Detaching from current tree");
        }

        function add() {
            grunt.log.oklns("ACTUAL VERSION ==> " + config.version);
            grunt.log.oklns("BUILD FILES");
            var filenames = [
                grunt.config.get("path.main"),
                grunt.config.get("path.min")
            ];
            // check the build files from the actual version
            // and add the js files to be commited
            var stringFiles = "";
            for (var i = 0; i < filenames.length; i++) {
                if (!grunt.file.exists(filenames[i])) {
                    rollback();
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
            var backBranch = currBranch !== undefined ? currBranch : "master";
            if (verbose) {
                grunt.log.oklns("Original Branch: " + backBranch);
            }
            run("git reset --hard");
            run("git checkout " + backBranch, "Resetting staged changes and back to initial branch");
        }

        try {
            checkout();
            add();
            commit();
            tag();
            push();
        } catch (err) {
            grunt.fail.warn(err || "release failed");
        } finally {
            rollback();
        }
    });
};
