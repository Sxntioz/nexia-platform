import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App.jsx'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('muestra la propuesta principal del proyecto', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Entornos educativos/i })).toBeInTheDocument()
  })

  it('no muestra el botón de Modo administrador para usuarios anónimos', () => {
    render(<App />)
    expect(screen.queryByText(/Modo administrador/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Acceso demo administrativa/i)).not.toBeInTheDocument()
  })

  it('muestra el modal de autenticación al hacer clic en Crear reporte sin sesión', () => {
    render(<App />)
    const createButtons = screen.getAllByRole('button', { name: /Crear reporte/i })
    fireEvent.click(createButtons[0])

    expect(screen.getByRole('heading', { name: /Crear una cuenta/i })).toBeInTheDocument()
    expect(screen.getByText(/Relación con la institución/i)).toBeInTheDocument()
  })
})
