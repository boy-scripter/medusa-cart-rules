import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CART_RULES_MODULE } from "../../../../modules/cart-rules"
import type CartRulesModuleService from "../../../../modules/cart-rules/service"
import { hasRuleType } from "../../../../modules/cart-rules/engine"
import { assertRuleTargets } from "../../../../lib/assert-scope"
import type { UpdateCartRuleBody } from "../../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  res.json({ cart_rule: await service.retrieveCartRule(req.params.id) })
}

export async function POST(req: MedusaRequest<UpdateCartRuleBody>, res: MedusaResponse) {
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  const body = req.validatedBody
  const current = await service.retrieveCartRule(req.params.id)
  const merged = { ...current, ...body }

  if (body.rule_type && !hasRuleType(body.rule_type))
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown rule_type "${body.rule_type}"`)
  if (merged.scope_type !== "global" && !merged.scope_id)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "scope_id is required unless scope_type is global")
  await assertRuleTargets(req.scope.resolve(ContainerRegistrationKeys.QUERY), merged)

  const cart_rule = await service.updateCartRules({
    id: req.params.id,
    ...body,
    ...(merged.scope_type === "global" ? { scope_id: null } : {}),
  } as any)
  res.json({ cart_rule })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  await service.deleteCartRules(req.params.id)
  res.json({ id: req.params.id, object: "cart_rule", deleted: true })
}
