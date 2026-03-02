import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

export default function Purchases() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [purchases, setPurchases] = useState([])
  const [productSearch, setProductSearch] = useState('')

  const [form, setForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    date: todayInput(),
    freight: '',
    otherCosts: '',
    notes: ''
  })

  const [itemDraft, setItemDraft] = useState({
    productId: '',
    quantity: 1,
    unitCost: ''
  })

  const [items, setItems] = useState([])

  const [filters, setFilters] = useState({
    supplierId: '',
    search: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    loadPurchases()
  }, [filters])

  async function loadLookups() {
    try {
      const [suppliersRes, productsRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products')
      ])
      setSuppliers(suppliersRes.data || [])
      setProducts(productsRes.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar dados de apoio')
    }
  }

  async function loadPurchases() {
    try {
      const params = {}
      if (filters.supplierId) params.supplierId = filters.supplierId
      if (filters.search) params.search = filters.search
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const res = await api.get('/purchases', { params })
      setPurchases(res.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar compras')
    }
  }

  function onSelectProduct(productId) {
    const product = products.find(p => p.id === productId)
    setItemDraft(prev => ({
      ...prev,
      productId,
      unitCost: product ? toNumber(product.custoBruto || 0).toFixed(4) : ''
    }))
  }

  function addItem() {
    if (!itemDraft.productId) {
      alert('Selecione um produto')
      return
    }

    const qty = toNumber(itemDraft.quantity)
    const unitCost = toNumber(itemDraft.unitCost)
    if (qty <= 0) {
      alert('Quantidade deve ser maior que zero')
      return
    }
    if (unitCost < 0) {
      alert('Custo unitario invalido')
      return
    }

    const product = products.find(p => p.id === itemDraft.productId)
    if (!product) {
      alert('Produto nao encontrado')
      return
    }

    const existingIdx = items.findIndex(i => i.productId === itemDraft.productId)
    if (existingIdx >= 0) {
      const next = [...items]
      const existing = next[existingIdx]
      const mergedQty = toNumber(existing.quantity) + qty
      next[existingIdx] = {
        ...existing,
        quantity: mergedQty,
        unitCost
      }
      setItems(next)
    } else {
      setItems(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitCost
      }])
    }

    setItemDraft({ productId: '', quantity: 1, unitCost: '' })
  }

  function removeItem(productId) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + toNumber(i.quantity) * toNumber(i.unitCost), 0), [items])
  const total = useMemo(() => subtotal + toNumber(form.freight) + toNumber(form.otherCosts), [subtotal, form.freight, form.otherCosts])
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

  async function savePurchase(e) {
    e.preventDefault()

    if (items.length === 0) {
      alert('Adicione pelo menos um item na compra')
      return
    }

    try {
      await api.post('/purchases', {
        supplierId: form.supplierId || null,
        invoiceNumber: form.invoiceNumber,
        date: form.date,
        notes: form.notes,
        freight: toNumber(form.freight),
        otherCosts: toNumber(form.otherCosts),
        items: items.map(i => ({
          productId: i.productId,
          quantity: toNumber(i.quantity),
          unitCost: toNumber(i.unitCost)
        }))
      })

      setForm({
        supplierId: '',
        invoiceNumber: '',
        date: todayInput(),
        freight: '',
        otherCosts: '',
        notes: ''
      })
      setItems([])
      setProductSearch('')

      await Promise.all([loadLookups(), loadPurchases()])
      alert('Compra registrada e estoque atualizado com custo medio')
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao registrar compra')
    }
  }

  return (
    <div className="page">
      <h2>Compras e Entrada de Estoque</h2>

      <form className="finance-form" onSubmit={savePurchase}>
        <div className="form-grid">
          <div className="form-group">
            <label>Fornecedor</label>
            <select value={form.supplierId} onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}>
              <option value="">Sem fornecedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Numero NF</label>
            <input value={form.invoiceNumber} onChange={e => setForm(prev => ({ ...prev, invoiceNumber: e.target.value }))} placeholder="Ex: 12345" />
          </div>
          <div className="form-group">
            <label>Data</label>
            <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Frete</label>
            <input type="number" step="0.01" min="0" value={form.freight} onChange={e => setForm(prev => ({ ...prev, freight: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Outros custos</label>
            <input type="number" step="0.01" min="0" value={form.otherCosts} onChange={e => setForm(prev => ({ ...prev, otherCosts: e.target.value }))} />
          </div>
          <div className="form-group full">
            <label>Observacoes</label>
            <input value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Observacoes da compra" />
          </div>
        </div>

        <div className="summary-row" style={{ marginTop: 10 }}>
          <div className="summary-item"><strong>Subtotal itens:</strong> {formatCurrency(subtotal)}</div>
          <div className="summary-item"><strong>Frete:</strong> {formatCurrency(form.freight)}</div>
          <div className="summary-item"><strong>Outros custos:</strong> {formatCurrency(form.otherCosts)}</div>
          <div className="summary-item"><strong>Total compra:</strong> {formatCurrency(total)}</div>
        </div>

        <div className="table-responsive" style={{ marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Custo unitario</th>
                <th>Total</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center">Nenhum item adicionado</td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.productId}>
                  <td>{item.productName}</td>
                  <td>{toNumber(item.quantity).toFixed(3)}</td>
                  <td className="text-right">{formatCurrency(item.unitCost)}</td>
                  <td className="text-right">{formatCurrency(toNumber(item.quantity) * toNumber(item.unitCost))}</td>
                  <td className="text-center">
                    <button type="button" className="btn-delete" onClick={() => removeItem(item.productId)}>Remover</button>
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
          <select value={itemDraft.productId} onChange={e => onSelectProduct(e.target.value)}>
            <option value="">Selecione produto</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} | estoque: {toNumber(p.estoque).toFixed(3)} | custo medio: {formatCurrency(p.custoBruto)}
              </option>
            ))}
          </select>
          <input type="number" step="0.001" min="0.001" value={itemDraft.quantity} onChange={e => setItemDraft(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Qtd" />
          <input type="number" step="0.0001" min="0" value={itemDraft.unitCost} onChange={e => setItemDraft(prev => ({ ...prev, unitCost: e.target.value }))} placeholder="Custo unitario" />
          <button type="button" className="btn-secondary" onClick={addItem}>Adicionar item</button>
        </div>

        <button type="submit" className="btn-primary">Finalizar compra e dar entrada</button>
      </form>

      <div className="filter-section" style={{ marginTop: 16 }}>
        <div className="filter-group">
          <label>Fornecedor</label>
          <select value={filters.supplierId} onChange={e => setFilters(prev => ({ ...prev, supplierId: e.target.value }))}>
            <option value="">Todos</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Busca</label>
          <input value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="NF, fornecedor ou observacao" />
        </div>
        <div className="filter-group">
          <label>De</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))} />
        </div>
        <div className="filter-group">
          <label>Ate</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))} />
        </div>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>NF</th>
              <th>Itens</th>
              <th>Subtotal</th>
              <th>Total</th>
              <th>Criado por</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td>{new Date(p.date).toLocaleDateString('pt-BR')}</td>
                <td>{p.supplierName || 'Sem fornecedor'}</td>
                <td>{p.invoiceNumber || '-'}</td>
                <td>{(p.items || []).length}</td>
                <td className="text-right">{formatCurrency(p.subtotal)}</td>
                <td className="text-right"><strong>{formatCurrency(p.total)}</strong></td>
                <td>{p.createdBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
