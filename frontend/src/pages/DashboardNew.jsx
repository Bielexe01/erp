import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Dashboard(){
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [periodDays, setPeriodDays] = useState(7)

  useEffect(()=>{ loadStats() }, [periodDays])
  
  async function loadStats(){
    setLoading(true)
    try{
      const res = await api.get('/orders')
      setOrders(res.data)
      
      // Calculate stats for last N days
      const now = new Date()
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
      const filtered = (res.data || []).filter(o => new Date(o.createdAt) >= startDate)
      
      const total = filtered.reduce((s, o) => s + (Number(o.paymentAmount) || 0), 0)
      const count = filtered.length
      const avgTicket = count > 0 ? total / count : 0
      const totalDiscount = filtered.reduce((s, o) => s + (Number(o.discount) || 0), 0)
      
      // Group by payment method
      const byPayment = {}
      filtered.forEach(o => {
        const method = o.paymentMethod || 'Não informado'
        byPayment[method] = (byPayment[method] || 0) + Number(o.paymentAmount || 0)
      })
      
      // Group by day
      const byDay = {}
      filtered.forEach(o => {
        const day = new Date(o.createdAt).toLocaleDateString('pt-BR')
        byDay[day] = (byDay[day] || 0) + Number(o.paymentAmount || 0)
      })
      
      setStats({ total, count, avgTicket, totalDiscount, byPayment, byDay, filtered })
    }catch(err){
      console.error(err)
    }finally{
      setLoading(false)
    }
  }

  const maxDaily = Math.max(...Object.values(stats.byDay || {}), 1)

  return (
    <div className="page">
      <h2>Dashboard - Resumo de Vendas</h2>
      
      <div className="period-selector">
        <label>Período: </label>
        <select value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value))}>
          <option value={1}>Hoje</option>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {loading ? <div>Carregando...</div> : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total de Vendas</div>
              <div className="stat-value">R$ {Number(stats.total||0).toFixed(2)}</div>
              <div className="stat-detail">{stats.count || 0} transações</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ticket Médio</div>
              <div className="stat-value">R$ {Number(stats.avgTicket||0).toFixed(2)}</div>
              <div className="stat-detail">por transação</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Desconto</div>
              <div className="stat-value">R$ {Number(stats.totalDiscount||0).toFixed(2)}</div>
              <div className="stat-detail">{stats.count > 0 ? ((stats.totalDiscount / stats.total) * 100).toFixed(1) : 0}% do total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Transações</div>
              <div className="stat-value">{stats.count || 0}</div>
              <div className="stat-detail">vendas realizadas</div>
            </div>
          </div>

          <div className="report-section">
            <h3>Vendas por Forma de Pagamento</h3>
            <div className="payment-chart">
              {Object.entries(stats.byPayment || {}).map(([method, amount]) => {
                const percent = (amount / stats.total) * 100
                return (
                  <div key={method} className="chart-item">
                    <div className="chart-label">{method}</div>
                    <div className="chart-bar-container">
                      <div className="chart-bar" style={{ width: percent + '%', background: '#2b6ef6' }}></div>
                    </div>
                    <div className="chart-value">R$ {Number(amount).toFixed(2)} ({percent.toFixed(1)}%)</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="report-section">
            <h3>Vendas por Dia</h3>
            <div className="daily-chart">
              {Object.entries(stats.byDay || {}).sort().map(([day, amount]) => {
                const percent = (amount / maxDaily) * 100
                return (
                  <div key={day} className="daily-item">
                    <div className="daily-label">{day}</div>
                    <div className="daily-bar-container">
                      <div className="daily-bar" style={{ height: percent + '%', background: '#2b6ef6' }}></div>
                    </div>
                    <div className="daily-value">R$ {Number(amount).toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="report-section">
            <h3>Últimas Transações</h3>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Data/Hora</th><th>Cliente</th><th>Itens</th><th>Subtotal</th><th>Desconto</th><th>Total</th><th>Pagamento</th></tr></thead>
                <tbody>
                  {(stats.filtered || []).slice(0, 20).map(o=> (
                    <tr key={o.id}>
                      <td>{new Date(o.createdAt).toLocaleString('pt-BR')}</td>
                      <td>{o.customerId || 'Consumidor Final'}</td>
                      <td>{(o.items||[]).length}</td>
                      <td>R$ {Number(o.total||0).toFixed(2)}</td>
                      <td>R$ {Number(o.discount||0).toFixed(2)}</td>
                      <td><strong>R$ {Number(o.paymentAmount||0).toFixed(2)}</strong></td>
                      <td>{o.paymentMethod || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
