#!/usr/bin/env node
/**
 * notation.js, tested. First the parts that need no screen, here in node: reading a tune, writing its lengths in
 * bars, ties, beams, keys, clefs, a tracker's rows turned into rhythm, and the layout's geometry at four widths.
 * Then real browsers: what is drawn is where the layout says, the notes that light are the notes that are heard
 * (the real synths.js plays, muted), a learner's right and wrong notes are marked and counted, a dials.js keyboard
 * plays the page, and every example runs as a pictures.js scene.
 *
 *   PLAYWRIGHT=/path/to/node_modules/playwright node scripts/test-notation.mjs
 *
 * pictures.js, synths.js and dials.js are taken from the folders beside this repository. Chromium, and WebKit
 * when Playwright has it. NOTHING IS HEARD: Chromium is started muted, and in every page what a sound would be
 * sent to is a gain of nothing. No MIDI is asked for. `--shots` saves pictures in shots/ (or SHOTS=/a/folder);
 * `--node` runs only the first part. It ends with code 1 if a case fails.
 */
import { createServer } from 'node:http'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BESIDE = { pictures: resolve(process.env.PICTURES || join(ROOT, '..', 'pictures.js')), synths: resolve(process.env.SYNTHS || join(ROOT, '..', 'synths.js')), dials: resolve(process.env.DIALS || join(ROOT, '..', 'dials.js')) }
const SHOTS = process.env.SHOTS || (process.argv.includes('--shots') ? join(ROOT, 'shots') : '')
const lib = await import(pathToFileURL(join(ROOT, 'notation.js')).href)
const { readMusic, readTune, readSong, unpackSong, write, writeLength, layout, guessKey, chooseClef, spell, keyOf, makeSheet } = lib

let passed = 0, failed = 0
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function check(where, what, got, want) {
  if (same(got, want)) { passed++; return }
  failed++
  console.log(`FAIL ${where}: ${what}\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`)
}
const throws = (fn) => { try { fn(); return null } catch (e) { return e.message } }

// ------------------------------------------------------------------------------------------ in node
// A staff as text: each bar's notes and rests as "where:how long", "~" for a tie to the next, "b" for a beam, "r" for a rest.
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const said = (staff) => staff.bars.map((bar) => bar.map((i) => (i.rest ? 'r' : i.heads.map((h) => NAMES[h.note % 12] + (Math.floor(h.note / 12) - 1)).join('+')) + ':' + i.long + (i.tie ? '~' : '') + (i.beam ? 'b' : '')).join(' ')).join(' | ')
const written = (tune, step, o) => { const score = write(readMusic(tune, step, o)); return score.staves.map(said).join(' // ') }

check('node', 'a tune is read as playNotes reads it: steps, ":2", ":q", a rest, a chord joined with + and one by name',
  readTune('C4 E4:2 - G4:q C4+E4 Am:h', 'eighth').notes.map((n) => [n.start, n.length, n.notes]),
  [[0, 0.5, [60]], [0.5, 1, [64]], [2, 1, [67]], [3, 0.5, [60, 64]], [3.5, 2, [69, 72, 76]]])
check('node', 'a list is read too: null is a rest and a list inside is a chord', readTune(['C4', null, ['C4', 'E4']], 'quarter').notes.map((n) => [n.start, n.notes]), [[0, [60]], [2, [60, 64]]])
check('node', 'a mistake is said in plain words', [/is not a note/.test(throws(() => readTune('C4 H4'))), /is not a length/.test(throws(() => readTune('C4:zz'))), /needs notes to show/.test(throws(() => readTune(''))), /not a time signature/.test(throws(() => readMusic('C4', undefined, { time: '4' }))), /is not a key/.test(throws(() => keyOf('H')))], [true, true, true, true, true])

// --- lengths: [where it starts, how long, dots] in ticks (8 to a quarter note), in a bar of 4/4 unless said
const lengths = (from, to, rest, bar = 32, beat = 8, compound = false) => writeLength(from, to, rest, bar, beat, compound).map(([at, long, dots]) => [at, long, dots])
check('node', 'a quarter, a dotted half and a whole note are each one note', [lengths(0, 8), lengths(8, 32), lengths(0, 32)], [[[0, 8, 0]], [[8, 24, 1]], [[0, 32, 0]]])
check('node', 'a note across the middle of the bar is tied there, so the third beat can be seen', [lengths(12, 28), lengths(8, 20)], [[[12, 4, 0], [16, 12, 1]], [[8, 8, 0], [16, 4, 0]]])
check('node', 'a quarter note off the beat is written as it is, but not across the middle of the bar', [lengths(4, 12), lengths(12, 20)], [[[4, 8, 0]], [[12, 4, 0], [16, 4, 0]]])
check('node', 'but a half note on the second beat is written as one', lengths(8, 24), [[8, 16, 0]])
check('node', 'a note that begins off the beat grows towards it', lengths(2, 16), [[2, 2, 0], [4, 4, 0], [8, 8, 0]])
check('node', 'a dotted quarter on the beat is one note; off it, two tied', [lengths(0, 12), lengths(4, 16)], [[[0, 12, 1]], [[4, 4, 0], [8, 8, 0]]])
check('node', 'rests are written plainly: no dots, and each on its own beat', [lengths(0, 12, true), lengths(4, 16, true), lengths(16, 32, true)], [[[0, 8, 0], [8, 4, 0]], [[4, 4, 0], [8, 8, 0]], [[16, 16, 0]]])
check('node', 'an empty bar is one whole rest, whatever the time', [writeLength(0, 24, true, 24, 8, false), writeLength(0, 24, true, 24, 12, true)], [[[0, 24, 0, true]], [[0, 24, 0, true]]])
check('node', 'in 6/8 a beat is a dotted quarter: notes and rests keep to it', [lengths(0, 12, false, 24, 12, true), lengths(12, 24, false, 24, 12, true), lengths(8, 16, false, 24, 12, true), lengths(12, 24, true, 24, 12, true), lengths(0, 24, false, 24, 12, true)],
  [[[0, 12, 1]], [[12, 12, 1]], [[8, 4, 0], [12, 4, 0]], [[12, 12, 1]], [[0, 24, 1]]])
check('node', 'in 3/4 a half note may begin on the second beat', lengths(8, 24, false, 24, 8), [[8, 16, 0]])

