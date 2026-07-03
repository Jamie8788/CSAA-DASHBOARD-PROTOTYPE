BROWN BEAR HUNTER - DEVELOPER ASSET PACK

This pack is made so the developer can use it directly without slicing the big concept sheets.

WHAT IS INCLUDED
1. 00_reference_sheets/
   - Original polished reference/concept sheets.
   - Use these for art direction, motion reference, and consistency.

2. 01_bear_transparent_png_frames_768x512/
   - Separate transparent PNG bear frames.
   - Every bear frame is on the same 768 x 512 canvas.
   - Pivot suggestion: bottom center, around x=384, y=450.
   - Frame groups:
     idle: 4 frames
     walk: 6 frames
     stalk: 6 frames
     strike: 6 frames
     splash_impact: 3 frames
     catch_claw: 2 frames
     catch_mouth: 2 frames
     recovery_victory: 1 frame

3. 02_fish_transparent_png_assets/
   - Separate transparent fish PNGs on 512 x 256 canvas.
   - Trout and salmon poses included.

4. 03_water_fx_transparent_png_assets/
   - Separate transparent ripple, splash, wake, shadow, contact, and footfall PNGs.
   - Main water FX are on 512 x 256 canvas.

5. 04_spritesheets_with_json/
   - Ready spritesheets for each animation group.
   - Matching JSON frame maps with x, y, w, h, pivot, and duration_ms.
   - A developer can load either individual PNG frames OR the spritesheet + JSON.

6. 05_preview_contact_sheets/
   - JPG previews only. Do not use these in-game.

SUGGESTED ANIMATION SPEEDS
- Idle: 5-6 fps, loop
- Walk: 8-10 fps, loop
- Stalk: 7-8 fps, loop
- Strike: 10-12 fps, play once
- Splash impact: 12 fps, play once
- Catch claw / catch mouth: 6-8 fps, hold last frame
- Recovery / victory: still pose or slow idle hold

IMPLEMENTATION NOTE
Use the transparent PNG frames directly if you do not want to write slicing code.
Use the spritesheet JSON only if your engine prefers spritesheets.

IMPORTANT QUALITY NOTE
These assets were prepared from the generated concept sheets and auto-cleaned into transparent PNGs. They are ready for prototype/game mockup use. For final commercial production, an artist can redraw or polish the same separated frames at full production quality.
