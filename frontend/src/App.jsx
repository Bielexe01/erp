import React, { Suspense, lazy } from 'react'
import { Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import DashboardNew from './pages/DashboardNew'
import Products from './pages/Products'
import PDV from './pages/PDV'

const Customers = lazy(() => import('./pages/Customers'))
const Orders = lazy(() => import('./pages/Orders'))
const SalesHistory = lazy(() => import('./pages/SalesHistory'))
const ReportSales = lazy(() => import('./pages/ReportSales'))
const Finance = lazy(() => import('./pages/Finance'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Employees = lazy(() => import('./pages/Employees'))
const PDVConfig = lazy(() => import('./pages/PDVConfig'))

function MenuLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
    >
      <span className="menu-glyph" aria-hidden="true">▣</span>
      <span>{label}</span>
    </NavLink>
  )
}

function MenuStatic({ label }) {
  return (
    <button type="button" className="menu-link menu-link-static" disabled>
      <span className="menu-glyph" aria-hidden="true">▢</span>
      <span>{label}</span>
    </button>
  )
}

function App() {
  const token = localStorage.getItem('pdv_token')
  let sessionUser = null
  try {
    sessionUser = JSON.parse(localStorage.getItem('pdv_user') || 'null')
  } catch (_) {
    sessionUser = null
  }

  const navigate = useNavigate()
  const location = useLocation()

  function logout() {
    localStorage.removeItem('pdv_token')
    localStorage.removeItem('pdv_user')
    navigate('/login')
  }

  const currentModule = {
    '/': 'Dashboard',
    '/report': 'Relatorios',
    '/products': 'Produtos',
    '/suppliers': 'Fornecedores',
    '/purchases': 'Compras',
    '/employees': 'Vendedores',
    '/customers': 'Clientes',
    '/orders': 'Pedidos',
    '/pdv-config': 'Configuracao Frente de Caixa',
    '/pdv': 'Frente de Caixa',
    '/sales': 'Historico',
    '/finance': 'Financas'
  }[location.pathname] || 'Frente de Caixa'

  if (!token) {
    return (
      <div className="app">
        <nav className="auth-nav">
          <Link to="/login">Login</Link>
          <Link to="/register">Registrar</Link>
        </nav>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className="erp-shell">
      <header className="erp-topbar">
        <div className="topbar-left">
          <div className="brand-name">Sistema ERP</div>
          <div className="module-name">{currentModule}</div>
        </div>
        <div className="topbar-right">
          <div className="top-pill">Operacao online</div>
          <div className="top-pill">Sincronizacao ativa</div>
          <div className="top-user">{sessionUser?.companyName || sessionUser?.username || 'Usuario autenticado'}</div>
          <button type="button" className="top-logout" onClick={logout}>Sair</button>
        </div>
      </header>

      <div className="erp-body">
        <aside className="erp-sidebar">
          <div className="erp-sidebar-scroll">
            <MenuLink to="/" label="Dashboard" />
            <MenuLink to="/orders" label="Pedidos" />
            <MenuStatic label="Conferencia de pedidos" />

            <div className="menu-section">PDV</div>
            <MenuLink to="/pdv-config" label="Configuracao Frente de Caixa" />
            <MenuLink to="/pdv" label="Frente de Caixa" />

            <MenuStatic label="Nota Fiscal" />
            <MenuLink to="/customers" label="Clientes" />
            <MenuLink to="/products" label="Produtos" />
            <MenuLink to="/suppliers" label="Fornecedores" />
            <MenuStatic label="Tabela de precos" />
            <MenuLink to="/purchases" label="Compras" />
            <MenuStatic label="Cond. de pagamento" />
            <MenuLink to="/finance" label="Financas" />
            <MenuStatic label="Agendas (CRM)" />
            <MenuStatic label="Transportadoras" />
            <MenuStatic label="Empresas/Representadas" />
            <MenuLink to="/employees" label="Vendedores" />
            <MenuStatic label="Equipes de vendas" />
            <MenuStatic label="Metas" />
            <MenuLink to="/report" label="Relatorios" />
            <MenuStatic label="Importacoes" />
            <MenuStatic label="Marketplaces" />
            <MenuStatic label="E-commerce/Catalogo" />
            <MenuLink to="/sales" label="Historico de vendas" />
          </div>
        </aside>

        <main className="erp-content">
          <Routes>
            <Route path="/" element={<DashboardNew />} />
            <Route path="/report" element={<Suspense fallback={<div>Carregando...</div>}><ReportSales /></Suspense>} />
            <Route path="/products" element={<Products />} />
            <Route path="/suppliers" element={<Suspense fallback={<div>Carregando...</div>}><Suppliers /></Suspense>} />
            <Route path="/purchases" element={<Suspense fallback={<div>Carregando...</div>}><Purchases /></Suspense>} />
            <Route path="/employees" element={<Suspense fallback={<div>Carregando...</div>}><Employees /></Suspense>} />
            <Route path="/pdv-config" element={<Suspense fallback={<div>Carregando...</div>}><PDVConfig /></Suspense>} />
            <Route path="/pdv" element={<PDV />} />
            <Route path="/customers" element={<Suspense fallback={<div>Carregando...</div>}><Customers /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<div>Carregando...</div>}><Orders /></Suspense>} />
            <Route path="/sales" element={<Suspense fallback={<div>Carregando...</div>}><SalesHistory /></Suspense>} />
            <Route path="/finance" element={<Suspense fallback={<div>Carregando...</div>}><Finance /></Suspense>} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="/register" element={<Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
