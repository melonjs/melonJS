module.exports = function (grunt) {
    "use strict";

    var sourceFiles = grunt.file.readJSON("sourceFiles.json");
    var testSpecs = grunt.file.readJSON("testSpecs.json");

    var quadFragment = "<%= grunt.file.read('build/glsl/quad-fragment.glsl') %>";
    var quadVertex = "<%= grunt.file.read('build/glsl/quad-vertex.glsl') %>";
    var lineFragment = "<%= grunt.file.read('build/glsl/line-fragment.glsl') %>";
    var lineVertex = "<%= grunt.file.read('build/glsl/line-vertex.glsl') %>";

    // Project configuration.
    grunt.initConfig({
        pkg : grunt.file.readJSON("package.json"),
        path : {
            main : "build/<%= pkg.name %>-<%= pkg.version %>.js",
            min : "build/<%= pkg.name %>-<%= pkg.version %>-min.js"
        },

        concat : {
            dist : {
                src : sourceFiles,
                dest : "<%= path.main %>"
            }
        },

        replace : {
            dist : {
                options : {
                    variables : {
                        "__VERSION__"       : "<%= pkg.version %>",
                        "__QUAD_FRAGMENT__" : quadFragment,
                        "__QUAD_VERTEX__"   : quadVertex,
                        "__LINE_FRAGMENT__" : lineFragment,
                        "__LINE_VERTEX__"   : lineVertex,
                    },
                    usePrefix : false,
                    force : true,
                    patterns : [
                        {
                            match : /this\._super\(\s*([\w\.]+)\s*,\s*"(\w+)"\s*(,\s*)?/g,
                            replacement : "$1.prototype.$2.apply(this$3"
                        },
                    ],
                },
                files : [
                    {
                        expand : true,
                        flatten : true,
                        src : [ "<%= path.main %>" ],
                        dest : "build/"
                    }
                ]
            },

            docs : {
                options : {
                    variables : {
                        "VERSION" : "<%= pkg.version %>"
                    },
                    prefix : "@",
                    force : true
                },
                files : [
                    {
                        expand : true,
                        src : sourceFiles.concat([ "README.md" ]),
                        dest : "build/docs/"
                    }
                ]
            },

            glsl : {
                options : {
                    preserveOrder : true,
                    patterns : [
                        {
                            // Remove comments
                            match : /(\/\/.*?\\n)|(\/\*(.|\\n)*?\*\/)/g,
                            replacement : ""
                        },
                        {
                            // Remove leading and trailing whitespace from lines
                            match : /(\\n\s+)|(\s+\\n)/g,
                            replacement : ""
                        },
                        {
                            // Remove line breaks
                            match : /(\\r|\\n)+/g,
                            replacement : ""
                        },
                        {
                            // Remove unnecessary whitespace
                            match : /\s*([;,[\](){}\\\/\-+*|^&!=<>?~%])\s*/g,
                            replacement : "$1"
                        },
                    ],
                },
                files : [
                    {
                        expand : true,
                        flatten : true,
                        src : [ "build/glsl/*.glsl" ],
                        dest : "build/glsl/"
                    }
                ]
            }
        },

        dot : {
            glsl : {
                options : {
                    strip : false,
                },
                files : [
                    {
                        src : "src/video/webgl/glsl/",
                        dest : "build/glsl/"
                    }
                ]
            }
        },

        uglify : {
            options : {
                report : "min",
                preserveComments : "some"
            },
            dist : {
                files : {
                    "<%= path.min %>" : [
                        "<%= path.main %>"
                    ]
                }
            }
        },

        jshint : {
            options : {
                jshintrc : ".jshintrc"
            },

            beforeConcat : {
                files : {
                    src : [
                        testSpecs,
                        sourceFiles,
                        "Gruntfile.js",
                        "plugins/**/*"
                    ]
                }
            },

            afterConcat : {
                files : {
                    src : [ "<%= path.main %>" ]
                }
            }
        },

        clean : {
            dist : [
                "<%= path.main %>",
                "<%= path.min %>"
            ],
            jsdoc : [
                "build/docs",
                "build/glsl/*.glsl",
                "./docs/**/*.*",
                "./docs/scripts",
                "./docs/styles",
                "./docs/images",
                "./docs/img"
            ]
        },

        jsdoc : {
            dist : {
                src : sourceFiles.map(function (value) {
                    return value.replace("src/", "build/docs/src/");
                }).concat([ "README.md" ]),
                options : {
                    configure : "jsdoc_conf.json",
                    destination : "docs",
                    template : "tasks/jsdoc-template/template"
                }
            }
        },

        jasmine : {
            src : "build/<%= pkg.name %>-<%= pkg.version %>.js",
            options : {
                specs : testSpecs,
                helpers : [ "tests/spec/helper-spec.js" ],
                host : "http://localhost:8889/"
            }
        },

        connect : {
            server : {
                options : {
                    port : 8889
                }
            },

            keepalive : {
                options : {
                    port : 8889,
                    keepalive : true
                }
            }
        },
    });

    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-jsdoc");
    grunt.loadNpmTasks("grunt-replace");
    grunt.loadNpmTasks("grunt-contrib-jasmine");
    grunt.loadNpmTasks("grunt-contrib-connect");

    // Custom Tasks
    grunt.loadTasks("tasks");

    // Default task.
    grunt.registerTask("default", [ "test", "uglify" ]);
    grunt.registerTask("build", [ "lint", "uglify" ]);
    grunt.registerTask("glsl", [ "dot:glsl", "replace:glsl" ]);
    grunt.registerTask("lint", [
        "jshint:beforeConcat",
        "glsl",
        "concat",
        "replace:dist",
        "jshint:afterConcat"
    ]);
    grunt.registerTask("doc", [ "replace:docs", "jsdoc" ]);
    grunt.registerTask("test", [ "lint", "connect:server", "jasmine" ]);
};