// --- bars, ties and beams
check('node', 'a note longer than what is left of its bar is tied over the bar line', written('C4:3 D4:3 E4:2', 'quarter'), 'C4:24 D4:8~ | D4:16 E4:16')
check('node', 'eighth notes are beamed by the beat, four together where a half bar is all eighths', written('C4 D4 E4 F4 G4 A4:2 B4', 'eighth'), 'C4:4b D4:4b E4:4b F4:4b G4:4 A4:8 B4:4')
check('node', 'sixteenths are beamed with the eighth of their beat, and a rest breaks a beam', written('C4:2 D4 E4 F4 - G4 A4 B4:4 C5:4', 'sixteenth'), 'C4:4b D4:2b E4:2b F4:2 r:2 G4:2b A4:2b B4:8 C5:8')
check('node', 'what is left of the last bar is rests', written('C4 D4 E4 F4 G4', 'quarter'), 'C4:8 D4:8 E4:8 F4:8 | G4:8 r:8 r:16')
check('node', 'a sheet is written a note at a time, in its own time and key', (() => { const s = makeSheet({ key: 'G', time: '3/4' }); s.add('G4', 'quarter').add(['B4', 'D5'], 'half').rest('quarter').add('F#4', 'eighth').add('G4', 'eighth').add('A4', 'quarter'); const score = write(readMusic(s)); return [score.key, score.time, said(score.staves[0]), score.staves[0].bars[1].filter((i) => !i.rest).map((i) => i.heads[0].sign)] })(), [1, [3, 4], 'G4:8 B4+D5:16 | r:8 F#4:4b G4:4b A4:8', [null, null, null]])
check('node', 'plain data in beats is written the same way, and a small gap before the next note is not a rest', written([{ note: 'C4', start: 0, length: 0.9 }, { note: 'E4', start: 1, length: 1.9 }, { notes: ['G4', 'B4'], start: 3, length: 1 }]), 'C4:8 E4:16 G4+B4:8')
check('node', 'notes that fall between sixteenths are written to the nearest thirty-second', written([{ note: 'C4', start: 0, length: 0.125 }, { note: 'D4', start: 0.125, length: 0.375 }, { note: 'E4', start: 0.5, length: 0.5 }]).split(' ').slice(0, 3), ['C4:1b', 'D4:1~b', 'D4:2b'])

// --- keys, spelling, accidentals, clefs
const weigh = (text) => { const w = new Array(12).fill(0); for (const n of readTune(text, 'quarter').notes) for (const p of n.notes) w[p % 12] += n.length; return w }
check('node', 'the key is the one with the fewest accidentals, and the plainest of those that fit', [guessKey(weigh('G4 A4 B4 C5 D5 E5 F#5 G5')), guessKey(weigh('F4 G4 A4 Bb4 C5 D5 E5 F5')), guessKey(weigh('E4 D4 C4 D4 E4 E4 E4 G4')), guessKey(weigh('D4 E4 F#4 G4 A4 B4 C#5 D5')), guessKey(weigh('Eb4 F4 G4 Ab4 Bb4 C5 D5')), guessKey(weigh('A3 B3 C4 D4 E4 F4 G4 A4'))], [1, -1, 0, 2, -3, 0])
check('node', 'a key is named as on a song sheet', [keyOf('C'), keyOf('G'), keyOf('F'), keyOf('Bb'), keyOf('Am'), keyOf('F#m'), keyOf('Eb'), keyOf(-2)], [0, 1, -1, -2, 0, 3, -3, -2])
check('node', 'a note outside the key takes the name nearest it', [spell(66, 0), spell(70, 0), spell(61, 2), spell(63, -3), spell(68, 0)].map((s) => 'CDEFGAB'[s.letter] + (s.alter > 0 ? '#' : s.alter < 0 ? 'b' : '')), ['F#', 'Bb', 'C#', 'Eb', 'G#'])
const signs = (tune, o) => write(readMusic(tune, 'quarter', o)).staves[0].bars.map((bar) => bar.filter((i) => !i.rest).map((i) => (i.heads[0].sign || '-').replace('accidental', '')))
check('node', 'a sharp is written once in a bar, cancelled by a natural, and written again in the next bar', signs('F#4 F#4 F4 F#4 F#4 G4 A4 B4', { key: 'C' }), [['Sharp', '-', 'Natural', 'Sharp'], ['Sharp', '-', '-', '-']])
check('node', 'the key signature covers its own notes, and a natural is needed to leave it', signs('F#4 G4 F4 Bb4', { key: 'G' }), [['-', '-', 'Natural', 'Flat']])
check('node', 'high notes take the treble clef, low ones the bass, and both far apart a grand staff', [chooseClef(readTune('C4 E4 G4 C5').notes).clef, chooseClef(readTune('C2 G2 C3 E3').notes).clef, chooseClef(readTune('C2 G2 C5 E5 C2 G5').notes).clef, chooseClef(readTune('C7 E7 G7 C8').notes)], ['treble', 'bass', 'grand', { clef: 'treble', octave: 1 }])
const places = (tune, o) => write(readMusic(tune, 'quarter', o)).staves.map((s) => s.bars[0].filter((i) => !i.rest).map((i) => [i.heads.map((h) => h.pos).join('+'), i.up ? 'up' : 'down']))
check('node', 'in the treble clef E4 is on the bottom line and F5 on the top; stems go up below the middle line and down from it', places('E4 G4 B4 F5', { clef: 'treble' }), [[['0', 'up'], ['2', 'up'], ['4', 'down'], ['8', 'down']]])
check('node', 'in the bass clef G2 is on the bottom line and A3 on the top', places('G2 D3 A3 C4', { clef: 'bass' }), [[['0', 'up'], ['4', 'down'], ['8', 'down'], ['10', 'down']]])
check('node', 'a grand staff has the notes from middle C up on the treble staff and the rest on the bass', places('C4+E4 C3 G4+E3 C2', { clef: 'grand' }), [[['-2+0', 'up'], ['2', 'up']], [['3', 'up'], ['5', 'down'], ['-4', 'up']]])
check('node', 'beamed notes have their stems the same way, by the note furthest from the middle', write(readMusic('E4 D5 F5 C4', 'eighth')).staves[0].bars[0].filter((i) => !i.rest).map((i) => i.up), [true, true, true, true])

// --- a tracker song: rows into rhythm
const song = (events, more = {}) => ({ format: 'synths-song', speed: 6, tempo: 125, channels: 4, order: [0], patterns: [{ rows: 16, events }], instruments: [{ name: 'lead', patch: 'lead' }, { name: 'kick', patch: 'chipKick' }, { name: 'snare', patch: 'chipSnare' }, { name: 'blip', sample: 0 }], samples: [{ name: 'blip', wave: new Array(2000).fill(50) }], ...more })
const tracked = (events, more, o) => { const music = readSong(song(events, more), o); return [music.tempo, ...write(music).staves.map((s) => (s.percussion ? 'drums ' : s.clef + ' ') + said(s))] }
check('node', 'four rows are a beat: a note lasts until the next on its channel, or a note-off', tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 4, ch: 0, note: 'E-4', ins: 1 }, { row: 6, ch: 0, note: 'G-4', ins: 1 }, { row: 8, ch: 0, note: 'off' }, { row: 12, ch: 0, note: 'C-5', ins: 1 }]), [125, 'treble C4:8 E4:4b G4:4b r:8 C5:8'])
check('node', 'a note let go a row before the next beat is written to the beat; a volume of nothing ends a note too', tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 7, ch: 0, note: 'off' }, { row: 8, ch: 0, note: 'D-4', ins: 1 }, { row: 12, ch: 0, vol: 0 }]), [125, 'treble C4:16 D4:8 r:8'])
check('node', 'a speed of 3 makes eight rows a beat, and the tempo written is the tempo heard', tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 8, ch: 0, note: 'E-4', ins: 1 }], { speed: 3 }), [125, 'treble C4:8 E4:8 r:16'])
check('node', 'an effect F changes the speed without changing how a row is written', readSong(song([{ row: 0, ch: 0, note: 'C-4', ins: 1, fx: 'F03' }, { row: 4, ch: 0, note: 'D-4', ins: 1 }])).parts[0].notes.map((n) => [n.start, n.length]), [[0, 1], [1, 3]])
check('node', 'a chord on a note is written as the chord, with a wavy line, not as many small notes', (() => { const music = readSong(song([{ row: 0, ch: 0, note: 'A-4', ins: 1, chord: 'min' }, { row: 8, ch: 0, note: 'F-4', ins: 1, chord: [0, 4, 7, 12] }, { row: 12, ch: 0, ins: 1, chord: 'G7' }])); return music.parts[0].notes.map((n) => [n.start, n.notes, n.arp]) })(), [[0, [69, 72, 76], true], [2, [65, 69, 72, 77], true], [3, [67, 71, 74, 77], true]])
const two = (events) => readSong(song(events, { version: 2 })).parts[0].notes.map((n) => [n.start, n.notes, n.arp])
check('node', 'in a version 2 song a chord is notes together and an arp the notes one at a time: both are written as the chord, the arp with a wavy line', two([{ row: 0, ch: 0, note: 'C-4', ins: 1, chord: 'm7' }, { row: 4, ch: 0, note: 'C-4', ins: 1, arp: { chord: 'maj', rate: '1/16', octaves: 2 } }, { row: 8, ch: 0, arp: { chord: [-4, 0, 3, 8], rate: '1/16' } }, { row: 12, ch: 0, note: 'A-3', ins: 1, arp: { chord: 'min', order: 'together' } }]),
  [[0, [60, 63, 67, 70], false], [1, [60, 64, 67], true], [2, [56, 60, 63, 68], true], [3, [57, 60, 64], false]])
