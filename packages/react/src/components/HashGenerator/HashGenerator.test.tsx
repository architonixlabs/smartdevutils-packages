import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HashGenerator } from './index'

describe('HashGenerator', () => {
  it('renders without crashing', () => {
    render(<HashGenerator />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows hash output when input is provided via defaultInput', () => {
    render(<HashGenerator defaultInput="hello" defaultAlgorithm="sha256" />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('calls onResult when user types', () => {
    const onResult = vi.fn()
    render(<HashGenerator onResult={onResult} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(onResult).toHaveBeenCalled()
  })

  it('renders algorithm selector buttons', () => {
    render(<HashGenerator />)
    expect(screen.getByText('MD5')).toBeInTheDocument()
    expect(screen.getByText('SHA-256')).toBeInTheDocument()
  })
})
