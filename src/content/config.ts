import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const lensSchema = z.enum(['topography', 'gis', 'software'])
const lngLat = z.tuple([z.number(), z.number()])

const archDiagramSchema = z.object({
  viewBox: z.string(),
  label: z.string(),
  nodes: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
      title: z.string(),
      sub: z.array(z.string()).optional(),
      highlight: z.boolean().optional(),
    })
  ),
  flows: z.array(z.string()),
})

const mediaImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
  es: z.object({ alt: z.string().optional(), caption: z.string().optional() }).optional(),
})

/** Carrusel de imágenes o video. Opcional: sin material, no se declara. */
const mediaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('images'), images: z.array(mediaImageSchema).min(1) }),
  z.object({
    type: z.literal('video'),
    src: z.string(),
    title: z.string(),
    poster: z.string().optional(),
    es: z.object({ title: z.string().optional() }).optional(),
  }),
])

/** Enlace de redirección (demo, sitio, repositorio). */
const linkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
  es: z.object({ label: z.string().optional() }).optional(),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    order: z.number(),
    featured: z.boolean(),
    draft: z.boolean().optional(),
    lens: lensSchema,
    status: z.enum(['production', 'delivered', 'in-progress']),
    tag: z.string(),
    meta: z.string(),
    summary: z.string(),
    impact: z.string().optional(),
    points: z.array(z.string()).optional(),
    stack: z.array(z.string()),
    icon: z.enum(['building', 'chart', 'pin', 'terrain', 'code']).optional(),
    diagram: archDiagramSchema.optional(),
    media: mediaSchema.optional(),
    link: linkSchema.optional(),
    layer: z.object({
      kind: z.enum(['lots', 'points', 'routes', 'graduated', 'study-area']),
      anchor: lngLat,
      note: z.string(),
    }),
    /** Textos en español. Lo que falte cae al inglés. */
    es: z
      .object({
        title: z.string().optional(),
        tag: z.string().optional(),
        meta: z.string().optional(),
        summary: z.string().optional(),
        impact: z.string().optional(),
        points: z.array(z.string()).optional(),
        diagram: archDiagramSchema.optional(),
        layerNote: z.string().optional(),
      })
      .optional(),
  }),
})

const headlineSchema = z.object({ before: z.string(), highlight: z.string(), after: z.string() })
const statsSchema = z.array(z.object({ value: z.string(), label: z.string() }))
const skillsSchema = z.array(z.object({ group: z.string(), items: z.array(z.string()) }))

const profile = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/profile' }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    shortName: z.string(),
    fullName: z.string(),
    role: z.string(),
    photo: z.string(),
    origin: z.object({ label: z.string(), coord: lngLat }),
    headline: headlineSchema,
    lead: z.string(),
    stats: statsSchema,
    workNote: z.string(),
    skills: skillsSchema,
    timeline: z.array(
      z.object({
        code: z.string().optional(),
        when: z.string(),
        title: z.string(),
        org: z.string(),
        station: lngLat.optional(),
      })
    ),
    contact: z.object({
      title: z.string(),
      body: z.string(),
      email: z.string(),
      linkedin: z.string(),
      github: z.string(),
    }),
    footer: z.string(),
    /** Textos en español. Lo que falte cae al inglés. */
    es: z
      .object({
        role: z.string().optional(),
        headline: headlineSchema.optional(),
        lead: z.string().optional(),
        stats: statsSchema.optional(),
        workNote: z.string().optional(),
        skills: skillsSchema.optional(),
        timeline: z.array(z.object({ when: z.string(), title: z.string(), org: z.string() })).optional(),
        contact: z.object({ title: z.string(), body: z.string() }).optional(),
      })
      .optional(),
  }),
})

export const collections = { projects, profile }
