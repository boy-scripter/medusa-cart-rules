import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateCart } from "../../lib/validate-cart"

updateLineItemInCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await validateCart(container, {
    cart_id: input.cart_id,
    action: "update_item",
    update: { item_id: input.item_id, quantity: (input.update as any)?.quantity },
  })
})
