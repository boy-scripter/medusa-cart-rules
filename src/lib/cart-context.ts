import type { EvalLine } from "../modules/cart-rules/engine"

type Query = { graph: (a: any) => Promise<{ data: any[] }> }

const toLine = (id: string, qty: number, variant_id: string | null, product_id: string | null, title: string | null, product: any): EvalLine => ({
  id,
  title,
  variant_id,
  product_id,
  quantity: qty,
  collection_id: product?.collection_id ?? null,
  category_ids: (product?.categories ?? []).map((c: any) => c.id),
})

export async function loadCart(query: Query, cartId: string) {
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id", "customer_id", "sales_channel_id",
      "items.id", "items.title", "items.quantity", "items.variant_id", "items.product_id",
      "items.product.collection_id", "items.product.categories.id",
    ],
    filters: { id: cartId },
  })
  const c = data[0]
  if (!c) return null
  return {
    customer_id: (c.customer_id ?? null) as string | null,
    cart: {
      id: c.id as string,
      sales_channel_id: (c.sales_channel_id ?? null) as string | null,
      items: (c.items ?? []).filter(Boolean).map((i: any) =>
        toLine(i.id, Number(i.quantity), i.variant_id ?? null, i.product_id ?? null, i.title ?? null, i.product)
      ),
    },
  }
}

/** Turns {variant_id, quantity} pairs into virtual lines (id = virtual:<n>). */
export async function loadVariantLines(query: Query, items: { variant_id: string; quantity: number }[]): Promise<EvalLine[]> {
  const ids = Array.from(new Set(items.map((i) => i.variant_id)))
  if (!ids.length) return []
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "product_id", "product.title", "product.collection_id", "product.categories.id"],
    filters: { id: ids },
  })
  const byId = new Map<string, any>(data.map((v) => [v.id, v]))
  return items.flatMap((it, n) => {
    const v = byId.get(it.variant_id)
    if (!v) return []
    return [toLine(`virtual:${n}`, Number(it.quantity), v.id, v.product_id ?? null, v.product?.title ?? null, v.product)]
  })
}

export async function loadCustomerGroupIds(query: Query, customerId: string | null): Promise<string[]> {
  if (!customerId) return []
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "groups.id"],
    filters: { id: customerId },
  })
  return (data[0]?.groups ?? []).filter(Boolean).map((g: any) => g.id)
}
