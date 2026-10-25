import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CART_RULES_MODULE } from "../../../modules/cart-rules"
import type CartRulesModuleService from "../../../modules/cart-rules/service"
import { describeLimits } from "../../../modules/cart-rules/engine"
import { loadCart, loadCustomerGroupIds, loadVariantLines } from "../../../lib/cart-context"

/**
 * GET /store/cart-rules?cart_id=cart_x            -> limits + remaining per cart line
 * GET /store/cart-rules?cart_id=cart_x&variant_id -> also how many of that variant can still be added
 * GET /store/cart-rules?variant_id=variant_x      -> PDP limit without a cart (guest / logged-in customer)
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const cartId = typeof req.query.cart_id === "string" ? req.query.cart_id : undefined
  const variantId = typeof req.query.variant_id === "string" ? req.query.variant_id : undefined
  if (!cartId && !variantId)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cart_id or variant_id is required")

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)

  let cart = { id: "none", sales_channel_id: null as string | null, items: [] as any[] }
  let customerId: string | null = req.auth_context?.actor_type === "customer" ? req.auth_context.actor_id : null
  if (cartId) {
    const loaded = await loadCart(query, cartId)
    if (!loaded) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart ${cartId} not found`)
    cart = loaded.cart
    customerId = loaded.customer_id
  }

  const probe = variantId ? await loadVariantLines(query, [{ variant_id: variantId, quantity: 0 }]) : []
  const evalCart = { ...cart, items: [...cart.items, ...probe] }

  const rules = await service.listEvaluableRules()
  const d = describeLimits(evalCart, rules, {
    customer_group_ids: await loadCustomerGroupIds(query, customerId),
    is_guest: !customerId,
    strategy: service.getConflictStrategy(),
  })

  const probeId = probe[0]?.id
  res.json({
    limits: d.limits,
    lines: Object.fromEntries(Object.entries(d.lines).filter(([id]) => id !== probeId)),
    variant: probeId ? { variant_id: variantId, remaining: d.lines[probeId]?.remaining ?? null } : undefined,
  })
}
