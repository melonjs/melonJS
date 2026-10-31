# Changelog

## [1.0.2] - _2026-10-31_

### Fixed
- A touch on the controls no longer reaches the game as a hover: the `pointerover` / `pointerenter` before it and the `pointerout` / `pointerleave` after it are kept from the engine too, so a widget under a button no longer gets `onOver` as the button is pressed ([#1805](https://github.com/melonjs/melonJS/issues/1805)). A mouse hovering over the controls is unchanged

## [1.0.1] - _2026-10-30_

### Changed
- Published from the melonJS release workflow, with npm provenance; the plugin itself is unchanged from 1.0.0

## [1.0.0] - _2026-10-30_

### Added
- Initial release ([#1719](https://github.com/melonjs/melonJS/issues/1719)): `GamepadPlugin` draws on-screen sticks and buttons and reports them as a gamepad in a gamepad slot, so a game's `input.bindGamepad` bindings work with them as with a real pad
- Sticks: one or two, analog with a deadzone, fixed or centered where the thumb lands; the left one also presses the D-pad in 8 directions once the thumb is half way out (`dpadThreshold`)
- Buttons: any number, each pressing a pad button or a key; a game can relabel, dim or hide them while it runs
- Several fingers at once, and a touch that starts on the controls does not reach the game; a finger held on them does not select the page or open a menu
- Drawn over the whole frame, above every camera, and kept across stage changes
- Hidden while the player uses a real pad, back on the next touch
- A light vibration on each button press, as a real button gives (`haptics`, 10 ms), and `input.vibrateGamepad` vibrating the phone, where the browser supports it
