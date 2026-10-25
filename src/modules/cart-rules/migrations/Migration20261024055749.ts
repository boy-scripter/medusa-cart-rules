import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261024055749 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cart_rule" ("id" text not null, "name" text not null, "is_active" boolean not null default true, "priority" integer not null default 0, "rule_type" text not null, "value" integer not null, "scope_type" text check ("scope_type" in ('global', 'product', 'variant', 'collection', 'category')) not null default 'global', "scope_id" text null, "customer_group_id" text null, "apply_to_guests" boolean not null default true, "sales_channel_id" text null, "message" text null, "starts_at" timestamptz null, "ends_at" timestamptz null, "conditions" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_deleted_at" ON "cart_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_is_active" ON "cart_rule" ("is_active") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_scope_type_scope_id" ON "cart_rule" ("scope_type", "scope_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_customer_group_id" ON "cart_rule" ("customer_group_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cart_rule_violation" ("id" text not null, "rule_id" text not null, "rule_type" text not null, "cart_id" text not null, "customer_id" text null, "action" text not null, "limit_value" integer not null, "current_value" integer not null, "message" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_rule_violation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_violation_deleted_at" ON "cart_rule_violation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_violation_rule_id" ON "cart_rule_violation" ("rule_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_rule_violation_cart_id" ON "cart_rule_violation" ("cart_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cart_rule" cascade;`);

    this.addSql(`drop table if exists "cart_rule_violation" cascade;`);
  }

}
