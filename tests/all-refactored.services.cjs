'use strict'

// Run from the repository root, or pass it explicitly:
// node tests/all-refactored.services.cjs /path/to/zhuanhua
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))

function readServicePrefix(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8')
  // Load only service declarations; never execute the action runtime or its entry point.
  const boundary = source.search(/\n(?:var AdActionRuntime\s*=|function allACtion\s*\()/)
  assert.ok(boundary >= 0, `${filename}: service boundary was not found`)
  return source.slice(0, boundary)
}

const sources = ['all.js', 'all-refactored.js'].map(readServicePrefix)
const scoringContexts = sources.map(source => {
  const context = vm.createContext({})
  vm.runInContext(source, context)
  return context
})
const flags = ['hasPositiveKeyword', 'hasNegativeKeyword', 'hasPasswordField', 'hasSearchLikeField', 'hasSubmitKeyword']
const fieldGroups = [[], ['fullName'], ['age'], ['unknown'], ['fullName', 'temporaryMail'], ['age', 'city'], ['fullName', 'age', 'city', 'state', 'zipCode']]
let scoreCases = 0
for (let mask = 0; mask < 32; mask++) {
  for (const tagName of ['form', 'div']) {
    for (const visibleFieldCount of [0, 1, 6, 9, 15]) {
      for (const visibleButtonCount of [6, 11]) {
        for (const group of fieldGroups) {
          for (const submitButton of [null, { score: 7 }, { score: 8 }]) {
            const summary = { tagName, visibleFieldCount, visibleButtonCount, requiredFieldCount: mask % 2 }
            flags.forEach((flag, bit) => { summary[flag] = Boolean(mask & (1 << bit)) })
            const fields = group.map(step => ({ step }))
            const results = scoringContexts.map(context => JSON.stringify(context.scoreAdsCandidate(summary, fields, submitButton)))
            assert.equal(results[1], results[0], `score mismatch: ${JSON.stringify({ summary, group, submitButton })}`)
            scoreCases++
          }
        }
      }
    }
  }
}
console.log(`PASS: ${scoreCases} original/refactored scoring comparisons`)

function createExposureHarness(source, { visualViewport = true } = {}) {
  let now = 0
  let nextTimer = 0
  const epoch = 1700000000000
  const timers = new Map()
  const reports = []
  const trace = []
  const queryCounts = new Map()
  const matchedBySelector = new Map()
  const intersectionObservers = []
  const mutationObservers = []
  const surfaces = []
  const captureValue = options => Boolean(typeof options === 'boolean' ? options : options?.capture)

  function makeEventTarget(name) {
    const listeners = []
    const target = {
      listeners,
      addEventListener(event, handler, options) {
        const capture = captureValue(options)
        if (!listeners.some(item => item.event === event && item.handler === handler && item.capture === capture)) {
          listeners.push({ event, handler, capture })
        }
        trace.push(['add', name, event, handler.name, capture, Boolean(options?.passive)])
      },
      removeEventListener(event, handler, options) {
        const capture = captureValue(options)
        const index = listeners.findIndex(item => item.event === event && item.handler === handler && item.capture === capture)
        if (index >= 0) listeners.splice(index, 1)
        trace.push(['remove', name, event, handler.name, capture])
      },
      dispatch(event) {
        for (const item of [...listeners]) if (item.event === event) item.handler({ type: event })
      },
    }
    surfaces.push(target)
    return target
  }

  const document = Object.assign(makeEventTarget('document'), {
    visibilityState: 'visible',
    documentElement: {},
    querySelectorAll(selector) {
      queryCounts.set(selector, (queryCounts.get(selector) || 0) + 1)
      return matchedBySelector.get(selector) || []
    },
  })
  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback
      this.targets = new Set()
      this.disconnected = false
      intersectionObservers.push(this)
      trace.push(['intersection-create', JSON.parse(JSON.stringify(options))])
    }
    observe(element) { this.targets.add(element); trace.push(['observe', element.id]) }
    unobserve(element) { this.targets.delete(element); trace.push(['unobserve', element.id]) }
    disconnect() { this.disconnected = true; this.targets.clear(); trace.push(['intersection-disconnect']) }
  }
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; mutationObservers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true; trace.push(['mutation-disconnect']) }
  }
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [epoch + now])) }
    static now() { return epoch + now }
  }
  const deterministicMath = Object.create(Math)
  deterministicMath.random = () => 0.123456789
  const window = Object.assign(makeEventTarget('window'), {
    IntersectionObserver: FakeIntersectionObserver,
    performance: { now: () => now },
    getComputedStyle: element => ({ display: 'block', visibility: 'visible', opacity: '1', ...element.style }),
    setTimeout(callback, delay) {
      const id = ++nextTimer
      timers.set(id, { callback, at: now + Math.max(0, Number(delay) || 0) })
      return id
    },
    clearTimeout(id) { timers.delete(id) },
  })
  if (visualViewport) window.visualViewport = makeEventTarget('visualViewport')
  const context = vm.createContext({
    window, document, Date: FakeDate, Math: deterministicMath,
    IntersectionObserver: FakeIntersectionObserver, MutationObserver: FakeMutationObserver,
    JSBehavior: { dotrack(code, payload) { reports.push({ code, data: JSON.parse(payload) }) } },
  })
  vm.runInContext(source, context)

  return {
    context, window, document, reports, timers, surfaces, trace, queryCounts, intersectionObservers, mutationObservers,
    addElement(selector, id) {
      const element = {
        id, tagName: 'DIV', isConnected: true, parentElement: document.documentElement, style: {},
        getAttribute(name) { return ({ 'data-ad-id': `business-${id}`, class: 'ad  placement' })[name] || null },
      }
      matchedBySelector.set(selector, [...(matchedBySelector.get(selector) || []), element])
      return element
    },
    removeElement(selector, element) {
      element.isConnected = false
      matchedBySelector.set(selector, (matchedBySelector.get(selector) || []).filter(item => item !== element))
    },
    start(selector = '.ad') { return context.startAdExposureMonitor(selector) },
    intersect(element, ratio, isIntersecting = true) {
      for (const observer of intersectionObservers) {
        if (!observer.disconnected && observer.targets.has(element)) {
          observer.callback([{ target: element, intersectionRatio: ratio, isIntersecting }])
        }
      }
    },
    mutate() { for (const observer of mutationObservers) if (!observer.disconnected) observer.callback([]) },
    tick(duration) {
      const until = now + duration
      let callbacks = 0
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!next) break
        assert.ok(++callbacks < 1000, 'unexpected timer loop')
        now = next[1].at
        timers.delete(next[0])
        next[1].callback()
      }
      now = until
    },
    assertClean() {
      context.window.__adExposureMonitor?.stop()
      assert.equal(timers.size, 0, 'monitor leaked timers')
      assert.ok(surfaces.every(surface => surface.listeners.length === 0), 'monitor leaked event listeners')
      assert.ok(intersectionObservers.every(observer => observer.disconnected), 'intersection observer stayed active')
      assert.ok(mutationObservers.every(observer => observer.disconnected), 'mutation observer stayed active')
    },
    result() { return { trace, reports, queries: [...queryCounts.entries()] } },
  }
}

