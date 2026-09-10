#!/usr/bin/env node
'use strict'

// Deterministic, offline differential regression for the injected allACtion script.
// No dependencies, real browser, advertising endpoint, or production bridge needed.
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const path = require('node:path')

const originalPath = process.argv[2] || path.resolve(__dirname, '..', 'all.js')
const refactoredPath = process.argv[3] || path.resolve(__dirname, '..', 'all-refactored.js')
const sources = [originalPath, refactoredPath].map(path => ({ path, text: fs.readFileSync(path, 'utf8') }))
const clone = value => JSON.parse(JSON.stringify(value))
const callResults = result => result.calls.filter(call => call[0] === 'jsResult')
const tracks = result => result.calls.filter(call => call[0] === 'dotrack').map(call => [call[1], JSON.parse(call[2])])
const config = overrides => ({
  CLICKAD: { selector: '.ad', slide: false, pageFinish: false },
  SECONDPAGE: { selector: '.next', slide: false, pageFinish: true },
  BANNER: { selector: '.banner', slide: false, pageFinish: false },
  INTERSTITIAL: { selector: '.inter', slide: false, pageFinish: false },
  SEARCH: { inputSelector: '.input', buttonSelector: '.button', slide: false, pageFinish: true },
  AGREEMENT: { selector: '.agreement', slide: false, pageFinish: false },
  ...overrides,
})
const element = (id, selector, rect = {}, extra = {}) => ({ id, selector, rect: { left: 20, top: 50, width: 100, height: 60, ...rect }, ...extra })
const ad = extra => element('ad-one', '.ad', {}, extra)
const banner = (height = 400, top = 0, extra = {}) => element('banner-one', '.banner', { top, height }, { fixed: true, ...extra })
const inter = (top = 100) => element('inter-one', '.inter', { left: 180, top, width: 200, height: 100 })
const resultAt = result => callResults(result)[0]
const scenarios = []
function add(name, options = {}, check = () => {}) {
  scenarios.push({ name, action: 'clickad', config: config(), elements: [ad()], ...options, check })
}

