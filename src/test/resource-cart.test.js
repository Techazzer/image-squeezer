import test from 'node:test'
import assert from 'node:assert/strict'
import { readCart, normaliseCart, addProduct, cartSummary, formatPrice } from '../../tools/resources/cart-core.js'

const products = [{ id: 'suppliers', pricePaise: 5000 }, { id: 'guide', pricePaise: 2000 }]
test('digital products are charged once even after repeated add clicks', () => {
  let cart = addProduct([], 'suppliers', products)
  cart = addProduct(cart, 'suppliers', products)
  cart = addProduct(cart, 'guide', products)
  assert.deepEqual(cart, ['suppliers', 'guide'])
  assert.equal(cartSummary(cart, products).totalPaise, 7000)
  assert.equal(cartSummary(cart.filter(id => id !== 'suppliers'), products).totalPaise, 2000)
})
test('restored cart ignores stale products, injected prices and non-ID values', () => {
  assert.deepEqual(readCart('["suppliers","suppliers","removed",{"id":"guide","pricePaise":1},null]', products), ['suppliers'])
  assert.deepEqual(normaliseCart(['guide', 5, false, '__proto__'], products), ['guide'])
  assert.equal(cartSummary(['guide'], [{ id: 'guide', pricePaise: 2500 }]).totalPaise, 2500)
})
test('broken or unavailable saved data gives a usable empty cart', () => {
  for (const value of [null, '', 'null', '{}', '{broken', '42']) assert.deepEqual(readCart(value, products), [])
  assert.deepEqual(cartSummary([], products), { items: [], count: 0, totalPaise: 0 })
})
test('currency totals use integer paise without rounding away small prices', () => {
  assert.equal(formatPrice(5000), '₹50')
  assert.equal(formatPrice(2000), '₹20')
  assert.equal(formatPrice(7050), '₹70.50')
})