let exposureScenarios = 0
function exposureCase(name, run, options) {
  const results = sources.map(source => {
    const h = createExposureHarness(source, options)
    run(h)
    h.assertClean()
    return h.result()
  })
  assert.deepEqual(results[1], results[0], `${name}: original/refactored lifecycle differed`)
  exposureScenarios++
  console.log(`PASS: ${name}`)
}

exposureCase('strictly over 50%, continuous 1000 ms, and one report per element', h => {
  const element = h.addElement('.ad', 'threshold')
  h.start()
  h.intersect(element, 0.5)
  h.tick(1500)
  assert.equal(h.reports.length, 0, 'exactly 50% must not qualify')
  h.intersect(element, 0.500001)
  h.tick(999)
  assert.equal(h.reports.length, 0)
  h.tick(1)
  assert.equal(h.reports.length, 1)
  assert.equal(h.reports[0].code, '20')
  assert.equal(h.reports[0].data.staticVisibleDurationMs, 1000)
  assert.equal(h.reports[0].data.adBusinessId, 'business-threshold')
  assert.equal(h.reports[0].data.className, 'ad placement')
  assert.equal(h.reports[0].data.exposedAt - h.reports[0].data.staticVisibleStartedAt, 1000)
  h.intersect(element, 0)
  h.intersect(element, 1)
  h.tick(3000)
  assert.equal(h.reports.length, 1, 'qualified element must not report twice')
})

