# Changes

## Unreleased

- Music is written out as sheet music: `showNotes("C4 E4 G4 - C5:2", "quarter")` takes a tune in the words of synths.js's `playNotes`, `makeSheet({ key: "G", time: "3/4" })` is written a note at a time, and a list of `{ note, start, length }` in beats is plain data anything can make.
- What is drawn: treble, bass and percussion clefs and a grand staff, key and time signatures, notes and rests from a whole note to a thirty-second, dots, ties, flags and beams, chords, sharps, flats and naturals, ledger lines, bar lines, bar numbers, a tempo mark and a title, on as many lines as the width needs, or as one long line (`scroll: "across"`).
- The key, the clef and how each length is written (tied across bar lines and beats, beamed by the beat) are worked out, and can each be said.
- A tracker song is written out: our JSON songs, and a MOD or XM once the sound library has packed it. Rows become beats, a note lasts until the next on its channel, a `chord` is written as a chord with a wavy line, drums get a percussion staff, and you choose the channels (`channels`, `instruments`, `drums`, `grand`, `rowsPerBeat`).
- It follows what plays: `page.play()` plays the music through the sound it was given and lights each note as it sounds; `page.follow(song)` follows a song from `playSong`, and tapping a bar sends the song there. A line moves through the bar and the page turns by itself. `page.onNote` and `page.onBar` tell a scene what has just begun.
- A learner can play along: `page.playAlong("wait")` waits at each note, `"time"` keeps time; notes come through `page.noteOn(note)`, so a dials.js `keyboard(page)` or a MIDI keyboard plays the page; right notes turn green and wrong ones red, and `page.result` counts them.
- It is drawn on a canvas of its own over a scene, or fills any element; on light or dark paper or none; and only the bars that change are drawn again.
- Three examples: a nursery tune written as code, a song with two staves following, and a play-along trainer with a keyboard.
