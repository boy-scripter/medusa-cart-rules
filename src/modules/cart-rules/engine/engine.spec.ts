import { test } from "node:test"
import assert from "node:assert/strict"
import { evaluate, describeLimits, type CartRuleDTO, type EvalCart } from "./index"

const rule = (o: Partial<CartRuleDTO>): CartRuleDTO => ({
  id: "r" + Math.random(), name: "r", is_active: true, priority: 0, rule_type: "max_cart_quantity",
  value: 20, scope_type: "global", scope_id: null, customer_group_id: null, apply_to_guests: true,
  sales_channel_id: null, message: null, starts_at: null, ends_at: null, ...o,
})
const line = (id: string, product: string, qty: number, extra = {}) => ({
  id, variant_id: "v_" + id, product_id: product, category_ids: [] as string[], quantity: qty, title: product, ...extra,
})
const cart = (items: ReturnType<typeof line>[]): EvalCart => ({ id: "c", sales_channel_id: "sc1", items })
const guest = { customer_group_ids: [], is_guest: true }
const vip = { customer_group_ids: ["vip"], is_guest: false }

const rules = [
  rule({ id: "g20", value: 20 }),
  rule({ id: "vip50", value: 50, customer_group_id: "vip" }),
  rule({ id: "p5", rule_type: "max_product_quantity", value: 5 }),
]

test("global cart limit blocks guest at 21", () => {
  const five = ["a", "b", "c", "d", "e"].map((id, i) => line(id, "p" + i, 5)) // 25 items, 5/product
  const v = evaluate(cart(five), rules, guest)
  assert.deepEqual(v.map((x) => x.rule_id), ["g20"])
})
test("VIP group overrides everyone-rule (50), per-product 5 still applies", () => {
  const six = ["a", "b", "c", "d", "e", "f"].map((id, i) => line(id, "p" + i, 5))
  assert.equal(evaluate(cart(six), rules, vip).length, 0) // 30 items, 5/product
  assert.deepEqual(evaluate(cart([line("a", "pX", 6)]), rules, vip).map((x) => x.rule_id), ["p5"])
})
test("variant rule beats product/global rule; product count excludes variant-governed lines", () => {
  const rs = [
    rule({ id: "p5", rule_type: "max_product_quantity", value: 5 }),
    rule({ id: "v10", rule_type: "max_product_quantity", value: 10, scope_type: "variant", scope_id: "v_a" }),
  ]
  assert.equal(evaluate(cart([line("a", "pX", 9), line("b", "pX", 5)]), rs, guest).length, 0)
  assert.equal(evaluate(cart([line("a", "pX", 11)]), rs, guest).length, 1)
})
test("multiple groups: restrictive picks lowest, permissive highest", () => {
  const rs = [rule({ id: "a", value: 10, customer_group_id: "g1" }), rule({ id: "b", value: 30, customer_group_id: "g2" })]
  const ctx = { customer_group_ids: ["g1", "g2"], is_guest: false }
  const c = cart([line("a", "pX", 15)])
  assert.equal(evaluate(c, rs, ctx).length, 1)
  assert.equal(evaluate(c, rs, { ...ctx, strategy: "permissive" }).length, 0)
})
test("guest exclusion, sales channel, date window", () => {
  const c = cart([line("a", "pX", 99)])
  assert.equal(evaluate(c, [rule({ apply_to_guests: false })], guest).length, 0)
  assert.equal(evaluate(c, [rule({ sales_channel_id: "other" })], guest).length, 0)
  assert.equal(evaluate(c, [rule({ ends_at: new Date(Date.now() - 1000) })], guest).length, 0)
  assert.equal(evaluate(c, [rule({ starts_at: new Date(Date.now() + 99999) })], guest).length, 0)
})
test("scoped cart quantity (collection) + describeLimits remaining", () => {
  const rs = [rule({ id: "col", scope_type: "collection", scope_id: "col1", value: 4 })]
  const c = cart([line("a", "pX", 3, { collection_id: "col1" }), line("b", "pY", 50)])
  assert.equal(evaluate(c, rs, guest).length, 0)
  const d = describeLimits(c, rs, guest)
  assert.equal(d.lines["a"].remaining, 1)
  assert.equal(d.lines["a"].max_quantity, 4)
  assert.equal(d.lines["b"], undefined)
})
test("custom message placeholders", () => {
  const v = evaluate(
    cart([line("a", "Phone", 7)]),
    [rule({ rule_type: "max_product_quantity", value: 5, message: "Max {limit} x {product}, you have {current}" })],
    guest
  )
  assert.equal(v[0].message, "Max 5 x Phone, you have 7")
})
