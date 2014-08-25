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

        function run(cmd, msg, callback) {
            grunt.log.oklns("Running: " + msg);
            exec(cmd, callback);
        }

        async.series([
            function checkout(callback) {
                var symbolicRef;
                var msg = "Detaching from current tree";
                run("git symbolic-ref HEAD", msg,
                    function(error, stdout, stderr) {
                        grunt.log.writeln("STDOUT: " + stdout);
                        if (error) {
                            if (verbose) {
                                grunt.log.error("Error: " + error);
                                grunt.log.error("STDERR: " + stderr);
                            }
                            callback(true, "Could not get the actual branch from symbolic ref");
                        }
                        symbolicRef = stdout;
                    }
                );
                var splitted = symbolicRef.split("/");
                currBranch = splitted.slice(2).join("/");
                if (verbose) {
                    grunt.log.writeln("Current branch: " + currBranch);
                }
                if (!currBranch) {
                    callback(true, "Could not get the actual branch from symbolic ref");
                }
                run("git checkout --detach", msg,
                    function(error, stdout, stderr) {
                        grunt.log.writeln("STDOUT: " + stdout);
                        if (error) {
                            if (verbose) {
                                grunt.log.error("Error: " + error);
                                grunt.log.error("STDERR: " + stderr);
                            }
                            callback(true, "Git detach error");
                        }
                    }
                );
                grunt.log.ok();
                callback(null, msg);
            },
            function add(callback) {
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
                run("git add -f " + stringFiles, msg,
                    function(error, stdout, stderr) {
                        grunt.log.writeln("STDOUT: " + stdout);
                        if (error) {
                            if (verbose) {
                                grunt.log.error("Error: " + error);
                                grunt.log.error("STDERR: " + stderr);
                            }
                            callback(true, "Git add error");
                        }
                    }
                );
                grunt.log.ok();
                callback(null, msg);
            },
            function commit(callback) {
                var msg = "Commiting release";
                run("git commit -am 'Release " + version + "'", msg, function(error, stdout, stderr) {
                    grunt.log.writeln("STDOUT: " + stdout);
                    if (error) {
                        if (verbose) {
                            grunt.log.error("Error: " + error);
                            grunt.log.error("STDERR: " + stderr);
                        }
                        callback(true, "Git release commit error");
                    }

                });
                grunt.log.ok();
                callback(null, msg);
            },
            function tag(callback) {
                var msg = "Tagging new version";
                run("git tag -a "+ version +" -m 'melonJS "+ version +" version'", msg, function(error, stdout, stderr) {
                    grunt.log.writeln("STDOUT: " + stdout);
                    if (error) {
                        if (verbose) {
                            grunt.log.error("Error: " + error);
                            grunt.log.error("STDERR: " + stderr);
                        }
                        callback(true, "Git tag error");
                    }
                });
                grunt.log.ok();
                callback(null, msg);
            },
            function push(callback) {
                var msg = "Pushing to new version branch";
                run("git push origin " + version, msg, function(error, stdout, stderr) {
                    grunt.log.writeln("STDOUT: " + stdout);
                    if (error) {
                        if (verbose) {
                            grunt.log.error("Error: " + error);
                            grunt.log.error("STDERR: " + stderr);
                        }
                        callback(true, "Git tag error");
                    }
                });
                grunt.log.ok();
                callback(null, msg);
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
                run("git reset --hard", "Reseting staged changes",
                    function(error, stdout, stderr) {
                        if (error) {
                            grunt.log.error(error);
                            grunt.log.error(stderr);
                        }
                        if (verbose) {
                            grunt.log.ok(stdout);
                        }
                    }
                );
                run("git checkout " + backBranch, "Back to initial branch");
            }
        );
    });
};
