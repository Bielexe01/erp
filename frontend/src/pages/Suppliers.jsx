import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Suppliers() {
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    contact: '',
    notes: ''
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const res = await api.get('/suppliers')
      setList(res.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar fornecedores')
    }
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('Nome do fornecedor e obrigatorio')
      return
    }

    try {
      await api.post('/suppliers', form)
      setForm({ name: '', document: '', email: '', phone: '', contact: '', notes: '' })
      load()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao salvar fornecedor')
    }
  }

  async function remove(id) {
    if (!confirm('Remover fornecedor?')) return
    try {
      await api.delete(`/suppliers/${id}`)
      load()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao remover fornecedor')
    }
  }

  const filtered = list.filter(s => {
    const q = search.toLowerCase()
    return (
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.document || '').toLowerCase().includes(q) ||
      String(s.email || '').toLowerCase().includes(q) ||
      String(s.phone || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <h2>Fornecedores</h2>

      <form className="finance-form" onSubmit={save}>
        <div className="form-grid">
          <div className="form-group">
            <label>Nome</label>
            <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Fornecedor" />
          </div>
          <div className="form-group">
            <label>Documento</label>
            <input value={form.document} onChange={e => setForm(prev => ({ ...prev, document: e.target.value }))} placeholder="CNPJ/CPF" />
          </div>
          <div className="form-group">
            <label>Contato</label>
            <input value={form.contact} onChange={e => setForm(prev => ({ ...prev, contact: e.target.value }))} placeholder="Nome do contato" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@dominio.com" />
          </div>
          <div className="form-group">
            <label>Telefone</label>
            <input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="(00) 00000-0000" />
          </div>
          <div className="form-group full">
            <label>Observacoes</label>
            <input value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Informacoes adicionais" />
          </div>
        </div>
        <button type="submit" className="btn-primary">Adicionar fornecedor</button>
      </form>

      <div className="filter-section" style={{ marginTop: 14 }}>
        <div className="filter-group">
          <label>Busca</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, documento, email ou telefone" />
        </div>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Documento</th>
              <th>Contato</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.document || '-'}</td>
                <td>{s.contact || '-'}</td>
                <td>{s.email || '-'}</td>
                <td>{s.phone || '-'}</td>
                <td className="text-center">
                  <button className="btn-delete" onClick={() => remove(s.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
