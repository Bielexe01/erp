const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    const name = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')
    cb(null, name)
  }
})

const upload = multer({ storage })

router.post('/', upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).json({ error: 'No file' })
  const relative = `/uploads/${req.file.filename}`
  res.json({ url: relative })
})

module.exports = router
