import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
})

export async function POST(request: Request) {
  try {
    const { items } = await request.json()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((i: any) => ({
        price_data: {
          currency: 'cop',
          product_data: { name: i.name },
          unit_amount: i.price,
        },
        quantity: i.qty,
      })),
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/cart`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'checkout_error' }, { status: 500 })
  }
}
