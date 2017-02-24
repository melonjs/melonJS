"use strict";
var path = require("path");
var shell = require("shelljs");
var Q = require("q");

module.exports = function (grunt) {
    grunt.registerTask("dorelease", "MelonJS Release", function () {
        var repo = path.join(__dirname, "..");
        var config = grunt.file.readJSON(path.join(repo, "package.json"));
        var version = config.version;
        var currBranch;
        var verbose = grunt.option("verbose");
        var done = this.async();
        // we could add more options here later
        var shellOpts = {};
        if (!verbose) {
            shellOpts.silent = true;
        }

        function run(cmd, msg) {
            var deferred = Q.defer();
            grunt.verbose.writeln("# " + msg);
            grunt.verbose.writeln("$ " + cmd);
            shell.exec(cmd, shellOpts, function (code, output) {
                if (code === 0) {
                    grunt.log.ok(msg || cmd);
                    deferred.resolve();
                }
                else {
                    // fail and stop execution of further tasks
                    deferred.reject("Error " + code + ": " + cmd + "\n" + output);
                }
            });
            return deferred.promise;
        }

        function checkout() {
            grunt.log.oklns("Creating release: " + version);
            var symbolicRef = shell.exec("git symbolic-ref HEAD", shellOpts).output;
            if (symbolicRef) {
                var splitted = symbolicRef.split('/');
                // the branch name is the last item of the array
                currBranch = splitted.slice(2).join("/");
                if (!currBranch) {
                    throw "Could not get the actual branch from symbolic ref";
                }
            }
            grunt.log.oklns("On branch: " + currBranch);
            return run("git checkout --detach", "Detaching from current tree");
        }

        function add() {
            var filenames = [
                grunt.config.get("path.main"),
                grunt.config.get("path.min")
            ];
            // check the build files from the actual version
            // and add the js files to be commited
            for (var i = 0; i < filenames.length; i++) {
                if (!grunt.file.exists(filenames[i])) {
                    throw "Missing file " + filenames[i] + " is required";
                }
            }
            return run("git add -f " + filenames.join(" "), "Adding build files");
        }

        function commit() {
            return run("git commit -m 'Add build files for " + version + "'", "Commiting release");
        }

        function tag() {
            return run("git tag -am 'Release " + version + "' " + version, "Tagging new version");
        }

        function push() {
            return run("git push origin " + version, "Pushing to new version branch");
        }

        function reset() {
            return run("git reset --hard", "Resetting staged changes");
        }

        function rollback() {
            var backBranch = currBranch !== undefined ? currBranch : "master";
            grunt.verbose.writeln("Original Branch: " + backBranch);
            return run("git checkout " + backBranch, "Checking out initial branch");
        }

        var failed = false;
        Q()
            .then(checkout)
            .then(add)
            .then(commit)
            .then(tag)
            .then(push)
            .catch(function(err) {
                err = err || "Release failed";
                grunt.log.error(err);
                failed = err;
            })
            .finally(function() {
                return Q()
                    .then(reset)
                    .then(rollback)
                    .then(function () {
                        if (failed) {
                            grunt.fail.fatal(failed);
                        }
                    })
                    .then(done)
                    .done();
            })
            .done();
    });
};
