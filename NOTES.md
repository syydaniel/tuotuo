# TUOTUO · 坨坨 (2026-09-27)
抽象 Mac desktop pet + DMG + 60 s promo. Design thinking in DESIGN.md. Deliverables in 发布包/.

## App
web/ is the whole pet: pet.js (engine, 21 word acts + interactions), sound.js (WebAudio synth), lines.js (all text), host.js (WKWebView bridge / browser dev mode), index.html.
Browser dev mode: preview "tuotuo" (video/rec_server.py, port 7812) -> http://localhost:7812/web/index.html (fake desktop + act buttons).
Contact sheets: web/sheet.html?act=<id>&t=... via `python3 web/_sheets/shot.py name "<query>"`.
app/build.sh -> app/build/坨坨.app (universal, macOS 11+, ad-hoc). dist: `../.venv/bin/dmgbuild -s dmg_settings.py "坨坨" Tuotuo-1.0-mac.dmg` (run in dist/).
Gotchas: transparent full-screen WKWebView counts as occluded -> page hidden, no rAF (fixed with _setWindowOcclusionDetectionEnabled:NO).
Idle CPU ~6%: canvas follows pet.extents(), busy() tiers pick rAF / 30 fps / 10 fps timers.
Debug: TUOTUO_DEBUG=<dir> .../Contents/MacOS/Tuotuo -> <dir>/state.json, touch snap.req -> snap.png, write cmd.js -> evaluated, result in cmd.out.

## Video
video/stage.html + stage.js: vector mock desktop, virtual 1080x1920 camera, scripted scenes (SC.*). `python3 sheet.py scene "t,..."` for previews, `python3 rec.py scene[:tag]` to record (60 fps PNG -> rec/<tag>.mp4 + offline-rendered pet SFX .wav).
Music: music/out1/1cd8f7ab (ACE-Step, quirky pizzicato 120 BPM; stops at 22.35, 36.65-40, ends 59.75). VO: tts/lines_tts.py D_lazy_male (voice from AIGAME1), vo/vo_post.py -> vo/timing.json.
Edit: VER=vN edl.py (SEG, VO_AT, captions at y=640) -> work/plan.json; build_resolve.py load|setup|timeline|captions|audio|render|status (project TUOTUO), one step per call (Resolve crashed once when several ran back to back); master.py -> -14 LUFS.
Cover: video/cover.html?save=name (posts to rec server).
