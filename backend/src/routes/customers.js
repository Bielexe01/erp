const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { nanoid } = require('nanoid')
const auth = require('../middleware/auth')

router.use(auth)

function byOwner(item, userId) {
  return item && item.ownerId === userId
}

router.get('/', async (req, res) => {
  await db.read()
  const list = (db.data.customers || []).filter((item) => byOwner(item, req.user.id))
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  const c = {
    id: nanoid(),
    ...req.body,
    ownerId: req.user.id,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.data.customers.push(c)
  await db.write()
  res.json(c)
})

router.put('/:id', async (req, res) => {
  await db.read()
  const idx = (db.data.customers || []).findIndex((x) => x.id === req.params.id && byOwner(x, req.user.id))
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  db.data.customers[idx] = {
    ...db.data.customers[idx],
    ...req.body,
    ownerId: db.data.customers[idx].ownerId,
    updatedAt: new Date().toISOString()
  }
  await db.write()
  res.json(db.data.customers[idx])
})

router.delete('/:id', async (req, res) => {
  await db.read()
  const exists = (db.data.customers || []).some((x) => x.id === req.params.id && byOwner(x, req.user.id))
  if (!exists) return res.status(404).json({ error: 'not found' })

  db.data.customers = (db.data.customers || []).filter((x) => !(x.id === req.params.id && byOwner(x, req.user.id)))
  await db.write()
  res.json({ ok: true })
})

module.exports = router
