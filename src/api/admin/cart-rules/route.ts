import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CART_RULES_MODULE } from "../../../modules/cart-rules"
import type CartRulesModuleService from "../../../modules/cart-rules/service"
import { hasRuleType, listRuleTypes } from "../../../modules/cart-rules/engine"
import { assertRuleTargets } from "../../../lib/assert-scope"
import type { CreateCartRuleBody } from "../../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  const limit = Math.min(Number(req.query.limit ?? 50), 200)
  const offset = Number(req.query.offset ?? 0)
  const [cart_rules, count] = await service.listAndCountCartRules(
    {},
    { skip: offset, take: limit, order: { created_at: "DESC" } }
  )
  res.json({ cart_rules, count, limit, offset, rule_types: listRuleTypes() })
}

export async function POST(req: MedusaRequest<CreateCartRuleBody>, res: MedusaResponse) {
  const body = req.validatedBody
  if (!hasRuleType(body.rule_type))
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown rule_type "${body.rule_type}"`)
  await assertRuleTargets(req.scope.resolve(ContainerRegistrationKeys.QUERY), body)

  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  const cart_rule = await service.createCartRules({
    ...body,
    scope_id: body.scope_type === "global" ? null : body.scope_id ?? null,
  } as any)
  res.status(201).json({ cart_rule })
}
