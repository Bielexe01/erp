const express = require('express')
const router = express.Router()
const prisma = require('../prismaClient')

router.get('/', async (req, res) => {
  const customers = await prisma.customer.findMany()
  res.json(customers)
})

router.post('/', async (req, res) => {
  const { name, email, phone } = req.body
  const c = await prisma.customer.create({ data: { name, email, phone } })
  res.json(c)
})

router.put('/:id', async (req, res) => {
  const id = req.params.id
  const data = req.body
  const updated = await prisma.customer.update({ where: { id }, data })
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const id = req.params.id
  await prisma.customer.delete({ where: { id } })
  res.json({ ok: true })
})

module.exports = router
