UPDATED DASHBOARD BEAR DEV PACK

This is the updated version that matches the Mino Bimaadiziwin dashboard style.

Main change from the old pack:
- The old bear was too realistic and looked pasted onto the page.
- This pack uses a flatter, softer, more dashboard-friendly illustrated bear.
- Square/cutout artifacts were cleaned.
- Water/fish/ripple assets are simplified so they blend into the page.
- Includes scroll-fade implementation snippets so the bear can disappear naturally when the user scrolls down.

FOLDER GUIDE

00_reference_and_mockup/
- hero_mockup_bear_fixed_dashboard_style.png
  Shows how the bear should look on the actual dashboard.

01_web_ready_transparent_pngs/
Use these directly in the website.
Best beginner file:
- hero_bear_scene_with_fish_768.png

Alternative files:
- hero_bear_only_768x384.png
- fish_near_bear_256.png
- water_ripple_dashboard_style_512x256.png
- water_contact_shadow_512x256.png

02_animation_frames/
Separate transparent PNG frames:
- bear_idle_768x384/
- bear_slow_walk_768x384/
- fish_swim_320x160/
- water_ripple_loop_512x256/
- combined_hero_loop_768x384/

03_spritesheets_with_json/
Use these if the developer prefers spritesheets instead of separate PNGs.

04_dev_code_snippets/
- BearHero.jsx
- bearHero.css
- simple_html_scroll_fade_example.html

RECOMMENDED FOR THE NOOB DEV

Use:
01_web_ready_transparent_pngs/hero_bear_scene_with_fish_768.png

Then add the CSS/React scroll fade from:
04_dev_code_snippets/

Recommended placement:
- Put bear as absolute positioned layer inside the hero section.
- Keep pointer-events none.
- z-index above background but below important UI if needed.
- Fade bear out between scrollY 0 and 420px.

Suggested CSS behavior:
- opacity: 1 on first screen
- opacity: 0 after user scrolls down
- slight translateY + scale down during fade

QUALITY NOTE
This pack is meant for web/dashboard integration and prototype production. It is intentionally less realistic than the old asset pack so it visually matches the flat illustrated dashboard.
