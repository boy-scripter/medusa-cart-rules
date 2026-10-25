import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateCart } from "../../lib/validate-cart"

completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await validateCart(container, { cart_id: input.id, action: "complete_cart" })
})
