/** Base-unit <-> human decimal conversion for token amounts (all amounts are bigint base units). */

/** Format a base-unit bigint as a human decimal string (e.g. 1500000, 6 -> "1.5"). */
export function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n
  const v = neg ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`
}

/** Parse a human decimal string into a base-unit bigint (e.g. "1.5", 6 -> 1500000n). */
export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error(`invalid amount: "${value}"`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
}
