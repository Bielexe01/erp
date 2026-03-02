const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { nanoid } = require('nanoid')
const auth = require('../middleware/auth')

router.use(auth)

router.get('/', async (req, res) => {
  await db.read()
  res.json(db.data.customers)
})

router.post('/', async (req, res) => {
  await db.read()
  const c = { id: nanoid(), ...req.body }
  db.data.customers.push(c)
  await db.write()
  res.json(c)
})

router.put('/:id', async (req, res) => {
  await db.read()
  const idx = db.data.customers.findIndex(x => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  db.data.customers[idx] = { ...db.data.customers[idx], ...req.body }
  await db.write()
  res.json(db.data.customers[idx])
})

router.delete('/:id', async (req, res) => {
  await db.read()
  db.data.customers = db.data.customers.filter(x => x.id !== req.params.id)
  await db.write()
  res.json({ ok: true })
})

module.exports = router
