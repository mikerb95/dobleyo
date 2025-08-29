import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { getCoupon } from '@/data/coupons'
import { shippingMethods } from '@/data/shipping'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
})

export async function POST(request: Request) {
  try {
    const { items, coupon: couponCode, shipping: shippingId, address } = await request.json()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const shipping = shippingMethods.find(m => m.id === (shippingId || 'standard')) || shippingMethods[0]
    const coupon = getCoupon(couponCode)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        ...items.map((i: any) => ({
        price_data: {
          currency: 'cop',
          product_data: { name: i.name },
          unit_amount: i.price,
        },
        quantity: i.qty,
        })),
        // shipping as a line item for simplicity
        {
          price_data: {
            currency: 'cop',
            product_data: { name: `Envío - ${shipping.name}` },
            unit_amount: shipping.price,
          },
          quantity: 1,
        },
      ],
      discounts: coupon ? [
        {
          coupon: coupon.type === 'percent'
            ? (await stripe.coupons.create({ percent_off: coupon.value, duration: 'once' })).id
            : (await stripe.coupons.create({ amount_off: coupon.value, currency: 'cop', duration: 'once' })).id
        }
      ] : undefined,
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/cart`,
      customer_email: undefined,
      shipping_address_collection: { allowed_countries: ['CO'] },
      metadata: {
        address: JSON.stringify(address || {}),
        coupon: coupon?.code || '',
        shipping: shipping.id,
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'checkout_error' }, { status: 500 })
  }
}
