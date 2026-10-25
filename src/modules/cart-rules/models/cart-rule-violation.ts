import { model } from "@medusajs/framework/utils"

const CartRuleViolation = model
  .define("cart_rule_violation", {
    id: model.id({ prefix: "crv" }).primaryKey(),
    rule_id: model.text(),
    rule_type: model.text(),
    cart_id: model.text(),
    customer_id: model.text().nullable(),
    action: model.text(), // add_to_cart | update_item | complete_cart
    limit_value: model.number(),
    current_value: model.number(),
    message: model.text(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ["rule_id"] }, { on: ["cart_id"] }])

export default CartRuleViolation
