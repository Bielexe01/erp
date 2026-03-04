const jwt = require('jsonwebtoken')
const { db } = require('../db')
let prisma = null
if (process.env.DATABASE_URL) {
  prisma = require('../prismaClient')
}

const SECRET = process.env.JWT_SECRET || 'dev_secret'

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing token' })
  const token = parts[1]
  try {
    const payload = jwt.verify(token, SECRET)

    // Prefer Prisma-backed users whenever DATABASE_URL is configured.
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) return res.status(401).json({ error: 'invalid token' })
      req.user = {
        id: user.id,
        username: user.username,
        companyName: user.companyName || '',
        companyCnpj: user.companyCnpj || ''
      }
      return next()
    }

    await db.read()
    const user = db.data.users.find(u => u.id === payload.sub)
    if (!user) return res.status(401).json({ error: 'invalid token' })
    req.user = {
      id: user.id,
      username: user.username,
      companyName: user.companyName || '',
      companyCnpj: user.companyCnpj || ''
    }
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
}
