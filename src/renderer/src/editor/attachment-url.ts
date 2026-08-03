export function attachmentContentUrl(attachmentId: string): string {
  return `wovennote-attachment://media/${encodeURIComponent(attachmentId)}`
}
