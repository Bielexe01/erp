const express = require('express')
const router = express.Router()
const prisma = require('../prismaClient')
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
  return (items || []).reduce((sum, it) => sum + toNumber(it.price, 0) * toNumber(it.quantity, 0), 0)
}

function normalizeStatus(value, fallback = 'completed') {
  const allowed = ['open', 'completed', 'canceled']
  if (allowed.includes(value)) return value
  return fallback
}

function mapQuantity(items) {
  const out = {}
  for (const item of items || []) {
    const productId = item.productId
    out[productId] = (out[productId] || 0) + toNumber(item.quantity, 0)
  }
  return out
}

async function ensureOwnedCustomer(ownerId, customerId) {
  if (!customerId) return true
  const customer = await prisma.customer.findFirst({ where: { id: customerId, ownerId } })
  return !!customer
}

async function ensureOwnedProducts(ownerId, items) {
  const productIds = [...new Set((items || []).map((item) => item.productId).filter(Boolean))]
  if (productIds.length === 0) return true

  const ownedProducts = await prisma.product.findMany({
    where: { ownerId, id: { in: productIds } },
    select: { id: true }
  })
  return ownedProducts.length === productIds.length
}

async function applyStockDiff(tx, ownerId, previousItems, previousStatus, nextItems, nextStatus) {
  const prevMap = previousStatus === 'completed' ? mapQuantity(previousItems) : {}
  const nextMap = nextStatus === 'completed' ? mapQuantity(nextItems) : {}
  const productIds = new Set([...Object.keys(prevMap), ...Object.keys(nextMap)])

  for (const productId of productIds) {
    const diff = toNumber(nextMap[productId], 0) - toNumber(prevMap[productId], 0)
    if (diff > 0) {
      const changed = await tx.product.updateMany({
        where: { id: productId, ownerId },
        data: { estoque: { decrement: diff } }
      })
      if (changed.count === 0) throw new Error(`product not found: ${productId}`)
    } else if (diff < 0) {
      const changed = await tx.product.updateMany({
        where: { id: productId, ownerId },
        data: { estoque: { increment: Math.abs(diff) } }
      })
      if (changed.count === 0) throw new Error(`product not found: ${productId}`)
    }
  }
}

router.get('/', async (req, res) => {
  const ownerId = req.user.id
  const statusFilter = String(req.query.status || '')
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true'
  const search = String(req.query.search || '').trim()

  const where = { ownerId }

  if (statusFilter) {
    where.status = normalizeStatus(statusFilter, '')
  } else if (!includeDeleted) {
    where.status = { not: 'canceled' }
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { customerId: { contains: search, mode: 'insensitive' } },
      { cashierId: { contains: search, mode: 'insensitive' } },
      { paymentMethod: { contains: search, mode: 'insensitive' } }
    ]
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true, payments: true },
    orderBy: { createdAt: 'desc' }
  })

  res.json(orders)
})

router.get('/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
    include: { items: true, payments: true }
  })

  if (!order) return res.status(404).json({ error: 'not found' })
  res.json(order)
})

router.post('/', async (req, res) => {
  const ownerId = req.user.id
  const { customerId, paymentMethod, paymentAmount, discount, cashierId } = req.body
  const items = normalizeItems(req.body.items)
  if (items.length === 0) {
    return res.status(400).json({ error: 'items are required' })
  }

  const status = normalizeStatus(req.body.status, 'completed')

  if (!(await ensureOwnedCustomer(ownerId, customerId))) {
    return res.status(400).json({ error: 'customer not found' })
  }

  if (!(await ensureOwnedProducts(ownerId, items))) {
    return res.status(400).json({ error: 'one or more products not found' })
  }

  const created = await prisma.$transaction(async (tx) => {
    const total = calcSubtotal(items)
    const disc = toNumber(discount, 0)
    const paid = paymentAmount !== undefined ? toNumber(paymentAmount, 0) : Math.max(0, total - disc)

    const order = await tx.order.create({
      data: {
        ownerId,
        customerId: customerId || null,
        total,
        discount: disc,
        paymentMethod: paymentMethod || null,
        paymentAmount: paid,
        cashierId: cashierId || null,
        status
      }
    })

    for (const item of items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }
      })

      if (status === 'completed') {
        const changed = await tx.product.updateMany({
          where: { id: item.productId, ownerId },
          data: { estoque: { decrement: item.quantity } }
        })
        if (changed.count === 0) throw new Error(`product not found: ${item.productId}`)
      }
    }

    await tx.payment.deleteMany({ where: { orderId: order.id } })
    if (paymentMethod) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          amount: paid
        }
      })
    }

    return tx.order.findUnique({ where: { id: order.id }, include: { items: true, payments: true } })
  })

  res.status(201).json(created)
})

