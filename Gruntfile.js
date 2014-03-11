/*global module:false*/
module.exports = function(grunt) {
    var sourceFiles = grunt.file.readJSON('sourceFiles.json');

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        path: {
            main: 'build/<%= pkg.name %>-<%= pkg.version %>.js',
            min: 'build/<%= pkg.name %>-<%= pkg.version %>-min.js'
        },

        concat: {
            dist: {
                src: sourceFiles,
                dest: '<%= path.main %>'
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
                        src: [ '<%= path.main %>' ],
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
                    '<%= path.min %>': [
                        '<%= path.main %>'
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
                    src: [ '<%= path.main %>' ]
                }
            }
        },

        clean: {
            dist: [
                '<%= path.main %>',
                '<%= path.min %>'
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