for (const event of ['scroll', 'wheel', 'touchmove', 'viewport-scroll']) {
  exposureCase(`${event} resets exposure and waits for 200 ms of idle`, h => {
    const element = h.addElement('.ad', event)
    h.start()
    h.intersect(element, 0.8)
    h.tick(700)
    if (event === 'viewport-scroll') h.window.visualViewport.dispatch('scroll')
    else h.document.dispatch(event)
    h.tick(1199)
    assert.equal(h.reports.length, 0, 'pre-scroll visible time must be discarded')
    h.tick(1)
    assert.equal(h.reports.length, 1)
    assert.equal(h.reports[0].data.staticVisibleDurationMs, 1000)
  })
}

exposureCase('scrollend permits exposure timing immediately', h => {
  const element = h.addElement('.ad', 'scrollend')
  h.start()
  h.intersect(element, 1)
  h.document.dispatch('scrollend')
  h.tick(999)
  assert.equal(h.reports.length, 0)
  h.tick(1)
  assert.equal(h.reports.length, 1)
})

exposureCase('hidden pages discard elapsed exposure time', h => {
  const element = h.addElement('.ad', 'hidden')
  h.start()
  h.intersect(element, 0.8)
  h.tick(700)
  h.document.visibilityState = 'hidden'
  h.document.dispatch('visibilitychange')
  h.tick(2000)
  assert.equal(h.reports.length, 0)
  h.document.visibilityState = 'visible'
  h.document.dispatch('visibilitychange')
  h.tick(1199)
  assert.equal(h.reports.length, 0)
  h.tick(1)
  assert.equal(h.reports.length, 1)
})

exposureCase('falling to 50% resets continuous exposure', h => {
  const element = h.addElement('.ad', 'interrupted')
  h.start()
  h.intersect(element, 0.8)
  h.tick(700)
  h.intersect(element, 0.5)
  h.tick(500)
  assert.equal(h.reports.length, 0)
  h.intersect(element, 0.8)
  h.tick(999)
  assert.equal(h.reports.length, 0)
  h.tick(1)
  assert.equal(h.reports.length, 1)
})

for (const visualViewport of [true, false]) {
  exposureCase(`selector reuse, replacement, and idempotent stop (viewport=${visualViewport})`, h => {
    const firstElement = h.addElement('.ad', 'first')
    const first = h.start('.ad::before')
    h.intersect(firstElement, 0.8)
    h.tick(200)
    const laterElement = h.addElement('.ad', 'later')
    assert.equal(h.start(' .ad '), first)
    assert.equal(h.intersectionObservers.length, 1)
    assert.ok(h.intersectionObservers[0].targets.has(laterElement), 'same selector must refresh elements')
    h.mutate() // Leave both refresh and exposure timers pending before replacement.
    const nextElement = h.addElement('.next', 'next')
    const next = h.start('.next')
    assert.equal(first.stopped, true)
    assert.equal(h.intersectionObservers[0].disconnected, true)
    assert.equal(h.mutationObservers[0].disconnected, true)
    assert.equal(h.intersectionObservers.length, 2)
    h.intersect(nextElement, 0.8)
    h.tick(200)
    h.mutate()
    next.stop()
    const afterStop = h.trace.length
    next.stop()
    assert.equal(h.trace.length, afterStop, 'second stop must be inert')
    assert.equal(next.stopped, true)
    assert.equal(h.timers.size, 0)
    h.tick(5000)
    assert.equal(h.reports.length, 0, 'stopped monitors must not report')
  }, { visualViewport })
}

exposureCase('removing an element clears its pending exposure timer', h => {
  const element = h.addElement('.ad', 'removed')
  h.start()
  h.intersect(element, 0.8)
  h.tick(700)
  h.removeElement('.ad', element)
  h.mutate()
  h.tick(50)
  assert.equal(h.intersectionObservers[0].targets.size, 0)
  h.tick(2000)
  assert.equal(h.reports.length, 0)
})

exposureCase('empty selector search retries stop after three attempts', h => {
  h.start('.missing')
  assert.equal(h.queryCounts.get('.missing'), 1)
  h.tick(2000)
  assert.equal(h.queryCounts.get('.missing'), 2)
  h.tick(2000)
  assert.equal(h.queryCounts.get('.missing'), 3)
  h.tick(10000)
  assert.equal(h.queryCounts.get('.missing'), 3)
  assert.equal(h.timers.size, 0)
})

exposureCase('pagehide stops observers, listeners, and pending timers', h => {
  h.addElement('.ad', 'pagehide')
  const monitor = h.start()
  h.mutate()
  h.window.dispatch('pagehide')
  assert.equal(monitor.stopped, true)
  assert.equal(h.timers.size, 0)
})

console.log(`All service checks passed: ${scoreCases} scoring cases and ${exposureScenarios} exposure scenarios for both files.`)
