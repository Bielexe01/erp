const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { nanoid } = require('nanoid')
const auth = require('../middleware/auth')

router.use(auth)

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((it) => ({
      productId: it.productId,
      quantity: toNumber(it.quantity, 1),
      price: toNumber(it.price, 0)
    }))
    .filter((it) => it.productId && it.quantity > 0)
}

function calcSubtotal(items) {
  return (items || []).reduce((sum, it) => sum + toNumber(it.quantity, 0) * toNumber(it.price, 0), 0)
}

function normalizeStatus(value, fallback = 'completed') {
  const allowed = ['open', 'completed', 'canceled']
  if (allowed.includes(value)) return value
  return fallback
}

router.get('/', async (req, res) => {
  await db.read()

  const statusFilter = req.query.status || ''
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true'
  const search = String(req.query.search || '').toLowerCase().trim()

  let list = [...(db.data.orders || [])]

  if (!includeDeleted) {
    list = list.filter((order) => order.deleted !== true)
  }

  if (statusFilter) {
    list = list.filter((order) => String(order.status || '') === statusFilter)
  }

  if (search) {
    list = list.filter((order) =>
      String(order.id || '').toLowerCase().includes(search) ||
      String(order.customerId || '').toLowerCase().includes(search) ||
      String(order.cashierId || '').toLowerCase().includes(search) ||
      String(order.notes || '').toLowerCase().includes(search)
    )
  }

  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()

  const items = normalizeItems(req.body.items)
  if (items.length === 0) {
    return res.status(400).json({ error: 'items are required' })
  }

  const subtotal = calcSubtotal(items)
  const discount = toNumber(req.body.discount, 0)
  const status = normalizeStatus(req.body.status, 'completed')

  const order = {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    deleted: false,
    customerId: req.body.customerId || null,
    cashierId: req.body.cashierId || null,
    paymentMethod: req.body.paymentMethod || null,
    notes: req.body.notes || '',
    items,
    total: subtotal,
    discount,
    paymentAmount: req.body.paymentAmount !== undefined ? toNumber(req.body.paymentAmount, 0) : Math.max(0, subtotal - discount),
    status
  }

  db.data.orders.push(order)
  await db.write()
  res.status(201).json(order)
})

router.put('/:id', async (req, res) => {
  await db.read()

  const idx = (db.data.orders || []).findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = db.data.orders[idx]
  const merged = {
    ...current,
    ...req.body,
    updatedAt: new Date().toISOString()
  }

  if (req.body.items !== undefined) {
    merged.items = normalizeItems(req.body.items)
  }

  const subtotal = req.body.total !== undefined ? toNumber(req.body.total, 0) : calcSubtotal(merged.items)
  merged.total = subtotal
  merged.discount = req.body.discount !== undefined ? toNumber(req.body.discount, 0) : toNumber(current.discount, 0)

  if (req.body.paymentAmount !== undefined) {
    merged.paymentAmount = toNumber(req.body.paymentAmount, 0)
  } else {
    merged.paymentAmount = Math.max(0, subtotal - merged.discount)
  }

  if (req.body.status !== undefined) {
    merged.status = normalizeStatus(req.body.status, current.status || 'completed')
  } else {
    merged.status = normalizeStatus(current.status, 'completed')
  }

  if (req.body.deleted !== undefined) {
    merged.deleted = !!req.body.deleted
    merged.deletedAt = merged.deleted ? (merged.deletedAt || new Date().toISOString()) : null
  }

  db.data.orders[idx] = merged
  await db.write()
  res.json(merged)
})

router.patch('/:id/status', async (req, res) => {
  await db.read()
  const idx = (db.data.orders || []).findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const nextStatus = normalizeStatus(req.body.status, db.data.orders[idx].status || 'completed')
  db.data.orders[idx] = {
    ...db.data.orders[idx],
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    deleted: nextStatus === 'canceled' ? true : db.data.orders[idx].deleted,
    deletedAt: nextStatus === 'canceled' ? (db.data.orders[idx].deletedAt || new Date().toISOString()) : db.data.orders[idx].deletedAt
  }

  await db.write()
  res.json(db.data.orders[idx])
})

router.patch('/:id/restore', async (req, res) => {
  await db.read()
  const idx = (db.data.orders || []).findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  db.data.orders[idx] = {
    ...db.data.orders[idx],
    status: db.data.orders[idx].status === 'canceled' ? 'completed' : db.data.orders[idx].status,
    deleted: false,
    deletedAt: null,
    updatedAt: new Date().toISOString()
  }

  await db.write()
  res.json(db.data.orders[idx])
})

router.post('/:id/duplicate', async (req, res) => {
  await db.read()
  const current = (db.data.orders || []).find((x) => x.id === req.params.id)
  if (!current) return res.status(404).json({ error: 'not found' })

  const items = normalizeItems(current.items)
  const subtotal = calcSubtotal(items)
  const discount = toNumber(current.discount, 0)

  const duplicated = {
    ...current,
    id: nanoid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    deletedAt: null,
    status: 'open',
    items,
    total: subtotal,
    paymentAmount: Math.max(0, subtotal - discount)
  }

  db.data.orders.push(duplicated)
  await db.write()
  res.status(201).json(duplicated)
})

router.delete('/:id', async (req, res) => {
  await db.read()

  const hardDelete = String(req.query.hard || '').toLowerCase() === 'true'

  if (hardDelete) {
    db.data.orders = (db.data.orders || []).filter((x) => x.id !== req.params.id)
    await db.write()
    return res.json({ ok: true, hard: true })
  }

  const idx = (db.data.orders || []).findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  db.data.orders[idx] = {
    ...db.data.orders[idx],
    status: 'canceled',
    deleted: true,
    deletedAt: db.data.orders[idx].deletedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.write()
  res.json({ ok: true, hard: false })
})

module.exports = router