check('node', 'in a version 2 song a chord beside one of the old keys is still the fast arpeggio, and "off" ends one without a new note', two([{ row: 0, ch: 0, note: 'C-4', ins: 1, chord: 'maj', chordHz: 50 }, { row: 4, ch: 0, arp: 'off' }, { row: 8, ch: 0, note: 'D-4', ins: 1 }]), [[0, [60, 64, 67], true], [2, [62], false]])
check('node', 'a note that is glided to is not a new note, and a bend, a slide and a vibrato are not written', two([{ row: 0, ch: 0, note: 'A-4', ins: 1, bend: 'scoop' }, { row: 4, ch: 0, note: 'C-5', ins: 1, glide: '1/16' }, { row: 6, ch: 0, bend: 'fall' }, { row: 8, ch: 0, note: 'E-5', ins: 1, vibrato: true }, { row: 12, ch: 0, note: 'G-5', ins: 1, glide: true }, { row: 14, ch: 0, slide: 12 }]).map((n) => [n[0], n[1][0]]), [[0, 69], [2, 76]])
check('node', 'drums are known by their names and written on a percussion staff, each drum in its own place, as short hits', tracked([{ row: 0, ch: 1, note: 'C-3', ins: 2 }, { row: 4, ch: 1, note: 'A-3', ins: 3 }, { row: 6, ch: 1, note: 'A-3', ins: 3 }, { row: 8, ch: 1, note: 'C-3', ins: 2 }]), [125, 'drums F4:8 C5:4b C5:4b F4:8 r:8'])
check('node', 'which instruments are drums can be told, and so can which channels and instruments to show', [tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 0, ch: 1, note: 'C-3', ins: 2 }], {}, { drums: ['lead'] })[1].slice(0, 5), tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 0, ch: 1, note: 'C-3', ins: 2 }], {}, { channels: [0] }).length, tracked([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 4, ch: 0, note: 'C-5', ins: 4 }], {}, { instruments: ['lead'] })[1]], ['drums', 2, 'treble C4:8 r:8 r:16'])
check('node', 'a sample that does not loop is as long as it sounds, not as long as the gap after it', tracked([{ row: 0, ch: 0, note: 'C-4', ins: 4 }, { row: 8, ch: 0, note: 'C-4', ins: 4 }]), [125, 'treble C4:4 r:4 r:8 C4:4 r:4 r:8'])
check('node', 'a note with a glide to it (effect 3) is not a new note, and a pattern break ends the pattern there', (() => { const music = readSong(song([{ row: 0, ch: 0, note: 'C-4', ins: 1 }, { row: 4, ch: 0, note: 'E-4', ins: 1, fx: '310' }, { row: 7, ch: 0, fx: 'D00' }], { order: [0, 0] })); return [music.parts[0].notes.map((n) => [n.start, n.notes[0]]), music.song.rows, music.song.beat({ order: 1, row: 4, tick: 3, speed: 6 }), music.song.place(2.5)] })(), [[[0, 60], [2, 60]], 16, 3.125, { order: 1, row: 2 }])
check('node', 'a song with nothing in the channels asked for says so', /nothing to show/.test(throws(() => readSong(song([{ row: 0, ch: 0, note: 'C-4', ins: 1 }]), { channels: [2] }))), true)

const drive = JSON.parse(readFileSync(join(ROOT, 'examples', 'songs', 'night_drive.json'), 'utf8'))
const night = readSong(drive)
const nightScore = write(night)
check('node', 'Night Drive: four staves (chords, bass, drums, tune), eight bars at 125, in A minor with no sharps or flats', [night.tempo, night.parts.map((p) => [p.name, p.channel, p.percussion]), nightScore.bars, nightScore.key, nightScore.staves.map((s) => s.clef)], [125, [['chords', 0, false], ['bass', 1, false], ['drums', 2, true], ['tune', 3, false]], 8, 0, ['treble', 'bass', 'percussion', 'treble']])
check('node', 'Night Drive: the bass is a dotted quarter, an eighth tied to a quarter, and a quarter; the chord is a whole note tied to the next bar', [said(nightScore.staves[1]).split(' | ')[0], said(nightScore.staves[0]).split(' | ').slice(0, 2), nightScore.staves[0].events[0].arp], ['A2:12 A2:4~ A2:8 A3:8', ['A4+C5+E5:32~', 'A4+C5+E5:32'], true])
check('node', 'Night Drive: a place in the song is a beat and back', [night.song.beat({ order: 0, row: 0 }), night.song.beat({ order: 2, row: 16, tick: 3, speed: 6 }), night.song.place(20), night.song.rowsPerBeat], [0, 20.125, { order: 2, row: 16 }, 4])
check('node', 'Night Drive on a grand staff: the tuned channels together on two joined staves, and the drums below', write(readSong(drive, { grand: true })).staves.map((s) => [s.clef, s.brace]), [['treble', 1], ['bass', 2], ['percussion', 0]])

