// This demo shows JavaScript drawing graphics in Circuitry Studio.
// The same file runs in a web browser with pictures.js, the free library:
// https://www.circuitry.dev/pictures

// Twinkle: a tune written as code, one line a note, shown as sheet music. Each note lights as it sounds, and a star goes up for it.
// Use: click or tap below the music to play the tune, and again to stop it. Tap a note to hear it.
// Try changing: the notes; "quarter" to "eighth"; tempo: 100 to 160; "bell" to "keys" or "lead"; key: "C" to "G" (and the notes to match).

// makeSheet and showNotes are sheet music (notation.js, which comes with pictures.js as its sound does).
const sheet = makeSheet({ title: "Twinkle, twinkle, little star", tempo: 100, key: "C" })
for (const name of ["C4", "C4", "G4", "G4", "A4", "A4"]) sheet.add(name, "quarter")
sheet.add("G4", "half")
for (const name of ["F4", "F4", "E4", "E4", "D4", "D4"]) sheet.add(name, "quarter")
sheet.add("C4", "half")

const page = showNotes(sheet, { voice: "bell" })
const stars = []      // one for each note that has played

// Called as each note begins: a higher note is a bigger star.
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
  for (const s of stars) star(s.x, s.y, s.size, 5, "gold")
  text(page.playing ? "Click to stop" : "Click here to play", width / 2, height - 24, "white", 18, "centre")
}
