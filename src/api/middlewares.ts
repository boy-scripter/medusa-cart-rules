import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { CreateCartRuleSchema, SimulateSchema, UpdateCartRuleSchema } from "./validators"

export default defineMiddlewares({
  routes: [
    { matcher: "/admin/cart-rules", method: "POST", middlewares: [validateAndTransformBody(CreateCartRuleSchema)] },
    { matcher: "/admin/cart-rules/simulate", method: "POST", middlewares: [validateAndTransformBody(SimulateSchema)] },
    { matcher: "/admin/cart-rules/:id", method: "POST", middlewares: [validateAndTransformBody(UpdateCartRuleSchema)] },
  ],
})
