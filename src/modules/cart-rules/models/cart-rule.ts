import { model } from "@medusajs/framework/utils"

const CartRule = model
  .define("cart_rule", {
    id: model.id({ prefix: "crule" }).primaryKey(),
    name: model.text(),
    is_active: model.boolean().default(true),
    priority: model.number().default(0),
    rule_type: model.text(), // string registry, see engine/registerRuleType
    value: model.number(),
    scope_type: model.enum(["global", "product", "variant", "collection", "category"]).default("global"),
    scope_id: model.text().nullable(),
    customer_group_id: model.text().nullable(), // null = everyone
    apply_to_guests: model.boolean().default(true), // only for customer_group_id = null
    sales_channel_id: model.text().nullable(), // null = all channels
    message: model.text().nullable(),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    conditions: model.json().nullable(), // reserved for custom rule types
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["is_active"] },
    { on: ["scope_type", "scope_id"] },
    { on: ["customer_group_id"] },
  ])

export default CartRule
