export function returnPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') &&
    !value.includes('\\') && !Array.from(value).some((character) => character <= ' ')
    ? value
    : '/dashboard'
}
