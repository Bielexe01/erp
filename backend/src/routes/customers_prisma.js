const express = require('express')
const router = express.Router()
const prisma = require('../prismaClient')
const auth = require('../middleware/auth')

router.use(auth)

router.get('/', async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' }
  })
  res.json(customers)
})

router.post('/', async (req, res) => {
  const { name, email, phone } = req.body
  const c = await prisma.customer.create({ data: { ownerId: req.user.id, name, email, phone } })
  res.json(c)
})

router.put('/:id', async (req, res) => {
  const id = req.params.id
  const data = { ...req.body }
  delete data.ownerId

  const current = await prisma.customer.findFirst({ where: { id, ownerId: req.user.id } })
  if (!current) return res.status(404).json({ error: 'not found' })

  const updated = await prisma.customer.update({ where: { id }, data })
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const id = req.params.id
  const current = await prisma.customer.findFirst({ where: { id, ownerId: req.user.id } })
  if (!current) return res.status(404).json({ error: 'not found' })

  await prisma.customer.delete({ where: { id } })
  res.json({ ok: true })
})

module.exports = router
