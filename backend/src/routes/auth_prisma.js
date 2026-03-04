const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const prisma = require('../prismaClient')

const SECRET = process.env.JWT_SECRET || 'dev_secret'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

router.post('/register', async (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')
  const companyName = String(req.body.companyName || '').trim()
  const companyCnpj = onlyDigits(req.body.companyCnpj)

  if (!username || !password) return res.status(400).json({ error: 'username/password required' })
  if (!companyName) return res.status(400).json({ error: 'companyName required' })
  if (companyCnpj.length !== 14) return res.status(400).json({ error: 'invalid cnpj' })

  try {
    const passwordHash = bcrypt.hashSync(password, 8)
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        companyName,
        companyCnpj
      }
    })

    return res.json({
      id: user.id,
      username: user.username,
      companyName: user.companyName || '',
      companyCnpj: user.companyCnpj || ''
    })
  } catch (err) {
    if (err && err.code === 'P2002') return res.status(400).json({ error: 'user exists' })
    console.error(err)
    return res.status(500).json({ error: 'failed to register user' })
  }
})

router.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })

  const ok = bcrypt.compareSync(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })

  const payload = {
    sub: user.id,
    username: user.username,
    companyName: user.companyName || '',
    companyCnpj: user.companyCnpj || ''
  }

  const token = jwt.sign(payload, SECRET, { expiresIn: '8h' })
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      companyName: user.companyName || '',
      companyCnpj: user.companyCnpj || ''
    }
  })
})

const auth = require('../middleware/auth')
router.get('/me', auth, async (req, res) => {
  return res.json({
    id: req.user.id,
    username: req.user.username,
    companyName: req.user.companyName || '',
    companyCnpj: req.user.companyCnpj || ''
  })
})

module.exports = router

