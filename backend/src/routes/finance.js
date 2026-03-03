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
}

function parseAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function byOwner(item, userId) {
  return item && item.ownerId === userId
}

router.get('/summary', async (req, res) => {
  await db.read()
  ensureStore()
  const list = (db.data.financeEntries || []).filter((item) => byOwner(item, req.user.id))
  const { startDate, endDate } = req.query

  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  const filtered = list.filter(item => {
    if (!item.dueDate) return true
    const due = new Date(item.dueDate)
    if (start && due < start) return false
    if (end && due > end) return false
    return true
  })

  const openReceivable = filtered
    .filter(item => item.type === 'receber' && item.status !== 'paid')
    .reduce((sum, item) => sum + parseAmount(item.amount), 0)

  const openPayable = filtered
    .filter(item => item.type === 'pagar' && item.status !== 'paid')
    .reduce((sum, item) => sum + parseAmount(item.amount), 0)

  const paidReceivable = filtered
    .filter(item => item.type === 'receber' && item.status === 'paid')
    .reduce((sum, item) => sum + parseAmount(item.amount), 0)

  const paidPayable = filtered
    .filter(item => item.type === 'pagar' && item.status === 'paid')
    .reduce((sum, item) => sum + parseAmount(item.amount), 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueCount = filtered.filter(item => {
    if (item.status === 'paid' || !item.dueDate) return false
    const due = new Date(item.dueDate)
    due.setHours(0, 0, 0, 0)
    return due < today
  }).length

  res.json({
    openReceivable,
    openPayable,
    paidReceivable,
    paidPayable,
    projectedBalance: openReceivable - openPayable,
    overdueCount
  })
})

router.get('/', async (req, res) => {
  await db.read()
  ensureStore()
  let list = (db.data.financeEntries || []).filter((item) => byOwner(item, req.user.id))
  const { type, status, search, startDate, endDate } = req.query

  if (type) list = list.filter(item => item.type === type)
  if (status) list = list.filter(item => item.status === status)

  if (search) {
    const q = String(search).toLowerCase()
    list = list.filter(item =>
      String(item.description || '').toLowerCase().includes(q) ||
      String(item.category || '').toLowerCase().includes(q) ||
      String(item.party || '').toLowerCase().includes(q)
    )
  }

  if (startDate) {
    const start = new Date(startDate)
    list = list.filter(item => !item.dueDate || new Date(item.dueDate) >= start)
  }

  if (endDate) {
    const end = new Date(endDate)
    list = list.filter(item => !item.dueDate || new Date(item.dueDate) <= end)
  }

  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  ensureStore()
  const { type, description, category, dueDate, amount, status, party, notes } = req.body

  if (!description) {
    return res.status(400).json({ error: 'description is required' })
  }

  if (!['receber', 'pagar'].includes(type)) {
    return res.status(400).json({ error: 'type must be receber or pagar' })
  }

  const parsedAmount = parseAmount(amount)
  if (parsedAmount <= 0) {
    return res.status(400).json({ error: 'amount must be greater than zero' })
  }

  const now = new Date().toISOString()
  const entry = {
    id: nanoid(),
    ownerId: req.user.id,
    type,
    description,
    category: category || '',
    dueDate: normalizeDate(dueDate),
    amount: parsedAmount,
    status: status === 'paid' ? 'paid' : 'open',
    party: party || '',
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
    paidAt: status === 'paid' ? now : null
  }

  db.data.financeEntries.push(entry)
  await db.write()
  res.status(201).json(entry)
})

router.put('/:id', async (req, res) => {
  await db.read()
  ensureStore()
  const idx = (db.data.financeEntries || []).findIndex((item) => item.id === req.params.id && byOwner(item, req.user.id))
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = db.data.financeEntries[idx]
  const merged = {
    ...current,
    ...req.body,
    ownerId: current.ownerId,
    amount: req.body.amount !== undefined ? parseAmount(req.body.amount) : current.amount,
    dueDate: req.body.dueDate !== undefined ? normalizeDate(req.body.dueDate) : current.dueDate,
    status: req.body.status === 'paid' ? 'paid' : (req.body.status === 'open' ? 'open' : current.status),
    updatedAt: new Date().toISOString()
  }

  if (merged.status === 'paid' && !merged.paidAt) {
    merged.paidAt = new Date().toISOString()
  }
  if (merged.status !== 'paid') {
    merged.paidAt = null
  }

  db.data.financeEntries[idx] = merged
  await db.write()
  res.json(merged)
})

router.patch('/:id/pay', async (req, res) => {
  await db.read()
  ensureStore()
  const idx = (db.data.financeEntries || []).findIndex((item) => item.id === req.params.id && byOwner(item, req.user.id))
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  db.data.financeEntries[idx] = {
    ...db.data.financeEntries[idx],
    status: 'paid',
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.write()
  res.json(db.data.financeEntries[idx])
})

router.delete('/:id', async (req, res) => {
  await db.read()
  ensureStore()
  const exists = (db.data.financeEntries || []).some((item) => item.id === req.params.id && byOwner(item, req.user.id))
  if (!exists) return res.status(404).json({ error: 'not found' })

  db.data.financeEntries = (db.data.financeEntries || []).filter((item) => !(item.id === req.params.id && byOwner(item, req.user.id)))
  await db.write()
  res.json({ ok: true })
})

module.exports = router

