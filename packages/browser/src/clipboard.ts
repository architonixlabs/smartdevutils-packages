export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export async function readFromClipboard(): Promise<string> {
  return navigator.clipboard.readText()
}
