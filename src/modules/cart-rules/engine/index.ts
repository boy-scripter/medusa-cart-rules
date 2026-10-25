import type {
  CartRuleDTO, ConflictStrategy, EvalCart, EvalContext, EvalLine, LimitInfo, LineLimit,
  Measurement, RuleTypeHandler, Violation,
} from "./types"

export * from "./types"

/* ------------------------------ registry ------------------------------ */
const registry = new Map<string, RuleTypeHandler>()
export const registerRuleType = (type: string, h: RuleTypeHandler) => { registry.set(type, h) }
export const hasRuleType = (type: string) => registry.has(type)
export const listRuleTypes = () => Array.from(registry, ([type, h]) => ({ type, label: h.label }))

/* ------------------------------ helpers ------------------------------ */
const sum = (lines: EvalLine[]) => lines.reduce((n, l) => n + l.quantity, 0)
const uniq = <T,>(a: T[]) => Array.from(new Set(a))

export function matchesScope(l: EvalLine, r: CartRuleDTO): boolean {
  switch (r.scope_type) {
    case "global": return true
    case "product": return !!r.scope_id && l.product_id === r.scope_id
    case "variant": return !!r.scope_id && l.variant_id === r.scope_id
    case "collection": return !!r.scope_id && l.collection_id === r.scope_id
    case "category": return !!r.scope_id && l.category_ids.includes(r.scope_id)
  }
}

const better = (a: CartRuleDTO, b: CartRuleDTO, s: ConflictStrategy) =>
  a.value !== b.value ? (s === "restrictive" ? a.value < b.value : a.value > b.value) : a.priority > b.priority

const pickOne = (rules: CartRuleDTO[], s: ConflictStrategy) =>
  rules.reduce((best, r) => (better(r, best, s) ? r : best))

/** Same scope target: group-specific rules override "everyone" rules; then strategy picks one. */
export function resolveBucket(rules: CartRuleDTO[], s: ConflictStrategy): CartRuleDTO {
  const specific = rules.filter((r) => r.customer_group_id)
  return pickOne(specific.length ? specific : rules, s)
}

export function resolveBuckets(rules: CartRuleDTO[], s: ConflictStrategy): CartRuleDTO[] {
  const buckets = new Map<string, CartRuleDTO[]>()
  for (const r of rules) {
    const k = `${r.scope_type}:${r.scope_id ?? ""}`
    buckets.set(k, [...(buckets.get(k) ?? []), r])
  }
  return Array.from(buckets.values(), (g) => resolveBucket(g, s))
}

const measurement = (rule: CartRuleDTO, kind: "max" | "min", lines: EvalLine[]): Measurement => ({
  rule, kind, limit: rule.value, current: sum(lines),
  line_ids: lines.map((l) => l.id),
  product_ids: uniq(lines.map((l) => l.product_id).filter(Boolean) as string[]),
  variant_ids: uniq(lines.map((l) => l.variant_id).filter(Boolean) as string[]),
  titles: uniq(lines.map((l) => l.title).filter(Boolean) as string[]),
})

/* ------------------------- built-in rule types ------------------------- */
// Specificity for per-product rules: variant > product > collection/category > global
const TIERS: CartRuleDTO["scope_type"][][] = [["variant"], ["product"], ["collection", "category"], ["global"]]

function effectiveRule(line: EvalLine, rules: CartRuleDTO[], s: ConflictStrategy) {
  for (const tier of TIERS) {
    const cands = rules.filter((r) => tier.includes(r.scope_type) && matchesScope(line, r))
    if (cands.length) return pickOne(resolveBuckets(cands, s), s)
  }
  return null
}

registerRuleType("max_cart_quantity", {
  label: "Max items in cart",
  defaultMessage: "You can't have more than {limit} items in your cart.",
  // each scope target is an independent combined limit (global = whole cart)
  measure: (cart, rules, ctx) =>
    resolveBuckets(rules, ctx.strategy).map((rule) =>
      measurement(rule, "max", cart.items.filter((l) => matchesScope(l, rule)))
    ),
})

