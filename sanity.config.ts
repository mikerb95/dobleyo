import { defineConfig } from 'sanity'
import { schema } from './sanity/schema'

export default defineConfig({
  name: 'default',
  title: 'DobleYo CMS',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  plugins: [],
  schema,
})
