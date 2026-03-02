import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeHex(color, fallback = '#0f4ccf') {
  const c = String(color || '').trim().replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(c)) return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase()
  return fallback
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

function shadeHex(hex, percent) {
  const { r, g, b } = hexToRgb(hex)
  const p = Math.max(-100, Math.min(100, Number(percent) || 0))

  const apply = (v) => {
    if (p >= 0) {
      return Math.round(v + ((255 - v) * p) / 100)
    }
    return Math.round(v * (1 + p / 100))
  }

  const toHex = (v) => apply(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function toRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildTheme(config) {
  const base = normalizeHex(config?.backgroundColor || '#0f4ccf')
  const text = normalizeHex(config?.textColor || '#e8f1ff', '#e8f1ff')

  return {
    text,
    mutedText: toRgba(text, 0.72),
    border: toRgba(base, 0.52),
    pageBg: `linear-gradient(160deg, ${shadeHex(base, -82)} 0%, ${shadeHex(base, -72)} 100%)`,
    headerBg: `linear-gradient(94deg, ${shadeHex(base, -30)} 0%, ${base} 62%, ${shadeHex(base, 16)} 100%)`,
    panelBg: `linear-gradient(180deg, ${shadeHex(base, -66)} 0%, ${shadeHex(base, -74)} 100%)`,
    tableHeadBg: shadeHex(base, -60),
    footerBg: shadeHex(base, -78),
    cardBg: shadeHex(base, -70),
    actionBg: `linear-gradient(95deg, ${shadeHex(base, -8)} 0%, ${shadeHex(base, 16)} 100%)`
  }
}

export default function PDV() {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [configs, setConfigs] = useState([])

  const [activeConfigId, setActiveConfigId] = useState(localStorage.getItem('pdv_active_config_id') || '')

  const [query, setQuery] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [currentQty, setCurrentQty] = useState(1)
  const [vendedor, setVendedor] = useState('')

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!configs.length) return

    let next = configs.find((cfg) => cfg.id === activeConfigId)
    if (!next) {
      next = configs.find((cfg) => cfg.isDefault) || configs[0]
    }

    if (next && next.id !== activeConfigId) {
      setActiveConfigId(next.id)
      localStorage.setItem('pdv_active_config_id', next.id)
    }
  }, [configs, activeConfigId])

  async function load() {
    const [pRes, cRes, eRes, cfgRes] = await Promise.all([
      api.get('/products'),
      api.get('/customers'),
      api.get('/employees'),
      api.get('/pdv-configs').catch(() => ({ data: [] }))
    ])

    const productList = pRes.data || []
    const customerList = cRes.data || []
    const employeeList = eRes.data || []
    const configList = cfgRes.data || []

    setProducts(productList)
    setCustomers(customerList)
    setEmployees(employeeList)
    setConfigs(configList)

    if (!vendedor) {
      setVendedor((employeeList[0] && employeeList[0].name) || 'Operador')
    }
  }

  function selectConfig(id) {
    setActiveConfigId(id)
    localStorage.setItem('pdv_active_config_id', id)
  }

  const activeConfig = useMemo(() => {
    return configs.find((cfg) => cfg.id === activeConfigId) || null
  }, [configs, activeConfigId])

  const theme = useMemo(() => buildTheme(activeConfig), [activeConfig])

  const filteredProducts = useMemo(() => {
    const q = String(productSearch || '').toLowerCase().trim()
    if (!q) return products

    return products.filter((p) =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.gtin || '').toLowerCase().includes(q) ||
      String(p.categoria || '').toLowerCase().includes(q)
    )
  }, [products, productSearch])

  function productSalePrice(prod) {
    return Number(prod?.precoVenda ?? prod?.price ?? 0)
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function subtotal() {
    return cart.reduce((s, i) => s + (Number(i.price) || 0) * Number(i.quantity || 0), 0)
  }

  function total() {
    const sub = subtotal()
    const disc = Number(discount) || 0
    return Math.max(0, sub - disc)
  }

  function addByBarcode(prodId) {
    if (!prodId) return alert('Digite um codigo')

    const prod = products.find(p => p.sku === prodId || p.id === prodId)
    if (!prod) return alert('Produto nao encontrado')

    const salePrice = productSalePrice(prod)
    const existing = cart.find(x => x.productId === prod.id)

    if (existing) {
      updateQty(prod.id, existing.quantity + currentQty)
    } else {
      setCart(prev => [...prev, { productId: prod.id, name: prod.name, price: salePrice, quantity: currentQty }])
    }

    setQuery('')
    setCurrentQty(1)
  }

  function updateQty(productId, qty) {
    if (qty <= 0) return removeFromCart(productId)
    setCart(prev => prev.map(x => x.productId === productId ? { ...x, quantity: qty } : x))
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(x => x.productId !== productId))
  }

  function printReceipt() {
    const printerType = activeConfig?.printerType || 'termica80'
    const pageSize = printerType === 'a4' ? 'A4' : (printerType === 'termica58' ? '58mm auto' : '80mm auto')
    const bodyWidth = printerType === 'a4' ? '190mm' : (printerType === 'termica58' ? '54mm' : '76mm')

    const w = window.open('', '_blank', 'width=600,height=800')
    const itemsHtml = (cart || []).map(i => {
      const qty = Number(i.quantity || 0)
      const unit = Number(i.price || 0)
      const lineTotal = qty * unit
      return `
        <tr>
          <td>${escapeHtml(i.name)}</td>
          <td class="right">${qty}</td>
          <td class="right">${unit.toFixed(2)}</td>
          <td class="right">${lineTotal.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    const clientName = (customers.find(c => c.id === customerId) || {}).name || 'Consumidor Final'
    const amountPaid = Number(paymentAmount || total())

    const html = `
      <html>
      <head>
        <title>Cupom</title>
        <style>
          @page { size: ${pageSize}; margin: 2mm; }
          body { width: ${bodyWidth}; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
          .center { text-align: center; }
          .right { text-align: right; }
          .line { border-top: 1px dashed #000; margin: 6px 0; }
          .muted { font-size: 10px; }
          h1 { margin: 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { padding: 2px 0; vertical-align: top; }
          thead th { border-bottom: 1px dashed #000; }
          tfoot td { border-top: 1px dashed #000; padding-top: 4px; }
          .logo { max-width: 120px; max-height: 58px; margin: 0 auto 4px; display: block; }
        </style>
      </head>
      <body>
        <div class="center">
          ${activeConfig?.logoUrl ? `<img class="logo" src="${escapeHtml(activeConfig.logoUrl)}" alt="Logo" />` : ''}
          <h1>CUPOM NAO FISCAL</h1>
          <div class="muted">PDV - Venda sem nota</div>
          <div class="muted">Caixa: ${escapeHtml(activeConfig?.name || 'PADRAO')}</div>
        </div>
        <div class="line"></div>
        <div>Data: ${new Date().toLocaleString('pt-BR')}</div>
        <div>Pedido: ${Date.now()}</div>
        <div>Cliente: ${escapeHtml(clientName)}</div>
        <div>Vendedor: ${escapeHtml(vendedor || 'Nao informado')}</div>
        <div>Pgto: ${escapeHtml(paymentMethod)}</div>
        <div class="line"></div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="right">Qtd</th>
              <th class="right">Un</th>
              <th class="right">Tot</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="4" class="center">Sem itens</td></tr>'}
          </tbody>
          <tfoot>
            <tr><td colspan="3">Subtotal</td><td class="right">${subtotal().toFixed(2)}</td></tr>
            <tr><td colspan="3">Desconto</td><td class="right">${Number(discount || 0).toFixed(2)}</td></tr>
            <tr><td colspan="3"><strong>Total</strong></td><td class="right"><strong>${total().toFixed(2)}</strong></td></tr>
            <tr><td colspan="3">Valor Pago</td><td class="right">${amountPaid.toFixed(2)}</td></tr>
          </tfoot>
        </table>

        <div class="line"></div>
        <div class="center">Obrigado pela preferencia!</div>
      </body>
      </html>
    `
    w.document.write(html)
    w.document.close()
    w.print()
  }

  async function checkout() {
    if (cart.length === 0) return alert('Carrinho vazio')
    if (activeConfig?.requireSellerAtStart && !String(vendedor || '').trim()) {
      return alert('Esta configuracao exige vendedor no inicio da venda')
    }
    if (activeConfig?.requireCpfAtStart && !customerId) {
      return alert('Esta configuracao exige cliente com CPF/CNPJ no inicio da venda')
    }

    try {
      const items = cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      const payload = {
        customerId: customerId || undefined,
        items,
        discount: Number(discount) || 0,
        paymentMethod,
        paymentAmount: Number(paymentAmount) || total(),
        cashierId: vendedor,
        notes: activeConfig ? `Config PDV: ${activeConfig.name}` : ''
      }

      await api.post('/orders', payload)
      printReceipt()

      setCart([])
      setDiscount(0)
      setPaymentAmount(0)
      setCustomerId('')
      setCurrentQty(1)
      setVendedor((employees[0] && employees[0].name) || 'Operador')
      load()
    } catch (err) {
      console.error(err)
      alert('Erro ao finalizar venda: ' + (err.response?.data?.error || err.message))
    }
  }

  const selectedProd = products.find(p => p.sku === query || p.id === query)
  const unitPrice = productSalePrice(selectedProd)
  const lineTotal = unitPrice * currentQty

  const panelStyle = { borderColor: theme.border, background: theme.panelBg }

  return (
    <div className="pdv-container" style={{ background: theme.pageBg, color: theme.text }}>
      <div className="pdv-header" style={{ background: theme.headerBg, borderBottomColor: theme.border }}>
        <div className="pdv-header-main">
          <div>
            <h1 style={{ color: theme.text }}>PDV - Caixa</h1>
            <div className="pdv-config-active" style={{ color: theme.mutedText }}>
              Configuracao ativa: {activeConfig?.name || 'Padrao do sistema'}
            </div>
          </div>

          <div className="pdv-header-right">
            {activeConfig?.logoUrl && (
              <img src={activeConfig.logoUrl} alt="Logo Caixa" className="pdv-config-logo" />
            )}
            <div className="pdv-config-switch">
              <label style={{ color: theme.mutedText }}>Caixa</label>
              <select value={activeConfigId} onChange={(e) => selectConfig(e.target.value)}>
                {configs.length === 0 && <option value="">Padrao</option>}
                {configs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.name}{cfg.isDefault ? ' (Padrao)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="pdv-main">
        <div className="pdv-left-panel" style={panelStyle}>
          <div className="input-section">
            <div className="input-group">
              <label>CODIGO DE BARRAS</label>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && addByBarcode(query)} placeholder="Digite codigo" autoFocus />
            </div>
            <div className="input-group">
              <label>BUSCAR PRODUTO</label>
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Nome, codigo, GTIN ou categoria"
              />
            </div>
            <div className="input-group">
              <label>PRODUTO</label>
              <select value={query} onChange={e => setQuery(e.target.value)}>
                <option value="">Selecione...</option>
                {filteredProducts.map(p => <option key={p.id} value={p.sku || p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>PRECO UN</label>
              <input type="text" value={unitPrice.toFixed(2)} disabled />
            </div>
            <div className="input-group">
              <label>QTD</label>
              <input type="number" min="1" value={currentQty} onChange={e => setCurrentQty(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>TOTAL</label>
              <input type="text" value={lineTotal.toFixed(2)} disabled />
            </div>
            <div className="input-group">
              <label>EMBALAGEM</label>
              <input type="text" value={selectedProd?.embalagem || ''} disabled />
            </div>
            <button className="btn-add" style={{ background: theme.actionBg }} onClick={() => addByBarcode(query)}>Adicionar Item</button>
          </div>
        </div>

        <div className="pdv-center" style={panelStyle}>
          <div className="table-header" style={{ borderBottomColor: theme.border, background: theme.tableHeadBg }}>
            <div className="th-col th-barcode" style={{ color: theme.mutedText }}>CODIGO</div>
            <div className="th-col th-date" style={{ color: theme.mutedText }}>DATA/HORA</div>
            <div className="th-col th-product" style={{ color: theme.mutedText }}>PRODUTO</div>
            <div className="th-col th-qty" style={{ color: theme.mutedText }}>QTD</div>
            <div className="th-col th-total" style={{ color: theme.mutedText }}>TOTAL</div>
            <div className="th-col th-price" style={{ color: theme.mutedText }}>PRECO UN</div>
            <div className="th-col th-emb" style={{ color: theme.mutedText }}>EMB</div>
          </div>
          <div className="table-body">
            {cart.length === 0 && <div className="empty-cart" style={{ color: theme.mutedText }}>Nenhum item no carrinho</div>}
            {cart.map((item, idx) => (
              <div key={idx} className="table-row" style={{ borderBottomColor: theme.border }}>
                <div className="td-col td-barcode" style={{ color: theme.text }}>{products.find(p => p.id === item.productId)?.sku || '-'}</div>
                <div className="td-col td-date" style={{ color: theme.text }}>{new Date().toLocaleString('pt-BR')}</div>
                <div className="td-col td-product" style={{ color: theme.text }}>{item.name}</div>
                <div className="td-col td-qty">
                  <input type="number" min="1" value={item.quantity} onChange={e => updateQty(item.productId, Number(e.target.value))} />
                </div>
                <div className="td-col td-total" style={{ color: theme.text }}>R$ {((item.price || 0) * item.quantity).toFixed(2)}</div>
                <div className="td-col td-price" style={{ color: theme.text }}>R$ {(item.price || 0).toFixed(2)}</div>
                <div className="td-col td-emb">
                  <button className="btn-small" onClick={() => removeFromCart(item.productId)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pdv-right-panel" style={panelStyle}>
          <div className="total-box" style={{ borderColor: theme.border, background: theme.headerBg }}>
            <div className="total-label" style={{ color: theme.mutedText }}>TOTAL</div>
            <div className="total-value" style={{ color: theme.text }}>R$ {total().toFixed(2)}</div>
          </div>

          <div className="summary-box" style={{ borderColor: theme.border, background: theme.cardBg }}>
            <div className="summary-item" style={{ borderColor: theme.border, background: theme.panelBg, color: theme.text }}>
              <span>Subtotal:</span>
              <span>R$ {subtotal().toFixed(2)}</span>
            </div>
            <div className="summary-item" style={{ borderColor: theme.border, background: theme.panelBg, color: theme.text }}>
              <label>Desconto: </label>
              <input type="number" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="summary-item" style={{ borderColor: theme.border, background: theme.panelBg, color: theme.text }}>
              <span>Itens:</span>
              <span>{cart.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pdv-footer" style={{ borderTopColor: theme.border, background: theme.footerBg }}>
        <div className="footer-left" style={panelStyle}>
          <div className="footer-item">
            <label>Cliente:</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Consumidor Final</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-search">Buscar</button>
          </div>
          <div className="footer-item">
            <label>Vendedor:</label>
            <select value={vendedor} onChange={e => setVendedor(e.target.value)}>
              {employees.length === 0 && <option value="">Sem vendedores cadastrados</option>}
              {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
            </select>
          </div>
        </div>

        <div className="footer-center" style={panelStyle}>
          <div className="payment-group">
            <label>PAGAMENTO</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option>Dinheiro</option>
              <option>Cartao</option>
              <option>PIX</option>
              <option>Cheque</option>
            </select>
          </div>
        </div>

        <div className="footer-right" style={panelStyle}>
          <button className="btn-action btn-secondary">Codigo</button>
          <button className="btn-action btn-secondary">Deletar</button>
          <button className="btn-action btn-secondary">Editar</button>
          <button className="btn-action btn-secondary">Finalizar Compra</button>
          <button className="btn-action btn-primary" style={{ background: theme.actionBg }} onClick={checkout}>FINALIZAR (SEM NOTA)</button>
          <button className="btn-action btn-secondary" onClick={printReceipt}>Imprimir</button>
        </div>
      </div>
    </div>
  )
}