// The packed form of a song, built here by the document: two notes and a chord.
function packed() {
  const b = []
  const u8 = (n) => b.push(n & 255), u16 = (n) => { u8(n); u8(n >> 8) }, u32 = (n) => { u16(n); u16(n >> 16) }
  const text = (s) => { u16(s.length); for (const c of s) u8(c.charCodeAt(0)) }
  for (const c of 'SYSG') u8(c.charCodeAt(0))
  u16(1); u16(0); u8(6); u8(125); u16(0); u16(2); u16(1); u16(1); u16(1); u16(0)
  text('Packed'); u8(128); u8(128); u16(0)
  u16(16); u32(3)
  u16(0); u8(0); u8(0); u8(49); u8(1); u8(0); u8(0); u8(0)
  u16(4); u8(0); u8(1); u8(53); u8(1); u8(0); u8(0); u8(0); u8(3); u8(0); u8(0); u8(0); u32(0); for (const o of [0, 3, 7, 0, 0, 0, 0, 0]) u8(o)
  u16(8); u8(0); u8(0); u8(97); u8(0); u8(0); u8(0); u8(0)
  text('lead'); text('lead'); u8(0); for (let e = 0; e < 2; e++) { u8(0); u8(0); u8(0); u8(0); u8(0) } u32(0); u16(0)
  return new Uint8Array(b)
}
check('node', 'the packed form of a song (what packSong makes of a MOD or XM) is read as the JSON is', (() => { const music = readMusic(packed()); return [music.title, music.parts[0].name, music.parts[0].notes.map((n) => [n.start, n.length, n.notes])] })(), ['Packed', 'lead', [[0, 1, [60]], [1, 1, [64, 67, 71]]]])
function packed2() {
  const b = []
  const u8 = (n) => b.push(n & 255), u16 = (n) => { u8(n); u8(n >> 8) }, u32 = (n) => { u16(n); u16(n >> 16) }
  const text = (s) => { u16(s.length); for (const c of s) u8(c.charCodeAt(0)) }
  const full = (arp, offsets, order = 0) => { u8(offsets.length); u8(arp); u8(order); for (let i = 0; i < 21; i++) u8(0); for (let i = 0; i < 8; i++) u8(offsets[i] || 0) }
  for (const c of 'SYSG') u8(c.charCodeAt(0))
  u16(2); u16(0); u8(6); u8(125); u16(0); u16(1); u16(1); u16(1); u16(1); u16(0)
  text('Two'); u8(128); u16(0)
  u16(16); u32(4)
  u16(0); u8(0); u8(2); u8(49); u8(1); u8(0); u8(0); u8(0); full(0, [0, 4, 7])                 // a chord, together
  u16(4); u8(0); u8(2); u8(49); u8(1); u8(0); u8(0); u8(0); full(1, [0, 3, 7])                 // an arpeggio
  u16(8); u8(0); u8(4); u8(53); u8(1); u8(0); u8(0); u8(0); u16(1)                             // a note glided to: extra 1
  u16(12); u8(0); u8(4); u8(56); u8(1); u8(0); u8(0); u8(0); u16(2)                            // a note with a bend: extra 2
  text('lead'); text('lead'); u8(0); for (let e = 0; e < 2; e++) { u8(0); u8(0); u8(0); u8(0); u8(0) } u32(0); u16(0)
  for (const c of 'XTRA') u8(c.charCodeAt(0))
  u16(2); u8(1); for (let i = 0; i < 8; i++) u8(0); u8(2); for (let i = 0; i < 16; i++) u8(0)
  return new Uint8Array(b)
}
check('node', 'the packed form of a version 2 song: a chord in full, an arpeggio in full, and a glide kept among the extras', readMusic(packed2()).parts[0].notes.map((n) => [n.start, n.notes, n.arp]), [[0, [60, 64, 67], false], [1, [60, 63, 67], true], [3, [67], false]])
check('node', 'bytes that are a MOD or XM as they came say what to do', /packSong/.test(throws(() => unpackSong(new Uint8Array(2000)))), true)

// --- the layout: real geometry, at the widths of a phone, a split view, a tablet and a desktop
const PIECES = {
  mary: ['E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4', 'quarter', { title: 'Mary had a little lamb' }],
  mixed: ['C4:e D4:e E4:s F4:s G4:s A4:s B4:q. C5:e Eb5:h F#4:q G#4:e Bb4:e C4+E4+G4:h D4+F4+A4:q -:q E5:s D5:s C5:e B4:e A4:s G4:s F4:w C6:q A3:q E4+F4:h C#4+D#4+F#4:q -:e Bb5:e', 'quarter', { tempo: 96 }],
  six: ['D4:e F#4:e A4:e D5:q A4:e B4:q. A4:q. G4:e B4:e D5:e G5:q. F#5:q E5:e D5:h.', 'eighth', { time: '6/8', key: 'D' }],
  bass: ['C2 G2 C3 G2 A1 E2 A2 E2 F2:2 G2:2 C2:4', 'eighth', {}],
  song: [drive, undefined, {}],
  grand: [drive, undefined, { grand: true }],
}
const WIDTHS = { phone: 390, split: 560, tablet: 820, desktop: 1280 }
const BOX = (p, S) => { const g = lib.glyphBox(p.n); const s = (p.s || 1) * S / 250; return [p.x + g[0] * s, p.y + g[1] * s, p.x + g[2] * s, p.y + g[3] * s] }
/** What is wrong with a page: symbols that overlap, anything outside the page, notes off their line. Nothing: []. */
function faults(score, plan) {
  const S = plan.S, wrong = []
  for (const sys of plan.systems) {
    const boxes = []
    for (const p of sys.fixed) if (p.k === 'g') boxes.push({ box: BOX(p, S), of: 'start', n: p.n })
    for (const bar of sys.bars) for (const p of bar.prims) if (p.k === 'g' && !/^flag/.test(p.n)) boxes.push({ box: BOX(p, S), of: p.e || p, n: p.n })
    for (const a of boxes) {
      if (a.box[0] < -0.5 || a.box[2] > plan.width + 0.5 || a.box[1] < sys.y - 0.5 || a.box[3] > sys.y + sys.h + 0.5) wrong.push(`${a.n} is outside its line of music`)
      for (const b of boxes) {
        if (a === b || a.of === b.of || (a.of === 'start') !== (b.of === 'start') && false) continue
        // (Shrunk a little: symbols may touch.)
        const m = 0.08 * S
        if (a.box[0] + m < b.box[2] - m && b.box[0] + m < a.box[2] - m && a.box[1] + m < b.box[3] - m && b.box[1] + m < a.box[3] - m && a.n <= b.n) wrong.push(`${a.n} and ${b.n} overlap at ${Math.round(a.box[0])}, ${Math.round(a.box[1])}`)
      }
    }
    if (sys.x1 > plan.width + 0.5) wrong.push('a line of music is wider than the page')
    let last = -Infinity
    for (const [, x] of sys.times) { if (x < last - 0.01) wrong.push('time goes backwards across the page'); last = x }
  }
  // Every note head is on the line or space of its pitch: so many half spaces above its staff's bottom line.
  for (const hit of plan.hits) for (const h of hit.item.heads) {
    const y = hit.sys.staffY[hit.st] + 4 * S - h.pos * S / 2
    if (Math.abs(h.py - y) > 0.01) wrong.push('a note is off its line')
    if (hit.item.plain < 32 && (hit.item.tip < hit.item.end) !== hit.item.up) wrong.push('a stem goes the wrong way')
  }
  return [...new Set(wrong)]
}
for (const [name, [tune, step, o]] of Object.entries(PIECES)) for (const [size, width] of Object.entries(WIDTHS)) {
  const score = write(readMusic(tune, step, o))
  const S = Math.min(11, Math.max(7, width / 62))
  const plan = layout(score, { width: width - 20 - 1.6 * S, space: S })
  check('node', `${name} at ${size} width: nothing overlaps, nothing is outside the page, every note is on its line and every stem the right way`, faults(score, plan), [])
  if (size === 'phone') check('node', `${name}: a narrow page has more lines of music than a wide one, and every bar is on one`, [plan.systems.length >= layout(write(readMusic(tune, step, o)), { width: 1240, space: 11 }).systems.length, plan.systems.length > 1 || score.bars < 3, plan.systems.reduce((n, s) => n + s.bars.length, 0)], [true, true, score.bars])
}
check('node', 'lines are filled to the right edge, but a short last line is left short', (() => { const plan = layout(write(readMusic(...PIECES.mary)), { width: 600, space: 9 }); const last = plan.systems[plan.systems.length - 1]; const short = layout(write(readMusic('C4 D4', 'whole')), { width: 1500, space: 10 }).systems[0]; return [plan.systems.length > 1, plan.systems.slice(0, -1).every((s) => Math.abs(s.x1 - (600 - plan.margin.right)) < 0.6), last.stretch === 1 || Math.abs(last.x1 - (600 - plan.margin.right)) < 0.6, short.stretch, short.x1 < 500] })(), [true, true, true, 1, true])
check('node', 'a longer note is given more room than a shorter one, and a line read across is one long line', (() => { const score = write(readMusic('C4:h D4:q E4:e F4:e', 'quarter')); const plan = layout(score, { width: 1000, space: 10 }); const x = score.staves[0].bars[0].map((i) => i.x); const across = layout(write(readMusic(...PIECES.mary)), { width: 300, space: 10, across: true }); return [x[1] - x[0] > x[2] - x[1], x[2] - x[1] > x[3] - x[2], across.systems.length, across.width > 900] })(), [true, true, 1, true])