registerRuleType("max_product_quantity", {
  label: "Max quantity per product",
  defaultMessage: "You can add at most {limit} of {product}.",
  measure: (cart, rules, ctx) => {
    const groups = new Map<string, { rule: CartRuleDTO; lines: EvalLine[] }>()
    for (const line of cart.items) {
      const rule = effectiveRule(line, rules, ctx.strategy)
      if (!rule) continue
      const unit = (rule.scope_type === "variant" ? line.variant_id : line.product_id) ?? line.id
      const key = `${rule.id}|${unit}`
      const g = groups.get(key) ?? { rule, lines: [] }
      g.lines.push(line)
      groups.set(key, g)
    }
    return Array.from(groups.values(), (g) => measurement(g.rule, "max", g.lines))
  },
})

/* ------------------------------ evaluation ------------------------------ */
export function filterApplicable(rules: CartRuleDTO[], cart: EvalCart, ctx: EvalContext): CartRuleDTO[] {
  const now = (ctx.now ?? new Date()).getTime()
  return rules.filter((r) => {
    if (!r.is_active) return false
    if (r.starts_at && new Date(r.starts_at).getTime() > now) return false
    if (r.ends_at && new Date(r.ends_at).getTime() < now) return false
    if (r.sales_channel_id && r.sales_channel_id !== cart.sales_channel_id) return false
    if (r.customer_group_id) return !ctx.is_guest && ctx.customer_group_ids.includes(r.customer_group_id)
    return ctx.is_guest ? r.apply_to_guests : true
  })
}

export function measureAll(cart: EvalCart, rules: CartRuleDTO[], ctx: EvalContext): Measurement[] {
  const c = { ...ctx, strategy: ctx.strategy ?? ("restrictive" as ConflictStrategy) }
  const byType = new Map<string, CartRuleDTO[]>()
  for (const r of filterApplicable(rules, cart, ctx)) byType.set(r.rule_type, [...(byType.get(r.rule_type) ?? []), r])
  const out: Measurement[] = []
  for (const [type, rs] of byType) {
    const h = registry.get(type)
    if (h) out.push(...h.measure(cart, rs, c))
  }
  return out
}

export function renderMessage(m: Measurement): string {
  const tpl = m.rule.message || registry.get(m.rule.rule_type)?.defaultMessage || "Cart rule violated."
  return tpl
    .split("{limit}").join(String(m.limit))
    .split("{current}").join(String(m.current))
    .split("{product}").join(m.titles[0] ?? "this product")
}

const violated = (m: Measurement) => (m.kind === "max" ? m.current > m.limit : m.current < m.limit)

/** Pure: no I/O. */
export function evaluate(cart: EvalCart, rules: CartRuleDTO[], ctx: EvalContext): Violation[] {
  return measureAll(cart, rules, ctx).filter(violated).map((m) => ({
    rule_id: m.rule.id, rule_type: m.rule.rule_type, kind: m.kind,
    limit: m.limit, current: m.current, message: renderMessage(m),
    line_item_ids: m.line_ids, product_ids: m.product_ids, variant_ids: m.variant_ids,
  }))
}

/** Effective limits + remaining quantity (for storefront UI). */
export function describeLimits(cart: EvalCart, rules: CartRuleDTO[], ctx: EvalContext) {
  const ms = measureAll(cart, rules, ctx).filter((m) => m.kind === "max")
  const limits: LimitInfo[] = ms.map((m) => ({
    rule_id: m.rule.id, rule_type: m.rule.rule_type, scope_type: m.rule.scope_type,
    scope_id: m.rule.scope_id, limit: m.limit, current: m.current,
    remaining: Math.max(0, m.limit - m.current),
  }))
  const lines: Record<string, LineLimit> = {}
  for (const line of cart.items) {
    let remaining = Infinity
    for (const m of ms) if (m.line_ids.includes(line.id)) remaining = Math.min(remaining, Math.max(0, m.limit - m.current))
    if (remaining !== Infinity) lines[line.id] = { remaining, max_quantity: line.quantity + remaining }
  }
  return { limits, lines }
}
