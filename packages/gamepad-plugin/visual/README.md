# Visual test

A page for developers working on the plugin: the controls over a small scene,
with a readout of what the engine receives and toggles for each feature. Not
part of the published package.

```sh
pnpm -F melonjs build                    # the page uses the built engine
pnpm -F @melonjs/gamepad-plugin visual
```

Open the printed URL. The "Network" one works from a phone on the same
network, to try real touches. Add `?renderer=canvas`, `webgl` or `webgpu` (or
`#webgl`) to pick the renderer (the select in the panel does the same).

What to look for:

- the left stick moves the dot (analog through `LX`/`LY`, digital through the
  D-pad), and A turns it yellow
- a stick and a button held at once, by two fingers
- a tap away from the controls leaves a green ring: the game got it. A touch
  on the controls never does ("taps the game got" stays put)
- **overlay**: a shade at a very high `z`; the controls stay over it
- **minimap**: a second camera; it shows the world but never the controls
- **2 sticks**, **floating**, **dim B**, **hide X**, **B: Open**: the options
  and the run-time changes
- **hide on pad**: plug in a pad and press a button, and the controls hide;
  touch the screen and they come back
- **vibrate**: the phone vibrates, where the browser supports it
