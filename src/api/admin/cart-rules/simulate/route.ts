import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CART_RULES_MODULE } from "../../../../modules/cart-rules"
import type CartRulesModuleService from "../../../../modules/cart-rules/service"
import { describeLimits, evaluate } from "../../../../modules/cart-rules/engine"
import { loadCart, loadCustomerGroupIds, loadVariantLines } from "../../../../lib/cart-context"
import type { SimulateBody } from "../../../validators"

/** Dry run: which rules would fire for a real cart and/or a hypothetical item list. */
export async function POST(req: MedusaRequest<SimulateBody>, res: MedusaResponse) {
  const { cart_id, customer_id, items } = req.validatedBody
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)

  let cart = { id: "simulated", sales_channel_id: null as string | null, items: [] as any[] }
  let customer = customer_id ?? null
  if (cart_id) {
    const loaded = await loadCart(query, cart_id)
    if (!loaded) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart ${cart_id} not found`)
    cart = loaded.cart
    if (customer_id === undefined) customer = loaded.customer_id
  }
  if (items?.length) cart.items = [...(cart_id ? cart.items : []), ...(await loadVariantLines(query, items))]

  const rules = await service.listEvaluableRules()
  const ctx = {
    customer_group_ids: await loadCustomerGroupIds(query, customer),
    is_guest: !customer,
    strategy: service.getConflictStrategy(),
  }
  res.json({
    violations: evaluate(cart, rules, ctx),
    ...describeLimits(cart, rules, ctx),
  })
}
