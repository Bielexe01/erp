const express = require('express')
const router = express.Router()
const { db } = require('../db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { nanoid } = require('nanoid')

const SECRET = process.env.JWT_SECRET || 'dev_secret'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

router.post('/register', async (req, res) => {
  await db.read()
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')
  const companyName = String(req.body.companyName || '').trim()
  const companyCnpj = onlyDigits(req.body.companyCnpj)

  if (!username || !password) return res.status(400).json({ error: 'username/password required' })
  if (!companyName) return res.status(400).json({ error: 'companyName required' })
  if (companyCnpj.length !== 14) return res.status(400).json({ error: 'invalid cnpj' })
  if (db.data.users.find(u => u.username === username)) return res.status(400).json({ error: 'user exists' })

  const hash = bcrypt.hashSync(password, 8)
  const user = { id: nanoid(), username, passwordHash: hash, companyName, companyCnpj }
  db.data.users.push(user)
  await db.write()
  res.json({
    id: user.id,
    username: user.username,
    companyName: user.companyName,
    companyCnpj: user.companyCnpj
  })
})

router.post('/login', async (req, res) => {
  await db.read()
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')
  const user = db.data.users.find(u => u.username === username)
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

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      companyName: user.companyName || '',
      companyCnpj: user.companyCnpj || ''
    }
  })
})

// protected endpoint to get current user
const auth = require('../middleware/auth')
router.get('/me', auth, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    companyName: req.user.companyName || '',
    companyCnpj: req.user.companyCnpj || ''
  })
})

module.exports = router
