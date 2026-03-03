const express = require('express')
const router = express.Router()
const { db } = require('../db')
const auth = require('../middleware/auth')
const { nanoid } = require('nanoid')

router.use(auth)

function byOwner(item, userId) {
  return item && item.ownerId === userId
}

router.get('/', async (req, res) => {
  await db.read()
  const userId = req.user.id
  const list = (db.data.products || []).filter((item) => byOwner(item, userId))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  const p = {
    id: nanoid(),
    ...req.body,
    ownerId: req.user.id,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.data.products.push(p)
  await db.write()
  res.json(p)
})

router.put('/:id', async (req, res) => {
  await db.read()
  const idx = (db.data.products || []).findIndex((x) => x.id === req.params.id && byOwner(x, req.user.id))
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  db.data.products[idx] = {
    ...db.data.products[idx],
    ...req.body,
    ownerId: db.data.products[idx].ownerId,
    updatedAt: new Date().toISOString()
  }
  await db.write()
  res.json(db.data.products[idx])
})

router.delete('/:id', async (req, res) => {
  await db.read()
  const exists = (db.data.products || []).some((x) => x.id === req.params.id && byOwner(x, req.user.id))
  if (!exists) return res.status(404).json({ error: 'not found' })

  db.data.products = (db.data.products || []).filter((x) => !(x.id === req.params.id && byOwner(x, req.user.id)))
  await db.write()
  res.json({ ok: true })
})

module.exports = router
