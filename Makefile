#######################################################################
#   MelonJS Game Engine
#   Copyright (C) 2011 - 2013, Olivier BIOT
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
GCC_VERSION = 20130227
GCC_PATH = tools/closure-compiler/
GCC_COMPRESSOR = ${GCC_PATH}compiler$(GCC_VERSION).jar
GCC_OPTION =
#GCC_OPTION = --compilation_level ADVANCED_OPTIMIZATIONS

# JSDOC
JSDOC_VERSION = 2.4.0
JSDOC_PATH = tools/jsdoc-toolkit
JSDOC_OPTION = -d=docs -s

# Set the source directory
srcdir = src
buildir = build
docdir = docs

# CURRENT BUILD VERSION
ME_VER=$(shell cat $(srcdir)/version.js | sed "s/^.*[^0-9]\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/")
VERSION=sed "s/@VERSION/${ME_VER}/"

# list of module to compile
MODULE = $(srcdir)/core.js\
	 $(srcdir)/math/geometry.js\
	 $(srcdir)/debug/debug.js\
	 $(srcdir)/entity/camera.js\
	 $(srcdir)/entity/sprite.js\
	 $(srcdir)/entity/texturepacker.js\
	 $(srcdir)/entity/entity.js\
	 $(srcdir)/state/state.js\
	 $(srcdir)/loader/loader.js\
	 $(srcdir)/font/font.js\
	 $(srcdir)/GUI/GUI.js\
	 $(srcdir)/GUI/HUD.js\
	 $(srcdir)/audio/audio.js\
	 $(srcdir)/video/video.js\
	 $(srcdir)/input/input.js\
	 $(srcdir)/utils/utils.js\
	 $(srcdir)/utils/stat.js\
	 $(srcdir)/level/TMXConstants.js\
	 $(srcdir)/level/TMXUtils.js\
	 $(srcdir)/level/TMXObjectGroup.js\
	 $(srcdir)/level/TMXTileset.js\
	 $(srcdir)/level/TMXRenderer.js\
	 $(srcdir)/level/TMXLayer.js\
	 $(srcdir)/level/TMXTiledMap.js\
	 $(srcdir)/level/TMXMapReader.js\
	 $(srcdir)/level/LevelDirector.js\
	 $(srcdir)/vendors/tween.js\
	 $(srcdir)/vendors/minpubsub.src.js\
	 $(srcdir)/plugin/plugin.js


# Debug Target name
DEBUG = $(buildir)/melonJS-$(ME_VER).js

# Build Target name
BUILD = $(buildir)/melonJS-$(ME_VER)-min.js

#######################################################################

.DEFAULT_GOAL := all

.PHONY: js

all: debug
	java -jar $(GCC_COMPRESSOR) $(GCC_OPTION) --js=$(DEBUG) --js_output_file=$(BUILD)
		
debug: clean
	cat $(MODULE) | $(VERSION) >> $(DEBUG)

clean:
	rm -Rf $(buildir)/*
	rm -Rf $(docdir)/*

doc: debug
	java -jar $(JSDOC_PATH)/jsrun.jar $(JSDOC_PATH)/app/run.js -a -t=$(JSDOC_PATH)/templates/melonjs $(DEBUG) $(JSDOC_OPTION) 
	

#######################################################################
