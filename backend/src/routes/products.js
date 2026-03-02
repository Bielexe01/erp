const express = require('express')
const router = express.Router()
const { db } = require('../db')
const auth = require('../middleware/auth')
const { nanoid } = require('nanoid')

router.use(auth)

router.get('/', async (req, res) => {
  await db.read()
  res.json(db.data.products)
})

router.post('/', async (req, res) => {
  await db.read()
  const p = { id: nanoid(), ...req.body }
  db.data.products.push(p)
  await db.write()
  res.json(p)
})

router.put('/:id', async (req, res) => {
  await db.read()
  const idx = db.data.products.findIndex(x => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  db.data.products[idx] = { ...db.data.products[idx], ...req.body }
  await db.write()
  res.json(db.data.products[idx])
})

router.delete('/:id', async (req, res) => {
  await db.read()
  db.data.products = db.data.products.filter(x => x.id !== req.params.id)
  await db.write()
  res.json({ ok: true })
})

module.exports = router
