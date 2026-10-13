// This demo shows JavaScript drawing graphics in Circuitry Studio.
// The same file runs in a web browser with pictures.js, the free library:
// https://www.circuitry.dev/pictures

// Night Drive: a song plays, and its tune and bass are written out as sheet music as it goes. The notes that are sounding light up, and a ring grows for each one.
// Use: tap or click to start the song. Tap a bar of the music to play from there, or a note to hear it.
// Try changing: channels: [3, 1] to [0, 3] or [3, 1, 2] (2 is the drums); add grand: true or paper: "dark" to showNotes; "bell" to "lead"; a note in night_drive.json.

// The song is the file night_drive.json, beside this one.
const song = await loadJSON("night_drive.json")

// Write out two of its channels: 3 is the tune, 1 is the bass.
const page = showNotes(song, {
  channels: [3, 1],
  patches: { tune: { preset: "bell", echo: 0.3 } },
})

// Play the song the page shows. It goes round and round.
page.play()

// One ring for each note that has begun.
const rings = []

// As each note begins, make a ring.
// Low notes are on the left and high notes on the right.
page.onNote = (note) => {
  rings.push({
    x: width * (0.15 + 0.7 * ((note.note - 33) % 36) / 36),
    hue: note.note * 30,
    age: 0,
  })
}

// Many times a second: the rings grow older.
// dt is seconds since last time.
function update(dt) {
  for (const r of rings) r.age += dt
  // A ring is taken away after a little more than a second.
  while (rings.length && rings[0].age > 1.2) rings.shift()
}

// Draw the night, the rings and the words. The music draws itself.
function draw() {
  background("#0b1020")
  const y = height * 0.78
  for (const r of rings) {
    const size = 12 + 70 * r.age
    const fade = 1 - r.age / 1.2
    const colour = `hsla(${r.hue}, 90%, 65%, ${fade})`
    circle(r.x, y, size, { outline: colour, thickness: 4 })
  }
  // A browser keeps a page silent until it has been touched.
  // page.bar is the bar the song is in: 0 until it has begun.
  let words = "Tap anywhere to start the song"
  if (page.bar) words = `bar ${page.bar}`
  text(words, width / 2, height - 24, "white", 18, "centre")
}
