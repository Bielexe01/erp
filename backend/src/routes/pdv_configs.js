const express = require('express')
const { nanoid } = require('nanoid')
const { db } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()
router.use(auth)

function ensureStore() {
  if (!db.data) db.data = {}
  if (!db.data.users) db.data.users = []
  if (!db.data.pdvConfigs) db.data.pdvConfigs = []
}

function byOwner(item, userId) {
  return item && item.ownerId === userId
}

function getOwnedConfigs(userId) {
  return (db.data.pdvConfigs || []).filter((cfg) => byOwner(cfg, userId))
}

function setOwnedConfigs(userId, ownedConfigs) {
  const others = (db.data.pdvConfigs || []).filter((cfg) => !byOwner(cfg, userId))
  db.data.pdvConfigs = [...others, ...ownedConfigs]
}

function normalizeConfig(input, current = null, ownerId = '') {
  const now = new Date().toISOString()
  const cfg = {
    id: current?.id || nanoid(),
    ownerId: current?.ownerId || ownerId,
    name: String(input.name ?? current?.name ?? '').trim(),
    represented: String(input.represented ?? current?.represented ?? '').trim(),
    priceTable: String(input.priceTable ?? current?.priceTable ?? '').trim(),
    nfeIssuer: String(input.nfeIssuer ?? current?.nfeIssuer ?? '').trim(),
    logoUrl: String(input.logoUrl ?? current?.logoUrl ?? '').trim(),
    textColor: String(input.textColor ?? current?.textColor ?? '#ffffff'),
    backgroundColor: String(input.backgroundColor ?? current?.backgroundColor ?? '#0081e9'),
    requireCpfAtStart: !!(input.requireCpfAtStart ?? current?.requireCpfAtStart),
    requireSellerAtStart: !!(input.requireSellerAtStart ?? current?.requireSellerAtStart),
    enableCharge: !!(input.enableCharge ?? current?.enableCharge),
    scaleEnabled: !!(input.scaleEnabled ?? current?.scaleEnabled),
    scalePort: String(input.scalePort ?? current?.scalePort ?? '').trim(),
    scaleModel: String(input.scaleModel ?? current?.scaleModel ?? '').trim(),
    printerType: String(input.printerType ?? current?.printerType ?? 'termica80').trim(),
    printerName: String(input.printerName ?? current?.printerName ?? '').trim(),
    printerCopies: Number.isFinite(Number(input.printerCopies))
      ? Math.max(1, Math.trunc(Number(input.printerCopies)))
      : (current?.printerCopies || 1),
    excluded: !!(input.excluded ?? current?.excluded),
    isDefault: !!(input.isDefault ?? current?.isDefault),
    updatedAt: now,
    createdAt: current?.createdAt || now
  }

  return cfg
}

function enforceDefault(list) {
  const normalized = list.map((cfg) => ({ ...cfg, isDefault: !!cfg.isDefault }))
  const active = normalized.filter((cfg) => cfg.excluded !== true)

  if (active.length === 0) {
    return normalized.map((cfg) => ({ ...cfg, isDefault: false }))
  }

  const chosen = active.find((cfg) => cfg.isDefault) || active[0]

  return normalized.map((cfg) => ({
    ...cfg,
    isDefault: cfg.id === chosen.id
  }))
}

router.get('/', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const includeExcluded = String(req.query.includeExcluded || '').toLowerCase() === 'true'
  const search = String(req.query.search || '').toLowerCase().trim()

  const owned = enforceDefault(getOwnedConfigs(userId))
  setOwnedConfigs(userId, owned)

  let list = [...owned]
  if (!includeExcluded) {
    list = list.filter((item) => item.excluded !== true)
  }

  if (search) {
    list = list.filter((item) =>
      String(item.name || '').toLowerCase().includes(search) ||
      String(item.represented || '').toLowerCase().includes(search) ||
      String(item.priceTable || '').toLowerCase().includes(search)
    )
  }

  list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
  await db.write()
  res.json(list)
})

router.post('/', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const owned = getOwnedConfigs(userId)
  const cfg = normalizeConfig(req.body, null, userId)
  if (!cfg.name) {
    return res.status(400).json({ error: 'name is required' })
  }

  owned.push(cfg)
  setOwnedConfigs(userId, enforceDefault(owned))

  await db.write()
  res.status(201).json((db.data.pdvConfigs || []).find((x) => x.id === cfg.id && byOwner(x, userId)))
})

router.put('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const owned = getOwnedConfigs(userId)
  const idx = owned.findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = owned[idx]
  const updated = normalizeConfig(req.body, current, userId)
  if (!updated.name) {
    return res.status(400).json({ error: 'name is required' })
  }

  owned[idx] = updated
  setOwnedConfigs(userId, enforceDefault(owned))

  await db.write()
  res.json((db.data.pdvConfigs || []).find((x) => x.id === updated.id && byOwner(x, userId)))
})

router.patch('/:id/default', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const owned = getOwnedConfigs(userId)
  const idx = owned.findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = owned[idx]
  if (current.excluded) {
    return res.status(400).json({ error: 'excluded config cannot be default' })
  }

  const updatedOwned = owned.map((cfg) => ({
    ...cfg,
    isDefault: cfg.id === req.params.id,
    updatedAt: cfg.id === req.params.id ? new Date().toISOString() : cfg.updatedAt
  }))

  setOwnedConfigs(userId, enforceDefault(updatedOwned))
  await db.write()

  res.json((db.data.pdvConfigs || []).find((x) => x.id === req.params.id && byOwner(x, userId)))
})

router.patch('/:id/excluded', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const owned = getOwnedConfigs(userId)
  const idx = owned.findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  const current = owned[idx]
  owned[idx] = {
    ...current,
    excluded: !!req.body.excluded,
    updatedAt: new Date().toISOString()
  }

  setOwnedConfigs(userId, enforceDefault(owned))
  await db.write()
  res.json((db.data.pdvConfigs || []).find((x) => x.id === req.params.id && byOwner(x, userId)))
})

router.delete('/:id', async (req, res) => {
  await db.read()
  ensureStore()

  const userId = req.user.id
  const owned = getOwnedConfigs(userId)
  const exists = owned.some((x) => x.id === req.params.id)
  if (!exists) return res.status(404).json({ error: 'not found' })

  const filteredOwned = owned.filter((x) => x.id !== req.params.id)
  setOwnedConfigs(userId, enforceDefault(filteredOwned))

  await db.write()
  res.json({ ok: true })
})

module.exports = router
