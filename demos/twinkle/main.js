// This demo shows JavaScript drawing graphics in Circuitry Studio.
// The same file runs in a web browser with pictures.js, the free library:
// https://www.circuitry.dev/pictures

// Twinkle: a tune written as code, one line a note, shown as sheet music. Each note lights as it sounds, and a star goes up for it.
// Use: click or tap below the music to play the tune, and again to stop it. Tap a note to hear it.
// Try changing: the notes; "quarter" to "eighth"; tempo: 100 to 160; "bell" to "keys" or "lead"; key: "C" to "G" (and the notes to match).

// The tune: a page of music with a title, a speed and a key.
const sheet = makeSheet({
  title: "Twinkle, twinkle, little star",
  tempo: 100,
  key: "C",
})

// Twinkle, twinkle, little ...
for (const name of ["C4", "C4", "G4", "G4", "A4", "A4"]) {
  sheet.add(name, "quarter")
}
// ... star (a long note)
sheet.add("G4", "half")

// How I wonder what you ...
for (const name of ["F4", "F4", "E4", "E4", "D4", "D4"]) {
  sheet.add(name, "quarter")
}
// ... are
sheet.add("C4", "half")

// Show the sheet, and choose the sound that plays it.
const page = showNotes(sheet, { voice: "bell" })

// One star for each note that has played.
const stars = []

// As each note begins, make a star. A higher note is a bigger star.
page.onNote = (note) => {
  stars.push({
    x: random(40, width - 40),
    y: height - 30,
    size: 8 + (note.note - 55),
    age: 0,
  })
}

// A click or a tap: play the tune, or stop it.
function onMouseDown() {
  if (page.playing) page.stop()
  else page.play()
}

// Many times a second: move the stars. dt is seconds since last time.
function update(dt) {
  for (const s of stars) {
    s.y -= 90 * dt
    s.age += dt
  }
  // A star is taken away after four seconds.
  while (stars.length && stars[0].age > 4) stars.shift()
}

// Draw the sky, the stars and the words. The music draws itself.
function draw() {
  background("midnightblue")
  for (const s of stars) star(s.x, s.y, s.size, 5, "gold")
  const words = page.playing ? "Click to stop" : "Click here to play"
  text(words, width / 2, height - 24, "white", 18, "centre")
}
