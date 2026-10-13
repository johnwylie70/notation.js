// Song: a tracker song plays, and two of its channels are written out as it goes: the tune and the bass.
// The notes that are sounding are lit, a line moves through the bar, and the page turns by itself.
// Tap a bar to play from there; tap a note to hear it.
// Try changing: channels: [3, 1] to [0, 3] or [3, 1, 2] (2 is the drums); grand: true; paper: "dark".
//
// Run it:   pictures run song.js     (staves.js and songs/night_drive.json sit beside this file)

const { showNotes, useSound } = await use("staves.js")
useSound({ playNote, soundTime })

const written = await loadJSON("songs/night_drive.json")     // the song's own file: it is what gets written out
const song = playSong("songs/night_drive.json", { patches: { tune: { preset: "bell", echo: 0.3 } } })
const page = showNotes(written, { channels: [3, 1], follow: song })

const rings = []
page.onNote = (note) => rings.push({ x: width * (0.15 + 0.7 * ((note.note - 33) % 36) / 36), hue: note.note * 30, age: 0 })

function update(dt) {
  for (const r of rings) r.age += dt
  while (rings.length && rings[0].age > 1.2) rings.shift()
}

function draw() {
  background("#0b1020")
  for (const r of rings) circle(r.x, height * 0.78, 12 + 70 * r.age, { outline: `hsla(${r.hue}, 90%, 65%, ${1 - r.age / 1.2})`, thickness: 4 })
  // A browser keeps a page silent until it has been touched: say so until the song is going.
  if (song.position.state !== "playing") text("Tap anywhere to start the song", width / 2, height - 24, "white", 18, "centre")
  else text(`bar ${page.bar}`, width / 2, height - 24, "#8fd3ff", 16, "centre")
}
