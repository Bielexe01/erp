import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'

const defaultForm = {
  name: '',
  represented: '1 - GUARI DOCES',
  priceTable: '',
  nfeIssuer: '',
  logoUrl: '',
  textColor: '#ffffff',
  backgroundColor: '#0081e9',
  requireCpfAtStart: false,
  requireSellerAtStart: false,
  enableCharge: false,
  scaleEnabled: false,
  scalePort: '',
  scaleModel: '',
  printerType: 'termica80',
  printerName: '',
  printerCopies: 1,
  excluded: false,
  isDefault: false
}

function statusLabel(cfg) {
  return cfg.excluded ? 'Excluida' : 'Ativa'
}

function defaultLabel(cfg) {
  return cfg.isDefault ? 'Sim' : 'Nao'
}

export default function PDVConfig() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showExcluded, setShowExcluded] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('geral')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    load()
  }, [showExcluded])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/pdv-configs', {
        params: {
          includeExcluded: showExcluded
        }
      })
      setList(res.data || [])
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar configuracoes de frente de caixa')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm(defaultForm)
    setActiveTab('geral')
    setModalOpen(true)
  }

  function openEdit(cfg) {
    setEditingId(cfg.id)
    setForm({
      ...defaultForm,
      ...cfg,
      printerCopies: Number(cfg.printerCopies || 1)
    })
    setActiveTab('geral')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(defaultForm)
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function save() {
    if (!String(form.name || '').trim()) {
      alert('Nome da configuracao e obrigatorio')
      return
    }

    try {
      if (editingId) {
        await api.put(`/pdv-configs/${editingId}`, form)
      } else {
        await api.post('/pdv-configs', form)
      }
      closeModal()
      load()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao salvar configuracao')
    }
  }

  async function toggleExcluded(cfg) {
    try {
      await api.patch(`/pdv-configs/${cfg.id}/excluded`, { excluded: !cfg.excluded })
      load()
    } catch (err) {
      console.error(err)
      alert('Erro ao atualizar status')
    }
  }

  async function remove(cfg) {
    if (!confirm('Excluir configuracao definitivamente?')) return
    try {
      await api.delete(`/pdv-configs/${cfg.id}`)
      load()
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir configuracao')
    }
  }

  async function setAsDefault(cfg) {
    try {
      await api.patch(`/pdv-configs/${cfg.id}/default`)
      load()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Erro ao definir configuracao padrao')
    }
  }

  async function uploadLogo(file) {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      updateField('logoUrl', res.data.url)
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar logotipo')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return list

    return list.filter((cfg) =>
      String(cfg.name || '').toLowerCase().includes(q) ||
      String(cfg.represented || '').toLowerCase().includes(q) ||
      String(cfg.priceTable || '').toLowerCase().includes(q)
    )
  }, [list, search])

  return (
    <div className="page pdv-config-page">
      <h2>Configuracao Frente de Caixa</h2>

      <div className="pdv-config-toolbar">
        <button className="btn-primary" onClick={openNew}>+ Nova Configuracao de Frente de Caixa</button>
        <button className="btn-secondary" onClick={load}>Atualizar</button>
        <label className="pdv-config-checkbox">
          <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
          Exibir configuracoes excluidas
        </label>
        <button className="btn-secondary" type="button">Relatorio</button>
        <button className="btn-secondary" type="button">Videoaulas</button>
      </div>

      <div className="pdv-config-counter">{filtered.length} configuracoes de frente de caixa encontradas</div>

      <div className="filter-section">
        <div className="filter-group">
          <label>Buscar</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, representada ou tabela de preco" />
        </div>
      </div>

      {loading ? <div>Carregando...</div> : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Representada</th>
                <th>Tabela de Preco</th>
                <th>Padrao PDV</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cfg) => (
                <tr key={cfg.id} onDoubleClick={() => openEdit(cfg)}>
                  <td>{cfg.name}</td>
                  <td>{cfg.represented || '-'}</td>
                  <td>{cfg.priceTable || '-'}</td>
                  <td>{defaultLabel(cfg)}</td>
                  <td>{statusLabel(cfg)}</td>
                  <td className="text-center">
                    <button className="btn-edit" onClick={() => openEdit(cfg)}>Editar</button>
                    {!cfg.isDefault && !cfg.excluded && (
                      <button className="btn-secondary" onClick={() => setAsDefault(cfg)}>Usar no PDV</button>
                    )}
                    <button className="btn-secondary" onClick={() => toggleExcluded(cfg)}>
                      {cfg.excluded ? 'Restaurar' : 'Excluir'}
                    </button>
                    <button className="btn-delete" onClick={() => remove(cfg)}>Apagar</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">Nenhuma configuracao encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pdv-config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configuracao Frente de Caixa</h3>
              <button className="btn-close" onClick={closeModal}>x</button>
            </div>

            <div className="pdv-config-tabs">
              <button className={`pdv-tab ${activeTab === 'geral' ? 'active' : ''}`} onClick={() => setActiveTab('geral')}>Geral</button>
              <button className={`pdv-tab ${activeTab === 'balanca' ? 'active' : ''}`} onClick={() => setActiveTab('balanca')}>Balanca</button>
              <button className={`pdv-tab ${activeTab === 'impressora' ? 'active' : ''}`} onClick={() => setActiveTab('impressora')}>Impressora</button>
            </div>

            <div className="modal-body">
              {activeTab === 'geral' && (
                <div className="pdv-config-grid">
                  <div className="pdv-logo-panel">
                    <label>Logotipo</label>
                    <div className="pdv-logo-box">
                      {form.logoUrl
                        ? <img src={form.logoUrl} alt="Logo" className="pdv-logo-image" />
                        : <div className="pdv-logo-placeholder">Sem logo</div>
                      }
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} />
                  </div>

                  <div className="pdv-preview-panel">
                    <div className="pdv-color-row">
                      <label>Cor do texto</label>
                      <div className="pdv-color-inputs">
                        <input type="color" value={form.textColor} onChange={(e) => updateField('textColor', e.target.value)} />
                        <input type="text" value={form.textColor} onChange={(e) => updateField('textColor', e.target.value)} />
                      </div>
                    </div>

                    <div className="pdv-color-row">
                      <label>Cor do fundo</label>
                      <div className="pdv-color-inputs">
                        <input type="color" value={form.backgroundColor} onChange={(e) => updateField('backgroundColor', e.target.value)} />
                        <input type="text" value={form.backgroundColor} onChange={(e) => updateField('backgroundColor', e.target.value)} />
                      </div>
                    </div>

                    <div className="pdv-preview-card" style={{ color: form.textColor, background: form.backgroundColor }}>
                      texto
                    </div>
                  </div>

                  <div className="form-group full">
                    <label>Nome *</label>
                    <input value={form.name} onChange={(e) => updateField('name', e.target.value)} maxLength={20} placeholder="Ex: caixa 3 (L2)" />
                  </div>

                  <div className="form-group full">
                    <label>Representada *</label>
                    <input value={form.represented} onChange={(e) => updateField('represented', e.target.value)} placeholder="1 - GUARI DOCES" />
                  </div>

                  <div className="form-group full">
                    <label>Tabela de Precos</label>
                    <input value={form.priceTable} onChange={(e) => updateField('priceTable', e.target.value)} placeholder="PADRAO" />
                  </div>

                  <div className="form-group full">
                    <label>Emitente NFC-e</label>
                    <input value={form.nfeIssuer} onChange={(e) => updateField('nfeIssuer', e.target.value)} placeholder="Empresa emissora" />
                  </div>

                  <label className="pdv-config-checkbox full"><input type="checkbox" checked={form.requireCpfAtStart} onChange={(e) => updateField('requireCpfAtStart', e.target.checked)} />Informar CPF/CNPJ do consumidor no inicio da venda</label>
                  <label className="pdv-config-checkbox full"><input type="checkbox" checked={form.requireSellerAtStart} onChange={(e) => updateField('requireSellerAtStart', e.target.checked)} />Informar o vendedor no inicio da venda</label>
                  <label className="pdv-config-checkbox full"><input type="checkbox" checked={form.enableCharge} onChange={(e) => updateField('enableCharge', e.target.checked)} />Gerar cobranca</label>
                  <label className="pdv-config-checkbox full"><input type="checkbox" checked={form.isDefault} onChange={(e) => updateField('isDefault', e.target.checked)} />Usar esta configuracao como padrao do PDV</label>
                </div>
              )}

              {activeTab === 'balanca' && (
                <div className="form-grid">
                  <label className="pdv-config-checkbox full"><input type="checkbox" checked={form.scaleEnabled} onChange={(e) => updateField('scaleEnabled', e.target.checked)} />Habilitar integracao com balanca</label>
                  <div className="form-group">
                    <label>Modelo da balanca</label>
                    <select value={form.scaleModel} onChange={(e) => updateField('scaleModel', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="toledo">Toledo</option>
                      <option value="filizola">Filizola</option>
                      <option value="urano">Urano</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Porta serial</label>
                    <input value={form.scalePort} onChange={(e) => updateField('scalePort', e.target.value)} placeholder="COM1" />
                  </div>
                </div>
              )}

              {activeTab === 'impressora' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo de impressora</label>
                    <select value={form.printerType} onChange={(e) => updateField('printerType', e.target.value)}>
                      <option value="termica80">Termica 80mm</option>
                      <option value="termica58">Termica 58mm</option>
                      <option value="a4">A4</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nome da impressora</label>
                    <input value={form.printerName} onChange={(e) => updateField('printerName', e.target.value)} placeholder="Epson TM-T20" />
                  </div>
                  <div className="form-group">
                    <label>Numero de copias</label>
                    <input type="number" min="1" max="5" value={form.printerCopies} onChange={(e) => updateField('printerCopies', Number(e.target.value || 1))} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
