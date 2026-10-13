# This demo shows Python drawing graphics in Circuitry Studio.
# The same file runs in a web browser with Pyctures, the free library:
# https://github.com/johnwylie70/pyctures
# pyctures: autorun

# Twinkle: a tune written as code, one line a note, shown as sheet music. Each note lights as it sounds, and a star goes up for it.
# Use: click or tap below the music to play the tune, and again to stop it. Tap a note to hear it.
# Try changing: the notes; "quarter" to "eighth"; tempo=100 to 160; "bell" to "keys" or "lead"; key="C" to "G" (and the notes to match).
import random

from pyctures import *
from pynotation import *      # sheet music, and the sound with it

# The tune: a page of music with a title, a speed and a key.
sheet = make_sheet(
    title="Twinkle, twinkle, little star",
    tempo=100,
    key="C",
)

# Twinkle, twinkle, little ...
for name in ["C4", "C4", "G4", "G4", "A4", "A4"]:
    sheet.add(name, "quarter")
# ... star (a long note)
sheet.add("G4", "half")

# How I wonder what you ...
for name in ["F4", "F4", "E4", "E4", "D4", "D4"]:
    sheet.add(name, "quarter")
# ... are
sheet.add("C4", "half")

# Show the sheet, and choose the sound that plays it.
page = show_notes(sheet, voice="bell")

# One star for each note that has played.
stars = []


# As each note begins, make a star. A higher note is a bigger star.
def on_note(note):
    stars.append({
        "x": random.uniform(40, width - 40),
        "y": height - 30,
        "size": 8 + (note.note - 55),
        "age": 0,
    })


page.on_note = on_note


# A click or a tap: play the tune, or stop it.
def on_mouse_down(x, y):
    if page.playing:
        page.stop()
    else:
        page.play()


# Many times a second: move the stars. dt is seconds since last time.
def update(dt):
    for s in stars:
        s["y"] -= 90 * dt
        s["age"] += dt
    # A star is taken away after four seconds.
    while stars and stars[0]["age"] > 4:
        stars.pop(0)


# Draw the night sky, the stars and the words. The music draws itself.
def draw():
    background("midnightblue")
    for s in stars:
        star(s["x"], s["y"], s["size"], 5, "gold")
    words = "Click to stop" if page.playing else "Click here to play"
    text(words, width / 2, height - 24, "white", 18, "centre")