async function run(source, scenario) {
  let now = 100000
  let randomCount = 0
  let seed = scenario.seed || 917
  let timerId = 0
  const timers = new Map()
  const calls = []
  const events = []
  const scrolls = []
  const monitorRequests = []
  const peopleRequests = []
  const errors = []
  const nodes = []
  const bySelector = new Map()
  const styleDefaults = { display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', position: 'static', top: 'auto', bottom: 'auto', left: 'auto', right: 'auto', content: 'normal', width: 'auto', height: 'auto' }
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  class FakeEvent {
    constructor(type, details = {}) { this.type = type; Object.assign(this, details) }
  }
  const window = {
    innerWidth: 800, innerHeight: 600, pageXOffset: scenario.scrollLeft || 0, pageYOffset: scenario.scrollTop || 0,
    getComputedStyle: (node, pseudo) => ({ ...styleDefaults, ...node.style, ...(pseudo ? node.pseudoStyle : {}) }),
    addEventListener() {}, removeEventListener() {},
    setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame(fn) { return window.setTimeout(fn, 16) },
    scrollTo(options, y) {
      const top = typeof options === 'object' ? options.top : y
      scrolls.push(top)
      window.pageYOffset = top
      document.documentElement.scrollTop = top
    },
    performance: { now: () => now },
  }
  const root = { clientWidth: 800, clientHeight: 600, scrollWidth: 1600, scrollHeight: 2400, scrollLeft: window.pageXOffset, scrollTop: window.pageYOffset }
  const body = { parentElement: root, scrollWidth: 1600, scrollHeight: 2400, style: {}, contains: node => nodes.includes(node) && node.isConnected !== false }
  const document = {
    documentElement: root, body, defaultView: window, visibilityState: 'visible',
    querySelectorAll: selector => [...(bySelector.get(selector) || [])],
    getElementById: id => nodes.find(node => node.id === id) || null,
    addEventListener() {}, removeEventListener() {},
    elementFromPoint(x, y) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null
      if (scenario.hitNone) return null
      return [...nodes].reverse().find(node => {
        const r = node.getBoundingClientRect()
        return node.isConnected && !node.disabled && node.style.display !== 'none' && node.style.visibility !== 'hidden' && node.style.pointerEvents !== 'none' && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      }) || null
    },
  }
  window.document = document
  for (const spec of scenario.elements) {
    const initialScroll = window.pageYOffset
    const node = {
      id: spec.id, tagName: spec.tagName || 'DIV', className: spec.className || '', disabled: false, isConnected: true,
      value: spec.value || '', checked: !!spec.checked, selectedIndex: -1, textContent: spec.textContent || '',
      style: spec.style || {}, pseudoStyle: spec.pseudoStyle || {}, ownerDocument: document, parentElement: body,
      getBoundingClientRect() {
        const r = { ...spec.rect }
        if (!spec.fixed) r.top += initialScroll - window.pageYOffset
        return { ...r, right: r.left + r.width, bottom: r.top + r.height }
      },
      contains(child) { return child === this || child.parentElement === this },
      getAttribute(name) { return (spec.attributes || {})[name] || null },
      hasAttribute(name) { return Object.hasOwn(spec.attributes || {}, name) },
      closest() { return null },
      focus() { events.push([spec.id, 'focus']) },
      click() { this.checked = true; events.push([spec.id, 'click']) },
      dispatchEvent(event) { events.push([spec.id, event.type, event.key || '', event.data || '', this.value, this.checked]); return true },
      ...spec.properties,
    }
    if (spec.options) node.options = clone(spec.options)
    if (spec.fixed || spec.parentStyle || spec.parentRect) {
      const r = spec.parentRect || spec.rect
      node.parentElement = { parentElement: body, style: spec.parentStyle || {}, getBoundingClientRect: () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height }) }
    }
    nodes.push(node)
    for (const selector of [].concat(spec.selector || [])) {
      bySelector.set(selector, [...(bySelector.get(selector) || []), node])
    }
  }
  const math = Object.create(Math)
  math.random = () => {
    randomCount++
    if (!scenario.seed) return scenario.random === undefined ? 0.5 : scenario.random
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const JSBehavior = {
    dotrack: (...args) => { calls.push(['dotrack', ...args]); if (scenario.throwTrack) throw new Error('bridge track failed') },
    jsResult: (...args) => calls.push(['jsResult', ...args]),
  }
  window.JSBehavior = JSBehavior
  const context = vm.createContext({
    window, document, JSBehavior, Math: math, Date: FakeDate, console: { log() {}, warn() {}, error() {} },
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    Event: FakeEvent, InputEvent: FakeEvent, KeyboardEvent: FakeEvent,
    fetch: () => { throw new Error('Unexpected network access in offline test') },
  })
  let script = source.text
  const marker = script.indexOf('// 客户端调用说明')
  if (!scenario.bootstrap) {
    script = marker >= 0 ? script.slice(0, marker) : script.split(';(function allACtionWithParams')[0]
  } else {
    script = script.replace(
      "allACtion('{jskey}', '{searchText}', '{step}', '{behaviorsId}', '{countryCode}')",
      'allACtion(' + [scenario.action, 'ab', '', 'offline-behavior', 'US'].map(value => JSON.stringify(value)).join(',') + ')',
    )
  }
  script = script.replace('{config}', scenario.rawConfig === undefined ? JSON.stringify(scenario.config) : scenario.rawConfig)
  vm.runInContext(script, context, { filename: source.path })
  const candidate = scenario.form ? {
    fingerprint: scenario.form.fingerprint || 'offline-form',
    formFields: scenario.form.fields.map(([step, id]) => ({ step, element: nodes.find(node => node.id === id) })),
    submitButton: { element: nodes.find(node => node.id === scenario.form.submit) },
  } : null
  context.recognizeAdsLandingPage = () => ({ candidates: candidate ? [candidate] : scenario.recognitionCandidates || [] })
  context.startAdExposureMonitor = selector => { monitorRequests.push(selector === undefined ? '<undefined>' : selector); return null }
  context.getAdEffectPerson = (behaviorId, countryCode) => {
    peopleRequests.push([behaviorId, countryCode])
    return Promise.resolve(scenario.person === undefined ? { fullName: 'Ada Lovelace', temporaryMail: 'ada@example.test', birthday: '12/10/1815', state: 'CA', stateFull: 'California' } : scenario.person)
  }
  let api = null
  try {
    if (scenario.api) {
      const runtime = context.AdActionRuntime
      const actionContext = runtime.createContext(scenario.action, 'ab', '', 'offline-behavior', 'US')
      const blocker = runtime.detectAdBlocker(actionContext)
      assert.equal(calls.length, 0, 'Detection must not report or track')
      const randomBefore = randomCount
      context.allACtion = () => { throw new Error('Blocker dispatch must not recurse through allACtion') }
      const handled = runtime.handleAdBlocker(actionContext, blocker)
      api = { type: blocker && blocker.type, handled, handlingRandomCalls: randomCount - randomBefore }
    } else if (scenario.bootstrap) {
      assert.equal(window.JSBehavior, JSBehavior, 'Full script must preserve the injected native bridge')
      assert.equal(context.JSBehavior, JSBehavior)
    } else {
      context.allACtion(scenario.action, scenario.searchText || 'ab', scenario.step || '', 'offline-behavior', scenario.countryCode || 'US')
    }
  }
  catch (error) { errors.push([error.name, error.message]) }
  const syncCallCount = calls.length
  const syncResultCount = callResults({ calls }).length
  for (let i = 0; i < 8; i++) await Promise.resolve()
  for (let count = 0; timers.size; count++) {
    if (count > 400) throw new Error(`Timer loop in ${scenario.name}`)
    const [id, timer] = [...timers].sort((a, b) => a[1].due - b[1].due)[0]
    timers.delete(id)
    now = Math.max(now, timer.due)
    try { timer.fn() } catch (error) { errors.push([error.name, error.message]) }
    for (let i = 0; i < 4; i++) await Promise.resolve()
  }
  return clone({ api, calls, syncCallCount, syncResultCount, errors, events, scrolls, randomCount, monitorRequests, peopleRequests, state: window.__adEffectFormState || null, nodes: nodes.map(node => ({ id: node.id, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex })) })
}

