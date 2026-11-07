# Changelog

## [1.2.0] - _unreleased_

### Added
- Controls: an optional `skin` texture atlas, with `base` / `thumb` regions on sticks and `region` / `pressed` regions on buttons. Parts without a region keep their shapes, and a button without a `pressed` region is drawn slightly smaller while held ([#1802](https://github.com/melonjs/melonJS/issues/1802), thanks @snowyukitty)

## [1.1.0] - _2026-11-02_

### Added
- Floating sticks: `area`, where one can be picked up: `"half"`, its half of the screen, as before and still the default; `"screen"`, anywhere; or a rectangle in viewport pixels. `hideAtRest` draws it only while a finger holds it, so it appears under the thumb wherever it lands and is gone once the thumb lifts
- Floating buttons: `floating`, `area` and `hideAtRest` on a button, as on a stick. A floating button is pressed wherever a finger lands inside its area (by default the half of the screen its `position` is on) and drawn under that finger while held, so the left thumb can steer anywhere on one half and the right thumb fire anywhere on the other, with nothing on screen until touched
- Where controls overlap, a finger takes the first free one: fixed buttons, fixed sticks, floating buttons, floating sticks. Floating buttons sharing an area split it: a finger presses the one resting nearest to it, and one nearest to a button already held falls through to a floating stick rather than pressing another button
- Sticks: `tap`, so a quick tap that does not steer presses a pad button (`FACE_1` by default) or a key for one frame, as a button would; with `area: "screen"` a game needs no button at all. A cancelled touch is not a tap, and a fading ring shows where one landed
- `ControlArea` and `StickTap`, the types of the `area` and `tap` options; `floating`, `area` and `hideAtRest` readable on each stick and button, and a stick's `tapping`

### Changed
- A button's `pressed`, and the pad button or key it presses, now last at least until a frame has run: a press and a release within the same frame let go after that frame's update instead of at once. A press a frame has already seen still lets go at once, and hiding or switching off the controls still lets go of everything at once

### Fixed
- A tap on a button quicker than a frame was lost: pressed and let go between two updates, the game never saw it and the button never showed. It now reaches the game (see Changed), and a floating button hidden at rest fades out where it was let go
- iOS: a second finger sometimes did nothing while the first held a stick, taken by Safari's pinch gesture, which two fingers start even over a canvas with `touch-action: none`. The plugin now cancels Safari's `gesturestart` / `gesturechange` / `gestureend` while the controls show

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
