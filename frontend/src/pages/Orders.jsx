import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function orderStatus(order) {
  if (order?.status) return order.status
  return order?.deleted ? 'canceled' : 'completed'
}

function statusLabel(status) {
  if (status === 'open') return 'Aberto'
  if (status === 'canceled') return 'Cancelado'
  return 'Concluido'
}

export default function Orders() {
  const [list, setList] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [employees, setEmployees] = useState([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [includeCanceled, setIncludeCanceled] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newItem, setNewItem] = useState({ productId: '', quantity: 1, price: '' })
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    loadOrders()
  }, [search, statusFilter, includeCanceled])

  async function loadLookups() {
    try {
      const [cRes, pRes, eRes] = await Promise.all([
        api.get('/customers'),
        api.get('/products'),
        api.get('/employees').catch(() => ({ data: [] }))
      ])

      setCustomers(cRes.data || [])
      setProducts(pRes.data || [])
      setEmployees(eRes.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar clientes/produtos/vendedores')
    }
  }

  async function loadOrders() {
    setLoading(true)
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'all') params.status = statusFilter
      if (includeCanceled) params.includeDeleted = true

      const res = await api.get('/orders', { params })
      setList(res.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  function customerName(customerId) {
    const c = customers.find(item => item.id === customerId)
    return c ? c.name : (customerId || 'Consumidor Final')
  }

  function productName(productId) {
    const p = products.find(item => item.id === productId)
    return p ? p.name : (productId || '-')
  }

  function productCode(productId) {
    const p = products.find(item => item.id === productId)
    return p?.sku || productId || '-'
  }

  function productSalePrice(productId) {
    const p = products.find(item => item.id === productId)
    return toNumber(p?.precoVenda ?? p?.price ?? 0)
  }

  function itemPrice(item) {
    const fromItem = toNumber(item?.price)
    if (fromItem > 0) return fromItem
    return productSalePrice(item?.productId)
  }

  function orderSubtotal(order) {
    return (order.items || []).reduce((sum, item) => {
      return sum + toNumber(item.quantity, 0) * itemPrice(item)
    }, 0)
  }

  function orderTotal(order) {
    if (order.paymentAmount !== undefined && order.paymentAmount !== null) {
      return toNumber(order.paymentAmount)
    }
    if (order.total !== undefined && order.total !== null) {
      return toNumber(order.total)
    }
    return Math.max(0, orderSubtotal(order) - toNumber(order.discount))
  }

  function normalizeOrder(order) {
    const items = (order.items || []).map((item) => ({
      productId: item.productId,
      quantity: toNumber(item.quantity, 1),
      price: itemPrice(item)
    }))

    return {
      id: order.id,
      customerId: order.customerId || '',
      cashierId: order.cashierId || '',
      paymentMethod: order.paymentMethod || 'Dinheiro',
      discount: toNumber(order.discount),
      paymentAmount: toNumber(order.paymentAmount ?? order.total ?? orderSubtotal({ items })),
      status: orderStatus(order),
      notes: order.notes || '',
      items
    }
  }

  function openDetails(order) {
    setEditing(order)
    setDraft(normalizeOrder(order))
    setNewItem({ productId: '', quantity: 1, price: '' })
    setProductSearch('')
  }

  function closeDetails() {
    setEditing(null)
    setDraft(null)
    setNewItem({ productId: '', quantity: 1, price: '' })
    setProductSearch('')
  }

  function updateDraftField(name, value) {
    setDraft(prev => ({ ...prev, [name]: value }))
  }

  function updateDraftItem(index, field, value) {
    setDraft(prev => {
      const nextItems = [...(prev.items || [])]
      nextItems[index] = {
        ...nextItems[index],
        [field]: field === 'productId' ? value : toNumber(value)
      }
      if (field === 'productId') {
        nextItems[index].price = productSalePrice(value)
      }
      return { ...prev, items: nextItems }
    })
  }

  function removeDraftItem(index) {
    setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  function addDraftItem() {
    if (!newItem.productId) {
      alert('Selecione um produto para adicionar')
      return
    }

    const quantity = toNumber(newItem.quantity, 1)
    const price = newItem.price === '' ? productSalePrice(newItem.productId) : toNumber(newItem.price)

    if (quantity <= 0) {
      alert('Quantidade deve ser maior que zero')
      return
    }

    setDraft(prev => ({
      ...prev,
      items: [...(prev.items || []), { productId: newItem.productId, quantity, price }]
    }))

    setNewItem({ productId: '', quantity: 1, price: '' })
  }

  const draftSubtotal = useMemo(() => {
    if (!draft) return 0
    return (draft.items || []).reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.price), 0)
  }, [draft])

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

  function productsForItemSelect(selectedId) {
    if (!selectedId) return filteredProducts
    const hasSelected = filteredProducts.some((p) => p.id === selectedId)
    if (hasSelected) return filteredProducts
    const selected = products.find((p) => p.id === selectedId)
    return selected ? [selected, ...filteredProducts] : filteredProducts
  }

  const draftTotal = useMemo(() => {
    if (!draft) return 0
    const paid = toNumber(draft.paymentAmount)
    return paid > 0 ? paid : Math.max(0, draftSubtotal - toNumber(draft.discount))
  }, [draft, draftSubtotal])

  async function saveDetails() {
    if (!draft) return
    if ((draft.items || []).length === 0) {
      alert('O pedido precisa ter pelo menos um item')
      return
    }

    try {
      const payload = {
        customerId: draft.customerId || undefined,
        cashierId: draft.cashierId || undefined,
        paymentMethod: draft.paymentMethod || undefined,
        discount: toNumber(draft.discount),
        paymentAmount: toNumber(draft.paymentAmount) || Math.max(0, draftSubtotal - toNumber(draft.discount)),
        status: draft.status || 'completed',
        notes: draft.notes || '',
        total: draftSubtotal,
        items: (draft.items || []).map(item => ({
          productId: item.productId,
          quantity: toNumber(item.quantity, 1),
          price: toNumber(item.price)
        }))
      }

      await api.put(`/orders/${draft.id}`, payload)
      closeDetails()
      loadOrders()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao salvar pedido')
    }
  }

  async function cancelOrder(id) {
    if (!confirm('Cancelar pedido?')) return
    try {
      await api.delete(`/orders/${id}`)
      if (draft && draft.id === id) closeDetails()
      loadOrders()
    } catch (err) {
      console.error(err)
      alert('Erro ao cancelar pedido')
    }
  }

  async function restoreOrder(id) {
    try {
      await api.patch(`/orders/${id}/restore`)
      loadOrders()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao restaurar pedido')
    }
  }

  async function duplicateOrder(id) {
    try {
      const res = await api.post(`/orders/${id}/duplicate`)
      await loadOrders()
      if (res?.data?.id) {
        alert(`Pedido duplicado: ${res.data.id}`)
      }
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao duplicar pedido')
    }
  }

  async function changeOrderStatus(id, status) {
    try {
      await api.patch(`/orders/${id}/status`, { status })
      loadOrders()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao atualizar status')
    }
  }

  async function hardDelete(id) {
    if (!confirm('Excluir definitivamente este pedido?')) return
    try {
      await api.delete(`/orders/${id}?hard=true`)
      if (draft && draft.id === id) closeDetails()
      loadOrders()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao excluir pedido')
    }
  }

  async function copyOrder(order) {
    const items = (order.items || []).map((item, index) => {
      const qty = toNumber(item.quantity, 0)
      const price = itemPrice(item)
      const total = qty * price
      return `${index + 1}. ${productName(item.productId)} | Qtd: ${qty} | Unit: ${currency(price)} | Total: ${currency(total)}`
    })

    const text = [
      `Pedido: ${order.id}`,
      `Data/Hora: ${formatDate(order.createdAt)}`,
      `Status: ${statusLabel(orderStatus(order))}`,
      `Cliente: ${customerName(order.customerId)}`,
      `Vendedor: ${order.cashierId || '-'}`,
      `Pagamento: ${order.paymentMethod || '-'}`,
      `Subtotal: ${currency(orderSubtotal(order))}`,
      `Desconto: ${currency(order.discount)}`,
      `Total: ${currency(orderTotal(order))}`,
      `Observacoes: ${order.notes || '-'}`,
      '',
      'Itens:',
      ...(items.length ? items : ['(sem itens)'])
    ].join('\n')

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      alert('Pedido copiado para a area de transferencia')
    } catch (err) {
      console.error(err)
      alert('Nao foi possivel copiar o pedido')
    }
  }

  async function printOrderPdf(order) {
    const orderId = order?.id
    if (!orderId) {
      alert('Pedido invalido para gerar PDF')
      return
    }

    let source = order
    try {
      const res = await api.get(`/orders/${orderId}`)
      if (res?.data?.id) {
        source = res.data
      }
    } catch (err) {
      console.error(err)
      // fallback para os dados da tela se a consulta individual falhar
    }

    const itemsRows = (source.items || []).map((item) => {
      const qty = toNumber(item.quantity, 0)
      const price = itemPrice(item)
      const total = qty * price
      return `
        <tr>
          <td>${escapeHtml(productCode(item.productId))}</td>
          <td>${escapeHtml(productName(item.productId))}</td>
          <td style="text-align:center">UN</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:right">${escapeHtml(Number(price).toFixed(2))}</td>
          <td style="text-align:right">${escapeHtml(Number(total).toFixed(2))}</td>
        </tr>
      `
    }).join('')

    const subtotal = orderSubtotal(source)
    const total = orderTotal(source)
    const issuedAt = source?.createdAt ? new Date(source.createdAt) : null
    const hasIssuedAt = issuedAt && !Number.isNaN(issuedAt.getTime())
    const issueDateLabel = hasIssuedAt ? issuedAt.toLocaleDateString('pt-BR') : '-'
    const issueTimeLabel = hasIssuedAt ? issuedAt.toLocaleTimeString('pt-BR') : '-'
    const orderNumber = String(source.id || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || '-'

    const html = `
      <html>
      <head>
        <title>Pedido ${escapeHtml(source.id)}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111; margin: 0; font-size: 12px; }
          .sheet { width: 190mm; margin: 0 auto; }
          .box { border: 1px solid #222; margin-bottom: 6px; }
          .title { font-size: 12px; font-weight: 700; margin-bottom: 2px; text-transform: uppercase; }
          .header-grid { display: grid; grid-template-columns: 22% 52% 26%; min-height: 72px; }
          .header-grid > div { border-right: 1px solid #222; padding: 8px 10px; }
          .header-grid > div:last-child { border-right: 0; }
          .center { text-align: center; }
          .pdf-title { font-size: 16px; font-weight: 700; }
          .big { font-size: 22px; font-weight: 800; line-height: 1.05; margin: 4px 0 3px; }
          .order-code { overflow-wrap: anywhere; word-break: break-word; }
          .logo { font-size: 18px; font-weight: 800; line-height: 1.05; margin-top: 4px; text-align: center; }
          .company { font-size: 28px; font-weight: 700; margin: 4px 0; text-align: center; }
          .seller { font-size: 14px; text-align: center; margin-top: 4px; }
          .small { font-size: 13px; line-height: 1.2; }
          .row { display: grid; border-top: 1px solid #222; }
          .row:first-child { border-top: 0; }
          .cell { border-right: 1px solid #222; padding: 3px 4px; min-height: 32px; }
          .cell:last-child { border-right: 0; }
          .label { display: block; font-size: 9px; text-transform: uppercase; margin-bottom: 2px; }
          .value { font-size: 14px; font-weight: 700; overflow-wrap: anywhere; word-break: break-word; }
          .nowrap { white-space: nowrap; }
          .products table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .products th, .products td { border-right: 1px solid #222; border-top: 1px solid #222; padding: 4px; }
          .products th:last-child, .products td:last-child { border-right: 0; }
          .products th { text-align: left; font-size: 10px; text-transform: uppercase; }
          .products td { overflow-wrap: anywhere; word-break: break-word; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="box header-grid">
            <div>
              <div class="logo">ATACADO<br/>& CIA</div>
            </div>
            <div>
              <div class="company">Atacado e Cia</div>
              <div class="seller">${escapeHtml(source.cashierId || 'BALCAO')}</div>
            </div>
            <div class="center">
              <div class="pdf-title">Pedido</div>
              <div class="big order-code">${escapeHtml(orderNumber)}</div>
              <div class="small">Emitido em ${escapeHtml(issueDateLabel)}<br/>${escapeHtml(issueTimeLabel)}</div>
              <div class="small nowrap"><strong>Folha 1 / 1</strong></div>
            </div>
          </div>

          <div class="box">
            <div class="title" style="padding:4px 6px;">Cliente</div>
            <div class="row" style="grid-template-columns: 63% 14% 23%;">
              <div class="cell"><span class="label">Nome / Razao Social</span><span class="value">${escapeHtml(customerName(source.customerId))}</span></div>
              <div class="cell"><span class="label">Codigo</span><span class="value">${escapeHtml(orderNumber)}</span></div>
              <div class="cell"><span class="label">CNPJ / CPF</span><span class="value">000.000.000-00</span></div>
            </div>
            <div class="row" style="grid-template-columns: 100%;">
              <div class="cell"><span class="label">Nome Fantasia</span><span class="value">${escapeHtml(customerName(source.customerId))}</span></div>
            </div>
            <div class="row" style="grid-template-columns: 63% 25% 12%;">
              <div class="cell"><span class="label">Endereco</span><span class="value">VENDA PRESENCIAL</span></div>
              <div class="cell"><span class="label">Bairro</span><span class="value"></span></div>
              <div class="cell"><span class="label">CEP</span><span class="value"></span></div>
            </div>
            <div class="row" style="grid-template-columns: 54% 18% 5% 23%;">
              <div class="cell"><span class="label">Municipio</span><span class="value">GUARIBA</span></div>
              <div class="cell"><span class="label">Telefone</span><span class="value"></span></div>
              <div class="cell"><span class="label">UF</span><span class="value">SP</span></div>
              <div class="cell"><span class="label">Complemento</span><span class="value"></span></div>
            </div>
          </div>

          <div class="box">
            <div class="title" style="padding:4px 6px;">Valores</div>
            <div class="row" style="grid-template-columns: 83% 17%;">
              <div class="cell"><span class="label">Total Produtos</span><span class="value">${escapeHtml(Number(subtotal).toFixed(2))}</span></div>
              <div class="cell"><span class="label">Total Pedido</span><span class="value">${escapeHtml(Number(total).toFixed(2))}</span></div>
            </div>
          </div>

          <div class="box">
            <div class="title" style="padding:4px 6px;">Outras Informacoes</div>
            <div class="row" style="grid-template-columns: 25% 25% 18% 32%;">
              <div class="cell"><span class="label">Previsao Entrega</span><span class="value">${escapeHtml(issueDateLabel)}</span></div>
              <div class="cell"><span class="label">Ordem de Compra</span><span class="value"></span></div>
              <div class="cell"><span class="label">Frete por Conta</span><span class="value"></span></div>
              <div class="cell"><span class="label">Transportadora</span><span class="value"></span></div>
            </div>
            <div class="row" style="grid-template-columns: 50% 27% 11% 12%;">
              <div class="cell"><span class="label">Tabela de Preco</span><span class="value">PADRAO</span></div>
              <div class="cell"><span class="label">Forma de Pagamento</span><span class="value">${escapeHtml(source.paymentMethod || '-')}</span></div>
              <div class="cell"><span class="label">Volumes</span><span class="value">${escapeHtml(String((source.items || []).length || 0))}</span></div>
              <div class="cell"><span class="label">Itens</span><span class="value">${escapeHtml(String((source.items || []).length || 0))}</span></div>
            </div>
            <div class="row" style="grid-template-columns: 100%;">
              <div class="cell"><span class="label">Condicao de Pagamento</span><span class="value">(0) ${escapeHtml(issueDateLabel)}</span></div>
            </div>
            <div class="row" style="grid-template-columns: 100%;">
              <div class="cell"><span class="label">Observacao</span><span class="value">${escapeHtml(source.notes || '')}</span></div>
            </div>
          </div>

          <div class="box products">
            <div class="title" style="padding:4px 6px;">Dados dos Produtos</div>
            <table>
              <thead>
                <tr>
                  <th style="width:15%;">Codigo</th>
                  <th style="width:39%;">Descricao do Produto</th>
                  <th style="width:6%;" class="text-center">UN</th>
                  <th style="width:7%;" class="text-center">Qtd</th>
                  <th style="width:11%;" class="text-right">V. Unit</th>
                  <th style="width:12%;" class="text-right">V. Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows || '<tr><td colspan="6" class="text-center">Sem itens</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `

    const w = window.open('', `pedido-pdf-${orderId}-${Date.now()}`, 'width=900,height=700')
    if (!w) {
      alert('Permita pop-up para gerar o PDF')
      return
    }

    w.document.write(html)
    w.document.close()
    w.onload = () => {
      w.focus()
      w.print()
    }
  }

  const filtered = list.filter((order) => {
    const status = orderStatus(order)
    if (!includeCanceled && status === 'canceled') return false

    if (statusFilter !== 'all' && status !== statusFilter) return false

    const q = search.toLowerCase().trim()
    if (!q) return true

    return (
      String(order.id || '').toLowerCase().includes(q) ||
      customerName(order.customerId).toLowerCase().includes(q) ||
      String(order.cashierId || '').toLowerCase().includes(q)
    )
  })

  const modalOrder = draft
    ? {
      ...(editing || {}),
      ...draft,
      createdAt: editing?.createdAt
    }
    : null

  return (
    <div className="page">
      <h2>Pedidos</h2>

      <div className="filter-section">
        <div className="filter-group">
          <label>Buscar pedido</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Numero, cliente ou vendedor"
          />
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="open">Aberto</option>
            <option value="completed">Concluido</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Mostrar cancelados</label>
          <select value={includeCanceled ? 'yes' : 'no'} onChange={e => setIncludeCanceled(e.target.value === 'yes')}>
            <option value="no">Nao</option>
            <option value="yes">Sim</option>
          </select>
        </div>

        <button className="btn-secondary" onClick={loadOrders}>Atualizar</button>
      </div>

      {loading ? <div>Carregando...</div> : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>No Pedido</th>
                <th>Data/Hora</th>
                <th>Status</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th>Vendedor</th>
                <th>Total</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const status = orderStatus(order)
                const canceled = status === 'canceled'
                return (
                  <tr key={order.id} onDoubleClick={() => openDetails(order)}>
                    <td>{order.id}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className={`status-badge ${status === 'completed' ? 'status-completed' : status === 'open' ? 'status-open' : 'status-canceled'}`}>
                        {statusLabel(status)}
                      </span>
                    </td>
                    <td>{customerName(order.customerId)}</td>
                    <td>{(order.items || []).length}</td>
                    <td>{order.paymentMethod || '-'}</td>
                    <td>{order.cashierId || '-'}</td>
                    <td className="text-right"><strong>{currency(orderTotal(order))}</strong></td>
                    <td className="text-center">
                      <button className="btn-edit" onClick={() => openDetails(order)}>Detalhes</button>
                      <button className="btn-secondary" onClick={() => duplicateOrder(order.id)}>Duplicar</button>
                      {!canceled && <button className="btn-secondary" onClick={() => changeOrderStatus(order.id, 'open')}>Abrir</button>}
                      {!canceled && <button className="btn-secondary" onClick={() => changeOrderStatus(order.id, 'completed')}>Concluir</button>}
                      {!canceled && <button className="btn-delete" onClick={() => cancelOrder(order.id)}>Cancelar</button>}
                      {canceled && <button className="btn-secondary" onClick={() => restoreOrder(order.id)}>Restaurar</button>}
                      <button className="btn-secondary" onClick={() => copyOrder(order)}>Copiar</button>
                      <button className="btn-secondary" onClick={() => printOrderPdf(order)}>PDF</button>
                      <button className="btn-delete" onClick={() => hardDelete(order.id)}>Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={closeDetails}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Pedido #{draft.id}</h3>
              <button className="btn-close" onClick={closeDetails}>x</button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Cliente</label>
                  <select value={draft.customerId} onChange={e => updateDraftField('customerId', e.target.value)}>
                    <option value="">Consumidor Final</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Vendedor</label>
                  <select value={draft.cashierId} onChange={e => updateDraftField('cashierId', e.target.value)}>
                    <option value="">Nao informado</option>
                    {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Pagamento</label>
                  <select value={draft.paymentMethod} onChange={e => updateDraftField('paymentMethod', e.target.value)}>
                    <option>Dinheiro</option>
                    <option>PIX</option>
                    <option>Cartao</option>
                    <option>Boleto</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Desconto</label>
                  <input type="number" step="0.01" min="0" value={draft.discount} onChange={e => updateDraftField('discount', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Valor pago</label>
                  <input type="number" step="0.01" min="0" value={draft.paymentAmount} onChange={e => updateDraftField('paymentAmount', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={draft.status} onChange={e => updateDraftField('status', e.target.value)}>
                    <option value="completed">Concluido</option>
                    <option value="open">Aberto</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
                <div className="form-group full">
                  <label>Observacoes</label>
                  <textarea value={draft.notes} onChange={e => updateDraftField('notes', e.target.value)} placeholder="Anotacoes do pedido" />
                </div>
              </div>

              <div className="table-responsive" style={{ marginTop: 14 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Quantidade</th>
                      <th>Preco</th>
                      <th>Total</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.items || []).map((item, index) => (
                      <tr key={`${item.productId}-${index}`}>
                        <td>
                          <select value={item.productId} onChange={e => updateDraftItem(index, 'productId', e.target.value)}>
                            {productsForItemSelect(item.productId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" step="1" min="1" value={item.quantity} onChange={e => updateDraftItem(index, 'quantity', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={item.price} onChange={e => updateDraftItem(index, 'price', e.target.value)} />
                        </td>
                        <td className="text-right">{currency(toNumber(item.quantity) * toNumber(item.price))}</td>
                        <td className="text-center">
                          <button className="btn-delete" onClick={() => removeDraftItem(index)}>Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-row" style={{ marginTop: 10 }}>
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar produto por nome, codigo, GTIN ou categoria"
                />
                <select value={newItem.productId} onChange={e => setNewItem(prev => ({ ...prev, productId: e.target.value }))}>
                  <option value="">Selecione produto</option>
                  {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" step="1" value={newItem.quantity} onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Qtd" />
                <input type="number" min="0" step="0.01" value={newItem.price} onChange={e => setNewItem(prev => ({ ...prev, price: e.target.value }))} placeholder="Preco (opcional)" />
                <button className="btn-secondary" onClick={addDraftItem}>Adicionar item</button>
              </div>

              <div className="summary-row" style={{ marginTop: 14 }}>
                <div className="summary-item"><strong>Subtotal:</strong> {currency(draftSubtotal)}</div>
                <div className="summary-item"><strong>Desconto:</strong> {currency(draft.discount)}</div>
                <div className="summary-item"><strong>Itens:</strong> {(draft.items || []).length}</div>
                <div className="summary-item"><strong>Total:</strong> {currency(draftTotal)}</div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeDetails}>Fechar</button>
              {modalOrder && <button className="btn-secondary" onClick={() => duplicateOrder(modalOrder.id)}>Duplicar</button>}
              {modalOrder && <button className="btn-secondary" onClick={() => copyOrder(modalOrder)}>Copiar Pedido</button>}
              {modalOrder && <button className="btn-secondary" onClick={() => printOrderPdf(modalOrder)}>Gerar PDF</button>}
              <button className="btn-primary" onClick={saveDetails}>Salvar Alteracoes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
