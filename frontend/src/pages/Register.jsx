import React, { useState } from 'react'
import api from '../api'
import { useNavigate, Link } from 'react-router-dom'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  function formatCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 14)
    const p1 = digits.slice(0, 2)
    const p2 = digits.slice(2, 5)
    const p3 = digits.slice(5, 8)
    const p4 = digits.slice(8, 12)
    const p5 = digits.slice(12, 14)

    if (digits.length <= 2) return p1
    if (digits.length <= 5) return `${p1}.${p2}`
    if (digits.length <= 8) return `${p1}.${p2}.${p3}`
    if (digits.length <= 12) return `${p1}.${p2}.${p3}/${p4}`
    return `${p1}.${p2}.${p3}/${p4}-${p5}`
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cnpjDigits = companyCnpj.replace(/\D/g, '')

    if (password !== confirmPassword) {
      setError('As senhas nao conferem')
      return
    }

    if (password.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres')
      return
    }

    if (!companyName.trim()) {
      setError('Informe o nome da empresa')
      return
    }

    if (cnpjDigits.length !== 14) {
      setError('Informe um CNPJ valido com 14 digitos')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/register', {
        username: username.trim(),
        password,
        companyName: companyName.trim(),
        companyCnpj: cnpjDigits
      })
      setSuccess('Conta criada com sucesso. Redirecionando para login...')
      setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-scene register-scene">
      <span className="login-bubble login-bubble-a" aria-hidden="true"></span>
      <span className="login-bubble login-bubble-b" aria-hidden="true"></span>
      <span className="login-bubble login-bubble-c" aria-hidden="true"></span>
      <span className="login-rings" aria-hidden="true"></span>

      <div className="login-card">
        <section className="login-hero">
          <div className="login-logo-mark">YOUR LOGO</div>
          <h1>Create,<br />your account!</h1>
          <p>Registre sua conta para acessar o sistema em qualquer dispositivo.</p>
          <div className="login-hero-shine" aria-hidden="true"></div>
        </section>

        <section className="login-form-wrap">
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="register-username">Email address</label>
            <input
              id="register-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@mail.com"
              autoComplete="username"
              required
            />

            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              required
            />

            <label htmlFor="register-company-name">Nome da empresa</label>
            <input
              id="register-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Minha Empresa LTDA"
              autoComplete="organization"
              required
            />

            <label htmlFor="register-company-cnpj">CNPJ da empresa</label>
            <input
              id="register-company-cnpj"
              value={companyCnpj}
              onChange={(e) => setCompanyCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              required
            />

            <label htmlFor="register-confirm">Confirm password</label>
            <input
              id="register-confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              required
            />

            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}

            <div className="login-actions">
              <button type="submit" className="login-btn login-btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Register'}
              </button>
              <Link to="/login" className="login-btn login-btn-secondary">Sign in</Link>
            </div>
          </form>

          <div className="login-social-row">
            <span>FOLLOW</span>
            <span className="login-social-icon" aria-hidden="true">f</span>
            <span className="login-social-icon" aria-hidden="true">t</span>
            <span className="login-social-icon" aria-hidden="true">i</span>
          </div>
        </section>
      </div>
    </div>
  )
}
