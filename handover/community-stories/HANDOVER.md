# Community Stories — "Paddle the territory. Meet the communities."

Handover pack for an animator / illustrator.

This folder contains everything that draws the tab in the screenshot.

| File | What it is |
|---|---|
| `stories-view.jsx` | The whole tab. React + hand-coded HTML5 Canvas 2D animation. **This is the file to work in.** |
| `community-stories.css` | The styles this tab uses, pulled out of the site's main `styles.css`. |

---

## How to run it

There is **no build step**. The site is React 18 + Babel Standalone compiled in the
browser. So:

1. Edit `stories-view.jsx` in any text editor.
2. Drop it back into the project root (it replaces the existing `stories-view.jsx`).
3. Reload the page.

That's it. No npm, no webpack, no bundler.

In the live project, `styles.css` and `stories-view.jsx` are referenced from
`Community Atlas.html` with a `?v=` cache-busting number — bump it after editing
or the browser serves the old copy.

---

## Where the animation actually lives

**Everything visual is drawn in code on a `<canvas>`.** There are no image
assets, no sprite sheets, no Lottie, no SVG for the scene. Every tree, ripple,
person and campfire is Canvas 2D drawing calls.

The entire animation is inside one function:

```
stories-view.jsx : line 482    function scene(time)
```

`scene()` runs once per frame via `requestAnimationFrame`. It redraws the world
from scratch every frame, painter's-algorithm style, back to front:

| Roughly | What's drawn |
|---|---|
| 497 | **Sky** — vertical gradient, interpolated between 4 keyframe colours |
| 502 | Drifting clouds (day only) |
| 517 | Sun → moon arc with halo |
| ~545 | Stars, aurora (night) |
| ~570 | Far hills, treeline |
| ~610 | **Water** — gradient, moving swell lines, sun/moon glitter path |
| ~660 | Shoreline and the camp bank |
| ~690 | **Campfire** — flicker driven by two summed sines |
| **709** | **`person()` — THE FIGURE RENDERER** (see below) |
| ~900 | The canoe and paddlers |
| ~980 | Foreground reeds, birds, fog |

### The figure renderer — `person()` (line 709)

This is what you'll most likely want to replace or improve. Signature:

```js
person(px, py, s, dir, shirt, act, ph, opt)
```

| Arg | Meaning |
|---|---|
| `px, py` | Position — `py` is the **ground line**, feet stand on it |
| `s` | Scale (1 ≈ 34px tall) |
| `dir` | Facing: `1` right, `-1` left |
| `shirt` | Ribbon-shirt colour (hex) |
| `act` | Pose: `'wave'` \| `'idle'` \| `'walk'` |
| `ph` | Phase offset — desync so figures don't move in lockstep |
| `opt` | `{ noArms: true }` when the caller draws its own arms |

Inside it builds, in order: legs (2-segment jointed via the `limb()` helper, so
there is a real knee), moccasins, ribbon shirt with hem + sash, arms (jointed,
real elbow), neck, head, hair with braids, beaded headband.

The `limb(x0,y0, x1,y1, x2,y2, w, col)` helper draws a 2-segment jointed limb —
that's what gives knees and elbows instead of straight sticks.

**Motion comes from `tt`** — seconds since the animation started. Every wobble
in the file is some variation of `Math.sin(tt * speed + phase)`. Walk cycle:

```js
const gait = act === 'walk' ? Math.sin(tt * 4 + ph) : 0;
```

### Colour keyframes (near the top of the effect)

`SKY_T`, `SKY_B`, `WATER`, `HILL` are each **4 RGB triples** — dawn → day →
dusk → night. The journey progress `jt` (0→1 across all stops) picks and blends
between them via `mixc()`. Change these arrays to re-grade the entire scene's
time-of-day.

---

## The structure around the canvas

The React component is `JourneyOfCare` (line 405). Its states:

```
intro → paddling → arrive → choose → done
```

- **`paddling`** — canoe crosses; `padRef.current` is 0→1 progress
- **`arrive`** — canoe lands, camp scene fades in
- **`choose`** — the 5 action cards in the screenshot
- Each action sets `sceneActionRef.current`, which the canvas reads to play a
  short reaction (`actionFxRef` is the 0→1 timer for that burst)

`_J_ACTIONS` (line 339) defines the 5 cards. `_TEACHINGS` (line 325) holds the
Seven Grandfather Teachings shown above the cards.

The panel UI is normal HTML/CSS — that's what `community-stories.css` styles
(`.j-*` classes). The canvas is `.journey-canvas` inside `.journey-stage`.

---

## Important content rules (please keep these)

This is a real First Nations community project, not a generic game. Two hard
rules were set by the community:

1. **Nothing is invented.** Every sentence shown at a camp is pulled verbatim
   from that community's own record in the dataset. `_fieldTruth()` (line 307)
   does the extraction. Don't write fictional dialogue.
2. **No religious symbols of any kind**, and no retelling any nation's sacred
   teachings on their behalf. An earlier draft accidentally included a cross on
   a building and it had to be removed.

Also: the scene should read as **present-tense and celebratory**. Community
members explicitly said the dashboard is not the place to depict the painful
past.

---

## What an animator could improve (honest list)

Everything here is drawn shape-by-shape in code by a programmer, and it shows.
The most valuable upgrades, roughly in order of impact:

1. **Replace `person()`** with better proportions, silhouette and a real walk
   cycle. It's self-contained — improving that one function lifts every figure.
2. **Regalia and clothing detail** — currently a flat shirt + sash. Ribbon work,
   layering and cloth movement would do a lot.
3. **Water** — the swell lines are simple sines; real caustics/reflection would
   transform the whole frame.
4. **Canoe and paddle stroke** — the paddling cycle is basic.
5. If code-drawing is the wrong tool, the scene could instead be **layered PNG
   or SVG art** drawn in Illustrator/Procreate and animated by parallax +
   sprite-swap on the same canvas. That's a bigger change but would break past
   the ceiling of what's drawable in code.

Whoever picks this up: the file is heavily commented at each section, and
nothing outside this folder needs touching.
