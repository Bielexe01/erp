const jwt = require('jsonwebtoken')
const { db } = require('../db')

const SECRET = process.env.JWT_SECRET || 'dev_secret'

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing token' })
  const token = parts[1]
  try {
    const payload = jwt.verify(token, SECRET)
    await db.read()
    const user = db.data.users.find(u => u.id === payload.sub)
    if (!user) return res.status(401).json({ error: 'invalid token' })
    req.user = { id: user.id, username: user.username }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
}
