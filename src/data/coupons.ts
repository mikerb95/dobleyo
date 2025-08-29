export type Coupon = {
  code: string
  type: 'percent' | 'fixed'
  value: number // percent: 10 => 10% ; fixed in COP
}

export const coupons: Coupon[] = [
  { code: 'CAFECITO10', type: 'percent', value: 10 },
  { code: 'ENVIOGRATIS', type: 'fixed', value: 10000 },
]

export function getCoupon(code: string | undefined | null): Coupon | null {
  if (!code) return null
  const c = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase())
  return c ?? null
}
