'use strict'

// Offline contract and distribution checks; no browser, network or native clicks.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { run, config, element, tracks, callResults, resultAt } = require('./all-refactored.test.cjs')
const files = process.argv.slice(2)
const sources = (files.length ? files : ['all-refactored.js', 'all-new.js']).map(path => ({ path, text: fs.readFileSync(path, 'utf8') }))
const adConfig = overrides => config({ CLICKAD: { selector: '.ad', slide: true, pageFinish: false, ...overrides } })
const ads = () => [element('visible-ad', '.ad', { top: 520 }), element('lower-ad', '.ad', { left: 220, top: 900 })]
const overlay = () => element('overlay', '.cover', { left: 43.12, top: 500, width: 100, height: 100 }, { fixed: true })
const clickTrack = r => tracks(r).find(([type]) => type === '3')[1]

async function main() {
  for (const source of sources) {
    const execute = async options => {
      const result = await run(source, { action: 'clickad', config: adConfig(), elements: ads(), ...options })
      assert.deepEqual(result.errors, [], source.path)
      return result
    }

    // 候选发现无随机选点，也不依赖当前遮挡；CHECKPAGE 与 CLICKAD 口径一致。
    const check = await execute({ action: 'checkpage', elements: [...ads(), overlay()] })
    const clickStats = tracks(check)[0][1].actions.find(action => action.action === 'clickad')
    assert.deepEqual(clickStats.elementIds, ['visible-ad', 'lower-ad'])
    assert.equal(check.randomCount, 26, 'only the unchanged EXPOSURE probe samples points; CLICKAD discovery does not')

    // 不可达/不可交互元素不参加；仅有边缘可见的元素仍可通过纵向滚动点击。
    const filtered = await execute({ elements: [
      element('edge', '.ad', { left: 790, top: 900 }),
      element('horizontal-offscreen', '.ad', { left: 900 }),
      element('outside-document', '.ad', { top: 3000 }),
      element('hidden', '.ad', {}, { style: { display: 'none' } }),
      element('disabled', '.ad', {}, { properties: { disabled: true } }),
      element('disconnected', '.ad', {}, { properties: { isConnected: false } }),
      element('zero-size', '.ad', { width: 0 }),
      element('offscreen-fixed', '.ad', { top: 900 }, { fixed: true, style: { position: 'fixed' } }),
    ] })
    assert.deepEqual(clickTrack(filtered).elementIds, ['edge'])
    assert.equal(clickTrack(filtered).selectedElementId, 'edge')
    assert.ok(Number(clickTrack(filtered).position.split(',')[0]) >= 790)

    const upper = await execute({ scrollTop: 1000, elements: [element('upper', '.ad', { top: -500 })] })
    assert.equal(resultAt(upper)[2], '70,530,upper')

    // 原生滚动仍获得同一被选元素的页面坐标，遮挡不能将它从候选中淘汰。
    const native = await execute({ elements: [...ads(), overlay()], random: 0.25 })
    assert.equal(clickTrack(native).foundElementCount, 2)
    assert.equal(clickTrack(native).selectedElementId, 'visible-ad')
    assert.ok(resultAt(native)[2].endsWith(',visible-ad'))
    assert.deepEqual(native.scrolls, [])

    // JS 滚动后重新确认同一元素的坐标，只回报一次。
    const scrolled = await execute({ config: adConfig({ jsSlide: true }), elements: [...ads(), overlay()], random: 0.25 })
    assert.equal(scrolled.syncResultCount, 0)
    assert.equal(scrolled.scrolls.length, 1)
    assert.equal(callResults(scrolled).length, 1)
    assert.equal(tracks(scrolled).length, 1)
    assert.equal(clickTrack(scrolled).selectedElementId, 'visible-ad')
    assert.ok(resultAt(scrolled)[2].endsWith(',visible-ad'))

    // 无法点击时保留抽签结果、回报空坐标，禁止转选另一个广告。
    for (const json of [false, true]) {
      for (const slide of [false, true]) {
        const blocked = await execute({ json, hitNone: true, config: adConfig({ slide, jsSlide: true }), random: 0.25 })
        assert.equal(clickTrack(blocked).selectedElementId, 'visible-ad')
        assert.equal(clickTrack(blocked).foundElementCount, slide ? 2 : 1)
        assert.equal(clickTrack(blocked).position, '')
        assert.equal(callResults(blocked).length, 1)
        assert.equal(json ? JSON.parse(resultAt(blocked)[1]).value : resultAt(blocked)[2], '')
      }
    }

    // 有效伪元素使用自己的矩形，候选不再要求宿主本身能命中随机点。
    const pseudo = await execute({
      config: adConfig({ selector: '.ad::before' }),
      elements: [element('pseudo-ad', '.ad', { width: 0, height: 0 }, { pseudoStyle: { content: '"x"', position: 'absolute', top: '900px', left: '10px', width: '40px', height: '20px' } })],
    })
    assert.equal(clickTrack(pseudo).foundElementCount, 1)
    assert.equal(resultAt(pseudo)[2], '50,960,pseudo-ad')

    const skipped = await execute({ config: adConfig({ clickrate: -1 }) })
    assert.equal(clickTrack(skipped).shouldSkipClick, true)
    assert.equal(clickTrack(skipped).selectedElementId, '')
    assert.equal(skipped.randomCount, 1, 'skipped click must not sample points')

    // 原来约 3:1 的场景：一个在屏内部分遮挡，一个在屏外。两种入口都应约 1:1。
    for (const format of ['legacy', 'json']) {
      const n = 30000
      const distribution = await execute({
        seed: 83719, elements: [...ads(), overlay()],
        invocations: Array.from({ length: n }, () => ({ format, params: { jskey: 'clickad' } })),
      })
      const counts = { 'visible-ad': 0, 'lower-ad': 0 }
      for (const [type, stat] of tracks(distribution)) {
        assert.equal(type, '3')
        assert.deepEqual(stat.elementIds, ['visible-ad', 'lower-ad'])
        assert.ok(stat.position, 'native scrolling retains a coordinate for the selected target')
        counts[stat.selectedElementId]++
      }
      assert.equal(counts['visible-ad'] + counts['lower-ad'], n)
      assert.ok(Math.abs(counts['visible-ad'] / n - 0.5) < 0.02, JSON.stringify(counts))
      console.log(`${source.path} ${format}: ${JSON.stringify(counts)}`)
    }
    console.log(`${source.path}: clickad candidate, scrolling, no-reselection and distribution checks passed`)
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1 })