console.log(`     node: ${passed} passed, ${failed} failed`)
if (process.argv.includes('--node')) process.exit(failed ? 1 : 0)

// ------------------------------------------------------------------------------------------ in browsers
const from = process.env.PLAYWRIGHT || 'playwright'
const playwright = await import(from.startsWith('/') ? pathToFileURL(join(from, 'index.mjs')).href : from)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' }
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/full.html') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;overflow:hidden;background:#223"><div id="s" style="position:absolute;inset:0"></div>')
  let body
  const beside = /^\/(pictures|synths|dials)\//.exec(path)
  try { body = await readFile(beside ? join(BESIDE[beside[1]], path.slice(beside[0].length)) : join(ROOT, path)) } catch { return res.writeHead(404).end() }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body)
})
await new Promise((done) => server.listen(0, done))
const at = `http://localhost:${server.address().port}`

// Nothing reaches the speakers: Chromium is launched muted, and in every page (WebKit has no such switch)
// what a sound would be sent to is a gain of nothing in front of the real output.
const SILENT = () => {
  for (const Kind of [window.AudioContext, window.webkitAudioContext]) {
    if (!Kind) continue
    const real = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination').get
    const quiet = new WeakMap()
    Object.defineProperty(Kind.prototype, 'destination', { configurable: true, get() {
      if (!quiet.has(this)) { const gain = this.createGain(); gain.gain.value = 0; gain.connect(real.call(this)); quiet.set(this, gain) }
      return quiet.get(this)
    } })
  }
}
// In every page: the library, the pages of the whole window, and a few helpers.
const HELPERS = async () => {
  window.lib = await import('/notation.js')
  window.frames = (n = 3) => new Promise((done) => { const go = () => (n-- > 0 ? requestAnimationFrame(go) : done()); go() })
  window.wait = (ms) => new Promise((done) => setTimeout(done, ms))
  window.fresh = () => { document.getElementById('s').replaceChildren(); window.S = window.lib.notation(document.getElementById('s'), { fresh: true }); window.lib.useSound(null); return window.S }
  // The colour of the canvas at a point of the page's music, as [r, g, b].
  window.inkAt = (page, x, y) => [...page.g.getImageData(Math.round((page.pad + x - page.scrollX) * page.ratio), Math.round((page.pad + y - page.scrollY) * page.ratio), 1, 1).data].slice(0, 3)
  window.headOf = (page, n) => { const hit = page.plan.hits[n], h = hit.item.heads[0]; return [h.x + hit.item.wide / 2, h.py] }
  window.rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  window.near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 40)
}
const run = (page, fn, arg) => page.evaluate(fn, arg)

/**
 * PLAYWRIGHT AND WORKLETS (as synths.js's own tests found, and say at more length): Playwright asks every new
 * thread of a Chromium page to wait until it has been looked at, and forgets about worklets, so an audio worklet
 * never starts. This is a second DevTools session on the page that tells each worklet to go on. WebKit needs none of it.
 */
async function letWorkletsRun(page) {
  const cdp = await page.context().newCDPSession(page)
  let id = 0
  const send = (path, method, params = {}) => {
    let message = { method, params }
    for (let i = path.length - 1; i >= 0; i--) message = { method: 'Target.sendMessageToTarget', params: { sessionId: path[i], message: JSON.stringify({ id: ++id, ...message }) } }
    return cdp.send(message.method, message.params).catch(() => {})
  }
  const seen = (path, method, params) => {
    if (method === 'Target.attachedToTarget') {
      const child = [...path, params.sessionId]
      if (params.targetInfo.type === 'worklet') send(child, 'Runtime.runIfWaitingForDebugger')
      else send(child, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false })
    } else if (method === 'Target.receivedMessageFromTarget') {
      const inner = JSON.parse(params.message)
      if (inner.method) seen([...path, params.sessionId], inner.method, inner.params)
    }
  }
  cdp.on('Target.attachedToTarget', (params) => seen([], 'Target.attachedToTarget', params))
  cdp.on('Target.receivedMessageFromTarget', (params) => seen([], 'Target.receivedMessageFromTarget', params))
  await send([], 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false })
}

