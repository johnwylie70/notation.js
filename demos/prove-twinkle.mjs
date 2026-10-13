// Twinkle in Python (demos/twinkle/main.py), run by `pyctures run`, in Chromium and WebKit, silently:
// is the sound truly on, is the music drawn, does each note light as it sounds?
//
//   PLAYWRIGHT=/path/to/node_modules/playwright node demos/prove-twinkle.mjs demos/twinkle/main.py /a/folder/for/pictures
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
const TUNE = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]
let ok = true
try {
  for (const name of ['chromium', 'webkit']) {
    const b = await pw[name].launch(name === 'chromium' ? { args: ['--mute-audio'] } : {})
    const ctx = await b.newContext({ viewport: { width: +(process.env.W || 800), height: +(process.env.H || 600) } })
    await ctx.addInitScript(QUIET)
    const page = await ctx.newPage()
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
    await page.goto(`http://localhost:${port}/`)
    await page.waitForFunction(() => { try { return document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0].plan.hits.length === 14 } catch (e) { return false } }, null, { timeout: 60000 })
    const before = await page.evaluate(() => document.querySelector('[data-pyctures-src]').pycturesScene.sound.state())
    await page.mouse.click(+(process.env.W || 800) / 2, +(process.env.H || 600) * 0.75)
    await page.evaluate(() => {
      window.seen = []
      const page = document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0], sound = document.querySelector('[data-pyctures-src]').pycturesScene.sound
      let last = null
      const look = () => {
        const r = sound.read(), e = page.active[0]
        if (e) {
          if (e !== last) { last = e; window.seen.push({ note: e.sounds[0], start: e.start / 8, state: sound.player && sound.player.state, level: 0, heard: false, ink: null }) }
          const s = window.seen[window.seen.length - 1]
          s.level = Math.max(s.level, Math.max(...r.level))
          if ([...r.notes].includes(e.sounds[0])) s.heard = true
          const h = e.items[0].heads[0]
          s.ink = [...page.g.getImageData(Math.round((page.pad + h.x + e.items[0].wide / 2) * page.ratio), Math.round((page.pad + h.py) * page.ratio), 1, 1).data].slice(0, 3)
        }
        requestAnimationFrame(look)
      }
      requestAnimationFrame(look)
    })
    await page.waitForFunction('window.seen.length >= 6', null, { timeout: 40000 })
    await page.screenshot({ path: join(OUT, `twinkle-py-${name}.png`) })
    await page.waitForFunction(`window.seen.length >= 14 && !document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0].playing`, null, { timeout: 40000 })
    await page.waitForTimeout(300)
    const seen = await page.evaluate('window.seen')
    const after = await page.evaluate(() => { const s = document.querySelector('[data-pyctures-src]').pycturesScene.sound; return { state: s.state(), kind: s.player.kind, lit: document.querySelector('[data-pyctures-src] canvas')[Symbol.for('notation.stage')].pages[0].sounding } })
    const notes = seen.map((s) => s.note)
    const solid = seen.filter((s) => s.start !== 6 && s.start !== 14) // the two half notes have hollow heads
    const orange = solid.every((s) => s.ink && s.ink[0] > 180 && s.ink[2] < 80)
    const good = String(notes) === String(TUNE) && seen.every((s) => s.state === 'on' && s.level > 0.02 && s.heard) && orange && after.lit.length === 0 && errs.length === 0
    ok = ok && good
    console.log(name, good ? 'OK' : 'FAILED', JSON.stringify({ 'sound before the click': before, after: after.state, player: after.kind, 'notes lit, in order': String(notes) === String(TUNE),
      'every lit note was sounding on the synth': seen.every((s) => s.heard), 'least level while a note was lit': Math.min(...seen.map((s) => s.level)).toFixed(3), 'lit head is orange': orange, errors: errs, ...(good ? {} : { seen }) }))
    await b.close()
  }
} finally { server.kill() }
process.exit(ok ? 0 : 1)
