import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CART_RULES_MODULE } from "../modules/cart-rules"
import type CartRulesModuleService from "../modules/cart-rules/service"
import { evaluate } from "../modules/cart-rules/engine"
import { loadCart, loadCustomerGroupIds, loadVariantLines } from "./cart-context"

export type CartAction = "add_to_cart" | "update_item" | "complete_cart"

type Params = {
  cart_id: string
  action: CartAction
  add_items?: { variant_id: string; quantity: number }[]
  update?: { item_id: string; quantity?: number }
}

export const CART_RULE_ERROR_CODE = "CART_RULE_VIOLATION"

export async function validateCart(container: MedusaContainer, p: Params) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const service = container.resolve<CartRulesModuleService>(CART_RULES_MODULE)

  const rules = await service.listEvaluableRules()
  if (!rules.length) return

  const loaded = await loadCart(query, p.cart_id)
  if (!loaded) return
  const { cart, customer_id } = loaded

  let items = cart.items
  const touched = new Set<string>()

  if (p.action === "add_to_cart") {
    const extra = await loadVariantLines(query, p.add_items ?? [])
    extra.forEach((l) => l.product_id && touched.add(l.product_id))
    items = [...items, ...extra]
  } else if (p.action === "update_item") {
    const line = items.find((l) => l.id === p.update?.item_id)
    const next = p.update?.quantity
    // decreasing / non-quantity edits are always allowed (lets users fix an over-limit cart)
    if (!line || next == null || next <= line.quantity) return
    if (line.product_id) touched.add(line.product_id)
    items = items.map((l) => (l.id === line.id ? { ...l, quantity: next } : l))
  }

  const ctx = {
    customer_group_ids: await loadCustomerGroupIds(query, customer_id),
    is_guest: !customer_id,
    strategy: service.getConflictStrategy(),
  }

  let violations = evaluate({ ...cart, items }, rules, ctx)
  if (p.action !== "complete_cart") {
    // only block for limits the current action actually pushes
    violations = violations.filter((v) => v.kind === "max" && v.product_ids.some((id) => touched.has(id)))
  }
  if (!violations.length) return

  try {
    await service.logViolations(
      violations.map((v) => ({
        rule_id: v.rule_id, rule_type: v.rule_type, cart_id: cart.id, customer_id,
        action: p.action, limit_value: v.limit, current_value: v.current, message: v.message,
      }))
    )
  } catch {
    /* logging must never mask the real error */
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    Array.from(new Set(violations.map((v) => v.message))).join(" "),
    CART_RULE_ERROR_CODE
  )
}
