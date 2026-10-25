import { z } from "@medusajs/framework/zod"

const date = z.null().or(z.coerce.date())

const base = z.object({
  name: z.string().min(1),
  is_active: z.boolean().default(true),
  priority: z.number().int().default(0),
  rule_type: z.string().min(1),
  value: z.number().int().min(0),
  scope_type: z.enum(["global", "product", "variant", "collection", "category"]).default("global"),
  scope_id: z.string().nullable().optional(),
  customer_group_id: z.string().nullable().optional(),
  apply_to_guests: z.boolean().default(true),
  sales_channel_id: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  starts_at: date.optional(),
  ends_at: date.optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const CreateCartRuleSchema = base.refine(
  (v) => v.scope_type === "global" || !!v.scope_id,
  { message: "scope_id is required unless scope_type is global", path: ["scope_id"] }
)
export const UpdateCartRuleSchema = base.partial()

export const SimulateSchema = z
  .object({
    cart_id: z.string().optional(),
    customer_id: z.string().nullable().optional(),
    items: z.array(z.object({ variant_id: z.string(), quantity: z.number().int().positive() })).optional(),
  })
  .refine((v) => v.cart_id || v.items?.length, { message: "Provide cart_id or items" })

export type CreateCartRuleBody = z.infer<typeof CreateCartRuleSchema>
export type UpdateCartRuleBody = z.infer<typeof UpdateCartRuleSchema>
export type SimulateBody = z.infer<typeof SimulateSchema>
