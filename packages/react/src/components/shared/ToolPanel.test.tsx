import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToolPanel } from './ToolPanel'
import { CopyButton } from './CopyButton'

describe('ToolPanel', () => {
  it('renders title and children', () => {
    render(<ToolPanel title="Test Tool"><p>content</p></ToolPanel>)
    expect(screen.getByText('Test Tool')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<ToolPanel title="T" description="desc"><p>x</p></ToolPanel>)
    expect(screen.getByText('desc')).toBeInTheDocument()
  })
})

describe('CopyButton', () => {
  it('shows "Copied!" briefly after click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<CopyButton text="hello" />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })
})
