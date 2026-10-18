# Earth Defender changelog

What changed in the game, version by version. The version here is
`GAME_VERSION` in `constants.ts`, which is what the title screen stamps in its
bottom corner, so a screenshot is enough to say which build someone is talking
about.

This tracks the GAME. The engine it runs on has its own changelog in
`packages/melonjs`, and an engine fix that came out of building this belongs
there rather than here.

Two things deliberately do not go in this file:

- **Why a number is what it is.** That lives in the doc comment on the
  constant itself, where it moves with the value instead of rotting a thousand
  lines away. `HUNTER_STANDOFF_ARC` carries its own measurements; this file
  only says the hunter learned to break off.
- **Anything a player would not notice.** A refactor, a rename or a tidied
  import is in the commit history, which is the right level of detail for it.

No em dashes, matching the engine's changelog.

## [1.0] - _unreleased_

The first version with a number on it. Everything below is what the game is
rather than what it used to be, since nothing before this was ever stamped.

### The run

- Fly a craft around a globe wrapped in a hexagonal glass dome, and hold the
  dome. Asteroids fall onto it and a saucer flies bombing runs at it, and a
  pane that takes enough of either lets go, which ends the run
- Turning is the whole of the movement: hold left or right and the craft comes
  all the way round. The boost is the only other input and it builds heat, so
  crossing the globe in a hurry is a resource decision rather than a free one
- Ice blocks cool the boost when flown through, more of it the bigger the
  block. Radioactive rocks pay a large score and drop one of a temporary
  weapon upgrade, a shield or a score multiplier
- A shield absorbs hits and regenerates, and the run ends on an impact with
  nothing left to absorb it

### The hunter

- A second enemy craft that hunts the PLAYER rather than the dome, arriving
  between bombing runs. Everything before it aimed at the glass, so the
  player's own position never mattered
- It flies attack runs instead of chasing: nose on while it closes, so its
  shots are aimed at something, then it breaks off before contact and swings
  out to come back from a new angle. A pursuer whose end state is contact is
  answered by flying away from it, which is not flying
- Twin cannons firing in pairs, continuously while the player is in front of
  it. Its bolts hit asteroids and bombs as well, which a player can set up:
  line the hunter up on a falling bomb and it defuses it for free
- An energy shell takes five bolts and regenerates, and the hull underneath
  takes two. The shell is magenta against the player's cyan, so during a
  contact it is clear whose shield just flared, and it whitens on a hit
- Shields touching bounce both craft apart and cost neither of them anything.
  Flying into it is a piloting answer, not a punishment
- Dying in three beats: the shell goes, then the hull in its own plating, then
  the fuel

### Controller

- Plays on a gamepad end to end, including the title menu and the
  photosensitivity notice. Left stick or D-pad to turn, right trigger to
  boost, A or the right bumper to fire, B to go back
- Every slot is bound rather than slot 0, so whichever pad is to hand works
- Rumble on every explosion, scaled by what blew up: a pebble is a tick and a
  bomb on the glass is the heaviest thing short of the run ending. A smaller
  rumble cannot cut off a larger one that is still playing, which is what a
  bomb needs, since it detonates and cracks a pane three milliseconds apart

### Presentation

- Rendered with a posed `Camera3d` over a 3D globe, with ground shadows, a
  lit dome, parallax nebulae and a spatial audio mix placed in world
  coordinates
- Instructions and credits behind the title menu, and the best score kept
  across reloads
