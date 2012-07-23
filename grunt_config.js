/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    lint: {
      files: ['src/**/*.js']
    },
    concat: {
      dist: {
        src: [
          '<banner:meta.banner>',
          'src/core.js',
          'src/loader/loader.js',
          'src/math/geometry.js',
          'src/entity/camera.js',
          'src/entity/entity.js',
          'src/font/font.js',
          'src/GUI/GUI.js',
          'src/GUI/HUD.js',
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
          'src/level/LevelDirector.js',
          'src/utils/tween.js'
        ],
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.js'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.min.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true
      },
      globals: {}
    },
    uglify: {}
  });

  // Default task.
  grunt.registerTask('default', 'lint concat min');

};
