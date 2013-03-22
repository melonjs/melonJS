fs = require 'fs'
util = require 'util'

files = [
	'./src/core.js',
	'./src/math/geometry.js',
	'./src/debug/debug.js',
	'./src/entity/camera.js',
	'./src/entity/sprite.js',
	'./src/entity/texturepacker.js',
	'./src/entity/entity.js',
	'./src/state/state.js',
	'./src/loader/loader.js',
	'./src/font/font.js',
	'./src/GUI/GUI.js',
	'./src/GUI/HUD.js',
	'./src/audio/audio.js',
	'./src/video/video.js',
	'./src/input/input.js',
	'./src/utils/utils.js',
	'./src/utils/stat.js',
	'./src/level/TMXConstants.js',
	'./src/level/TMXUtils.js',
	'./src/level/TMXObjectGroup.js',	
	'./src/level/TMXTileset.js',
	'./src/level/TMXRenderer.js',
	'./src/level/TMXLayer.js',
	'./src/level/TMXTiledMap.js',
	'./src/level/TMXMapReader.js',
	'./src/level/LevelDirector.js',
	'./src/vendors/tween.js',
	'./src/vendors/minpubsub.src.js',
	'./src/plugin/plugin.js']

version = require './src/version.js'

builddir = './build'
targetfile = "melonJS-#{version}"

task 'build:browser', 'Compile and minify for use in browser', ->
	util.log "Creating browser file for melonJS version #{version}."
	contents = new Array
	remaining = files.length
	for file, index in files
		do (file, index) ->
			fs.readFile file, 'utf8', (err, cnt) ->
				util.log err if err
				contents[index] = cnt

				util.log "[#{index + 1}/#{files.length}] #{file}"

				process() if --remaining is 0
	process = ->
		util.log "Creating #{builddir}/#{targetfile}.js"

		code = contents.join "\n\n"
		fs.unlink builddir, ->
			fs.mkdir builddir, 0o755, ->
				fs.writeFile "#{builddir}/#{targetfile}.js", code, 'utf8', (err) ->
					console.log err if err
					try
						util.log "Creating #{builddir}/#{targetfile}.min.js"
						{parser, uglify} = require 'uglify-js'
						ast = parser.parse code
						code = uglify.gen_code uglify.ast_squeeze uglify.ast_mangle ast, extra: yes
						fs.writeFile "#{builddir}/#{targetfile}-min.js", code

task 'build', 'Compile', ->
	invoke 'build:browser'
