import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Customers(){
  const [list,setList] = useState([])
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [phone,setPhone] = useState('')

  useEffect(()=>{ load() }, [])
  async function load(){
    const res = await api.get('/customers')
    setList(res.data)
  }

  async function add(){
    if(!name) return
    await api.post('/customers',{ name, email, phone })
    setName(''); setEmail(''); setPhone('')
    load()
  }

  async function remove(id){
    if(!confirm('Remover cliente?')) return
    await api.delete(`/customers/${id}`)
    load()
  }

  return (
    <div className="page">
      <h2>Clientes</h2>
      <div className="form-row">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome" />
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefone" />
        <button onClick={add}>Adicionar</button>
      </div>

      <table className="table">
        <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Ações</th></tr></thead>
        <tbody>
          {list.map(c=> (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.email}</td>
              <td>{c.phone}</td>
              <td><button onClick={()=>remove(c.id)}>Remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
