# Visual test

A page for developers working on the plugin: a 20 x 15 grid to paint walls
and mud on, three agents chasing a target, and a toggle for each option of
the search, with the debug overlay. Not part of the published package.

```sh
pnpm -F melonjs build                        # the page uses the built engine
pnpm -F @melonjs/pathfinding-plugin visual
```

Open the printed URL. Add `?renderer=canvas`, `webgl` or `webgpu` (or `#webgl`)
to pick the renderer (the select in the panel does the same).

What to look for:

- **tool: target**: the target follows the pointer, and the agents re-plan
  four times a second to chase it
- **tool: wall / mud / erase**: paint the grid; the agents go round the new
  walls, and round the mud when that is cheaper (they also move slower in it)
- **diagonal**: the four diagonal modes; `onlyIfNoObstacles` never cuts a
  corner past a wall, `always` squeezes between two
- **smooth**: straight lines across open ground, never cutting through mud
  the search went round
- **avoid each other**: the agents spread out instead of following in a line
- **maxNodes**: a low cap; the paths stop short, heading for the target
  (`partial` in the readout: `allowPartialPath` is on)
- **grid: shapes**: the grid built from two static collision bodies (a post
  and a diagonal slab) with `Grid.fromBodies`; the overlay shows the cells
  they block, the slab as a staircase. Painting then changes the grid's cells
  directly
- **overlay**: blocked cells in red, mud in orange, the cells each search
  looked at in blue, and each agent's path
