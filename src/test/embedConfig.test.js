import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEmbedConfig, getEmbedDefaults } from '../config/embedConfig.js'

test('returns non-embed defaults when embed is not enabled', () => {
  const config = parseEmbedConfig('?target=250&unit=MB')
  assert.deepEqual(config, getEmbedDefaults())
})

test('applies target/unit/format in embed mode', () => {
  const config = parseEmbedConfig('?embed=1&target=200&unit=KB&format=webp')
  assert.equal(config.isEmbed, true)
  assert.equal(config.useTargetSize, true)
  assert.equal(config.targetSizeValue, 200)
  assert.equal(config.targetSizeUnit, 'KB')
  assert.equal(config.outputFormat, 'image/webp')
})

test('applies quality in embed mode when target is absent', () => {
  const config = parseEmbedConfig('?embed=1&quality=43')
  assert.equal(config.useTargetSize, false)
  assert.equal(config.qualityPercent, 43)
})

test('invalid values fall back to safe defaults while out-of-range values clamp', () => {
  const config = parseEmbedConfig('?embed=1&target=-5&format=tiff&quality=999&unit=GB')
  assert.equal(config.useTargetSize, false)
  assert.equal(config.targetSizeValue, 200)
  assert.equal(config.targetSizeUnit, 'KB')
  assert.equal(config.outputFormat, 'image/jpeg')
  assert.equal(config.qualityPercent, 100)
})

test('non-numeric quality uses default', () => {
  const config = parseEmbedConfig('?embed=1&quality=abc')
  assert.equal(config.qualityPercent, 80)
})

test('parses width/height/keepAspect/label with clamping', () => {
  const config = parseEmbedConfig(
    '?embed=1&width=0&height=15000&keepAspect=0&label=Pre-configured%3A%20Under%20200%20KB'
  )
  assert.equal(config.width, '')
  assert.equal(config.height, '10000')
  assert.equal(config.keepAspect, false)
  assert.equal(config.label, 'Pre-configured: Under 200 KB')
})
