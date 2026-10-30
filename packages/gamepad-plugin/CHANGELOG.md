# Changelog

## [1.0.0] - _unreleased_

### Added
- Initial release ([#1719](https://github.com/melonjs/melonJS/issues/1719)). `GamepadPlugin` draws on-screen sticks and buttons and reports them as a gamepad in a gamepad slot, through melonJS's `input.addVirtualGamepad`, so a game's `input.bindGamepad` bindings answer to them as to a real pad. One or two analog sticks with a deadzone, pressing the D-pad in 8 directions; any number of buttons pressing a pad button or a key, which a game can relabel, dim or hide; each finger followed on its own; touches on the controls kept from the game; drawn over the whole frame and across stages; hidden while a real pad is in use; phone vibration through `input.vibrateGamepad`
