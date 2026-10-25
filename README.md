# @xross-dev/medusa-cart-rules

Medusa v2 plugin. Blocks add-to-cart, quantity increase and checkout when a quantity rule is violated.

## Rules
| `rule_type` | Meaning |
|---|---|
| `max_cart_quantity` | Total items ≤ limit. Scope `global` = whole cart; other scopes = combined items matching the scope (e.g. "max 4 items from collection X"). |
| `max_product_quantity` | Per product ≤ limit (per **variant** when scope = `variant`). Scope `global` = every product; `product`/`collection`/`category` = matching products. |

**Audience:** everyone (+ optional guests), or one customer group. **Also:** sales channel, active window (`starts_at`/`ends_at`), priority, custom message (`{limit} {current} {product}`).

**Resolution**
- Per-product: variant > product > collection/category > global (first tier with a matching rule wins).
- Same scope target: a customer-group rule overrides the "everyone" rule (VIP 50 beats global 20).
- Several matching group rules: `restrictive` (lowest, default) or `permissive` (highest).
- Cart-level and product-level rules are checked independently; all must pass.
- Decreasing a quantity is always allowed. Add/update only block for products they touch; `complete` checks the whole cart.

## Install
```bash
# in the plugin
yarn && yarn build        # migration for cart_rule + cart_rule_violation is already included
                          # (after changing models: yarn db:generate, needs a local Postgres + DB_USERNAME/DB_PASSWORD)
npx medusa plugin:publish                  # or: yalc / npm publish
```
```ts
// medusa-config.ts
plugins: [
  { resolve: "@xross-dev/medusa-cart-rules", options: { conflict_strategy: "restrictive" } },
],
```
```bash
npx medusa db:migrate   # in the app
```
Dev loop: `npx medusa plugin:develop` in the plugin, `npx medusa develop` in the app.

## API
Admin (auth required): `GET|POST /admin/cart-rules`, `GET|POST|DELETE /admin/cart-rules/:id`, `GET /admin/cart-rules/violations`, `POST /admin/cart-rules/simulate` `{ cart_id? , customer_id?, items?: [{variant_id, quantity}] }`.

Store (publishable key): `GET /store/cart-rules?cart_id=…[&variant_id=…]` or `?variant_id=…`
```json
{ "limits": [{ "rule_id": "crule_…", "rule_type": "max_cart_quantity", "scope_type": "global", "limit": 20, "current": 12, "remaining": 8 }],
  "lines": { "item_…": { "remaining": 2, "max_quantity": 5 } },
  "variant": { "variant_id": "variant_…", "remaining": 3 } }
```
Use `lines[id].max_quantity` to cap the quantity stepper.

Blocked requests return HTTP 400 `{ "type": "invalid_data", "code": "CART_RULE_VIOLATION", "message": "You can add at most 5 of Phone." }`.

## Custom rule types
```ts
import { registerRuleType } from "@xross-dev/medusa-cart-rules/modules/cart-rules/engine"
registerRuleType("max_cart_total", { label: "...", defaultMessage: "...", measure: (cart, rules, ctx) => [/* Measurement[] */] })
```
Call it from a loader or any file loaded at boot. The engine (`engine/`) is pure (no I/O) and unit-tested: `yarn test`.

## Notes
- Workflow hooks used: `addToCartWorkflow`, `updateLineItemInCartWorkflow`, `completeCartWorkflow` → `hooks.validate`.
- Scope/group/channel IDs are plain strings (no module links), validated on create/update.
- Admin page: **Cart Rules** in the sidebar (rules CRUD + blocked-attempts log), built with `@medusajs/ui`.