add('ordinary click', {}, r => { assert.equal(callResults(r).length, 1); assert.equal(tracks(r)[0][0], '3'); assert.equal(resultAt(r)[2], '70,80,ad-one') })
add('normalizes action and preserves bridge booleans', { action: ' Click_ad ', config: config({ CLICKAD: { selector: '.ad', slide: 'false', pageFinish: true } }) }, r => assert.deepEqual(resultAt(r).slice(1), ['clickad', '70,80,ad-one', '', 'false', true, 'offline-behavior']))
add('empty clickable query', { elements: [] }, r => { assert.equal(tracks(r)[0][1].foundElementCount, 0); assert.equal(resultAt(r)[2], '') })
add('anonymous clickable element', { elements: [element('', '.ad')] }, r => assert.match(resultAt(r)[2], /,null$/))
add('multiple elements seeded random ordering', { elements: [ad(), element('ad-two', '.ad', { left: 220 })], seed: 991 })
for (const [label, props] of [['disabled', { disabled: true }], ['disconnected', { isConnected: false }]]) add(label + ' element excluded', { elements: [ad({ properties: props })] }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
for (const [property, value] of [['display', 'none'], ['visibility', 'hidden'], ['opacity', '0'], ['pointerEvents', 'none']]) add('hidden style ' + property, { elements: [ad({ style: { [property]: value } })] }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('hidden ancestor excluded', { elements: [ad({ parentStyle: { display: 'none' } })] }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('covered target has no candidate', { hitNone: true }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('zero size element excluded', { elements: [element('zero', '.ad', { width: 0 })] }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('off-document target excluded even when slide enabled', { config: config({ CLICKAD: { selector: '.ad', slide: true } }), elements: [element('past-document', '.ad', { top: 3000 })] }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('offscreen target excluded without slide', { elements: [element('lower-ad', '.ad', { top: 900 })] }, r => assert.equal(resultAt(r)[2], ''))
add('offscreen page coordinate with slide', { config: config({ CLICKAD: { selector: '.ad', slide: true } }), elements: [element('lower-ad', '.ad', { top: 900 })], scrollTop: 100 }, r => assert.equal(resultAt(r)[2], '70,1030,lower-ad'))
add('viewport coordinate ignores scroll when slide disabled', { scrollTop: 100 }, r => assert.equal(resultAt(r)[2], '70,80,ad-one'))
add('jsSlide reports after asynchronous scroll settles once', { config: config({ CLICKAD: { selector: '.ad', slide: true, jsSlide: 'true' } }), elements: [element('lower-ad', '.ad', { top: 900 })] }, r => { assert.equal(r.syncResultCount, 0); assert.equal(callResults(r).length, 1); assert.deepEqual(r.scrolls, [630]) })
add('jsSlide does not delay visible target', { config: config({ CLICKAD: { selector: '.ad', slide: true, jsSlide: true } }) }, r => { assert.equal(r.syncResultCount, 1); assert.deepEqual(r.scrolls, []) })
add('pseudo selector uses effective rectangle', { config: config({ CLICKAD: { selector: '.ad::before', slide: false } }), elements: [ad({ pseudoStyle: { content: '"x"', position: 'absolute', top: '5px', left: '10px', width: '40px', height: '20px' } })] }, r => assert.equal(resultAt(r)[2], '50,65,ad-one'))
add('pseudo selector rejects absent content', { config: config({ CLICKAD: { selector: '.ad::before', slide: false } }) }, r => assert.equal(tracks(r)[0][1].foundElementCount, 0))
add('pseudo selector falls back to parent size', { config: config({ CLICKAD: { selector: '.ad::after', slide: false } }), elements: [ad({ pseudoStyle: { content: '"x"' } })] }, r => assert.equal(resultAt(r)[2], '70,80,ad-one'))
add('pseudo selector positions by right and bottom', { config: config({ CLICKAD: { selector: '.ad::after', slide: false } }), elements: [ad({ pseudoStyle: { content: '"x"', position: 'absolute', right: '10px', bottom: '10px', width: '20px', height: '20px' } })] }, r => assert.equal(resultAt(r)[2], '100,90,ad-one'))
add('offscreen pseudo allowed when slide enabled', { config: config({ CLICKAD: { selector: '.ad::before', slide: true } }), elements: [ad({ pseudoStyle: { content: '"x"', position: 'absolute', top: '1000px', left: '10px', width: '40px', height: '20px' } })] }, r => assert.equal(resultAt(r)[2], '50,1060,ad-one'))
for (const rate of [undefined, null, 0, 49, 50, 51, '50', 'invalid', -1, 100]) add('clickrate ' + String(rate), { config: config({ CLICKAD: { selector: '.ad', slide: false, clickrate: rate } }) }, r => assert.equal(tracks(r)[0][1].shouldSkipClick, rate !== undefined && rate !== null && 50 > Number(rate)))
add('clickrate zero still clicks when random integer zero (legacy boundary)', { random: 0, config: config({ CLICKAD: { selector: '.ad', slide: false, clickrate: 0 } }) }, r => assert.equal(tracks(r)[0][1].shouldSkipClick, false))
add('clickrate scales with element count', { elements: [ad(), element('ad-two', '.ad', { left: 250 })], config: config({ CLICKAD: { selector: '.ad', slide: false, clickrate: 25 } }) }, r => assert.equal(tracks(r)[0][1].shouldSkipClick, false))
for (const action of ['banner', 'secondpage', 'associationsearch', 'agreement', 'interstitial', 'exposure', 'unknown']) add('generic branch ' + action, { action, elements: [element('generic', '.target')], config: config({ [action.toUpperCase()]: { selector: '.target', slide: false, pageFinish: true } }) }, r => { assert.equal(callResults(r).length, 1); assert.equal(resultAt(r)[1], action) })

for (const action of ['clickad', 'secondpage', 'search', 'agreement', 'adeffect']) add('interstitial guard intercepts ' + action, { action, elements: [ad(), inter(), banner()] }, r => { assert.equal(r.calls.length, 1); assert.deepEqual(resultAt(r).slice(1), [action, '', 'irregularinter', '', '', 'offline-behavior']) })
for (const action of ['checkpage', 'interstitial', 'interstitialclose', 'exposure']) add('interstitial guard skips ' + action, { action, elements: [ad(), inter()] }, r => assert.notEqual(resultAt(r)[3], 'irregularinter'))
add('interstitial inherits initiating slide true', { action: 'agreement', config: config({ AGREEMENT: { selector: '.agreement', slide: true } }), elements: [inter(1000)] }, r => assert.equal(resultAt(r)[3], 'irregularinter'))
add('interstitial inherits initiating slide false', { action: 'agreement', elements: [inter(1000)] }, r => assert.notEqual(resultAt(r)[3], 'irregularinter'))
add('interstitial close coordinates', { action: 'interstitialclose', elements: [inter()] }, r => { assert.equal(tracks(r)[0][0], '2'); assert.equal(resultAt(r)[2], '766,22') })
add('interstitial close no target', { action: 'interstitialclose', elements: [] }, r => assert.equal(r.calls.length, 1))
add('missing interstitial config throws known baseline error', { action: 'interstitialclose', config: {} }, r => { assert.equal(r.errors.length, 1); assert.equal(r.errors[0][0], 'TypeError'); assert.equal(r.calls.length, 0) })

add('banner top explicit parent placement', { elements: [ad(), banner(400, 0, { parentStyle: { top: '0px' } })] }, r => { assert.equal(tracks(r)[0][0], 26); assert.equal(tracks(r)[0][1].bannerPosition, 'top'); assert.equal(resultAt(r)[2], '50.5,415.5,banner-one') })
add('banner bottom explicit parent placement', { elements: [ad(), banner(400, 200, { parentStyle: { bottom: '0px' } })] }, r => { assert.equal(tracks(r)[0][1].bannerPosition, 'bottom'); assert.equal(resultAt(r)[2], '50.5,185.5,banner-one') })
add('banner fallback chooses nearest edge', { elements: [ad(), banner(400, 200)] }, r => assert.equal(tracks(r)[0][1].bannerPosition, 'bottom'))
add('banner both parent edges fallback', { elements: [ad(), banner(400, 0, { parentStyle: { top: '0px', bottom: '0px' } })] }, r => assert.equal(tracks(r)[0][1].bannerPosition, 'top'))
add('banner threshold exact 360 excluded', { elements: [element('ad-one', '.ad', { left: 250 }), banner(360)] }, r => assert.equal(tracks(r)[0][0], '3'))
add('banner threshold 361 included', { elements: [ad(), banner(361)] }, r => assert.equal(tracks(r)[0][0], 26))
add('banner no valid dismissal y returns id only', { elements: [ad(), banner(595)] }, r => assert.equal(resultAt(r)[2], ',,banner-one'))
add('banner dismissal x outside viewport returns id only', { elements: [ad(), element('right-banner', '.banner', { left: 780, width: 10, top: 0, height: 400 }, { fixed: true })] }, r => assert.equal(resultAt(r)[2], ',,right-banner'))
add('banner dismissal negative y returns id only', { elements: [ad(), banner(400, 0, { parentStyle: { bottom: '0px' } })] }, r => assert.equal(resultAt(r)[2], ',,banner-one'))
add('banner missing id placeholder', { elements: [ad(), element('', '.banner', { top: 0, height: 400 }, { fixed: true })] }, r => assert.match(resultAt(r)[2], /,null$/))
add('banner largest candidate selected', { elements: [ad(), banner(380), element('tallest', '.banner', { left: 250, top: 0, height: 450 }, { fixed: true })] }, r => { assert.equal(tracks(r)[0][1].selectedElementId, 'tallest'); assert.equal(tracks(r)[0][1].foundElementCount, 2) })
add('banner tied height selects first', { elements: [ad(), banner(400), element('tie', '.banner', { left: 250, top: 0, height: 400 }, { fixed: true })] }, r => assert.equal(tracks(r)[0][1].selectedElementId, 'banner-one'))
add('banner preserves raw incoming action in result', { action: ' Second_page ', elements: [banner()] }, r => assert.deepEqual(resultAt(r).slice(1), [' Second_page ', '50.5,415.5,banner-one', ' Second_page ', false, false, 'offline-behavior']))
for (const slide of [true, 'true', undefined, null, '', 0]) add('banner guard excludes slide=' + String(slide), { config: config({ BANNER: { selector: '.banner', slide } }), elements: [element('ad-one', '.ad', { left: 250 }), banner()] }, r => assert.equal(tracks(r)[0][0], '3'))
add('banner guard accepts string FALSE', { config: config({ BANNER: { selector: '.banner', slide: 'FALSE' } }), elements: [banner()] }, r => assert.equal(tracks(r)[0][0], 26))
for (const action of ['search', 'agreement', 'banner', 'associationsearch', 'unknown']) add('banner guard not run for ' + action, { action, elements: [banner()] }, r => assert.notEqual(tracks(r)[0]?.[0], 26))

const searchElements = [element('input', '.input', {}, { tagName: 'INPUT', className: '  search   term  ', value: 'old' }), element('button', '.button', { left: 220 }, { tagName: 'BUTTON' })]
add('search first step', { action: 'search', elements: searchElements }, r => { assert.equal(resultAt(r)[3], '{searchButton}'); assert.deepEqual(r.events, []); assert.equal(tracks(r)[0][1].className, 'search term') })
add('search fills then selects button', { action: 'search', step: '{searchButton}', elements: searchElements }, r => { assert.equal(resultAt(r)[2], '270,80'); assert.equal(r.nodes[0].value, 'ab'); assert.deepEqual(r.events.map(e => e[1]), ['focus', 'input', 'keydown', 'keypress', 'input', 'keyup', 'keydown', 'keypress', 'input', 'keyup', 'change']) })
add('search no input first step', { action: 'search', elements: [] }, r => { assert.equal(resultAt(r)[2], ''); assert.equal(resultAt(r)[3], '{searchButton}') })
add('search no input button step', { action: 'search', step: '{searchButton}', elements: [searchElements[1]] }, r => { assert.equal(resultAt(r)[2], ''); assert.deepEqual(r.events, []) })
add('search no button still fills', { action: 'search', step: '{searchButton}', elements: [searchElements[0]] }, r => { assert.equal(resultAt(r)[2], ''); assert.equal(r.nodes[0].value, 'ab') })
add('search unrecognized step', { action: 'search', step: 'other', elements: searchElements }, r => { assert.equal(resultAt(r)[2], ''); assert.deepEqual(r.events, []) })
add('checkpage deduplicates shared elements', { action: 'checkpage', elements: [element('shared', ['.ad', '.banner'], { left: 420 }), ...searchElements] }, r => { assert.equal(tracks(r)[0][0], '1'); assert.equal(tracks(r)[0][1].foundElementCount, 3); assert.deepEqual(r.monitorRequests, ['.ad']); assert.equal(resultAt(r)[4], '') })
add('checkpage recognizes form candidate', { action: 'checkpage', elements: [], recognitionCandidates: [{}] }, r => assert.equal(resultAt(r)[2], 'adeffect'))
add('checkpage tolerates bridge tracking throw', { action: 'checkpage', elements: [], throwTrack: true }, r => { assert.equal(r.errors.length, 0); assert.equal(callResults(r).length, 1) })
add('checkpage scroll stats uses action slide', { action: 'checkpage', scrollLeft: 40, scrollTop: 100, config: config({ CLICKAD: { selector: '.ad', slide: true } }) }, r => { const item = tracks(r)[0][1].actions.find(a => a.action === 'clickad').elements[0]; assert.equal(item.left, 60); assert.equal(item.top, 150) })
add('missing config generic action', { config: {}, action: 'agreement' }, r => { assert.equal(r.errors.length, 0); assert.equal(resultAt(r)[4], '') })
add('invalid injected JSON falls back', { rawConfig: 'not JSON', action: 'checkpage', elements: [] }, r => { assert.equal(r.errors.length, 0); assert.equal(resultAt(r)[2], '') })
add('explicit EXPOSURE selector preserved if clickad absent', { action: 'checkpage', config: { EXPOSURE: { selector: '.exposure' } }, elements: [] }, r => assert.deepEqual(r.monitorRequests, ['.exposure']))

const formElements = [element('name', '.name', {}, { tagName: 'INPUT' }), element('email', '.email', { left: 220 }, { tagName: 'INPUT' }), element('submit', '.submit', { left: 420 }, { tagName: 'BUTTON' })]
const form = { fields: [['fullName', 'name'], ['temporaryMail', 'email']], submit: 'submit' }
add('adeffect no form returns without bridge', { action: 'adeffect' }, r => assert.deepEqual(r.calls, []))
add('adeffect first field asynchronous result once', { action: 'adeffect', elements: formElements, form }, r => { assert.equal(r.syncResultCount, 0); assert.equal(callResults(r).length, 1); assert.equal(resultAt(r)[3], 'fullName'); assert.deepEqual(r.peopleRequests, [['offline-behavior', 'US']]) })
add('adeffect fills current advances next', { action: 'adeffect', step: 'fullName', elements: formElements, form }, r => { assert.equal(r.nodes[0].value, 'Ada Lovelace'); assert.equal(resultAt(r)[3], 'temporaryMail') })
add('adeffect last field advances submit', { action: 'adeffect', step: 'temporaryMail', elements: formElements, form }, r => { assert.equal(r.nodes[1].value, 'ada@example.test'); assert.equal(resultAt(r)[2], '470,80'); assert.equal(resultAt(r)[3], '') })
add('adeffect unavailable person still advances', { action: 'adeffect', step: 'fullName', person: null, elements: formElements, form }, r => { assert.deepEqual(r.events, []); assert.equal(resultAt(r)[3], 'temporaryMail') })
add('adeffect unknown step restarts first field', { action: 'adeffect', step: 'missing', elements: formElements, form }, r => assert.equal(resultAt(r)[3], 'fullName'))
add('adeffect country forwarding', { action: 'adeffect', countryCode: 'GB', elements: formElements, form }, r => assert.deepEqual(r.peopleRequests, [['offline-behavior', 'GB']]))
add('adeffect birthday date conversion', { action: 'adeffect', step: 'birthday', elements: [element('birth', '.birth', {}, { tagName: 'INPUT', attributes: { type: 'date' } }), formElements[2]], form: { fields: [['birthday', 'birth']], submit: 'submit' } }, r => assert.equal(r.nodes[0].value, '1815-12-10'))
add('adeffect select matches state full name', { action: 'adeffect', step: 'state', elements: [element('state', '.state', {}, { tagName: 'SELECT', options: [{ value: '', textContent: 'Choose' }, { value: 'NY', textContent: 'New York' }, { value: 'CA', textContent: 'California' }] }), formElements[2]], form: { fields: [['state', 'state']], submit: 'submit' } }, r => { assert.equal(r.nodes[0].value, 'CA'); assert.equal(r.nodes[0].selectedIndex, 2) })
add('adeffect checkbox toggles and dispatches', { action: 'adeffect', step: 'fullName', elements: [element('check', '.check', {}, { tagName: 'INPUT', attributes: { type: 'checkbox' } }), formElements[2]], form: { fields: [['fullName', 'check']], submit: 'submit' } }, r => { assert.equal(r.nodes[0].checked, true); assert.deepEqual(r.events.map(e => e[1]), ['focus', 'click', 'input', 'change']) })

;(async () => {
  let passed = 0
  let seededComparisons = 0
  const failures = []
  for (const scenario of scenarios) {
    const baseline = await run(sources[0], scenario)
    try {
      scenario.check(baseline)
      if (!scenario.name.startsWith('missing interstitial config')) assert.deepEqual(baseline.errors, [], 'Unexpected original error')
      for (const source of sources.slice(1)) {
        const actual = await run(source, scenario)
        assert.deepEqual(actual, baseline, `${scenario.name}: bridge, timing, DOM, or random sequence changed`)
        if (scenario.random === undefined) {
          for (const seed of [171, 7619]) {
            const seededScenario = { ...scenario, seed }
            const seededBaseline = await run(sources[0], seededScenario)
            const seededActual = await run(source, seededScenario)
            assert.deepEqual(seededActual, seededBaseline, `${scenario.name}, seed ${seed}: behavior changed`)
            seededComparisons++
          }
        }
      }
      passed++
    } catch (error) {
      failures.push(scenario.name)
      console.error(`FAIL ${scenario.name}\n${error.stack}`)
      console.error('BASELINE:', JSON.stringify(baseline))
    }
  }
  console.log(`${passed}/${scenarios.length} passed (${sources.length === 2 ? 'original vs refactored differential' : 'original baseline only; refactored file not present'})`)
  if (seededComparisons) console.log(`${seededComparisons} additional seeded differential comparisons passed.`)

  const apiScenarios = [
    { name: 'interstitial detection and dispatch', elements: [inter()], expected: { type: 'interstitial', handled: true, handlingRandomCalls: 0 } },
    { name: 'high banner detection result is reused', elements: [banner()], expected: { type: 'highBanner', handled: true, handlingRandomCalls: 2 } },
    { name: 'no blocker leaves action unhandled', elements: [], expected: { type: null, handled: false, handlingRandomCalls: 0 } },
  ]
  for (const scenario of apiScenarios) {
    const actual = await run(sources[1], { config: config(), action: 'clickad', ...scenario, api: true })
    assert.deepEqual(actual.errors, [])
    assert.deepEqual(actual.api, scenario.expected, scenario.name)
    assert.equal(callResults(actual).length, scenario.expected.handled ? 1 : 0)
  }
  const bootstrap = await run(sources[1], {
    name: 'full script preserves bridge and invokes once', action: 'secondpage',
    config: config(), elements: [element('next', '.next')], bootstrap: true,
  })
  assert.deepEqual(bootstrap.errors, [])
  assert.equal(callResults(bootstrap).length, 1)
  assert.equal(tracks(bootstrap).length, 1)
  assert.equal(resultAt(bootstrap)[1], 'secondpage')
  console.log('4 public API and full-script bootstrap checks passed.')

  console.log('Known original behaviors retained: missing INTERSTITIAL config throws in INTERSTITIALCLOSE; clickrate 0 clicks if random bucket is 0; EXPOSURE action falls through generic click handler.')
  if (failures.length) process.exitCode = 1
})().catch(error => { console.error(error.stack); process.exitCode = 1 })
