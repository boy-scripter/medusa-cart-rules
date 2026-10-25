import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EllipsisHorizontal, PencilSquare, Plus, ShoppingCart, Trash } from "@medusajs/icons"
import {
  Badge, Button, Container, DatePicker, Drawer, DropdownMenu, Heading, IconButton, Input, Label,
  Select, Switch, Table, Text, Textarea, toast, usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

type Rule = {
  id: string; name: string; is_active: boolean; priority: number; rule_type: string; value: number
  scope_type: string; scope_id: string | null; customer_group_id: string | null
  apply_to_guests: boolean; sales_channel_id: string | null; message: string | null
  starts_at: string | null; ends_at: string | null
}
type RulesRes = { cart_rules: Rule[]; count: number; rule_types: { type: string; label: string }[] }
type Violation = { id: string; rule_id: string; cart_id: string; customer_id: string | null; action: string; limit_value: number; current_value: number; message: string; created_at: string }
type Opt = { id: string; label: string }

const ALL = "__all__"
const SCOPES = ["global", "product", "variant", "collection", "category"]
const PAGE = 20

const useOptions = () => {
  const groups = useQuery({ queryKey: ["cr-groups"], queryFn: () => sdk.admin.customerGroup.list({ limit: 200 }) })
  const channels = useQuery({ queryKey: ["cr-channels"], queryFn: () => sdk.admin.salesChannel.list({ limit: 100 }) })
  return {
    groups: (groups.data?.customer_groups ?? []).map((g): Opt => ({ id: g.id, label: g.name ?? g.id })),
    channels: (channels.data?.sales_channels ?? []).map((c): Opt => ({ id: c.id, label: c.name })),
  }
}

/* --------------------------- scope target picker --------------------------- */
const ScopeTarget = ({ type, value, onChange }: { type: string; value: string; onChange: (v: string) => void }) => {
  const { data } = useQuery({
    queryKey: ["cr-scope", type],
    enabled: ["product", "collection", "category"].includes(type),
    queryFn: async (): Promise<Opt[]> => {
      if (type === "product") return (await sdk.admin.product.list({ limit: 200, fields: "id,title" })).products.map((p) => ({ id: p.id, label: p.title }))
      if (type === "collection") return (await sdk.admin.productCollection.list({ limit: 200 })).collections.map((c) => ({ id: c.id, label: c.title }))
      return (await sdk.admin.productCategory.list({ limit: 200 })).product_categories.map((c) => ({ id: c.id, label: c.name }))
    },
  })
  if (type === "global") return null
  if (type === "variant")
    return <Input placeholder="variant_01..." value={value} onChange={(e) => onChange(e.target.value)} />
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <Select.Trigger><Select.Value placeholder={`Select ${type}`} /></Select.Trigger>
      <Select.Content>
        {(data ?? []).map((o) => <Select.Item key={o.id} value={o.id}>{o.label}</Select.Item>)}
      </Select.Content>
    </Select>
  )
}

/* ------------------------------- rule drawer ------------------------------- */
const empty = {
  name: "", rule_type: "max_cart_quantity", value: "10", scope_type: "global", scope_id: "",
  customer_group_id: ALL, apply_to_guests: true, sales_channel_id: ALL, priority: "0",
  message: "", is_active: true, starts_at: null as Date | null, ends_at: null as Date | null,
}

