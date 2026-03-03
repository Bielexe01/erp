const express = require('express')
const { nanoid } = require('nanoid')
const { db } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

router.use(auth)

function ensureStore() {
  if (!db.data) db.data = {}
  if (!db.data.users) db.data.users = []
  if (!db.data.products) db.data.products = []
  if (!db.data.customers) db.data.customers = []
  if (!db.data.orders) db.data.orders = []
  if (!db.data.financeEntries) db.data.financeEntries = []
  if (!db.data.suppliers) db.data.suppliers = []
  if (!db.data.purchases) db.data.purchases = []
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round(value, places = 4) {
  const f = 10 ** places
  return Math.round(toNumber(value) * f) / f
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function byOwner(item, userId) {
  return item && item.ownerId === userId
}

router.get('/', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const { supplierId, search, startDate, endDate } = req.query
  let list = (db.data.purchases || []).filter((purchase) => byOwner(purchase, userId))

  if (supplierId) list = list.filter(p => p.supplierId === supplierId)

  if (search) {
    const q = String(search).toLowerCase()
    list = list.filter(p =>
      String(p.invoiceNumber || '').toLowerCase().includes(q) ||
      String(p.supplierName || '').toLowerCase().includes(q) ||
      String(p.notes || '').toLowerCase().includes(q)
    )
  }

  if (startDate) {
    const start = new Date(startDate)
    list = list.filter(p => new Date(p.date) >= start)
  }

  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    list = list.filter(p => new Date(p.date) <= end)
  }

  list = list.sort((a, b) => new Date(b.date) - new Date(a.date))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  ensureStore()

  const { supplierId, invoiceNumber, date, notes, freight, otherCosts, items } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' })
  }

  const parsedItems = items.map((item) => ({
    productId: item.productId,
    quantity: toNumber(item.quantity),
    unitCost: toNumber(item.unitCost)
  }))

  if (parsedItems.some(item => !item.productId || item.quantity <= 0 || item.unitCost < 0)) {
    return res.status(400).json({ error: 'invalid items' })
  }

  const subtotal = parsedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  const freightValue = toNumber(freight)
  const otherValue = toNumber(otherCosts)
  const extraCosts = Math.max(0, freightValue + otherValue)
  const total = subtotal + extraCosts
  const totalQty = parsedItems.reduce((sum, item) => sum + item.quantity, 0)

  let supplier = null
  if (supplierId) {
    supplier = (db.data.suppliers || []).find((s) => s.id === supplierId && byOwner(s, req.user.id))
    if (!supplier) {
      return res.status(400).json({ error: 'supplier not found' })
    }
  }

  const detailedItems = []

  for (const item of parsedItems) {
    const productIdx = (db.data.products || []).findIndex((p) => p.id === item.productId && byOwner(p, req.user.id))
    if (productIdx === -1) {
      return res.status(400).json({ error: `product not found: ${item.productId}` })
    }

    const product = db.data.products[productIdx]

    const stockBefore = toNumber(product.estoque)
    const avgCostBefore = toNumber(product.custoBruto)

    const itemTotal = item.quantity * item.unitCost
    const extraAllocated = subtotal > 0
      ? (itemTotal / subtotal) * extraCosts
      : (totalQty > 0 ? (item.quantity / totalQty) * extraCosts : 0)

    const effectiveUnitCost = item.quantity > 0 ? (itemTotal + extraAllocated) / item.quantity : item.unitCost

    const stockAfter = stockBefore + item.quantity
    const avgCostAfter = stockAfter > 0
      ? ((stockBefore * avgCostBefore) + (item.quantity * effectiveUnitCost)) / stockAfter
      : effectiveUnitCost

    db.data.products[productIdx] = {
      ...product,
      estoque: round(stockAfter, 3),
      custoBruto: round(avgCostAfter, 4),
      updatedAt: new Date().toISOString()
    }

    detailedItems.push({
      id: nanoid(),
      productId: item.productId,
      productName: product.name,
      quantity: round(item.quantity, 3),
      unitCost: round(item.unitCost, 4),
      itemTotal: round(itemTotal, 2),
      extraAllocated: round(extraAllocated, 2),
      effectiveUnitCost: round(effectiveUnitCost, 4),
      stockBefore: round(stockBefore, 3),
      stockAfter: round(stockAfter, 3),
      avgCostBefore: round(avgCostBefore, 4),
      avgCostAfter: round(avgCostAfter, 4)
    })
  }

  const purchase = {
    id: nanoid(),
    ownerId: req.user.id,
    supplierId: supplierId || null,
    supplierName: supplier ? supplier.name : 'Sem fornecedor',
    invoiceNumber: String(invoiceNumber || '').trim(),
    date: normalizeDate(date),
    notes: String(notes || '').trim(),
    freight: round(freightValue, 2),
    otherCosts: round(otherValue, 2),
    subtotal: round(subtotal, 2),
    total: round(total, 2),
    items: detailedItems,
    createdAt: new Date().toISOString(),
    createdBy: req.user.username || req.user.id,
    status: 'received'
  }

  db.data.purchases.push(purchase)
  await db.write()

  res.status(201).json(purchase)
})

module.exports = router
