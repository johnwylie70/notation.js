# What Circuitry needs for sheet music

Found by reading Circuitry's source on 13 October 2026; none of it has been changed. Sheet music is in pictures.js and Pyctures on their `notation` branches (pictures.js: `NOTATION_NAMES`, the `notation/` folder; Pyctures: handle 15, `notationKeeper`, `web/notation/`), which copy the shape of the effects' branches, so nearly every step below sits beside the one already written for effects.

**The whole list, in the order to do it** (each is explained below):

1. `scripts/sync-pictures.mjs`: copy pictures.js's `notation/` folder, write `SCENE_NOTATION_NAMES`, copy `pynotation.py`, and take `libraryKeeper` (which `dialsKeeper` now calls, and sheet music uses) with the keepers.
2. `scene.ts`: both names settle a scene alone (Telling that a file is a scene).
3. Python: `pynotation` in `detect.ts` and `CIRCUITRY_PROVIDED_MODULES`; `H_NOTATION = 15` in `canvas-runtime-py.ts`; handle 15 in the page; `<app>/pictures/notation/` in the Python preview's `script-src`; and a file that imports `pynotation` counts as importing `synths`.
4. The Python recorder: draw the pages of music into the frame (How its recorder works).
5. Web export: pack `notation/notation.js` for a scene that uses it.
6. The help pages and the how-to (Words for the help pages), and the demo.

A JavaScript scene needs only steps 1, 2 and 5: it loads, runs and records as it is.

## Serving the library

