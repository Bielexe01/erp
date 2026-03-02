import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Finance() {
  const [list, setList] = useState([])
  const [summary, setSummary] = useState({
    openReceivable: 0,
    openPayable: 0,
    paidReceivable: 0,
    paidPayable: 0,
    projectedBalance: 0,
    overdueCount: 0
  })
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
    startDate: '',
    endDate: ''
  })

  const [form, setForm] = useState({
    type: 'receber',
    description: '',
    category: '',
    dueDate: '',
    amount: '',
    status: 'open',
    party: '',
    notes: ''
  })

  const params = useMemo(() => {
    const p = {}
    if (filters.type) p.type = filters.type
    if (filters.status) p.status = filters.status
    if (filters.search) p.search = filters.search
    if (filters.startDate) p.startDate = filters.startDate
    if (filters.endDate) p.endDate = filters.endDate
    return p
  }, [filters])

  useEffect(() => {
    loadAll()
  }, [params])

  async function loadAll() {
    setLoading(true)
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.get('/finance', { params }),
        api.get('/finance/summary', { params: { startDate: filters.startDate, endDate: filters.endDate } })
      ])
      setList(listRes.data || [])
      setSummary(summaryRes.data || {})
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar financeiro')
    } finally {
      setLoading(false)
    }
  }

  async function createEntry(e) {
    e.preventDefault()
    if (!form.description || !form.amount) {
      alert('Descricao e valor sao obrigatorios')
      return
    }

    try {
      await api.post('/finance', {
        ...form,
        amount: Number(form.amount)
      })

      setForm({
        type: 'receber',
        description: '',
        category: '',
        dueDate: '',
        amount: '',
        status: 'open',
        party: '',
        notes: ''
      })

      loadAll()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao salvar lancamento')
    }
  }

  async function togglePaid(entry) {
    try {
      if (entry.status === 'paid') {
        await api.put(`/finance/${entry.id}`, { status: 'open' })
      } else {
        await api.patch(`/finance/${entry.id}/pay`)
      }
      loadAll()
    } catch (err) {
      console.error(err)
      alert('Erro ao atualizar status')
    }
  }

  async function removeEntry(id) {
    if (!confirm('Remover lancamento?')) return
    try {
      await api.delete(`/finance/${id}`)
      loadAll()
    } catch (err) {
      console.error(err)
      alert('Erro ao remover lancamento')
    }
  }

  return (
    <div className="page">
      <h2>Financeiro</h2>

      <div className="summary-row">
        <div className="summary-item"><strong>A Receber (aberto):</strong> {formatCurrency(summary.openReceivable)}</div>
        <div className="summary-item"><strong>A Pagar (aberto):</strong> {formatCurrency(summary.openPayable)}</div>
        <div className="summary-item"><strong>Saldo Projetado:</strong> {formatCurrency(summary.projectedBalance)}</div>
        <div className="summary-item"><strong>Vencidos:</strong> {summary.overdueCount || 0}</div>
      </div>

      <form className="finance-form" onSubmit={createEntry}>
        <div className="form-grid">
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
              <option value="receber">Receber</option>
              <option value="pagar">Pagar</option>
            </select>
          </div>
          <div className="form-group">
            <label>Descricao</label>
            <input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Ex: Venda balcao" />
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <input value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} placeholder="Ex: Vendas" />
          </div>
          <div className="form-group">
            <label>Vencimento</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Valor</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
              <option value="open">Aberto</option>
              <option value="paid">Pago</option>
            </select>
          </div>
          <div className="form-group">
            <label>Cliente/Fornecedor</label>
            <input value={form.party} onChange={e => setForm(prev => ({ ...prev, party: e.target.value }))} placeholder="Nome" />
          </div>
          <div className="form-group full">
            <label>Observacoes</label>
            <input value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Informacoes adicionais" />
          </div>
        </div>
        <button type="submit" className="btn-primary">Adicionar lancamento</button>
      </form>

      <div className="filter-section finance-filter-row">
        <div className="filter-group">
          <label>Busca</label>
          <input value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Descricao, categoria ou pessoa" />
        </div>
        <div className="filter-group">
          <label>Tipo</label>
          <select value={filters.type} onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}>
            <option value="">Todos</option>
            <option value="receber">Receber</option>
            <option value="pagar">Pagar</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
            <option value="">Todos</option>
            <option value="open">Aberto</option>
            <option value="paid">Pago</option>
          </select>
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

      {loading ? <div>Carregando...</div> : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Descricao</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Pessoa</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {list.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{entry.description}</td>
                  <td>{entry.type === 'receber' ? 'Receber' : 'Pagar'}</td>
                  <td>{entry.category || '-'}</td>
                  <td>{entry.party || '-'}</td>
                  <td className="text-right">{formatCurrency(entry.amount)}</td>
                  <td>{entry.status === 'paid' ? 'Pago' : 'Aberto'}</td>
                  <td className="text-center">
                    <button className="btn-edit" onClick={() => togglePaid(entry)}>
                      {entry.status === 'paid' ? 'Reabrir' : 'Quitar'}
                    </button>
                    <button className="btn-delete" onClick={() => removeEntry(entry.id)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
