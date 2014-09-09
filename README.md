melonJS
=======
[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)

A fresh & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](http://melonjs.org/media/alex4-github.png)

Copyright (C) 2011 - 2014, Olivier Biot, Jason Oster, Aaron McLeod

[melonJS](http://melonjs.org/) is licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)

About melonJS
-------------------------------------------------------------------------------

[melonJS](http://melonjs.org/) is the result of our enthusiasm & experiments with Javascript,
and currently features :

- a fresh & lightweight 2D sprite-based engine
- standalone library (does not rely on anything else, except a HTML5 capable browser)
- compatible with most major browser (Chrome, Safari, Firefox, Opera, IE) and mobile devices
- built-in support for CocoonJS
- device motion & accelerometer support
- high DPI & auto scaling
- multi-channel HTML5 audio support and WebAudio on supported devices
- a lightweight physic implementation to ensure low CPU requirements
- polygon (SAT) based collision algorithm for accurate detection and response
- fast broad-phase collision detection using spatial partitioning
- advanced math API for Vector and Matrix
- a basic set of Entities (to be extended)
- object pooling
- basic particle system
- basic animation management
- tween effects
- standard spritesheet and packed textures (Texture Packer, ShoeBox) support
- a state manager (to easily manage loading, menu, options, in-game state)
- transition effects
- Tiled map format version +0.9.x integration for easy level design
    - Uncompressed Plain, Base64, CSV and JSON encoded XML tilemap loading
    - orthogonal tilemap with built-in collision management
    - isometric and perspective tilemap support
    - multiple layers (multiple background / foreground, collision and image layers)
    - multiple tileset support
    - tileset transparency settings
    - layers alpha settings
    - rectangle, ellipse, polygon and polyline objects support
    - Tiled objects
    - flipped & rotated tiles
    - dynamic layer and object / group ordering
    - dynamic entity loading
    - solid, platform, slope and breakable tiles
- system & bitmap fonts
- mouse and touch device support (with mouse emulation)
- asynchronous messaging support (minPubSub)
- some basic GUI elements
- a customizable loader

Using melonJS
-------------------------------------------------------------------------------
Follow the tutorial [here](http://melonjs.github.io/tutorial-platformer/) to get started !

Note that due to the 'cross-origin request' policy implemented in most browsers
(that prevents from accessing local files), you will need to either disable this
security check (see the tutorial), or better use a "personal" local web server
like the `grunt connect` task that is used for building melonJS (see below).

Building melonJS
-------------------------------------------------------------------------------
To build your own version of melonJS you will need to install :

- the [Node.js](http://nodejs.org/) JavaScript runtime and [npm](https://npmjs.org/) package manager
- the [Grunt](http://gruntjs.com/) task manager

Once the Node.js package manager has been installed (using the installer from their website),
we need to install Grunt and the Grunt CLI (Command Line Interface), by doing the following :

Open a [Terminal](http://www.apple.com/osx/apps/all.html#terminal) or a [Commmand Prompt](http://en.wikipedia.org/wiki/Command_Prompt) and
type the following :

    $ npm install -g grunt-cli

then we can install the melonJS required dependencies, by typing :

    $ cd melonJS
    $ npm install

Once all the above done, we are ready to build melonJS :

    $ cd melonJS (if not already in the melonJS directory)
    $ grunt

Both plain and minified library will be available under the "build" directory.

Building the documentation
-------------------------------------------------------------------------------
Just do the following to actually build the documentation :

    $ cd melonJS (if not already in the melonJS directory)
    $ grunt doc

The generated documentation will be then available under the "docs" directory

Testing
-------------------------------------------------------------------------------
The recommended way to test is to start the `connect` server in keepalive mode:

    $ grunt connect:keepalive

Then navigate to http://localhost:8889/ in your browser. Stop the `connect`
server when you are done by pressed `Ctrl+C` in the terminal.


To run melonJS tests in node simply run the following:

    $ grunt test

This will run the jasmine spec tests with the output on the shell. This is not
recommended because tests are run by PhantomJS in this mode, and there are a
lot of known bugs and unsupported features in the version of WebKit shipped
with PhantomJS.

WIP Builds
-------------------------------------------------------------------------------
melonJS uses Travis-CI for automated testing and build uploads. The latest build
artifacts can be downloaded from the [melonjs-builds](http://melonjs-builds.s3.amazonaws.com/index.html?prefix=artifacts/)
bucket.

Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels :
* [melonJS developer forum](http://groups.google.com/group/melonjs)
* [gitter web chat](https://gitter.im/melonjs/public)
* #melonjs on freenode.net (also available via [webchat](http://webchat.freenode.net/?channels=melonjs))
* [melonJS wikipage] (https://github.com/melonjs/melonJS/wiki)

For any other non technical related questions, feel free to also send us an [email](mailto:contact@melonjs.org).
