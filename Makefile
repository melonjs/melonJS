#######################################################################
#   MelonJS Game Engine
#   Copyright (C) 2012, Olivier BIOT
#   http://www.melonjs.org
#
#   melonJS is licensed under the MIT License.
#   http://www.opensource.org/licenses/mit-license.php
#
#   javascript compilation / "minification" makefile
# 
#   MODULE -- js files to minify
#   BUILD  -- js minified target file (1) 
# 
#######################################################################

# GOOGLE CLOSURE COMPILER
GCC_VERSION = 2079
GCC_PATH = tools/closure-compiler/
GCC_COMPRESSOR = ${GCC_PATH}compiler$(GCC_VERSION).jar
GCC_OPTION = --jscomp_off=internetExplorerChecks 
#GCC_OPTION = --compilation_level ADVANCED_OPTIMIZATIONS

# JSDOC
JSDOC_VERSION = 2.4.0
JSDOC_PATH = tools/jsdoc-toolkit
JSDOC_OPTION = -d=docs -s

# Set the source directory
srcdir = src/
buildir = build/
docdir = docs/

# CURRENT BUILD VERSION
ME_VER=$(shell cat $(srcdir)version.js | sed "s/^.*[^0-9]\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/")
VERSION=sed "s/@VERSION/${VERSION}/"

# list of module to compile
MODULE = $(srcdir)core.js\
	 $(srcdir)loader/loader.js\
	 $(srcdir)math/geometry.js\
 	 $(srcdir)entity/camera.js\
	 $(srcdir)entity/entity.js\
	 $(srcdir)font/font.js\
	 $(srcdir)GUI/GUI.js\
	 $(srcdir)GUI/HUD.js\
	 $(srcdir)audio/audio.js\
	 $(srcdir)video/video.js\
	 $(srcdir)input/input.js\
	 $(srcdir)utils/utils.js\
	 $(srcdir)utils/stat.js\
	 $(srcdir)level/TMXConstants.js\
	 $(srcdir)level/TMXUtils.js\
	 $(srcdir)level/TMXObjectGroup.js\
	 $(srcdir)level/TMXTileset.js\
	 $(srcdir)level/TMXRenderer.js\
	 $(srcdir)level/TMXLayer.js\
	 $(srcdir)level/TMXTiledMap.js\
	 $(srcdir)level/LevelDirector.js\
	 $(srcdir)utils/tween.js

# Debug Target name
DEBUG = $(buildir)melonJS-$(ME_VER).js

# Build Target name
BUILD = $(buildir)melonJS-$(ME_VER)-min.js

#######################################################################

.DEFAULT_GOAL := all

.PHONY: js

all: debug
	mkdir -p $(buildir)
	java -jar $(GCC_COMPRESSOR) $(GCC_OPTION) --js=$(DEBUG) --js_output_file=$(BUILD)
		
debug: clean
	mkdir -p $(buildir)
	cat $(MODULE) >> $(DEBUG)

clean:
	rm -f $(BUILD)
	rm -f $(DEBUG)
	rm -Rf $(docdir)

doc:
	mkdir -p $(docdir)
	java -jar $(JSDOC_PATH)/jsrun.jar $(JSDOC_PATH)/app/run.js -a -t=$(JSDOC_PATH)/templates/melonjs $(DEBUG) $(JSDOC_OPTION) 
	

#######################################################################
