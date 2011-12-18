[melonJS](http://melonjs.org/) - a fresh & lightweight 2D sprite-based engine
=============================================================================

Copyright (C) 2011, Olivier BIOT

melonJS is licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)


About melonJS
-------------------------------------------------------------------------------

melonJS is the result of my enthusiasm & my past experiments with Javascript, 
and currently features :

- A fresh & lightweight 2D sprite-based engine
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with most major browser (Chrome, Safari, Firefox, Opera, IE)
- Multiple Audio Channel support
- Basic physics & collision mechanisms (to ensure low cpu requirements)
- Tween Effects
- Transition effects
- A basic set of Object Entities (to be extended)
- Basic animation management
- A state manager (to easily manage loading, menu, options, in-game state)
- Tiled map format version 0.7.x integration for easy level design
	- Uncompressed Plain, Base64 and CSV encoded XML tilemap loading
	- Orthogonal tilemap
	- Multiple layers (multiple background/Foreground, collision and "Parallax" layers)
	- Multiple Tileset support
	- Tileset Transparency settings
	- Layers Alpha settings
	- Tiled Objects
	- Flipped Tiles
	- Dynamic Layer and Object/Group ordering
	- Dynamic Entity loading 
	- Solid, Platform, Slope and Breakable Tiles
- System & bitmap fonts
- some basic GUI elements
- a customizable loader, etc

Building melonJS
-------------------------------------------------------------------------------
* Regular flavored build :

`$ cd melonJS`

`$ mkdir build`

`$ make`

Both plain and minified library will be available under the "build" directory

* CoffeeScript flavored build :

First make sure that you have installed :

- [node.js](http://nodejs.org/)
- [npm](http://npmjs.org/)
- [CofeeScript](http://jashkenas.github.com/coffee-script/)

`$ sudo npm install -g coffee-script`

`$ cd melonJS`

`$ npm install -d`      # Installs the deps from the package.json file

`$ cake build:browser`

Building the documentation
-------------------------------------------------------------------------------

`cd melonJS`

`make doc`

The generated documentation will be then available under the "docs" directory

Questions, need help ?
-------------------------------------------------------------------------------
If you need help, or have any questions, please feel free to ask on the
[melonJS developer forum](http://groups.google.com/group/melonjs), or send us an [email](mailto:contact@melonjs.org).
