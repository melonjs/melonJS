#######################################################################
#   MelonJS Game Engine
#   Copyright (C) 2011, Olivier BIOT
#   http://www.melonjs.org
#
#   melonJS is licensed under a Creative Commons 
#   Attribution-NonCommercial-NoDerivs 3.0 Unported License.
#   http://creativecommons.org/licenses/by-nc-nd/3.0/
#
#   javascript compilation / "minification" makefile
# 
#   MODULE -- js files to minify
#   BUILD  -- js minified target file (1) 
# 
#######################################################################

# YUICOMPRESSOR
YUI_VERSION = 2.4.6
YUI_PATH = tools/yuicompressor-$(YUI_VERSION)/build/
YUI_COMPRESSOR = ${YUI_PATH}yuicompressor-$(YUI_VERSION).jar
YUI_OPTION =
#YUI_OPTION = --verbose

# GOOGLE CLOSURE COMPILER
GCC_VERSION =
GCC_PATH = tools/google-closure-compiler$(GCC_VERSION)/
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
ME_VER=$(shell cat src/version.js | sed -re "s/.*'([0-9].[0-9].[0-9])'.*/\1/")
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
	 $(srcdir)level/level.js\
	 $(srcdir)level/TMXTiledMap.js\
	 $(srcdir)utils/tween.js

# Debug Target name
DEBUG = $(buildir)melonJS-$(ME_VER).js

# Build Target name
BUILD = $(buildir)melonJS-$(ME_VER)-min.js

#######################################################################

.DEFAULT_GOAL := all

.PHONY: js

all: debug
	java -jar $(YUI_COMPRESSOR) $(YUI_OPTION) $(DEBUG) >> $(BUILD)

google: debug
	java -jar $(GCC_COMPRESSOR) $(GCC_OPTION) --js=$(DEBUG) --js_output_file=$(BUILD)
		
debug: clean
	cat $(MODULE) >> $(DEBUG)

clean:
	rm -f $(BUILD)
	rm -f $(DEBUG)
	rm -Rf $(docdir)

doc:
	java -jar $(JSDOC_PATH)/jsrun.jar $(JSDOC_PATH)/app/run.js -a -t=$(JSDOC_PATH)/templates/melonjs $(DEBUG) $(JSDOC_OPTION) 
	

#######################################################################
