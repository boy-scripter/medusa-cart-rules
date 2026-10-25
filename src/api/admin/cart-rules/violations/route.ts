import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CART_RULES_MODULE } from "../../../../modules/cart-rules"
import type CartRulesModuleService from "../../../../modules/cart-rules/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<CartRulesModuleService>(CART_RULES_MODULE)
  const limit = Math.min(Number(req.query.limit ?? 20), 200)
  const offset = Number(req.query.offset ?? 0)
  const filters: Record<string, unknown> = {}
  if (typeof req.query.rule_id === "string") filters.rule_id = req.query.rule_id
  const [violations, count] = await service.listAndCountCartRuleViolations(filters, {
    skip: offset, take: limit, order: { created_at: "DESC" },
  })
  res.json({ violations, count, limit, offset })
}