router.put('/:id', async (req, res) => {
  const ownerId = req.user.id
  const id = req.params.id
  const { customerId, paymentMethod, paymentAmount, discount, status, cashierId } = req.body
  const nextItemsInput = req.body.items !== undefined ? normalizeItems(req.body.items) : null

  if (customerId !== undefined && !(await ensureOwnedCustomer(ownerId, customerId))) {
    return res.status(400).json({ error: 'customer not found' })
  }

  if (nextItemsInput && !(await ensureOwnedProducts(ownerId, nextItemsInput))) {
    return res.status(400).json({ error: 'one or more products not found' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true } })
    if (!current) return null

    const currentItems = (current.items || []).map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity, 0),
      price: toNumber(item.price, 0)
    }))

    const nextItems = nextItemsInput || currentItems
    const nextStatus = status !== undefined
      ? normalizeStatus(status, current.status || 'completed')
      : current.status

    await applyStockDiff(tx, ownerId, currentItems, current.status, nextItems, nextStatus)

    if (nextItemsInput) {
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      for (const item of nextItems) {
        await tx.orderItem.create({
          data: {
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }
        })
      }
    }

    const total = calcSubtotal(nextItems)
    const disc = discount !== undefined ? toNumber(discount, 0) : toNumber(current.discount, 0)
    const paid = paymentAmount !== undefined ? toNumber(paymentAmount, 0) : Math.max(0, total - disc)

    await tx.order.update({
      where: { id },
      data: {
        customerId: customerId !== undefined ? (customerId || null) : current.customerId,
        total,
        discount: disc,
        paymentMethod: paymentMethod !== undefined ? (paymentMethod || null) : current.paymentMethod,
        paymentAmount: paid,
        status: nextStatus,
        cashierId: cashierId !== undefined ? (cashierId || null) : current.cashierId
      }
    })

    await tx.payment.deleteMany({ where: { orderId: id } })
    const finalPaymentMethod = paymentMethod !== undefined ? paymentMethod : current.paymentMethod
    if (finalPaymentMethod) {
      await tx.payment.create({
        data: {
          orderId: id,
          method: finalPaymentMethod,
          amount: paid
        }
      })
    }

    return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } })
  })

  if (!updated) return res.status(404).json({ error: 'not found' })
  res.json(updated)
})

router.patch('/:id/status', async (req, res) => {
  const ownerId = req.user.id
  const id = req.params.id
  const status = normalizeStatus(req.body.status, 'completed')

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true } })
    if (!current) return null

    const currentItems = (current.items || []).map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity, 0),
      price: toNumber(item.price, 0)
    }))

    await applyStockDiff(tx, ownerId, currentItems, current.status, currentItems, status)
    await tx.order.update({ where: { id }, data: { status } })

    return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } })
  })

  if (!updated) return res.status(404).json({ error: 'not found' })
  res.json(updated)
})

router.patch('/:id/restore', async (req, res) => {
  const ownerId = req.user.id
  const id = req.params.id

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true } })
    if (!current) return null

    const targetStatus = current.status === 'canceled' ? 'completed' : current.status
    const currentItems = (current.items || []).map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity, 0),
      price: toNumber(item.price, 0)
    }))

    await applyStockDiff(tx, ownerId, currentItems, current.status, currentItems, targetStatus)
    await tx.order.update({ where: { id }, data: { status: targetStatus } })

    return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } })
  })

  if (!updated) return res.status(404).json({ error: 'not found' })
  res.json(updated)
})

router.post('/:id/duplicate', async (req, res) => {
  const ownerId = req.user.id
  const id = req.params.id

  const duplicated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true, payments: true } })
    if (!current) return null

    const order = await tx.order.create({
      data: {
        ownerId: current.ownerId,
        customerId: current.customerId || null,
        total: toNumber(current.total, 0),
        discount: toNumber(current.discount, 0),
        paymentMethod: current.paymentMethod || null,
        paymentAmount: toNumber(current.paymentAmount, 0),
        status: 'open',
        cashierId: current.cashierId || null
      }
    })

    for (const item of current.items || []) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: toNumber(item.quantity, 0),
          price: toNumber(item.price, 0)
        }
      })
    }

    return tx.order.findUnique({ where: { id: order.id }, include: { items: true, payments: true } })
  })

  if (!duplicated) return res.status(404).json({ error: 'not found' })
  res.status(201).json(duplicated)
})

router.delete('/:id', async (req, res) => {
  const ownerId = req.user.id
  const id = req.params.id
  const hardDelete = String(req.query.hard || '').toLowerCase() === 'true'

  if (hardDelete) {
    const removed = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true } })
      if (!current) return false

      const currentItems = (current.items || []).map((item) => ({
        productId: item.productId,
        quantity: toNumber(item.quantity, 0),
        price: toNumber(item.price, 0)
      }))

      await applyStockDiff(tx, ownerId, currentItems, current.status, [], 'canceled')
      await tx.payment.deleteMany({ where: { orderId: id } })
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
      return true
    })

    if (!removed) return res.status(404).json({ error: 'not found' })
    return res.json({ ok: true, hard: true })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where: { id, ownerId }, include: { items: true } })
    if (!current) return null

    const currentItems = (current.items || []).map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity, 0),
      price: toNumber(item.price, 0)
    }))

    await applyStockDiff(tx, ownerId, currentItems, current.status, currentItems, 'canceled')
    await tx.order.update({ where: { id }, data: { status: 'canceled' } })

    return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } })
  })

  if (!updated) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true, hard: false, order: updated })
})

module.exports = router
