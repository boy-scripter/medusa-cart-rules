import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateCart } from "../../lib/validate-cart"

addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await validateCart(container, {
    cart_id: input.cart_id,
    action: "add_to_cart",
    add_items: (input.items ?? [])
      .filter((i: any) => i.variant_id)
      .map((i: any) => ({ variant_id: i.variant_id as string, quantity: Number(i.quantity) })),
  })
})
