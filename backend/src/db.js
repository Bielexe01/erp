const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const path = require('path')

const file = path.join(__dirname, 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter, {
  users: [],
  employees: [],
  products: [],
  customers: [],
  orders: [],
  financeEntries: [],
  suppliers: [],
  purchases: [],
  pdvConfigs: []
})

async function init() {
  await db.read()

  // Ensure there is a default admin user with a hashed password
  const bcrypt = require('bcryptjs')
  const defaultUsername = 'admin'
  const defaultPassword = 'admin'

  if (!db.data.users) db.data.users = []
  if (!db.data.employees) db.data.employees = []
  if (!db.data.products) db.data.products = []
  if (!db.data.customers) db.data.customers = []
  if (!db.data.orders) db.data.orders = []
  if (!db.data.financeEntries) db.data.financeEntries = []
  if (!db.data.suppliers) db.data.suppliers = []
  if (!db.data.purchases) db.data.purchases = []
  if (!db.data.pdvConfigs) db.data.pdvConfigs = []
  let admin = db.data.users.find(u => u.username === defaultUsername)
  if (!admin) {
    const hash = bcrypt.hashSync(defaultPassword, 8)
    admin = {
      id: 'admin',
      username: defaultUsername,
      passwordHash: hash,
      companyName: 'Atacado e Cia',
      companyCnpj: '00000000000000'
    }
    db.data.users.push(admin)
  } else if (!admin.passwordHash) {
    admin.passwordHash = bcrypt.hashSync(defaultPassword, 8)
  }

  if (!admin.companyName) admin.companyName = 'Atacado e Cia'
  if (!admin.companyCnpj) admin.companyCnpj = '00000000000000'

  const ownerCollections = [
    'employees',
    'products',
    'customers',
    'orders',
    'financeEntries',
    'suppliers',
    'purchases',
    'pdvConfigs'
  ]

  for (const key of ownerCollections) {
    db.data[key] = (db.data[key] || []).map((item) => ({
      ...item,
      ownerId: item.ownerId || 'admin'
    }))
  }

  await db.write()
}

module.exports = { db, init }
