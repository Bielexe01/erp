const express = require('express')
const router = express.Router()
const { db } = require('../db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { nanoid } = require('nanoid')

const SECRET = process.env.JWT_SECRET || 'dev_secret'

router.post('/register', async (req, res) => {
  await db.read()
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'username/password required' })
  if (db.data.users.find(u => u.username === username)) return res.status(400).json({ error: 'user exists' })
  const hash = bcrypt.hashSync(password, 8)
  const user = { id: nanoid(), username, passwordHash: hash }
  db.data.users.push(user)
  await db.write()
  res.json({ id: user.id, username: user.username })
})

router.post('/login', async (req, res) => {
  await db.read()
  const { username, password } = req.body
  const user = db.data.users.find(u => u.username === username)
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  const ok = bcrypt.compareSync(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: '8h' })
  res.json({ token })
})

// protected endpoint to get current user
const auth = require('../middleware/auth')
router.get('/me', auth, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

module.exports = router
