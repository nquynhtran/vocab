export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function deleteFolderMessage(name: string, fileCount: number, termCount: number): string {
  if (fileCount === 0) return `Delete folder "${name}"?`
  return `Delete folder "${name}" and its ${plural(fileCount, 'file')} (${plural(termCount, 'term')})?`
}

export function deleteFileMessage(name: string, termCount: number): string {
  if (termCount === 0) return `Delete file "${name}"?`
  return `Delete file "${name}" and its ${plural(termCount, 'term')}?`
}

export function deleteTermMessage(word: string): string {
  return `Delete "${word}"?`
}
