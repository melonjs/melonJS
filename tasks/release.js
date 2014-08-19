"use strict";
var path = require("path");
var exec = require("child_process").exec;
var async = require("async");

module.exports = function (grunt) {
    grunt.registerTask("dorelease", "MelonJS Release", function () {
        var repo = path.join(__dirname, "..");
        var config = grunt.file.readJSON(path.join(repo, "package.json"));
        var version = config.version;
        var currBranch;
        var verbose = grunt.option("verbose");

        function run(cmd, msg) {
            grunt.log.oklns("Running: " + msg);
            var _stdout;
            var _error = null;
            exec(cmd, function(error, stdout, stderr) {
                grunt.log.writeln("STDOUT: " + stdout);
                if (error) {
                    _error = true;
                    if (verbose) {
                        grunt.log.error("Error on run exec: " + error);
                        grunt.log.error("STDERR: " + stderr);
                    }
                } else {
                    _stdout = stdout;
                }
            });
            return _error || _stdout;
        }

        async.series([
            function checkout(callback) {
                var symbolicRef = run("git symbolic-ref HEAD");
                var msg = "Detaching from current tree";
                var ok;
                if (symbolicRef) {
                    var splitted = symbolicRef.split("/");
                    currBranch = splitted.slice(2).join("/");
                    if (verbose) {
                        grunt.log.writeln("Current branch: " + currBranch);
                    }
                    if (!currBranch) {
                        callback(true, "Could not get the actual branch from symbolic ref");
                    }
                }
                ok = run("git checkout --detach", msg);
                if (ok !== null) {
                    grunt.log.ok();
                }
                callback(ok, msg);
            },
            function add(callback) {
                var ok;
                var msg = "Adding build files";
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
                        grunt.fail.fatal("Missing file " + filenames[i] + " is required");
                    }
                    if (verbose) {
                        grunt.log.oklns(filenames[i] + " exists!");
                    }
                    stringFiles += filenames[i] + " ";
                }
                ok = run("git add -f " + stringFiles, msg);
                if (ok !== null) {
                    grunt.log.ok();
                }

                callback(ok, msg);
            },
            function commit(callback) {
                var ok;
                var msg = "Commiting release";
                ok = run("git commit -am 'Release " + version + "'", msg);
                if (ok !== null) {
                    grunt.log.ok();
                }
                callback(ok, msg);
            },
            function tag(callback) {
                var ok;
                var msg = "Tagging new version";
                ok = run("git tag -a "+ version +" -m 'melonJS "+ version +" version'", msg);
                if (ok !== null) {
                    grunt.log.ok();
                }
                callback(ok, msg);
            },
            function push(callback) {
                var ok;
                var msg = "Pushing to new version branch";
                ok = run("git push origin " + version, msg);
                if (ok !== null) {
                    grunt.log.ok();
                }
                callback(ok, msg);
            }
        ],
            function rollback(err, results) {
                if (err) {
                    grunt.log.error("Error: " + err);
                }
                var backBranch = currBranch !== undefined ? currBranch : "master";
                if (verbose) {
                    grunt.log.ok("Original Branch: " + backBranch);
                    grunt.log.ok(results);
                }
                run("git reset --hard", "Reseting staged changes");
                run("git checkout " + backBranch, "Back to initial branch");
            }
        );
    });
};
