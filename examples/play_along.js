// Play along: the music waits for you. Play each note on the keys (a finger, the mouse, or the computer's
// keys A S D F G H J): the key to press next is lit. A right note turns green, a wrong one shows in red.
// Try changing: "wait" to "time" (the line keeps going, at the tempo, after a bar counted in); the tune;
// tempo: 80; hint: false (no lit key).
//
// Run it:   pictures run play_along.js     (staves.js sits beside this file)

const { showNotes } = await use("staves.js")

const lead = makeSynth("keys")
const page = showNotes("E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2", "quarter", { title: "Mary had a little lamb", tempo: 80 })
page.playAlong({ mode: "wait", synth: lead })     // lead is heard when a key goes down
keyboard(page, { octave: 4, octaves: 1 })          // the keys play the page

// A real keyboard plugged in plays it too.
function onMidiNote(note, velocity) {
  if (velocity > 0) page.noteOn(note, velocity)
  else page.noteOff(note)
}

function draw() {
  background("#12261e")
  const r = page.result
  const words = r.done ? `Done! ${r.right} right, ${r.wrong} wrong: ${r.percent}%. Click here to go again.` : `${r.right} of ${r.total} played, ${r.wrong} wrong`
  text(words, width / 2, height * 0.5, "white", 20, "centre")
}

function onMouseDown() {
  if (page.result.done) page.playAlong({ mode: "wait", synth: lead })
}
