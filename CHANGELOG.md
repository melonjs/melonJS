# Changelog

## 1.6.0 - 2023-10-xx

## 1.5.0 - 2023-09-23

- fix the `addAnimation()` method not returning the corresponding set TrackEntry
- fix the base renderable `flip[X/Y]` method when used/applied to the Spine renderable
- add a `isCurrentAnimation()` method that returns true if the given name is corresponding to the current track current animation
- expose the `currentTrack` property to access the corresponding current animation track entry
- clarify in the readme that the current plugin support both the 4.1 and 4.2-beta Spine runtime versions
- the spine-plugin now requires to be properly registered using `me.plugin.register(SpinePlugin);`
- the spine-plugin now requires melonJS v15.12.0 or higher
- add check for minimum melonJS version when the plugin is registered
- restructure code to adhere to the updated plugin API and get a proper reference to the melonjs renderer instance

## 1.4.0 - 2023-09-05

- add support for loading spine assets through the melonJS preloader (see README)
- add inline documentation for the Spine class, properties and methods
- console now display both the plugin and spine runtime versions

## 1.3.0 - 2023-08-28

- add support for Mesh Attachement
- added more examples under the test folder and separated them into individual files
- add a fullscreen option to examples (pressing the "F" key toggles fullscreen mode)

## 1.2.1 - 2023-08-23

- code refactoring and optimization to prepare for future feature additions
- fix URLs in the package.json file

## 1.2.0 - 2023-08-22

- add support for clipping (coin example is now rendered properly)

## 1.1.0 - 2023-08-19

- add some basic debug rendering
- optimize code (remove unneeded logic)

## 1.0.0 - 2023-08-16

initial release