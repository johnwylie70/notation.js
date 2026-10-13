// Twinkle: a tune written as code, one line a note, shown as sheet music. Click below the music and it
// plays: each note lights as it sounds, and a star goes up for it.
// Try changing: the notes; "quarter" to "eighth"; tempo: 100 to 160; key: "C" to "G" (and the notes to match).
//
// Run it:   pictures run twinkle.js     (staves.js sits beside this file)

const { makeSheet, showNotes, useSound } = await use("staves.js")
useSound({ makeSynth, playNote, soundTime })      // what the page plays through, and keeps time by

const sheet = makeSheet({ title: "Twinkle, twinkle, little star", tempo: 100, key: "C" })
for (const name of ["C4", "C4", "G4", "G4", "A4", "A4"]) sheet.add(name, "quarter")
sheet.add("G4", "half")
for (const name of ["F4", "F4", "E4", "E4", "D4", "D4"]) sheet.add(name, "quarter")
sheet.add("C4", "half")

const page = showNotes(sheet, { voice: "bell" })
const stars = []
page.onNote = (note) => stars.push({ x: random(40, width - 40), y: height - 30, size: 8 + (note.note - 55), age: 0 })

function onMouseDown() {
  if (page.playing) page.stop()
  else page.play()
}

function update(dt) {
  for (const s of stars) { s.y -= 90 * dt; s.age += dt }
  while (stars.length && stars[0].age > 4) stars.shift()
}

function draw() {
  background("midnightblue")
  for (const s of stars) star(s.x, s.y, s.size, "gold")
  text(page.playing ? "Click to stop" : "Click here to play", width / 2, height - 24, "white", 18, "centre")
}
