/*global module:false*/
module.exports = function(grunt) {
    var sourceFiles = [
        'src/core.js',
        'src/math/geometry.js',
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
        'src/utils/stat.js',
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
        'src/plugin/plugin.js'
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
            dist: {
                options: {
                    variables: {
                        'VERSION': '<%= pkg.version %>'
                    },
                    prefix: '@'
                },
                files: [
                    {
                        expand: true,
                        flatten: true,
                        src: ['build/<%= pkg.name %>-<%= pkg.version %>.js'],
                        dest: 'build/'
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
                    'build/<%= pkg.name %>-<%= pkg.version %>-min.js': ['<%= concat.dist.dest %>']
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
            dist: ['build/<%= pkg.name %>-<%= pkg.version %>.js', 'build/<%= pkg.name %>-<%= pkg.version %>.min.js'],
            jsdoc: ['./docs/**/*.*', './docs/scripts', './docs/styles', './docs/images']
        },

        jsdoc : {
            dist : {
                src: ['build/<%= pkg.name %>-<%= pkg.version %>.js', 'README.md'],
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
    grunt.loadNpmTasks('grunt-replace');

    // Custom Tasks
    grunt.loadTasks('tasks');

    // Default task.
    grunt.registerTask('default', ['concat', 'replace', 'uglify']);
    grunt.registerTask('lint', ['jshint:beforeConcat', 'concat', 'replace', 'jshint:afterConcat']);
    grunt.registerTask('doc', ['concat', 'replace', 'jsdoc']);
};