async function browserCases(name, browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } })
  await context.addInitScript(SILENT)
  const page = await context.newPage()
  if (name === 'chromium') await letWorkletsRun(page)
  const errors = []
  page.on('pageerror', (e) => errors.push(process.env.STACKS ? String(e.stack) : String(e)))
  page.on('console', (m) => { if (process.env.DEBUG) console.log('   page:', m.text().slice(0, 3000)) })
  await page.goto(`${at}/full.html`)
  await run(page, HELPERS)
  if (process.env.DEBUG) await run(page, () => { window.DEBUG = true })

  // --- what is drawn is where the layout says, at four sizes of screen
  for (const [size, [width, height]] of Object.entries({ phone: [390, 780], split: [560, 700], tablet: [820, 1100], desktop: [1280, 800] })) {
    await page.setViewportSize({ width, height })
    for (const piece of ['mary', 'mixed', 'song', 'grand']) {
      const [tune, step, o] = PIECES[piece]
      const got = await run(page, async ({ tune, step, o }) => {
        const S = fresh()
        const p = S.showNotes(tune, step, { ...o, at: 'fill' })
        await frames()
        const box = p.wrap.getBoundingClientRect(), c = p.colours
        const heads = p.plan.hits.filter((h) => h.sys.y + h.sys.h < p.box.h - 2 * p.pad && h.item.plain < 16).slice(0, 12)
        return {
          inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
          fits: p.plan.systems.every((s) => s.x1 <= p.box.w - 2 * p.pad + 0.5), lines: p.plan.systems.length,
          inked: heads.length > 0 && heads.every((h) => near(inkAt(p, h.item.heads[0].x + h.item.wide / 2, h.item.heads[0].py), rgb(c.ink))),
          paper: near(inkAt(p, 3 - p.pad + 8, 3 - p.pad + 8), rgb(c.paper)),
          space: p.S,
        }
      }, { tune, step, o })
      check(name, `${piece} on a ${size} (${width} wide): the page is inside the view, every line of music fits it, and there is ink where the layout puts each note head`, [got.inside, got.fits, got.inked, got.paper, got.space >= 7], [true, true, true, true, true])
      if (SHOTS && name === 'chromium' && (size === 'phone' || size === 'desktop')) await page.screenshot({ path: join(SHOTS, `${piece}-${size}.png`) })
    }
  }
  await page.setViewportSize({ width: 900, height: 700 })

  // --- placement, paper, zoom
  let got = await run(page, async () => {
    const S = fresh()
    const top = S.showNotes('C4 D4 E4 F4', 'quarter'), bottom = S.showNotes('C3 D3', 'quarter', { at: 'bottom', paper: 'dark' }), boxed = S.showNotes('C4', { x: 300, y: 300, width: 240, height: 120, paper: 'clear' })
    await frames()
    const was = top.S
    top.zoom = 1.5
    await frames()
    return [top.y, top.x + top.w <= 900, bottom.y + bottom.h, [boxed.x, boxed.y, boxed.w, boxed.h], near(inkAt(bottom, 3, 3), rgb(bottom.colours.paper)), inkAt(boxed, 100, 5), Math.round(top.S / was * 10) / 10, S.over(450, 30), S.over(880, 250), S.all.length]
  })
  check(name, 'a page sits at the top unless told: at the bottom, or in a rectangle; on dark paper or none; and bigger with zoom', got, [10, true, 690, [300, 300, 240, 120], true, [0, 0, 0], 1.5, true, false, 3])

  // --- following a tune the page plays itself, through the real sound library (a click first: a page is silent until it is touched)
  await page.mouse.click(450, 650)
  got = await run(page, async () => {
    const synths = await import('/synths/synths.js')
    window.synths = synths
    const S = fresh()
    lib.useSound(synths)
    const p = S.showNotes('C4 E4 G4 - C5 E5:2 C5', 'quarter', { tempo: 200 })
    const began = [], bars = [], samples = []
    p.onNote = (note) => began.push([note.name, synths.soundTime(), note.start])
    p.onBar = (bar) => bars.push(bar)
    let done = false
    p.onDone = () => { done = true }
    // (The synth is asked what it sounds once beforehand: its answers begin a moment after the first asking.)
    const lead = synths.mainSynth()
    lead.notes()
    await wait(400)
    p.play()
    const start = performance.now()
    while (!done && performance.now() - start < 6000) {
      await frames(1)
      samples.push({ t: synths.soundTime(), lit: p.sounding, heard: [...lead.notes()], x: p.cursor.style.transform, colour: p.active.length && p.active[0].items[0].plain < 16 ? inkAt(p, ...headOf(p, p.plan.hits.findIndex((h) => h.item.event === p.active[0]))) : null })
    }
    await frames()
    const first = began[0] ? began[0][1] : 0
    // When each note first lights, and when the synth first says it is sounding it (which it reads from the
    // audio thread some 25 times a second, so it is a little behind the sound itself).
    const firstLit = {}, firstHeard = {}
    for (const s of samples) { for (const n of s.lit) firstLit[n] ??= s.t; for (const n of s.heard) firstHeard[n] ??= s.t }
    const late = [60, 64, 67, 72, 76].map((n) => (firstHeard[n] === undefined || firstLit[n] === undefined ? 9 : Math.abs(firstHeard[n] - firstLit[n])))
    const xs = samples.map((s) => +(/translate\(([-\d.]+)px/.exec(s.x) || [0, -1])[1]).filter((x) => x >= 0)
    if (window.DEBUG) console.log(JSON.stringify({ began, first: samples.slice(0, 40).map((s) => [Math.round(s.t * 1000), s.lit.join(), s.heard.join()]) }))
    return {
      names: began.map((b) => b[0]), gaps: began.slice(1).map((b, i) => Math.round((b[1] - began[i][1]) / 0.3 * 100) / 100 - (b[2] - began[i][2])),
      bars, done, samples: samples.length, heardSome: samples.filter((s) => s.heard.length).length > samples.length / 2, worst: Math.max(0, ...late),
      lit: samples.filter((s) => s.colour).every((s) => near(s.colour, rgb(p.colours.now))), someLit: samples.filter((s) => s.colour).length > 20,
      forward: xs.every((x, i) => i === 0 || x >= xs[i - 1] - 400), moved: Math.max(...xs) - Math.min(...xs) > 150,
      after: [p.playing, p.sounding, near(inkAt(p, ...headOf(p, 0)), rgb(p.colours.ink)), p.cursor.style.display],
    }
  })
  check(name, 'a tune the page plays: each note is said as it begins, in order and in time with the sound clock (to a frame or two)', [got.names, got.gaps.every((g) => Math.abs(g) < 0.2), got.bars, got.done], [['C4', 'E4', 'G4', 'C5', 'E5', 'C5'], true, [1, 2], true])
  check(name, `a tune the page plays: each note lights within a tenth of a second of the synth saying it sounds (worst ${got.worst.toFixed(3)} s over ${got.samples} frames), in the colour for now`, [got.heardSome, got.worst < 0.1, got.lit, got.someLit], [true, true, true, true])
  check(name, 'a tune the page plays: the line moves on, and when the tune ends the notes are plain ink again and the line is gone', [got.forward, got.moved, got.after], [true, true, [false, [], true, 'none']])

  // --- following a song the sound library plays
  got = await run(page, async () => {
    const synths = window.synths
    const S = fresh()
    lib.useSound(synths)
    const file = '/examples/songs/night_drive.json'
    const json = await (await fetch(file)).json()
    const song = synths.playSong(file)
    const p = S.showNotes(file, { channels: [1, 3], follow: song, at: 'fill' })
    await p.ready
    // What the song's own rows say is sounding on a channel at a row counted from the start, and how near a change is.
    const rows = (ch) => json.order.flatMap((n, o) => json.patterns[n].events.filter((e) => e.ch === ch && e.note).map((e) => [o * 32 + e.row, e.note]))
    const bass = rows(1)
    const expect = (row) => { let found = null; for (const [r, note] of bass) if (r <= row) found = note; return found }
    const edge = (row) => Math.min(...bass.map(([r]) => Math.abs(r - row)))
    const samples = []
    const start = performance.now()
    while (performance.now() - start < 3500) {
      await frames(1)
      const pos = song.position
      if (pos.state !== 'playing') continue
      const row = pos.order * 32 + pos.row + pos.tick / pos.speed
      const lit = p.active.filter((e) => e.staff === 0).map((e) => e.sounds[0])
      samples.push({ row, beat: p.beat, lit: lit.length ? lib.noteName(lit[0]).replace(/^([A-G])(\d)/, '$1-$2') : null, want: expect(row), edge: edge(row) })
    }
    const wrong = samples.filter((s) => s.lit !== s.want && s.want !== 'off')
    const out = { n: samples.length, rows: samples.length ? samples[samples.length - 1].row - samples[0].row : 0, worst: Math.max(0, ...wrong.map((s) => s.edge)), off: Math.max(0, ...samples.map((s) => Math.abs(s.beat - s.row / 4))), staves: p.score.staves.map((s) => s.name) }
    // Tap the sixth bar: the song is sent there.
    const bar = p.plan.bars[5], r = p.wrap.getBoundingClientRect()
    out.tap = [r.left + p.pad + bar.x + bar.w - 6 - p.scrollX, r.top + p.pad + bar.sys.staffY[0] + 2 * p.S - p.scrollY]
    window.song = song; window.p = p
    return out
  })
  check(name, `a song that plays: the bass note that is lit is the one the song's own rows say is sounding, to within a row of a change (worst ${got.worst.toFixed(2)} rows over ${got.n} frames and ${Math.round(got.rows)} rows), and the line is never more than a sixteenth note from the song's place`, [got.n > 60, got.rows > 16, got.worst <= 1, got.off < 0.3, got.staves], [true, true, true, true, ['bass', 'tune']])
  await page.mouse.click(got.tap[0], got.tap[1])
  await page.waitForTimeout(500)
  got = await run(page, () => { const pos = window.song.position; window.song.stop(); return [pos.order, pos.row >= 16 && pos.row < 30, window.p.bar] })
  check(name, 'a tap on a bar sends the song there, and the page follows', got, [2, true, 6])

  // --- taps: a note is heard and said
  got = await run(page, async () => {
    const S = fresh()
    const heard = [], tapped = []
    const p = S.showNotes('C4 E4+G4 D4', 'quarter', { sound: { playNote: (note, seconds) => heard.push(note) }, seek: false })
    p.onTap = (what) => tapped.push(what.name || 'bar ' + what.bar)
    await frames()
    const r = p.wrap.getBoundingClientRect(), hit = p.plan.hits[1], top = hit.item.heads[1]
    window.p = p
    window.out = { heard, tapped }
    return [r.left + p.pad + top.x + hit.item.wide / 2, r.top + p.pad + top.py, r.left + p.pad + p.plan.bars[0].x + p.plan.bars[0].w - 12, r.top + p.pad + p.plan.systems[0].staffY[0] + 5]
  })
  await page.mouse.click(got[0], got[1])
  await page.mouse.click(got[2], got[3])
  check(name, 'a tap on a note of a chord plays that note and tells onTap; a tap elsewhere in a bar says which bar', await run(page, () => window.out), { heard: [67], tapped: ['G4', 'bar 1'] })

  // --- the sound is not on yet: the page waits for it, and does not go by the clock alone
  got = await run(page, async () => {
    const S = fresh()
    const sound = { state: 'waiting', played: [], soundTime: () => performance.now() / 1000, latency: 0, playNotes(text, step, o) { this.played.push(text); return { stop() {} } } }
    const p = S.showNotes('C4 E4 G4 C5', 'quarter', { tempo: 240, sound })
    await frames()
    p.play()
    await wait(400)
    const before = [p.playing, sound.played.length, p.sounding, p.cursor.style.display]
    sound.state = 'on'
    await wait(250)
    const after = [p.playing, sound.played, p.sounding.length > 0]
    p.stop()
    sound.state = 'loading'
    p.playAlong({ mode: 'time', countIn: 0 })
    await wait(300)
    const held = [p.beat, p.along.groups.length]
    sound.state = 'on'
    await wait(300)
    return { before, after, held, going: p.beat > 0.3 }
  })
  check(name, 'while the sound is not on (the page has not been touched, or the engine is loading) nothing is played and nothing lights, though the sound clock runs; the moment it is on, the tune begins; keeping time for a learner waits the same way', got, { before: [true, 0, [], 'none'], after: [true, ['C4:4 E4:4 G4:4 C5:4'], true], held: [0, 0], going: true })

  got = await run(page, async () => {
    const S = fresh()
    const of = (sound) => S.showNotes('C4', { sound }).latency
    return [of(null), of({ soundTime: () => 0 }), of({ soundTime: () => 0, player: { state: 'on', buffer: () => ({ delay: 0, thread: 'stepped' }) } }), of({ soundTime: () => 0, player: { state: 'on', buffer: () => ({ delay: 25 }) } }), of({ soundTime: () => 0, latency: 0.1 }), S.showNotes('C4', { latency: 0.2 }).latency]
  })
  check(name, 'a note lights as long after its time as the player says it plays late: 0.04 s unless it says, and nothing at all for a player a video recorder steps, so in a film the note lit is the note sounding', got, [0, 0.04, 0, 0.025, 0.1, 0.2])

  // --- playing along: the page waits
  got = await run(page, async () => {
    const S = fresh()
    const sung = [], said = []
    const p = S.showNotes('C4 E4+G4 D4', 'quarter')
    p.playAlong({ mode: 'wait', synth: { noteOn: (n) => sung.push(n), noteOff: (n) => sung.push(-n) } })
    p.onRight = (n) => said.push('right ' + n); p.onWrong = (n) => said.push('wrong ' + n)
    let result = null
    p.onDone = (r) => { result = { ...r } }
    await frames()
    const c = p.colours, out = { hint: [p.notes()], beats: [p.beat] }
    p.noteOn(60); p.noteOff(60)
    await frames()
    out.first = near(inkAt(p, ...headOf(p, 0)), rgb(c.right))
    out.hint.push(p.notes()); out.beats.push(p.beat)
    p.noteOn(61)
    await frames()
    const ghost = p.ghosts[0]
    out.ghost = ghost ? near(inkAt(p, ghost.x + 6, ghost.y), rgb(c.wrong)) : false
    out.beats.push(p.beat)
    p.noteOn(67)
    out.hint.push(p.notes()); out.beats.push(p.beat)
    p.noteOn(64)
    out.beats.push(p.beat)
    await frames()
    out.chord = [near(inkAt(p, ...headOf(p, 1)), rgb(c.right)), near(inkAt(p, ...headOf(p, 2)), rgb(c.ink))]
    p.noteOn(62)
    await wait(900)
    out.gone = [p.ghosts.length, near(inkAt(p, ghost.x + 6, ghost.y), rgb(c.wrong))]
    return { ...out, result, said, sung }
  })
  check(name, 'play along, waiting: the line waits at each note; the key to press is given as a hint; a right note turns green and moves on only when the whole chord is played', [got.hint, got.beats, got.first, got.chord], [[[60], [64, 67], [61, 67, 64]], [0, 1, 1, 1, 2], true, [true, true]])
  check(name, 'play along, waiting: a wrong note is shown in red for a moment and counted; at the end the result is 4 right and 1 wrong, and every key was heard', [got.ghost, got.gone, got.result, got.said, got.sung.filter((n) => n > 0)], [true, [0, false], { right: 4, wrong: 1, missed: 0, total: 4, timing: null, percent: 88, done: true }, ['right 60', 'wrong 61', 'right 67', 'right 64', 'right 62'], [60, 61, 67, 64, 62]])

  // --- playing along: the page keeps time (by a clock the test holds)
  got = await run(page, async () => {
    const S = fresh()
    window.clock = 100
    const p = S.showNotes('C4 D4 E4 F4', 'quarter', { tempo: 60, sound: { soundTime: () => window.clock, latency: 0 } })
    p.playAlong({ mode: 'time', countIn: 0 })
    await frames()
    const c = p.colours, out = {}
    const at = async (t) => { window.clock = 100 + t; await frames() }
    await at(0.05); p.noteOn(60)
    await at(1.0); p.noteOn(62)
    await at(2.0); p.noteOn(65)
    await at(2.9); p.noteOn(65)
    await at(3.5)
    out.marks = [0, 1, 2, 3].map((i) => { const ink = inkAt(p, ...headOf(p, i)); return near(ink, rgb(c.right)) ? 'right' : near(ink, rgb(c.wrong)) ? 'missed' : 'plain' })
    out.before = p.result.done
    await at(4.4)
    out.result = { ...p.result, timing: Math.round(p.result.timing * 1000) / 1000 }
    out.beat = Math.round(p.beat * 100) / 100
    return out
  })
  check(name, 'play along, in time: a note played on its beat is right, one played far from its beat is wrong, one never played is missed and turns red; the result counts them and says how close the right ones were', got, { marks: ['right', 'right', 'missed', 'right'], before: false, result: { right: 3, wrong: 1, missed: 1, total: 4, timing: 0.05, percent: 63, done: true }, beat: 4.4 })
  got = await run(page, async () => {
    const S = fresh()
    const p = S.showNotes('C4 C5', 'quarter')
    p.playAlong({ mode: 'wait', anyOctave: true, hint: false })
    const hint = p.notes()
    p.noteOn('C6'); p.noteOn(48)
    return [hint, p.result.right, p.result.done]
  })
  check(name, 'play along: any octave may be allowed, and the hint switched off', got, [[], 2, true])

  // --- a keyboard from dials.js plays the page, and lights the key to press
  got = await run(page, async () => {
    const dials = await import('/dials/dials.js')
    const host = document.getElementById('s')
    host.replaceChildren()
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:900px;height:700px'
    canvas.tabIndex = 0
    host.append(canvas)
    const S = lib.notation(canvas, { fresh: true })
    const p = S.showNotes('C4 E4 G4', 'quarter', { playAlong: 'wait' })
    const piano = dials.dials(canvas, { fresh: true }).keyboard(p, { octave: 4, octaves: 1 })
    await frames(5)
    window.p = p
    const wide = piano.w / 8
    return { keys: [0, 2, 4].map((i) => [piano.x + wide * (i + 0.5), piano.y + piano.h * 0.85]), over: p.y + p.h < piano.y, under: p.wrap.previousElementSibling === canvas || p.wrap.parentElement === host }
  })
  for (const [x, y] of got.keys.slice(0, 2)) { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up() }
  check(name, 'a dials.js keyboard tied to the page plays it: two keys pressed with the mouse are two right notes, and the music is above the keys', [got.over, got.under, await run(page, () => [window.p.result.right, window.p.result.wrong, window.p.notes()])], [true, true, [2, 0, [67]]])

  // --- a MOD file, through the sound library's packSong
  got = await run(page, async () => {
    const bytes = new Uint8Array(1084 + 1024 + 64)
    const put = (text, at) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i) }
    put('three notes', 0); put('M.K.', 1080)
    bytes[42] = 0; bytes[43] = 32; bytes[45] = 64; bytes[49] = 1 // sample 1: 64 bytes long, full volume
    bytes[950] = 1 // one pattern in the order
    const cell = (row, period, sample) => { const at = 1084 + row * 16; bytes[at] = (sample & 0xf0) | (period >> 8); bytes[at + 1] = period & 255; bytes[at + 2] = (sample & 15) << 4 }
    cell(0, 428, 1); cell(4, 381, 1); cell(8, 339, 1); cell(16, 428, 1)
    for (let i = 0; i < 64; i++) bytes[1084 + 1024 + i] = i < 32 ? 100 : 156
    const S = fresh()
    let direct = null
    try { S.showNotes(bytes) } catch (e) { direct = /packSong/.test(e.message) }
    const p = S.showNotes(await window.synths.packSong(bytes), { rowsPerBeat: 4 })
    await frames()
    const notes = p.music.parts[0].notes
    return [direct, notes.map((n) => n.start), notes.slice(1).map((n, i) => n.notes[0] - notes[i].notes[0]), p.score.bars, p.plan.hits.length >= 4]
  })
  check(name, 'a MOD file is shown once the sound library has packed it: its rows are beats and its notes keep their steps', got, [true, [0, 1, 2, 4], [2, 2, -4], 4, true])

  // --- a page that changes, and one that is taken away
  got = await run(page, async () => {
    const S = fresh()
    const sheet = lib.makeSheet({ time: '3/4' })
    sheet.add('C4', 'quarter')
    const p = S.showNotes(sheet)
    await frames()
    const before = p.plan.hits.length
    sheet.add('E4', 'quarter').add('G4', 'quarter').add('C5', 'half.')
    await frames()
    const grown = [p.plan.hits.length, p.score.bars]
    p.show('C2 D2', 'quarter')
    await frames()
    const shown = [p.score.staves[0].clef, p.plan.hits.length]
    p.remove()
    return [before, grown, shown, S.all.length, document.querySelectorAll('[data-notation-layer]').length]
  })
  check(name, 'a sheet that is added to is drawn again; a page can be given other music, and taken away', got, [1, [4, 2], ['bass', 2], 0, 0])
  check(name, 'no page left an error', errors, [])
  await context.close()
}

