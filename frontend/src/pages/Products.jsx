import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import '../styles.css'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function getApiOrigin() {
  const configured = import.meta.env.VITE_API_URL || api.defaults.baseURL || 'http://localhost:5000/api'
  try {
    return new URL(configured, window.location.origin).origin
  } catch (err) {
    return window.location.origin
  }
}

function resolveImageUrl(path, apiOrigin) {
  const value = String(path || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value

  const normalized = value.startsWith('/') ? value : `/${value}`
  return `${apiOrigin}${normalized}`
}

function isNumericField(name) {
  return [
    'qtdEmbalagem',
    'custoBruto',
    'percentMarkup',
    'precoVenda',
    'estoque',
    'estoqueMinimo',
    'comissao'
  ].includes(name)
}

export default function Products() {
  const [list, setList] = useState([])
  const [filtro, setFiltro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [brokenThumbs, setBrokenThumbs] = useState({})
  const [photoPreviewError, setPhotoPreviewError] = useState(false)

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    embalagem: 'UN',
    qtdEmbalagem: 1,
    custoBruto: 0,
    percentMarkup: 0,
    precoVenda: 0,
    estoque: 0,
    estoqueMinimo: 0,
    validade: '',
    categoria: '',
    fornecedor: '',
    marca: '',
    gtin: '',
    comissao: 0,
    observacao: '',
    foto: ''
  })

  const apiOrigin = useMemo(() => getApiOrigin(), [])

  useEffect(() => { load() }, [])

  useEffect(() => {
    setPhotoPreviewError(false)
  }, [formData.foto, showModal])

  async function load() {
    try {
      const res = await api.get('/products')
      setList(res.data || [])
      setBrokenThumbs({})
    } catch (err) {
      console.error(err)
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: isNumericField(name) ? toNumber(value) : value
    }))
  }

  function calcularPrecoVenda() {
    const custo = toNumber(formData.custoBruto)
    const markup = toNumber(formData.percentMarkup)
    const preco = custo + (custo * markup / 100)
    setFormData(prev => ({ ...prev, precoVenda: Math.round(preco * 100) / 100 }))
  }

  useEffect(() => {
    if (formData.custoBruto && formData.percentMarkup) {
      calcularPrecoVenda()
    }
  }, [formData.custoBruto, formData.percentMarkup])

  async function save() {
    if (!formData.name) {
      alert('Nome do produto e obrigatorio')
      return
    }

    try {
      if (isEdit) {
        await api.put(`/products/${editingId}`, formData)
      } else {
        await api.post('/products', formData)
      }
      resetForm()
      setShowModal(false)
      load()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar produto')
    }
  }

  async function remove(id) {
    if (!confirm('Remover este produto?')) return
    try {
      await api.delete(`/products/${id}`)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  function resetForm() {
    setFormData({
      sku: '',
      name: '',
      embalagem: 'UN',
      qtdEmbalagem: 1,
      custoBruto: 0,
      percentMarkup: 0,
      precoVenda: 0,
      estoque: 0,
      estoqueMinimo: 0,
      validade: '',
      categoria: '',
      fornecedor: '',
      marca: '',
      gtin: '',
      comissao: 0,
      observacao: '',
      foto: ''
    })
    setEditingId(null)
    setIsEdit(false)
    setPhotoPreviewError(false)
  }

  function openNew() {
    resetForm()
    setIsEdit(false)
    setShowModal(true)
  }

  function openEdit(p) {
    setFormData({
      sku: p.sku || '',
      name: p.name || '',
      embalagem: p.embalagem || 'UN',
      qtdEmbalagem: p.qtdEmbalagem || 1,
      custoBruto: toNumber(p.custoBruto),
      percentMarkup: toNumber(p.percentMarkup),
      precoVenda: toNumber(p.precoVenda),
      estoque: toNumber(p.estoque),
      estoqueMinimo: toNumber(p.estoqueMinimo),
      validade: p.validade ? new Date(p.validade).toISOString().split('T')[0] : '',
      categoria: p.categoria || '',
      fornecedor: p.fornecedor || '',
      marca: p.marca || '',
      gtin: p.gtin || '',
      foto: p.foto || '',
      comissao: toNumber(p.comissao),
      observacao: p.observacao || ''
    })
    setEditingId(p.id)
    setIsEdit(true)
    setShowModal(true)
    setPhotoPreviewError(false)
  }

  async function uploadPhoto(file) {
    if (!file) return

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setFormData(prev => ({ ...prev, foto: res.data.url || '' }))
      setPhotoPreviewError(false)
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar imagem')
    }
  }

  const listFiltrada = list.filter(p => {
    const q = filtro.toLowerCase().trim()
    if (!q) return true

    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.categoria || '').toLowerCase().includes(q) ||
      String(p.gtin || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <div className="products-header">
        <h2>Produtos</h2>
        <button className="btn-primary" onClick={openNew}>+ Novo Produto</button>
      </div>

      <div className="filter-section">
        <input
          type="text"
          placeholder="Buscar por codigo, nome, GTIN ou categoria..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="input-search"
        />
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Codigo</th>
              <th>Nome</th>
              <th>Embalagem</th>
              <th>Custo R$</th>
              <th>% Markup</th>
              <th>Venda R$</th>
              <th>Estoque</th>
              <th>Min.</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Marca</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {listFiltrada.map(p => {
              const thumbUrl = resolveImageUrl(p.foto, apiOrigin)
              const canShowThumb = !!thumbUrl && !brokenThumbs[p.id]

              return (
                <tr key={p.id}>
                  <td className="product-photo-cell">
                    {canShowThumb ? (
                      <img
                        src={thumbUrl}
                        alt={p.name || 'foto produto'}
                        className="product-thumb"
                        onError={() => setBrokenThumbs(prev => ({ ...prev, [p.id]: true }))}
                        onClick={() => openEdit(p)}
                        title="Clique para editar"
                      />
                    ) : (
                      <div className="product-thumb-placeholder">-</div>
                    )}
                  </td>
                  <td><strong>{p.sku || '-'}</strong></td>
                  <td>{p.name}</td>
                  <td>{p.embalagem}/{toNumber(p.qtdEmbalagem, 1)}</td>
                  <td className="text-right">R$ {toNumber(p.custoBruto).toFixed(2)}</td>
                  <td className="text-right">{toNumber(p.percentMarkup).toFixed(1)}%</td>
                  <td className="text-right"><strong>R$ {toNumber(p.precoVenda).toFixed(2)}</strong></td>
                  <td className="text-center">{toNumber(p.estoque)}</td>
                  <td className="text-center">{toNumber(p.estoqueMinimo)}</td>
                  <td>{p.categoria || '-'}</td>
                  <td>{p.fornecedor || '-'}</td>
                  <td>{p.marca || '-'}</td>
                  <td className="text-center">
                    <button className="btn-edit" onClick={() => openEdit(p)}>Editar</button>
                    <button className="btn-delete" onClick={() => remove(p.id)}>Remover</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content products-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEdit ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>x</button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Codigo (SKU)</label>
                  <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} placeholder="Codigo do produto" />
                </div>

                <div className="form-group">
                  <label>GTIN/EAN</label>
                  <input type="text" name="gtin" value={formData.gtin} onChange={handleInputChange} placeholder="GTIN/EAN" />
                </div>

                <div className="form-group full">
                  <label>*Nome do Produto</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Nome do produto" />
                </div>

                <div className="form-group">
                  <label>Embalagem</label>
                  <select name="embalagem" value={formData.embalagem} onChange={handleInputChange}>
                    <option>UN</option>
                    <option>CX</option>
                    <option>PC</option>
                    <option>KG</option>
                    <option>L</option>
                    <option>M</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Qtd/Embalagem</label>
                  <input type="number" name="qtdEmbalagem" value={formData.qtdEmbalagem} onChange={handleInputChange} min="1" />
                </div>

                <div className="form-group">
                  <label>Custo Bruto (R$)</label>
                  <input type="number" name="custoBruto" value={formData.custoBruto} onChange={handleInputChange} step="0.01" min="0" />
                </div>

                <div className="form-group">
                  <label>% Markup</label>
                  <input type="number" name="percentMarkup" value={formData.percentMarkup} onChange={handleInputChange} step="0.1" min="0" />
                </div>

                <div className="form-group">
                  <label>Preco Venda (R$)</label>
                  <input type="number" name="precoVenda" value={formData.precoVenda} onChange={handleInputChange} step="0.01" min="0" />
                </div>

                <div className="form-group">
                  <label>Estoque Atual</label>
                  <input type="number" name="estoque" value={formData.estoque} onChange={handleInputChange} min="0" />
                </div>

                <div className="form-group">
                  <label>Estoque Minimo</label>
                  <input type="number" name="estoqueMinimo" value={formData.estoqueMinimo} onChange={handleInputChange} min="0" />
                </div>

                <div className="form-group">
                  <label>Validade</label>
                  <input type="date" name="validade" value={formData.validade} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>% Comissao</label>
                  <input type="number" name="comissao" value={formData.comissao} onChange={handleInputChange} step="0.1" min="0" />
                </div>

                <div className="form-group">
                  <label>Categoria</label>
                  <input type="text" name="categoria" value={formData.categoria} onChange={handleInputChange} placeholder="Ex: Bebidas, Alimentos" />
                </div>

                <div className="form-group">
                  <label>Fornecedor</label>
                  <input type="text" name="fornecedor" value={formData.fornecedor} onChange={handleInputChange} placeholder="Nome do fornecedor" />
                </div>

                <div className="form-group">
                  <label>Marca</label>
                  <input type="text" name="marca" value={formData.marca} onChange={handleInputChange} placeholder="Marca" />
                </div>

                <div className="form-group full">
                  <label>Observacao</label>
                  <textarea name="observacao" value={formData.observacao} onChange={handleInputChange} placeholder="Observacoes sobre o produto" rows="3"></textarea>
                </div>

                <div className="form-group">
                  <label>Foto</label>
                  <input type="file" name="fotoFile" accept="image/*" onChange={async (e) => uploadPhoto(e.target.files?.[0])} />
                  {formData.foto && !photoPreviewError && (
                    <img
                      src={resolveImageUrl(formData.foto, apiOrigin)}
                      alt="foto"
                      style={{ width: 80, marginTop: 8, borderRadius: 4, border: '1px solid #eef4fb', objectFit: 'cover' }}
                      onError={() => setPhotoPreviewError(true)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={save}>
                {isEdit ? 'Atualizar' : 'Adicionar'} Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
