export type ScopeType = "global" | "product" | "variant" | "collection" | "category"
export type ConflictStrategy = "restrictive" | "permissive"

export type CartRuleDTO = {
  id: string
  name: string
  is_active: boolean
  priority: number
  rule_type: string
  value: number
  scope_type: ScopeType
  scope_id: string | null
  customer_group_id: string | null
  apply_to_guests: boolean
  sales_channel_id: string | null
  message: string | null
  starts_at: Date | string | null
  ends_at: Date | string | null
  conditions?: Record<string, unknown> | null
}

export type EvalLine = {
  id: string
  title?: string | null
  variant_id: string | null
  product_id: string | null
  collection_id?: string | null
  category_ids: string[]
  quantity: number
}

export type EvalCart = {
  id: string
  sales_channel_id?: string | null
  items: EvalLine[]
}

export type EvalContext = {
  customer_group_ids: string[]
  is_guest: boolean
  strategy?: ConflictStrategy
  now?: Date
}

/** One measured limit: "<current> of <limit>" for a resolved rule + the lines it covers. */
export type Measurement = {
  rule: CartRuleDTO
  kind: "max" | "min"
  limit: number
  current: number
  line_ids: string[]
  product_ids: string[]
  variant_ids: string[]
  titles: string[]
}

export type RuleTypeHandler = {
  label: string
  defaultMessage: string // placeholders: {limit} {current} {product}
  measure: (
    cart: EvalCart,
    rules: CartRuleDTO[],
    ctx: EvalContext & { strategy: ConflictStrategy }
  ) => Measurement[]
}

export type Violation = {
  rule_id: string
  rule_type: string
  kind: "max" | "min"
  limit: number
  current: number
  message: string
  line_item_ids: string[]
  product_ids: string[]
  variant_ids: string[]
}

export type LimitInfo = {
  rule_id: string
  rule_type: string
  scope_type: ScopeType
  scope_id: string | null
  limit: number
  current: number
  remaining: number
}

export type LineLimit = { max_quantity: number; remaining: number }
