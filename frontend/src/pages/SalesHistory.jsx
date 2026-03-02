import React, { useEffect, useState } from 'react'
import api from '../api'

export default function SalesHistory() {
  const [list, setList] = useState([])
  const [productsMap, setProductsMap] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [oRes, pRes] = await Promise.all([api.get('/orders'), api.get('/products')])
    setList(oRes.data)
    setProductsMap(pRes.data)
  }

  function productName(productId) {
    const p = (productsMap || []).find(x => x.id === productId)
    return p ? p.name : productId
  }

  function productPrice(productId) {
    const p = (productsMap || []).find(x => x.id === productId)
    return Number(p?.precoVenda ?? p?.price ?? 0)
  }

  function productCode(productId) {
    const p = (productsMap || []).find(x => x.id === productId)
    return String(p?.sku || '')
  }

  function itemPrice(item) {
    const fromItem = Number(item?.price ?? 0)
    if (Number.isFinite(fromItem) && fromItem > 0) return fromItem
    return productPrice(item?.productId)
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function printReceipt(order) {
    const w = window.open('', '_blank', 'width=600,height=800')
    const subtotal = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * itemPrice(item), 0)
    const total = Number(order.paymentAmount ?? order.total ?? subtotal)
    const discount = Number(order.discount || 0)

    const paymentsHtml = (order.payments || []).map(p => `<div>${escapeHtml(p.method)}: ${Number(p.amount || 0).toFixed(2)}</div>`).join('')
    const itemsHtml = (order.items || []).map(i => {
      const qty = Number(i.quantity || 0)
      const unit = itemPrice(i)
      const lineTotal = qty * unit
      return `
        <tr>
          <td>${escapeHtml(productName(i.productId))}</td>
          <td class="right">${qty}</td>
          <td class="right">${unit.toFixed(2)}</td>
          <td class="right">${lineTotal.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    const html = `
      <html>
      <head>
        <title>Cupom ${escapeHtml(order.id)}</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          body { width: 76mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
          .center { text-align: center; }
          .right { text-align: right; }
          .line { border-top: 1px dashed #000; margin: 6px 0; }
          .muted { font-size: 10px; }
          h1 { margin: 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { padding: 2px 0; vertical-align: top; }
          thead th { border-bottom: 1px dashed #000; }
          tfoot td { border-top: 1px dashed #000; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h1>CUPOM NAO FISCAL</h1>
          <div class="muted">Pedido ${escapeHtml(order.id)}</div>
        </div>
        <div class="line"></div>
        <div>Data: ${new Date(order.createdAt).toLocaleString('pt-BR')}</div>
        <div>Cliente: ${escapeHtml(order.customerId || 'Consumidor Final')}</div>
        <div>Vendedor: ${escapeHtml(order.cashierId || '-')}</div>
        <div>Pagamento: ${escapeHtml(order.paymentMethod || '-')}</div>
        ${paymentsHtml ? `<div>Pagamentos: ${paymentsHtml}</div>` : ''}
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
            <tr><td colspan="3">Subtotal</td><td class="right">${subtotal.toFixed(2)}</td></tr>
            <tr><td colspan="3">Desconto</td><td class="right">${discount.toFixed(2)}</td></tr>
            <tr><td colspan="3"><strong>Total</strong></td><td class="right"><strong>${total.toFixed(2)}</strong></td></tr>
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

  const filtered = list.filter((o) => {
    const q = String(search || '').toLowerCase().trim()
    if (!q) return true

    const basicMatch =
      String(o.id || '').toLowerCase().includes(q) ||
      String(o.customerId || '').toLowerCase().includes(q) ||
      String(o.paymentMethod || '').toLowerCase().includes(q) ||
      String(o.cashierId || '').toLowerCase().includes(q)

    if (basicMatch) return true

    return (o.items || []).some((item) =>
      String(productName(item.productId) || '').toLowerCase().includes(q) ||
      String(productCode(item.productId) || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <h2>Historico de Vendas</h2>

      <div className="filter-section">
        <div className="filter-group">
          <label>Buscar</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pedido, cliente, vendedor, produto ou codigo"
          />
        </div>
      </div>

      <table className="table">
        <thead><tr><th>ID</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Subtotal</th><th>Desconto</th><th>Total Pago</th><th>Pagamento</th><th>Acoes</th></tr></thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
              <td>{o.customerId || 'Consumidor Final'}</td>
              <td>{(o.items || []).length}</td>
              <td>R$ {Number(o.total || 0).toFixed(2)}</td>
              <td>R$ {Number(o.discount || 0).toFixed(2)}</td>
              <td>R$ {Number(o.paymentAmount || 0).toFixed(2)}</td>
              <td>{(o.paymentMethod) || '-'}</td>
              <td><button onClick={() => printReceipt(o)}>Imprimir</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
