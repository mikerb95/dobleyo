import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: rule => rule.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' }, validation: rule => rule.required() }),
    defineField({ name: 'mainImage', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'tastingNotes', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'origin', type: 'string' }),
    defineField({ name: 'process', type: 'string' }),
    defineField({ name: 'roast', type: 'string' }),
    defineField({
      name: 'variants',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'id', type: 'string', validation: r => r.required() },
            { name: 'label', type: 'string', validation: r => r.required() },
            { name: 'size', type: 'string' },
            { name: 'grind', type: 'string' },
            { name: 'price', type: 'number', validation: r => r.required().min(0) },
          ]
        }
      ]
    })
  ]
})
