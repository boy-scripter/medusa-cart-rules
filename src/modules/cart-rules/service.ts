import { MedusaService } from "@medusajs/framework/utils"
import CartRule from "./models/cart-rule"
import CartRuleViolation from "./models/cart-rule-violation"
import type { CartRuleDTO, ConflictStrategy } from "./engine"

export type CartRulesOptions = { conflict_strategy?: ConflictStrategy }

class CartRulesModuleService extends MedusaService({ CartRule, CartRuleViolation }) {
  protected options_: CartRulesOptions

  constructor(...args: any[]) {
    // @ts-ignore
    super(...args)
    this.options_ = (args[1] as CartRulesOptions) ?? {}
  }

  getConflictStrategy(): ConflictStrategy {
    return this.options_.conflict_strategy ?? "restrictive"
  }

  async listEvaluableRules(): Promise<CartRuleDTO[]> {
    const rules = await this.listCartRules({ is_active: true }, { take: null })
    return rules as unknown as CartRuleDTO[]
  }

  async logViolations(
    entries: {
      rule_id: string; rule_type: string; cart_id: string; customer_id: string | null
      action: string; limit_value: number; current_value: number; message: string
    }[]
  ) {
    if (entries.length) await this.createCartRuleViolations(entries)
  }
}

export default CartRulesModuleService
