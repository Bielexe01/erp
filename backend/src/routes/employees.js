const express = require('express')
const { nanoid } = require('nanoid')
const { db } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

router.use(auth)

function ensureStore() {
  if (!db.data) db.data = {}
  if (!db.data.users) db.data.users = []
  if (!db.data.employees) db.data.employees = []
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

router.get('/', async (req, res) => {
  await db.read()
  ensureStore()

  const search = String(req.query.search || '').toLowerCase()
  let list = db.data.employees || []

  if (search) {
    list = list.filter(emp =>
      String(emp.name || '').toLowerCase().includes(search) ||
      String(emp.role || '').toLowerCase().includes(search) ||
      String(emp.phone || '').toLowerCase().includes(search)
    )
  }

  list = list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  ensureStore()

  const { name, role, hireDate, salary, phone, address, birthDate } = req.body

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const employee = {
    id: nanoid(),
    name: String(name).trim(),
    role: String(role || '').trim(),
    hireDate: normalizeDate(hireDate),
    salary: toNumber(salary),
    phone: String(phone || '').trim(),
    address: String(address || '').trim(),
    birthDate: normalizeDate(birthDate),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  db.data.employees.push(employee)
  await db.write()
  res.status(201).json(employee)
})

router.put('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  const idx = db.data.employees.findIndex(emp => emp.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = db.data.employees[idx]
  const updated = {
    ...current,
    ...req.body,
    name: String(req.body.name ?? current.name ?? '').trim(),
    role: String(req.body.role ?? current.role ?? '').trim(),
    hireDate: req.body.hireDate !== undefined ? normalizeDate(req.body.hireDate) : current.hireDate,
    salary: req.body.salary !== undefined ? toNumber(req.body.salary) : current.salary,
    phone: String(req.body.phone ?? current.phone ?? '').trim(),
    address: String(req.body.address ?? current.address ?? '').trim(),
    birthDate: req.body.birthDate !== undefined ? normalizeDate(req.body.birthDate) : current.birthDate,
    updatedAt: new Date().toISOString()
  }

  if (!updated.name) {
    return res.status(400).json({ error: 'name is required' })
  }

  db.data.employees[idx] = updated
  await db.write()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  db.data.employees = db.data.employees.filter(emp => emp.id !== req.params.id)
  await db.write()
  res.json({ ok: true })
})

module.exports = router
