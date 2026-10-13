# This demo shows Python drawing graphics in Circuitry Studio.
# The same file runs in a web browser with Pyctures, the free library:
# https://github.com/johnwylie70/pyctures
# pyctures: autorun

# Night Drive: a song plays, and its tune and bass are written out as sheet music as it goes. The notes that are sounding light up, and a ring grows for each one.
# Use: tap or click to start the song. Tap a bar of the music to play from there, or a note to hear it.
# Try changing: channels=[3, 1] to [0, 3] or [3, 1, 2] (2 is the drums); add grand=True or paper="dark" to show_notes; "bell" to "lead"; a note in night_drive.json.
from pyctures import *
from pynotation import *      # sheet music, and the sound with it

# The song is the file night_drive.json, beside this one.
# Write out two of its channels: 3 is the tune, 1 is the bass.
page = show_notes(
    "night_drive.json",
    channels=[3, 1],
    patches={"tune": {"preset": "bell", "echo": 0.3}},
)

# Play the song the page shows. It goes round and round.
page.play()

# One ring for each note that has begun.
rings = []


# As each note begins, make a ring.
# Low notes are on the left and high notes on the right.
def on_note(note):
    rings.append({
        "x": width * (0.15 + 0.7 * ((note.note - 33) % 36) / 36),
        "hue": note.note * 30,
        "age": 0,
    })


page.on_note = on_note


# Many times a second: the rings grow older.
# dt is seconds since last time.
def update(dt):
    for r in rings:
        r["age"] += dt
    # A ring is taken away after a little more than a second.
    while rings and rings[0]["age"] > 1.2:
        rings.pop(0)


# Draw the night, the rings and the words. The music draws itself.
def draw():
    background("#0b1020")
    y = height * 0.78
    for r in rings:
        size = 12 + 70 * r["age"]
        fade = 1 - r["age"] / 1.2
        colour = "hsla(%d, 90%%, 65%%, %.2f)" % (r["hue"], fade)
        circle(r["x"], y, size, outline=colour, thickness=4)
    # A browser keeps a page silent until it has been touched.
    # page.bar is the bar the song is in: 0 until it has begun.
    if page.bar:
        words = "bar %d" % page.bar
    else:
        words = "Tap anywhere to start the song"
    text(words, width / 2, height - 24, "white", 18, "centre")
