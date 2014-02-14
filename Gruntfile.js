/*global module:false*/
module.exports = function(grunt) {
    var sourceFiles = [
        'src/core.js',
        'src/system/device.js',
        'src/system/timer.js',
        'src/system/pooling.js',
        'src/math/vector.js',
        'src/shapes/rectangle.js',
        'src/shapes/circle.js',
        'src/shapes/poly.js',
        'src/math/matrix.js',
        'src/debug/debug.js',
        'src/renderable/base.js',
        'src/renderable/sprite.js',
        'src/renderable/texturepacker.js',
        'src/renderable/camera.js',
        'src/renderable/GUI.js',
        'src/renderable/container.js',
        'src/entity/entity.js',
        'src/state/state.js',
        'src/loader/loadingscreen.js',
        'src/loader/loader.js',
        'src/font/font.js',
        'src/audio/audio.js',
        'src/video/video.js',
        'src/input/input.js',
        'src/utils/utils.js',
        'src/utils/color.js',
        'src/system/save.js',
        'src/level/TMXConstants.js',
        'src/level/TMXUtils.js',
        'src/level/TMXObjectGroup.js',
        'src/level/TMXTileset.js',
        'src/level/TMXRenderer.js',
        'src/level/TMXLayer.js',
        'src/level/TMXTiledMap.js',
        'src/level/TMXMapReader.js',
        'src/level/LevelDirector.js',
        'src/vendors/tween.js',
        'src/vendors/minpubsub.src.js',
        'src/vendors/howler.js',
        'src/plugin/plugin.js',
        'src/entity/draggable.js',
        'src/entity/droptarget.js',
        'src/particles/emitter.js',
        'src/particles/particlecontainer.js',
        'src/particles/particle.js'
    ];

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        concat: {
            dist: {
                src: sourceFiles,
                dest: 'build/<%= pkg.name %>-<%= pkg.version %>.js'
            }
        },

        replace: {
            options: {
                variables: {
                    'VERSION': '<%= pkg.version %>'
                },
                prefix: '@',
                force: true
            },

            dist: {
                files: [
                    {
                        expand: true,
                        flatten: true,
                        src: [ 'build/<%= pkg.name %>-<%= pkg.version %>.js' ],
                        dest: 'build/'
                    }
                ]
            },

            docs: {
                files: [
                    {
                        expand: true,
                        src: sourceFiles.concat([ 'README.md' ]),
                        dest: 'build/docs/'
                    }
                ]
            }
        },

        uglify: {
            options: {
                report: 'min',
                preserveComments: 'some'
            },
            dist: {
                files: {
                    'build/<%= pkg.name %>-<%= pkg.version %>-min.js': [
                        '<%= concat.dist.dest %>'
                    ]
                }
            }
        },

        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },

            beforeConcat: {
                files: {
                    src: sourceFiles
                }
            },

            afterConcat: {
                files: {
                    src: [ '<%= concat.dist.dest %>' ]
                }
            }
        },

        clean: {
            dist: [
                'build/<%= pkg.name %>-<%= pkg.version %>.js',
                'build/<%= pkg.name %>-<%= pkg.version %>-min.js'
            ],
            jsdoc: [
                'build/docs',
                './docs/**/*.*',
                './docs/scripts',
                './docs/styles',
                './docs/images'
            ]
        },

        jsdoc : {
            dist : {
                src: sourceFiles.map(function (value) {
                    return value.replace('src/', 'build/docs/src/');
                }).concat([ 'README.md' ]),
                options: {
                    configure: 'jsdoc_conf.json',
                    destination: 'docs',
                    template: 'tasks/jsdoc-template/melonjs'
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-replace');

    // Custom Tasks
    grunt.loadTasks('tasks');

    // Default task.
    grunt.registerTask('default', ['concat', 'replace:dist', 'uglify']);
    grunt.registerTask('lint', ['jshint:beforeConcat', 'concat', 'replace:dist', 'jshint:afterConcat']);
    grunt.registerTask('doc', ['replace:docs', 'jsdoc']);
};