const RuleDrawer = ({ rule, open, onOpenChange, ruleTypes }: {
  rule: Rule | null; open: boolean; onOpenChange: (o: boolean) => void; ruleTypes: RulesRes["rule_types"]
}) => {
  const qc = useQueryClient()
  const { groups, channels } = useOptions()
  const [f, setF] = useState(empty)
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!open) return
    setF(rule ? {
      name: rule.name, rule_type: rule.rule_type, value: String(rule.value), scope_type: rule.scope_type,
      scope_id: rule.scope_id ?? "", customer_group_id: rule.customer_group_id ?? ALL,
      apply_to_guests: rule.apply_to_guests, sales_channel_id: rule.sales_channel_id ?? ALL,
      priority: String(rule.priority), message: rule.message ?? "", is_active: rule.is_active,
      starts_at: rule.starts_at ? new Date(rule.starts_at) : null, ends_at: rule.ends_at ? new Date(rule.ends_at) : null,
    } : empty)
  }, [open, rule])

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, rule_type: f.rule_type, value: Number(f.value), scope_type: f.scope_type,
        scope_id: f.scope_type === "global" ? null : f.scope_id || null,
        customer_group_id: f.customer_group_id === ALL ? null : f.customer_group_id,
        apply_to_guests: f.customer_group_id === ALL ? f.apply_to_guests : false,
        sales_channel_id: f.sales_channel_id === ALL ? null : f.sales_channel_id,
        priority: Number(f.priority), message: f.message || null, is_active: f.is_active,
        starts_at: f.starts_at ? f.starts_at.toISOString() : null,
        ends_at: f.ends_at ? f.ends_at.toISOString() : null,
      }
      return sdk.client.fetch(rule ? `/admin/cart-rules/${rule.id}` : "/admin/cart-rules", { method: "POST", body })
    },
    onSuccess: () => {
      toast.success(rule ? "Rule updated" : "Rule created")
      qc.invalidateQueries({ queryKey: ["cart-rules"] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-y-1">
      <Label size="small" weight="plus">{label}</Label>
      {node}
      {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
    </div>
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>{rule ? "Edit rule" : "Create rule"}</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          {field("Name", <Input value={f.name} onChange={(e) => set("name", e.target.value)} />)}
          {field("Rule type", (
            <Select value={f.rule_type} onValueChange={(v) => set("rule_type", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{ruleTypes.map((t) => <Select.Item key={t.type} value={t.type}>{t.label}</Select.Item>)}</Select.Content>
            </Select>
          ))}
          {field("Limit", <Input type="number" min={0} value={f.value} onChange={(e) => set("value", e.target.value)} />)}
          {field("Scope", (
            <Select value={f.scope_type} onValueChange={(v) => { set("scope_type", v); set("scope_id", "") }}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{SCOPES.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
            </Select>
          ), "global = whole cart / every product. Others limit only matching items.")}
          {f.scope_type !== "global" && field("Scope target", <ScopeTarget type={f.scope_type} value={f.scope_id} onChange={(v) => set("scope_id", v)} />)}
          {field("Customer group", (
            <Select value={f.customer_group_id} onValueChange={(v) => set("customer_group_id", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL}>Everyone</Select.Item>
                {groups.map((g) => <Select.Item key={g.id} value={g.id}>{g.label}</Select.Item>)}
              </Select.Content>
            </Select>
          ), "A group rule overrides the 'Everyone' rule for the same scope.")}
          {f.customer_group_id === ALL && (
            <div className="flex items-center justify-between">
              <Label size="small" weight="plus">Apply to guests</Label>
              <Switch checked={f.apply_to_guests} onCheckedChange={(v) => set("apply_to_guests", v)} />
            </div>
          )}
          {field("Sales channel", (
            <Select value={f.sales_channel_id} onValueChange={(v) => set("sales_channel_id", v)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL}>All channels</Select.Item>
                {channels.map((c) => <Select.Item key={c.id} value={c.id}>{c.label}</Select.Item>)}
              </Select.Content>
            </Select>
          ))}
          {field("Priority", <Input type="number" value={f.priority} onChange={(e) => set("priority", e.target.value)} />, "Tie-breaker when two rules have the same limit.")}
          {field("Starts at", <DatePicker granularity="minute" value={f.starts_at ?? undefined} onChange={(d) => set("starts_at", d ?? null)} />)}
          {field("Ends at", <DatePicker granularity="minute" value={f.ends_at ?? undefined} onChange={(d) => set("ends_at", d ?? null)} />)}
          {field("Error message", <Textarea value={f.message} onChange={(e) => set("message", e.target.value)} />, "Optional. Placeholders: {limit} {current} {product}")}
          <div className="flex items-center justify-between">
            <Label size="small" weight="plus">Active</Label>
            <Switch checked={f.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild><Button variant="secondary">Cancel</Button></Drawer.Close>
          <Button isLoading={save.isPending} disabled={!f.name || f.value === "" || (f.scope_type !== "global" && !f.scope_id)} onClick={() => save.mutate()}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* --------------------------------- tables --------------------------------- */
const RulesTable = () => {
  const qc = useQueryClient()
  const prompt = usePrompt()
  const { groups, channels } = useOptions()
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["cart-rules", offset],
    queryFn: () => sdk.client.fetch<RulesRes>("/admin/cart-rules", { query: { limit: PAGE, offset } }),
  })
  const toggle = useMutation({
    mutationFn: (r: Rule) => sdk.client.fetch(`/admin/cart-rules/${r.id}`, { method: "POST", body: { is_active: !r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart-rules"] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({
    mutationFn: (id: string) => sdk.client.fetch(`/admin/cart-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["cart-rules"] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const onDelete = async (r: Rule) => {
    const ok = await prompt({ title: "Delete rule", description: `Delete "${r.name}"? This can't be undone.`, confirmText: "Delete", cancelText: "Cancel" })
    if (ok) del.mutate(r.id)
  }
  const typeLabel = (t: string) => data?.rule_types.find((x) => x.type === t)?.label ?? t
  const audience = (r: Rule) =>
    r.customer_group_id ? groups.find((g) => g.id === r.customer_group_id)?.label ?? r.customer_group_id : r.apply_to_guests ? "Everyone" : "Customers only"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Cart rules</Heading>
          <Text size="small" className="text-ui-fg-subtle">Quantity limits enforced on add to cart, line update and checkout.</Text>
        </div>
        <Button size="small" onClick={() => { setEditing(null); setOpen(true) }}><Plus /> Create</Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Limit</Table.HeaderCell>
            <Table.HeaderCell>Scope</Table.HeaderCell>
            <Table.HeaderCell>Audience</Table.HeaderCell>
            <Table.HeaderCell>Channel</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading && <Table.Row><Table.Cell>Loading…</Table.Cell></Table.Row>}
          {!isLoading && !data?.cart_rules.length && <Table.Row><Table.Cell>No rules yet.</Table.Cell></Table.Row>}
          {data?.cart_rules.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.name}</Table.Cell>
              <Table.Cell>{typeLabel(r.rule_type)}</Table.Cell>
              <Table.Cell>{r.value}</Table.Cell>
              <Table.Cell>
                <Badge size="2xsmall">{r.scope_type}</Badge>{" "}
                {r.scope_id && <Text size="xsmall" className="text-ui-fg-subtle inline">{r.scope_id}</Text>}
              </Table.Cell>
              <Table.Cell>{audience(r)}</Table.Cell>
              <Table.Cell>{r.sales_channel_id ? channels.find((c) => c.id === r.sales_channel_id)?.label ?? r.sales_channel_id : "All"}</Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={r.is_active ? "green" : "grey"}>{r.is_active ? "Active" : "Inactive"}</Badge></Table.Cell>
              <Table.Cell>
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild><IconButton variant="transparent"><EllipsisHorizontal /></IconButton></DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item className="gap-x-2" onClick={() => { setEditing(r); setOpen(true) }}><PencilSquare /> Edit</DropdownMenu.Item>
                    <DropdownMenu.Item onClick={() => toggle.mutate(r)}>{r.is_active ? "Deactivate" : "Activate"}</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item className="gap-x-2" onClick={() => onDelete(r)}><Trash /> Delete</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Table.Pagination
        count={data?.count ?? 0} pageSize={PAGE} pageIndex={Math.floor(offset / PAGE)}
        pageCount={Math.max(1, Math.ceil((data?.count ?? 0) / PAGE))}
        canPreviousPage={offset > 0} canNextPage={offset + PAGE < (data?.count ?? 0)}
        previousPage={() => setOffset(Math.max(0, offset - PAGE))} nextPage={() => setOffset(offset + PAGE)}
      />
      <RuleDrawer rule={editing} open={open} onOpenChange={setOpen} ruleTypes={data?.rule_types ?? []} />
    </Container>
  )
}

const ViolationsTable = () => {
  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useQuery({
    queryKey: ["cart-rule-violations", offset],
    queryFn: () => sdk.client.fetch<{ violations: Violation[]; count: number }>("/admin/cart-rules/violations", { query: { limit: PAGE, offset } }),
  })
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Blocked attempts</Heading>
        <Text size="small" className="text-ui-fg-subtle">Useful for tuning limits.</Text>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>When</Table.HeaderCell>
            <Table.HeaderCell>Action</Table.HeaderCell>
            <Table.HeaderCell>Cart</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Attempted / limit</Table.HeaderCell>
            <Table.HeaderCell>Message</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading && <Table.Row><Table.Cell>Loading…</Table.Cell></Table.Row>}
          {!isLoading && !data?.violations.length && <Table.Row><Table.Cell>Nothing blocked yet.</Table.Cell></Table.Row>}
          {data?.violations.map((v) => (
            <Table.Row key={v.id}>
              <Table.Cell>{new Date(v.created_at).toLocaleString()}</Table.Cell>
              <Table.Cell><Badge size="2xsmall">{v.action}</Badge></Table.Cell>
              <Table.Cell>{v.cart_id}</Table.Cell>
              <Table.Cell>{v.customer_id ?? "Guest"}</Table.Cell>
              <Table.Cell>{v.current_value} / {v.limit_value}</Table.Cell>
              <Table.Cell>{v.message}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Table.Pagination
        count={data?.count ?? 0} pageSize={PAGE} pageIndex={Math.floor(offset / PAGE)}
        pageCount={Math.max(1, Math.ceil((data?.count ?? 0) / PAGE))}
        canPreviousPage={offset > 0} canNextPage={offset + PAGE < (data?.count ?? 0)}
        previousPage={() => setOffset(Math.max(0, offset - PAGE))} nextPage={() => setOffset(offset + PAGE)}
      />
    </Container>
  )
}

const CartRulesPage = () => (
  <div className="flex flex-col gap-y-3">
    <RulesTable />
    <ViolationsTable />
  </div>
)

export const config = defineRouteConfig({ label: "Cart Rules", icon: ShoppingCart })
export default CartRulesPage
