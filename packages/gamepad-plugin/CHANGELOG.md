# Changelog

## [1.0.0] - _unreleased_

### Added
- Initial release ([#1719](https://github.com/melonjs/melonJS/issues/1719)): `GamepadPlugin` draws on-screen sticks and buttons and reports them as a gamepad in a gamepad slot, so a game's `input.bindGamepad` bindings work with them as with a real pad
- Sticks: one or two, analog with a deadzone, fixed or centered where the thumb lands; the left one also presses the D-pad in 8 directions
- Buttons: any number, each pressing a pad button or a key; a game can relabel, dim or hide them while it runs
- Several fingers at once, and a touch that starts on the controls does not reach the game
- Drawn over the whole frame, above every camera, and kept across stage changes
- Hidden while the player uses a real pad, back on the next touch
- `input.vibrateGamepad` vibrates the phone, where the browser can
