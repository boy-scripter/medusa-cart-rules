import { MedusaError } from "@medusajs/framework/utils"

const SCOPE_ENTITY: Record<string, string> = {
  product: "product",
  variant: "variant",
  collection: "product_collection",
  category: "product_category",
}

async function exists(query: any, entity: string, id: string) {
  const { data } = await query.graph({ entity, fields: ["id"], filters: { id } })
  return data.length > 0
}

export async function assertRuleTargets(
  query: any,
  b: { scope_type?: string; scope_id?: string | null; customer_group_id?: string | null; sales_channel_id?: string | null }
) {
  const fail = (m: string) => { throw new MedusaError(MedusaError.Types.INVALID_DATA, m) }
  if (b.scope_type && b.scope_type !== "global") {
    if (!b.scope_id) fail(`scope_id is required for scope_type "${b.scope_type}"`)
    if (!(await exists(query, SCOPE_ENTITY[b.scope_type], b.scope_id!))) fail(`${b.scope_type} ${b.scope_id} not found`)
  }
  if (b.customer_group_id && !(await exists(query, "customer_group", b.customer_group_id)))
    fail(`customer group ${b.customer_group_id} not found`)
  if (b.sales_channel_id && !(await exists(query, "sales_channel", b.sales_channel_id)))
    fail(`sales channel ${b.sales_channel_id} not found`)
}
