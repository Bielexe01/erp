import React, { useState } from 'react'
import api from '../api'
import { useNavigate, Link } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/auth/login', { username, password })
      localStorage.setItem('pdv_token', res.data.token)
      if (res?.data?.user) {
        localStorage.setItem('pdv_user', JSON.stringify(res.data.user))
      } else {
        try {
          const me = await api.get('/auth/me')
          if (me?.data?.id) {
            localStorage.setItem('pdv_user', JSON.stringify(me.data))
          }
        } catch (_) {
          // keep login flow even if /me fails
        }
      }
      localStorage.setItem('pdv_remember', rememberMe ? '1' : '0')
      navigate('/')
    } catch (err) {
      setError('Usuario ou senha invalidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-scene">
      <span className="login-bubble login-bubble-a" aria-hidden="true"></span>
      <span className="login-bubble login-bubble-b" aria-hidden="true"></span>
      <span className="login-bubble login-bubble-c" aria-hidden="true"></span>
      <span className="login-rings" aria-hidden="true"></span>

      <div className="login-card">
        <section className="login-hero">
          <div className="login-logo-mark">ERP BRITT</div>
          <h1>OLÁ,<br />BEM VINDO!</h1>
          <p>Somos o melhor ERP do mercado, prezamos pelas melhores práticas de desenvolvimento e segurança.</p>
          <div className="login-hero-shine" aria-hidden="true"></div>
        </section>

        <section className="login-form-wrap">
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">Email address</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@mail.com"
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />

            <div className="login-inline-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Me lembrar
              </label>
              <button type="button" className="login-link-btn">Esqueceu a senha?</button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <div className="login-actions">
              <button type="submit" className="login-btn login-btn-primary" disabled={loading}>
                {loading ? 'Loading...' : 'Login'}
              </button>
              <Link to="/register" className="login-btn login-btn-secondary">Sign up</Link>
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
