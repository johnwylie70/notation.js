// Night Drive in Python (demos/night-drive/main.py), run by `pyctures run`, in Chromium and WebKit, silently: is the
// sound truly on, are the notes lit on each staff the notes the song's own rows say are sounding, does the page turn?
//
//   PLAYWRIGHT=/path/to/node_modules/playwright node demos/prove-night-drive.mjs demos/night-drive/main.py /a/folder/for/pictures
//
// Pyctures is taken from the folder beside this repository (or PYCTURES=/path/to/pyctures), and run with its own
// .venv's Python when it has one (or PYTHON=/path/to/python). W and H set the window.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
const [DEMO, OUT] = process.argv.slice(2)
const BESIDE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PYCTURES = resolve(process.env.PYCTURES || join(BESIDE, 'pyctures'))
const PYTHON = process.env.PYTHON || (existsSync(join(PYCTURES, '.venv', 'bin', 'python')) ? join(PYCTURES, '.venv', 'bin', 'python') : 'python3')
const from = process.env.PLAYWRIGHT || 'playwright'
const pw = await import(from.startsWith('/') ? pathToFileURL(join(from, 'index.mjs')).href : from)
const port = await new Promise((done) => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => done(p)) }) })
const server = spawn(PYTHON, ['-m', 'pyctures', 'run', resolve(DEMO), '--no-browser', '--port', String(port)], { env: { ...process.env, PYTHONPATH: join(PYCTURES, 'src') }, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 1500))
const QUIET = `(() => { if (typeof AudioNode === 'undefined' || typeof AudioDestinationNode === 'undefined') return
  const connect = AudioNode.prototype.connect, silent = new WeakMap()
  AudioNode.prototype.connect = function (to, ...rest) { if (!(to instanceof AudioDestinationNode)) return connect.call(this, to, ...rest)
    let gain = silent.get(to); if (!gain) { gain = to.context.createGain(); gain.gain.value = 0; connect.call(gain, to); silent.set(to, gain) }
    connect.call(this, gain, ...rest); return to } })()`
import { readFile } from 'node:fs/promises'
const SONG = JSON.parse(await readFile(join(dirname(resolve(DEMO)), 'night_drive.json'), 'utf8'))
let ok = true
try {
  for (const name of ['chromium', 'webkit']) {
    const b = await pw[name].launch(name === 'chromium' ? { args: ['--mute-audio'] } : {})
    const ctx = await b.newContext({ viewport: { width: +(process.env.W || 600), height: +(process.env.H || 600) } })
    await ctx.addInitScript(QUIET)
    const page = await ctx.newPage()
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
    await page.goto(`http://localhost:${port}/`)
    await page.waitForFunction(() => { try { return document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0].plan.hits.length > 20 } catch (e) { return false } }, null, { timeout: 60000 })
    await page.waitForTimeout(600)
    const before = await page.evaluate(() => { const p = document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0]; return { state: document.querySelector('[data-pyctures-src]').pycturesScene.sound.state(), lit: p.sounding, bar: p.bar } })
    await page.mouse.click(+(process.env.W || 600) / 2, +(process.env.H || 600) * 0.75)
    await page.evaluate((song) => {
      window.seen = []
      const page = document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0], sound = document.querySelector('[data-pyctures-src]').pycturesScene.sound
      // What the song's own rows say a channel is sounding at a row counted from the start: its latest note, unless it was let go.
      const rows = (ch) => song.order.flatMap((n, o) => song.patterns[n].events.filter((e) => e.ch === ch && e.note).map((e) => [o * 32 + e.row, e.note]))
      const lines = [rows(3), rows(1)]
      const number = (name) => (name === 'off' ? null : 12 * (+name.slice(-1) + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]] + (name[1] === '#' ? 1 : 0))
      const look = () => {
        const p = sound.player && sound.player.songPosition && sound.player.songPosition(), r = sound.read()
        if (p && p.state === 'playing') {
          const row = p.order * 32 + p.row + p.tick / p.speed
          const staves = lines.map((line, staff) => {
            let want = null
            for (const [at, note] of line) if (at <= row) want = number(note)
            const lit = page.active.filter((e) => e.staff === staff).map((e) => e.sounds[0])
            return { want, lit: lit.length ? lit[0] : null, many: lit.length, edge: Math.min(...line.map(([at]) => Math.abs(at - row))) }
          })
          window.seen.push({ row, staves, level: Math.max(...r.level), scroll: page.scrollY, bar: page.bar })
        }
        requestAnimationFrame(look)
      }
      requestAnimationFrame(look)
    }, SONG)
    await page.waitForFunction('window.seen.length > 60 && window.seen[window.seen.length - 1].row > 12', null, { timeout: 40000 })
    await page.screenshot({ path: join(OUT, `night-drive-py-${name}.png`) })
    await page.waitForFunction('window.seen[window.seen.length - 1].row > 100', null, { timeout: 60000 })
    const seen = await page.evaluate('window.seen')
    const said = await page.evaluate(() => document.querySelector('[data-pyctures-src]').pycturesScene.sound.state())
    // A lit note that is not the one the rows give is allowed only within a row of a change (the page is a frame or two
    // from the player), and never two notes on a staff.
    const wrong = seen.flatMap((s) => s.staves.filter((x) => x.lit !== x.want && x.edge > 1.01))
    const two = seen.some((s) => s.staves.some((x) => x.many > 1))
    const loud = seen.filter((s) => s.level > 0.02).length / seen.length
    const turned = new Set(seen.map((s) => Math.round(s.scroll))).size > 1
    // (Where a browser lets a page play before it is touched, as headless WebKit does, the song has begun already.)
    const waited = before.state === 'on' || (before.lit.length === 0 && before.bar === 0)
    const good = said === 'on' && waited && wrong.length === 0 && !two && loud > 0.9 && turned && errs.length === 0
    ok = ok && good
    console.log(name, good ? 'OK' : 'FAILED', JSON.stringify({ 'sound before the tap': before.state, after: said, frames: seen.length, 'rows played': Math.round(seen[seen.length - 1].row - seen[0].row),
      'lit notes that are not the rows\' (beyond a row of a change)': wrong.length, 'two notes lit on one staff': two, 'frames with sound': loud.toFixed(2), 'the page turned': turned, errors: errs, ...(good ? {} : { wrong: wrong.slice(0, 5) }) }))
    await b.close()
  }
} finally { server.kill() }
process.exit(ok ? 0 : 1)
