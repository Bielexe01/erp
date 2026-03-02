import React, { useEffect, useState } from 'react'
import api from '../api'

export default function ReportSales(){
  const [orders, setOrders] = useState([])
  const [filtered, setFiltered] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ loadOrders() }, [])
  
  async function loadOrders(){
    try{
      const res = await api.get('/orders')
      setOrders(res.data || [])
      applyFilters(res.data || [], startDate, endDate, vendedor, paymentMethod)
    }catch(err){
      console.error(err)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ applyFilters(orders, startDate, endDate, vendedor, paymentMethod) }, [startDate, endDate, vendedor, paymentMethod, orders])

  function applyFilters(data, sd, ed, vend, payment){
    let result = data
    if (sd) result = result.filter(o => new Date(o.createdAt) >= new Date(sd))
    if (ed) result = result.filter(o => new Date(o.createdAt) <= new Date(ed))
    if (vend) result = result.filter(o => (o.cashierId || '').includes(vend))
    if (payment) result = result.filter(o => o.paymentMethod === payment)
    setFiltered(result)
  }

  function exportCSV(){
    const csv = [
      ['Data', 'Cliente', 'Itens', 'Subtotal', 'Desconto', 'Total Pago', 'Pagamento'].join(','),
      ...filtered.map(o=> [
        new Date(o.createdAt).toLocaleString('pt-BR'),
        o.customerId || 'Consumidor Final',
        (o.items||[]).length,
        Number(o.total||0).toFixed(2),
        Number(o.discount||0).toFixed(2),
        Number(o.paymentAmount||0).toFixed(2),
        o.paymentMethod || '-'
      ].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_vendas_${new Date().toLocaleString()}.csv`
    a.click()
  }

  const total = filtered.reduce((s, o) => s + (Number(o.paymentAmount) || 0), 0)
  const totalDiscount = filtered.reduce((s, o) => s + (Number(o.discount) || 0), 0)
  const vendorNames = [...new Set(orders.map(o => o.cashierId).filter(Boolean))]
  const paymentMethods = [...new Set(orders.map(o => o.paymentMethod).filter(Boolean))]

  return (
    <div className="page">
      <h2>Relatório de Vendas</h2>

      <div className="filter-section">
        <div className="filter-group">
          <label>Data Inicial:</label>
          <input type="datetime-local" value={startDate} onChange={e=>setStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Data Final:</label>
          <input type="datetime-local" value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Vendedor:</label>
          <select value={vendedor} onChange={e=>setVendedor(e.target.value)}>
            <option value="">Todos</option>
            {vendorNames.map(v=> <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Forma Pagamento:</label>
          <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
            <option value="">Todos</option>
            {paymentMethods.map(p=> <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={exportCSV}>Exportar CSV</button>
      </div>

      <div className="summary-row">
        <div className="summary-item">
          <strong>Total de Transações:</strong> {filtered.length}
        </div>
        <div className="summary-item">
          <strong>Total de Vendas:</strong> R$ {Number(total).toFixed(2)}
        </div>
        <div className="summary-item">
          <strong>Total Desconto:</strong> R$ {Number(totalDiscount).toFixed(2)}
        </div>
        <div className="summary-item">
          <strong>Ticket Médio:</strong> R$ {filtered.length > 0 ? (total / filtered.length).toFixed(2) : '0.00'}
        </div>
      </div>

      {loading ? <div>Carregando...</div> : (
        <table className="table">
          <thead><tr><th>Data/Hora</th><th>Cliente</th><th>Itens</th><th>Subtotal</th><th>Desconto</th><th>Total Pago</th><th>Pagamento</th><th>Vendedor</th></tr></thead>
          <tbody>
            {filtered.map(o=> (
              <tr key={o.id}>
                <td>{new Date(o.createdAt).toLocaleString('pt-BR')}</td>
                <td>{o.customerId || 'Consumidor Final'}</td>
                <td>{(o.items||[]).length}</td>
                <td>R$ {Number(o.total||0).toFixed(2)}</td>
                <td>R$ {Number(o.discount||0).toFixed(2)}</td>
                <td><strong>R$ {Number(o.paymentAmount||0).toFixed(2)}</strong></td>
                <td>{o.paymentMethod || '-'}</td>
                <td>{o.cashierId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
