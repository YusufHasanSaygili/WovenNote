import { z } from 'zod'

export const TAG_COLORS = [
  '#5364d8',
  '#b42318',
  '#c2410c',
  '#047857',
  '#1d4ed8',
  '#7e22ce',
] as const

export const TagSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(40),
    color: z.enum(TAG_COLORS),
    createdAt: z.iso.datetime(),
  })
  .strict()

export type Tag = z.infer<typeof TagSchema>
