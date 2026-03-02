import React, { useEffect, useState } from 'react'
import api from '../api'

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Employees() {
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    role: '',
    hireDate: '',
    salary: '',
    phone: '',
    address: '',
    birthDate: ''
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const res = await api.get('/employees')
      setList(res.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar funcionarios')
    }
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      name: '',
      role: '',
      hireDate: '',
      salary: '',
      phone: '',
      address: '',
      birthDate: ''
    })
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('Nome do funcionario e obrigatorio')
      return
    }

    try {
      const payload = {
        ...form,
        salary: Number(form.salary || 0)
      }

      if (editingId) {
        await api.put(`/employees/${editingId}`, payload)
      } else {
        await api.post('/employees', payload)
      }

      resetForm()
      load()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao salvar funcionario')
    }
  }

  function edit(emp) {
    setEditingId(emp.id)
    setForm({
      name: emp.name || '',
      role: emp.role || '',
      hireDate: emp.hireDate || '',
      salary: Number(emp.salary || 0),
      phone: emp.phone || '',
      address: emp.address || '',
      birthDate: emp.birthDate || ''
    })
  }

  async function remove(id) {
    if (!confirm('Remover funcionario?')) return
    try {
      await api.delete(`/employees/${id}`)
      if (editingId === id) resetForm()
      load()
    } catch (err) {
      console.error(err)
      alert('Erro ao remover funcionario')
    }
  }

  const filtered = list.filter(emp => {
    const q = search.toLowerCase()
    return (
      String(emp.name || '').toLowerCase().includes(q) ||
      String(emp.role || '').toLowerCase().includes(q) ||
      String(emp.phone || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <h2>Funcionarios / Vendedores</h2>

      <form className="finance-form" onSubmit={save}>
        <div className="form-grid">
          <div className="form-group">
            <label>Nome</label>
            <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do funcionario" />
          </div>
          <div className="form-group">
            <label>Cargo</label>
            <input value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))} placeholder="Ex: Vendedor" />
          </div>
          <div className="form-group">
            <label>Data contratacao</label>
            <input type="date" value={form.hireDate} onChange={e => setForm(prev => ({ ...prev, hireDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Salario</label>
            <input type="number" step="0.01" min="0" value={form.salary} onChange={e => setForm(prev => ({ ...prev, salary: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Telefone</label>
            <input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Data nascimento</label>
            <input type="date" value={form.birthDate} onChange={e => setForm(prev => ({ ...prev, birthDate: e.target.value }))} />
          </div>
          <div className="form-group full">
            <label>Endereco</label>
            <input value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <button type="submit" className="btn-primary">{editingId ? 'Atualizar' : 'Adicionar'} funcionario</button>
          {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancelar edicao</button>}
        </div>
      </form>

      <div className="filter-section" style={{ marginTop: 14 }}>
        <div className="filter-group">
          <label>Busca</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, cargo ou telefone" />
        </div>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cargo</th>
              <th>Telefone</th>
              <th>Salario</th>
              <th>Contratacao</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id}>
                <td>{emp.name}</td>
                <td>{emp.role || '-'}</td>
                <td>{emp.phone || '-'}</td>
                <td className="text-right">{formatCurrency(emp.salary || 0)}</td>
                <td>{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="text-center">
                  <button className="btn-edit" onClick={() => edit(emp)}>Editar</button>
                  <button className="btn-delete" onClick={() => remove(emp.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
