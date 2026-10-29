import Medusa from "@medusajs/js-sdk"

declare const __BACKEND_URL__: string | undefined

export const sdk = new Medusa({
  baseUrl: __BACKEND_URL__ ?? "/",
  debug: import.meta.env.DEV,
  auth: { type: "jwt" },
})
