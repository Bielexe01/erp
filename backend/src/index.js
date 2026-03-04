require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const { init } = require('./db')

let authRoutes = require('./routes/auth')
const path = require('path')
const fs = require('fs')

// serve public uploads
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })


// If DATABASE_URL is set use Prisma routes, otherwise fallback to lowdb routes
let productsRoutes = require('./routes/products')
let customersRoutes = require('./routes/customers')
let ordersRoutes = require('./routes/orders')
let financeRoutes = require('./routes/finance')
let employeesRoutes = require('./routes/employees')
let suppliersRoutes = require('./routes/suppliers')
let purchasesRoutes = require('./routes/purchases')
let pdvConfigsRoutes = require('./routes/pdv_configs')
if (process.env.DATABASE_URL) {
  authRoutes = require('./routes/auth_prisma')
  productsRoutes = require('./routes/products_prisma')
  customersRoutes = require('./routes/customers_prisma')
  ordersRoutes = require('./routes/orders_prisma')
}

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.use('/api/auth', authRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/customers', customersRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/finance', financeRoutes)
app.use('/api/employees', employeesRoutes)
app.use('/api/suppliers', suppliersRoutes)
app.use('/api/purchases', purchasesRoutes)
app.use('/api/pdv-configs', pdvConfigsRoutes)

// static files for uploaded images
app.use('/uploads', express.static( path.join(__dirname, '..', 'public', 'uploads') ))

// upload route
const uploadRoutes = require('./routes/uploads')
app.use('/api/upload', uploadRoutes)

const PORT = process.env.PORT || 5000

async function start(){
  // initialize lowdb store used by auth and fallback routes
  await init()
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
}

start()
