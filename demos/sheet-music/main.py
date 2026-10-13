# This demo shows a tune written as a line of notes, shown as sheet music and played, in Circuitry Studio.
# The same file runs in a web browser with Pyctures and its sheet music, sound and dials libraries, the free libraries:
# https://github.com/johnwylie70/pyctures
# pyctures: autorun

# Sheet Music: a tune is one line of notes. It is written out as sheet music, and each note lights up as it plays.
# Use: press play to hear the tune, and again to stop it. Tap a note to hear it. Play along on the keys (or A S D F G H J K on a keyboard).
# Try changing: the notes in tune ("-" is a rest, and ":2" makes a note last two steps); "quarter" to "eighth"; 110, the beats a minute; "bell" to "keys" or "lead"; the title.
from pyctures import *
from synths import *
from pydials import *
from pynotation import *

tune = "E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2"

music = show_notes(tune, "quarter", title="Mary had a little lamb", tempo=110, voice="bell")
now = "press play"      # the name of the note that is sounding


def on_note(note):       # called as each note begins
    global now
    now = note.name


music.on_note = on_note


def play():
    if music.playing:
        music.stop()
    else:
        music.play()


layout(at="bottom")        # the button goes at the bottom, above the keys
button("play", play)
keyboard(make_synth("bell"), octave=4, octaves=1)      # keys to play along on, with the same sound


def draw():
    background("midnightblue")
    text(now if music.playing else "press play", width / 2, height * 0.52, "gold", 30, "centre")
