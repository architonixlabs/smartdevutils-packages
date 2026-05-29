import React from 'react'

interface ToolPanelProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function ToolPanel({ title, description, children }: ToolPanelProps) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