// Every example as a pictures.js scene: it runs, music is drawn over the scene, and (after a click) nothing has gone wrong.
async function exampleCases(name, browser) {
  const examples = (await readdir(join(ROOT, 'examples'))).filter((f) => f.endsWith('.js') && f !== 'notation.js').sort()
  check(name, 'the copy of notation.js beside the examples is the library itself', readFileSync(join(ROOT, 'examples', 'notation.js'), 'utf8') === readFileSync(join(ROOT, 'notation.js'), 'utf8'), true)
  for (const [size, viewport] of Object.entries({ desktop: { width: 1000, height: 700 }, phone: { width: 390, height: 780 } })) {
    const context = await browser.newContext({ viewport })
    await context.addInitScript(SILENT)
    const page = await context.newPage()
    if (name === 'chromium') await letWorkletsRun(page)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    for (const file of examples) {
      await page.goto(`${at}/full.html`)
      const source = await readFile(join(ROOT, 'examples', file), 'utf8')
      const began = await page.evaluate(async ({ source, file }) => {
        const { runScene } = await import('/pictures/pictures.js')
        return new Promise((done) => {
          // (MIDI is switched off: a test must not reach for the devices of the computer it runs on.)
          window.scene = runScene(document.getElementById('s'), { source, name: file, base: '/examples/', keyboard: true, midi: false, onError: (message, line) => done({ error: message, line }) })
          setTimeout(() => done({ ok: true }), 900)
        })
      }, { source, file })
      await page.mouse.click(viewport.width / 2, viewport.height * 0.62)
      await page.waitForTimeout(1300)
      const got = await page.evaluate(() => {
        const wrap = document.querySelector('div[data-notation-layer]'), canvas = wrap && wrap.querySelector('canvas')
        if (!canvas) return { layer: false }
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        const seen = new Set()
        for (let i = 0; i < data.length; i += 4 * 97) seen.add(data[i] >> 5 << 6 | data[i + 1] >> 5 << 3 | data[i + 2] >> 5)
        const box = wrap.getBoundingClientRect()
        return { layer: true, colours: seen.size, inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight, line: wrap.querySelectorAll('canvas')[1].style.display }
      })
      check(name, `the example ${file} on a ${size}: it runs as a pictures.js scene with its music drawn inside the picture${file === 'play_along.js' ? '' : ', and after a click the line is moving'}`, [began, got.layer, got.colours > 2, got.inside, file === 'play_along.js' ? 'block' : got.line], [{ ok: true }, true, true, true, 'block'])
      if (SHOTS && name === 'chromium') await page.screenshot({ path: join(SHOTS, `example-${file.replace('.js', '')}-${size}.png`) })
      await page.evaluate(() => window.scene?.stop())
    }
    check(name, `no example left an error on a ${size}`, errors, [])
    await context.close()
  }
}

if (SHOTS) await mkdir(SHOTS, { recursive: true })
for (const name of ['chromium', 'webkit']) {
  let browser
  try { browser = await playwright[name].launch(name === 'chromium' ? { args: ['--mute-audio'] } : {}) } catch (e) { console.log(`     ${name}: not installed, skipped`); continue }
  const before = [passed, failed]
  await browserCases(name, browser)
  await exampleCases(name, browser)
  await browser.close()
  console.log(`     ${name}: ${passed - before[0]} passed, ${failed - before[1]} failed`)
}
server.close()
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