- **`FOLDERS`** in `scripts/sync-pictures.mjs` gains `'notation'` (or `FOLDERS_WHEN_THERE`, as `visualfx` is, until pictures.js's main has it). The folder holds `notation.js`, `LICENSE` and `LICENSE-GLYPHS` (the music symbols are outlines from the Leland font, under the SIL Open Font Licence: that file must travel with `notation.js`).
- **`scene-names.ts`** gains `SCENE_NOTATION_NAMES` from the `/* NOTATION_NAMES:BEGIN */ … /* NOTATION_NAMES:END */` marks: `['showNotes', 'makeSheet']`.
- **`BESIDE`** gains `{ repo: 'pynotation', file: 'src/pynotation/__init__.py', to: 'public/pictures/notation/pynotation.py' }`. The page's half for a Python scene is pictures.js's own `notation/notation.js` (the same file Pyctures carries).
- **`PYTHON_SOUND_LIBRARIES`** gains `pynotation: { url: '/pictures/notation/pynotation.py', tag }`, and `PYCTURES_SOUND_HANDLES` gains `H_NOTATION: 15`, each when Pyctures has the handle, as `H_EFFECTS` is done.
- **The keepers.** Sheet music has no keeper of its own in Pyctures: the page's object for it is notation.js's own (`notation(canvas, { fresh: true, sound })`, which has `close()`), made through `libraryKeeper`, a new function straight after `dialsKeeper` in the "sound and dials" section of `pyctures.js`. `dialsKeeper` is now one line that calls `libraryKeeper` (the stand-in that loads a library when it is first asked for something), so the section must be taken whole as it is today; the check for `function dialsKeeper(` still passes. `soundKeeper`'s object has two new functions that sheet music relies on: `state()` and `soundTime()`.

## Telling that a file is a scene (`src/lib/pictures/scene.ts`)

`showNotes` and `makeSheet` are names of two words, so the existing `twoWords` filter makes each settle a file alone, in both spellings (`show_notes`, `make_sheet`), once `SCENE_NOTATION_NAMES` is added to the lists it is given (line 43, beside `SCENE_SOUND_NAMES`, `SCENE_SCENE_NAMES` and `SCENE_EFFECT_NAMES`). There are no single-word names to score. The names clash with nothing: not with drawing, sound, the dials (including the new controls and `tranceGate`), scenes, effects, or `soundButton`, `askAboutSound` and `soundIsOn`.

A scene that names one is given the sound as well (`sceneUses(source).sound` is true for it), so whatever the app does for a scene with sound (the sound button's card, the engine) it does for a scene with sheet music.

What a page gives back (`page.play()`, `page.onNote`, `page.playAlong`) are methods of an object, not scene names: completion can offer them from the table in pictures.js's `docs/sheet-music.md`.

## The app's own Python runtime and page, piece by piece

In Pyctures these are in `src/pyctures/__init__.py`, `src/pyctures/pages.py` and `src/pyctures/web/pyctures.js` on the `notation` branch; take the text from there.

**`canvas-runtime-py.ts`** (the Python half): one line.

```python
H_NOTATION = 15  # the page's sheet music: the library pynotation makes each page of it with one command
```

That is all pynotation reads of Pyctures: `p.H_NOTATION`, `p.JsRef`, `p.js` (to tell one run from the next), `p.canvas` (only without the handle) and `p.load_json` (a song file beside the scene). It needs no `S.dt` and no `S.ending`. It imports `synths` itself when it is there, so that a file with only `from pynotation import *` is heard: see the next point.

**A file that imports `pynotation` has the sound too.** Pyctures' test of a file's text says so in both halves (`usesLibrary(source, 'synths')` in pyctures.js and `uses_library` in pages.py now answer yes for `from pynotation import *`). `usesPythonLibrary` in `python-sound.ts` is the app's copy of that test and needs the same: for `synths`, `(?:synths|pynotation)`. Without it a page of music is drawn and followed in silence.

**`python-sound.ts`**: `'pynotation'` in `PYTHON_SOUND_MODULES`; `pynotation: '/pictures/notation/notation.js'` in `PYTHON_SOUND_PAGE_HALF`; `pynotation` in `pythonSoundUse` (and in `sound` or `any` as the policy needs); `libraryKeeper` returned with the other keepers; and beside the dials (about line 219), as Pyctures' own `Scene` does it:

```js
var notation = kit.libraryKeeper('pynotation', 'Sheet music', { given: <address of /pictures/notation/notation.js>, module: (modules && modules.pynotation) || null },
  function (m, canvas) { return m.notation(canvas, { fresh: true, sound: sound }); })(canvas);
```

(`libraryKeeper` loads through Pyctures' `loadLibrary('pynotation', given)`, so `LIBRARIES.pynotation` must be in the copy, as it is in the section.)

`sound` is the scene's own sound keeper (what handle 10 is). Sheet music asks it three things, which is why it is handed the keeper itself and not its `output()`:

- `sound.state()`: `'loading'`, `'waiting'` (the page has not been touched) or `'on'`. A tune is not begun until it is `'on'`. Asking begins the engine loading.
- `sound.soundTime()`: Python's clock as the page reckons it from the batches that have come. The note that is lit is read from it every frame.
- `sound.player.songPosition()` (the keeper's `player`, as it already was): where the song is, for a page that follows one. Where there is no player in the page, Python hands `song.position` on instead, a frame late.

If the app's page plays sound through a host of its own (`host.send`), `state()` answers `'on'`, and a `songPosition()` on the object handed over as `sound` is used if it has one.

**`canvas-renderer-script.ts`**: `H.set(15, soundKit.notation)` beside `H.set(11, soundKit.dials)` (about line 1514), and `soundKit.notation.close()` where the dials' panel is closed (a run that ends, a run again). No wrapper is wanted: every call goes straight to the keeper's object (`make`, `call`, `set`, `drop`, `page`, `words`, `listen`, `beat`, `ack`, `theme`). What the page tells Python comes back through the callback Python gives `listen`, as `{ t: JSON text, b: 0 or 1 }`: two plain values, so `summarize` loses nothing.

**`detect.ts`**: `if (usesPythonLibrary(code, 'pynotation')) return decided(true, 'has sheet music (pynotation)')`, beside the lines for `pydials` and `pyvisualfx`.

**`python-packages.ts`** (`CIRCUITRY_PROVIDED_MODULES`): `'pynotation'`, so nothing tries to install it.

**`preview-isolation-script.ts`** (`pythonSoundPreviewPolicy`): for a Python file that imports `pynotation`, `<app>/pictures/notation/` in `script-src`, and the sound's own folder as for a file that imports `synths`. `notation.js` uses no worker, no fetch of its own (a song file is read by Python and sent as data), no `eval` and no font: its symbols are paths inside the file.

**The hand-ported runtime's hooks for handle 15**, in one place: Python makes a page with `JsRef(15).make(id, music, step, options)`, changes it with `call(id, name, ...args)` and `set(id, name, value)`, removes it with `drop(id)`, asks for the notes to play with `words(id, from)`, reads the page object with `page(id)` (a pydials keyboard is tied to it), and hears back through `listen(fn)`, with `beat()` and `ack()` for a callback every frame while Python must look at something each frame. `synth=lead` in an option is the page's own object for a synth (`lead.page`, a `JsRef`), as a dial's target is.

## How its recorder works, and what that means here

**A JavaScript scene (pictures.js)**: the frame is every visible canvas copied where it sits. A page of music is a `div[data-notation-layer]` holding two canvases: the music, and the line that moves (`canvas[data-notation-layer="line"]`, one pixel stretched by CSS to 3 pixels wide and the height of the line of music, placed by its `left` and `top`, with no CSS transform, since the recorder takes no notice of transforms). Both are canvases so that they are in the film. Two things to check in `visibleCanvases` / `drawCanvases`:

- They must be found though they are inside a `div`, not straight after the scene's canvas (a query for every `canvas` under the scene's box finds them; one that walks only the canvas's siblings does not).
- Each must be drawn at its own box (`getBoundingClientRect()`), which for the line is its stretched size, not its one pixel. (record-sync says the recorder does this: every visible canvas in the document, in DOM order, each at its bounding rect.)

The pages draw from their own `requestAnimationFrame`, so under the stepped clock they are drawn in each step, after the scene's own frame. Which note is lit is read in that same callback from the sound's clock (`soundTime()`, less the player's latency) or from the song's place, so with the stepped player the note lit in a frame is the note sounding in that frame.

**How a recording stays exact.** Sheet music lights a note a little after the time it was asked for, by as much as the player says it plays late: `player.buffer().delay`, which is 40 ms for the real-time player and 0 for synths.js's stepped player. So with the stepped player (pictures.js's `runScene(…, { stepped })`, Pyctures' keeper for a recorded scene) the note lit in a frame is the note that sounds in that frame. With an app whose copy of synths.js is older than the stepped player, the film's pictures are exact and a note lights 40 ms (one or two frames) after its place on the clock.

**NOT VERIFIED:** this has been read from the stepped player's code (`createSteppedPlayer`, on synths.js's `stepped` branch) and not run under the recorder, because the `notation` branches are cut from main, which has no stepped player yet. A test like pictures.js's `test-stepped.mjs` clapperboard, with `showNotes("C4 E4 G4", "quarter").play()` and the lit note read at each step against the samples, would settle it once the two are merged. `page.play()` begins a tune 0.12 s ahead of now, in a film as anywhere.

**A Python scene**: `canvas-renderer-script.ts` builds the frame from canvases it names itself (about line 1303, and about lines 308 and 335 for a still picture). After the scene's canvas and the effects' layer, and before the dials', each page of music wants drawing, each canvas at its own box:

```js
var sheets = canvas.parentNode ? canvas.parentNode.querySelectorAll('[data-notation-layer] canvas') : [];
var whole = canvas.getBoundingClientRect();
for (var i = 0; i < sheets.length; i++) {
  var b = sheets[i].getBoundingClientRect();
  if (!b.width || !b.height || sheets[i].style.display === 'none') continue;
  c.drawImage(sheets[i], (b.left - whole.left) * rec.w / whole.width, (b.top - whole.top) * rec.h / whole.height, b.width * rec.w / whole.width, b.height * rec.h / whole.height);
}
```

A page is never the size of the scene (it is a sheet of paper over part of it), so `drawImage(layer, 0, 0, rec.w, rec.h)`, as the scene's canvas is drawn, would stretch it over the whole picture.

## Web export

**A JavaScript scene** (`src/lib/pictures/web-export/build-web-page.ts`): `sceneUses(source).notation` says whether to pack; the packed text is `notation/notation.js`, added to the `pictures-siblings` JSON as `notation` and mapped as the others are: `imports[new URL('notation/notation.js', document.baseURI).href] = made(packed.notation)`. The file has no `import.meta.url` and loads nothing else, so it packs as plain text; a check like the dials' one can look for `notationLayer` in it. `sceneUses(source).sound` is true for such a scene, so the sound is packed with it by the rule already there. The licence of the symbols should go in the page's licence comment: "music symbols from the Leland font (SIL OFL 1.1), © MuseScore BVBA".

**A Python scene**: as synths and pydials are; Pyctures' `pages.single_page` packs it as `notation: { js, py }`.

## Sizes

- `notation/notation.js` is 130 KB (44 KB gzipped), 13 KB of it the symbols' outlines. `pynotation.py` is 20 KB.
- pictures.js itself grew by 2 KB; a scene that shows no music asks for nothing new.
- A Pyctures single-file page with no sheet music is 195,989 characters on the `notation` branch, where main is 194,057: 1.9 KB more (the two things asked of the sound, the handle, and the stand-in for a library). Pyctures' scenes test held such a page under 195,000, which main is 943 short of and the effects' branch 14 short of; the `notation` branch raises that line to the stated limit, 200,000. The three branches together will be near 197 KB.

## The demo

`demos/twinkle/` here is in the shape of `public/demos/*`: `main.py` (the entry), `main.js` (its twin, the same program line for line), and `thumbnail.jpg` at 600 × 600; `demos/index.json` has its entry in the form of `public/demos/index.json` (`tags: ["learn"]`). It is this library's own `examples/twinkle.js`, in the form of the app's learn demos, without the first lines that fetched the library. It has not been copied anywhere: the catalogue's test pins the list of learn demos. The Python file imports `pyctures` and `pynotation` (which brings the sound), so it runs in the app once step 3 above is done; the JavaScript one once steps 1 and 2 are. `demos/prove-twinkle.mjs` runs the Python file with `pyctures run` in Chromium and WebKit and checks that the sound is on, that every note lights in order, and that the synth is sounding each note while it is lit.

## Words for the help pages

The app's help already has a Sheet Music section (`src/app/docs/notation/`) that says the library is not built in. What becomes true when the `notation` branches are the libraries' main and the steps above are done:

- **A JavaScript scene needs no first line.** `showNotes(...)` and `makeSheet(...)` are there, in both spellings, with nothing to import: every `const { showNotes, useSound } = await use("notation.js")` on those pages goes, and so does `useSound(...)`. The scene's own sound is what a page plays through.
- **A Python scene needs `from pynotation import *`** and nothing else to hear a page: the import brings the sound. `from synths import *` is still wanted for a scene that calls sound functions itself (`play_song`, `make_synth`).
- **A tune waits for the sound.** `page.play()` before the first tap does not run ahead in silence: it begins when the sound is on.
- **Songs in format version 2**: a `chord` is written as its notes together, an `arp` as its chord with a wavy line, and a note that is glided to is not a new note. Bends, slides and vibrato are not written.
- **Record Video**: for a JavaScript scene the music and its moving line are in the film (see the unverified point above about which frame a note lights in). For a Python scene they are in it once the recorder's change above is made.
- The line "notation is not built into Circuitry's scenes yet" and the "In Circuitry" section that explains it can go.

**The how-to** (the sheet-music recipe that waits on this): the shortest scene is

```js
const page = showNotes("E4 D4 C4 D4 E4 E4 E4:2", "quarter", { title: "Mary had a little lamb" })
button("play", () => (page.playing ? page.stop() : page.play()))

function draw() {
  background("midnightblue")
}
```

and in Python

```python
from pyctures import *
from pydials import *
from pynotation import *

page = show_notes("E4 D4 C4 D4 E4 E4 E4:2", "quarter", title="Mary had a little lamb")
button("play", lambda: page.stop() if page.playing else page.play())

def draw():
    background("midnightblue")
```

Things a recipe should say, because they are what trips people: a staff has one rhythm (two tunes at once want two pages, or a song with a channel each); the page is drawn over the scene, so nothing is needed in `draw()`; with dials on the scene too, `layout(at="bottom")` keeps their rows clear of music at the top; and `page` is also the name of a dials function, which a scene's own `page = …` simply replaces.
