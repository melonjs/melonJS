/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
		dist: {
			src: [
				'src/core.js',
				'src/math/geometry.js',
				'src/debug/debug.js',
				'src/renderable/base.js',
				'src/renderable/sprite.js',
				'src/renderable/texturepacker.js',
				'src/renderable/camera.js',
				'src/entity/entity.js',
				'src/state/state.js',
				'src/loader/loader.js',
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
				'src/level/TMXMapReader.js',
				'src/level/LevelDirector.js',
				'src/vendors/tween.js',
				'src/vendors/minpubsub.src.js',
				'src/plugin/plugin.js'
			],
			dest: 'build/<%= pkg.name %>-<%= pkg.version %>.js'
		}
    },
	
	uglify: {
		options: {
			banner: "/*! melonJS (c)2011 - 2013 Olivier Biot (http://www.melonjs.org) */\n",
		},
		dist: {
			files: {
				'build/<%= pkg.name %>-<%= pkg.version %>.min.js': ['<%= concat.dist.dest %>']
			}
		}
	},
    
	
    jshint: {
		dist: {
			src: [ 'build/<%= pkg.name %>-<%= pkg.version %>.js' ]
		},
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
		}
   }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
 
 // Default task.
  grunt.registerTask('default', ['concat', 'uglify']);

};