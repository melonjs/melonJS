melonJS
=======
[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)

A fresh & lightweight HTML5 game engine
-------------------------------------------------------------------------------

Copyright (C) 2011 - 2014, Olivier Biot, Jason Oster, Aaron McLeod

[melonJS](http://melonjs.org/) is licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)

About melonJS
-------------------------------------------------------------------------------

[melonJS](http://melonjs.org/) is the result of our enthusiasm & experiments with Javascript,
and currently features :

- A fresh & lightweight 2D sprite-based engine
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with most major browser (Chrome, Safari, Firefox, Opera, IE)
- Multiple Audio Channel support
- Basic physics & collision mechanisms (to ensure low cpu requirements)
- Basic Vector Math
- Tween Effects
- Transition effects
- A basic set of Object Entities (to be extended)
- Object Pooling
- Basic Particle System
- Basic animation management
- Standard spritesheet and Packed Textures (Texture Packer, ShoeBox) support
- A state manager (to easily manage loading, menu, options, in-game state)
- Tiled map format version +0.9.x integration for easy level design
    - Uncompressed Plain, Base64, CSV and JSON encoded XML tilemap loading
    - Orthogonal tilemap with built-in collision management
    - Isometric, Perspective tilemap support
    - Multiple layers (multiple background/Foreground, collision and Image layers)
    - Multiple Tileset support
    - Tileset Transparency settings
    - Layers Alpha settings
    - Tiled Objects
    - Flipped & rotated Tiles
    - Dynamic Layer and Object/Group ordering
    - Dynamic Entity loading
    - Solid, Platform, Slope and Breakable Tiles
- System & bitmap fonts
- Mouse and Touch device support (with mouse emulation)
- Built-in support for cocoonJS
- Asynchronous messaging support (minPubSub)
- some basic GUI elements
- a customizable loader, etc...

Using melonJS
-------------------------------------------------------------------------------
Follow the tutorial [here](http://melonjs.github.io/tutorial/) to get started !

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
If you need help, you can try the [melonJS developer forum](http://groups.google.com/group/melonjs), or in #melonjs on irc.freenode.net.
For any other questions, feel free to send us an [email](mailto:contact@melonjs.org).
