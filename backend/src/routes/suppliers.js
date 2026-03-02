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

router.get('/', async (req, res) => {
  await db.read()
  ensureStore()

  const q = String(req.query.search || '').toLowerCase()
  let list = db.data.suppliers

  if (q) {
    list = list.filter(s =>
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.document || '').toLowerCase().includes(q) ||
      String(s.email || '').toLowerCase().includes(q) ||
      String(s.phone || '').toLowerCase().includes(q)
    )
  }

  list = list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  ensureStore()

  const { name, document, email, phone, contact, notes } = req.body

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const supplier = {
    id: nanoid(),
    name: String(name).trim(),
    document: String(document || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    contact: String(contact || '').trim(),
    notes: String(notes || '').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  db.data.suppliers.push(supplier)
  await db.write()
  res.status(201).json(supplier)
})

router.put('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  const idx = db.data.suppliers.findIndex(s => s.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = db.data.suppliers[idx]
  const updated = {
    ...current,
    ...req.body,
    name: String(req.body.name ?? current.name ?? '').trim(),
    document: String(req.body.document ?? current.document ?? '').trim(),
    email: String(req.body.email ?? current.email ?? '').trim(),
    phone: String(req.body.phone ?? current.phone ?? '').trim(),
    contact: String(req.body.contact ?? current.contact ?? '').trim(),
    notes: String(req.body.notes ?? current.notes ?? '').trim(),
    updatedAt: new Date().toISOString()
  }

  if (!updated.name) {
    return res.status(400).json({ error: 'name is required' })
  }

  db.data.suppliers[idx] = updated
  await db.write()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  const supplierId = req.params.id
  const used = (db.data.purchases || []).some(p => p.supplierId === supplierId)
  if (used) {
    return res.status(400).json({ error: 'supplier has purchases and cannot be removed' })
  }

  db.data.suppliers = db.data.suppliers.filter(s => s.id !== supplierId)
  await db.write()
  res.json({ ok: true })
})

module.exports = router
