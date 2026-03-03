const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const auth = require('../middleware/auth')

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const safeOwnerId = String(req.user?.id || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_')
    const userDir = path.join(uploadsDir, safeOwnerId)
    fs.mkdirSync(userDir, { recursive: true })
    cb(null, userDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    const name = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')
    cb(null, name)
  }
})

const upload = multer({ storage })

router.use(auth)

router.post('/', upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).json({ error: 'No file' })
  const safeOwnerId = String(req.user?.id || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_')
  const relative = `/uploads/${safeOwnerId}/${req.file.filename}`
  res.json({ url: relative })
})

module.exports = router
