// Public product metadata only. Paid files and supplier records never belong here.
export const CART_KEY = 'aeroniqx.resource-cart.v1'
export function normaliseCart(value, products) {
  if (!Array.isArray(value)) return []
  const allowed = new Set(products.map(product => product.id))
  return [...new Set(value.filter(id => typeof id === 'string' && allowed.has(id)))].slice(0, 100)
}
export function readCart(raw, products) {
  try { return normaliseCart(JSON.parse(raw || '[]'), products) } catch { return [] }
}
export function addProduct(ids, id, products) {
  return normaliseCart([...ids, id], products)
}
export function cartSummary(ids, products) {
  const selected = new Set(normaliseCart(ids, products))
  const items = products.filter(product => selected.has(product.id))
  return { items, count: items.length, totalPaise: items.reduce((sum, item) => sum + item.pricePaise, 0) }
}
export function formatPrice(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100)
}
