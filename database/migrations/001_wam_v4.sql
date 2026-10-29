-- WAM v4: fresh PostgreSQL database initialization. Not an in-place migration.
-- Generated from WAM_unified_25_tables_v4.dbml, followed by executable business rules.
BEGIN;

CREATE TABLE "EMPLOYEE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "full_name" varchar(150) NOT NULL,
  "email" varchar(255) UNIQUE,
  "job_title" varchar(100),
  "is_active" boolean NOT NULL DEFAULT true
);

CREATE TABLE "DEPARTMENT" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(100) UNIQUE NOT NULL,
  "manager_id" uuid
);

CREATE TABLE "EMPLOYEE_DEPARTMENT" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "employee_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "department_role" varchar(100)
);

CREATE TABLE "CUSTOMER" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(180) NOT NULL,
  "contact_name" varchar(150),
  "phone" varchar(40),
  "email" varchar(255),
  "notes" text
);

CREATE TABLE "TEMPLATE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "template_code" varchar(60) NOT NULL,
  "name" varchar(180) NOT NULL,
  "revision" int NOT NULL DEFAULT 1,
  "design_file" varchar(500) NOT NULL,
  "design_checksum" char(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "CUSTOMER_ORDER" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_number" varchar(40) UNIQUE NOT NULL,
  "title" varchar(180) NOT NULL,
  "customer_id" uuid NOT NULL,
  "template_id" uuid,
  "intake_employee_id" uuid NOT NULL,
  "designer_id" uuid,
  "qc_employee_id" uuid,
  "special_requests" text,
  "quantity" int NOT NULL DEFAULT 1,
  "status" varchar(30) NOT NULL DEFAULT 'SUBMITTED',
  "qc_result" varchar(20) NOT NULL DEFAULT 'NOT_CHECKED',
  "qc_notes" text,
  "qc_checked_at" timestamptz,
  "submitted_at" timestamptz NOT NULL DEFAULT (now()),
  "due_at" timestamptz,
  "delivered_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "JOB" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_id" uuid NOT NULL,
  "sequence_no" int NOT NULL,
  "name" varchar(180) NOT NULL,
  "responsible_employee_id" uuid,
  "machine_id" uuid,
  "completed_quantity" int NOT NULL DEFAULT 0,
  "schematic_file" varchar(500),
  "schematic_revision" varchar(50),
  "schematic_checksum" char(64),
  "status" varchar(30) NOT NULL DEFAULT 'PENDING',
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "notes" text,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "JOB_MATERIAL" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "job_id" uuid NOT NULL,
  "material_id" uuid NOT NULL,
  "planned_quantity" numeric(14,3) NOT NULL,
  "unit_cost" numeric(14,4)
);

CREATE TABLE "LOCATION" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(150) UNIQUE NOT NULL,
  "type" varchar(60)
);

CREATE TABLE "MACHINE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "location_id" uuid,
  "supplier_id" uuid,
  "name" varchar(160) NOT NULL,
  "serial_number" varchar(160) UNIQUE,
  "type" varchar(100),
  "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
  "purchase_price" numeric(12,2)
);

CREATE TABLE "SUPPLIER" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(180) NOT NULL,
  "contact_name" varchar(150),
  "phone" varchar(40),
  "email" varchar(255),
  "notes" text
);

CREATE TABLE "ASSET" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "machine_id" uuid,
  "location_id" uuid,
  "supplier_id" uuid,
  "name" varchar(160) NOT NULL,
  "serial_number" varchar(160) UNIQUE,
  "category" varchar(80),
  "purchase_price" numeric(12,2)
);

CREATE TABLE "MATERIAL" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "material_code" varchar(60) UNIQUE NOT NULL,
  "name" varchar(160) NOT NULL,
  "type" varchar(30) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "standard_unit_cost" numeric(14,4),
  "min_stock" numeric(14,3) NOT NULL DEFAULT 0
);

CREATE TABLE "SUPPLIER_MATERIAL" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "supplier_id" uuid NOT NULL,
  "material_id" uuid NOT NULL,
  "unit_price" numeric(14,4)
);

CREATE TABLE "MACHINE_MATERIAL" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "machine_id" uuid NOT NULL,
  "material_id" uuid NOT NULL,
  "purpose" varchar(255)
);

CREATE TABLE "STOCK_BALANCE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "material_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "quantity" numeric(14,3) NOT NULL DEFAULT 0
);

CREATE TABLE "STOCK_MOVEMENT" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "request_key" uuid UNIQUE NOT NULL,
  "material_id" uuid NOT NULL,
  "from_location_id" uuid,
  "to_location_id" uuid,
  "job_id" uuid,
  "financial_record_id" uuid,
  "quantity" numeric(14,3) NOT NULL,
  "movement_type" varchar(30) NOT NULL,
  "reason" text,
  "performed_by_employee_id" uuid NOT NULL,
  "movement_date" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "FINANCIAL_RECORD" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "reference_number" varchar(100),
  "customer_order_id" uuid,
  "customer_id" uuid,
  "supplier_id" uuid,
  "original_record_id" uuid,
  "type" varchar(30) NOT NULL,
  "category" varchar(80),
  "amount" numeric(12,2) NOT NULL,
  "paid_amount" numeric(12,2) NOT NULL DEFAULT 0,
  "currency" char(3) NOT NULL DEFAULT 'EUR',
  "record_date" date NOT NULL,
  "due_date" date,
  "notes" text
);

CREATE TABLE "DOCUMENT" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "title" varchar(255) NOT NULL,
  "category" varchar(80),
  "file_path" varchar(500) UNIQUE NOT NULL,
  "visibility" varchar(30) NOT NULL DEFAULT 'INTERNAL',
  "uploaded_by_employee_id" uuid NOT NULL,
  "uploaded_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "DOCUMENT_LINK" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "machine_id" uuid,
  "asset_id" uuid,
  "material_id" uuid,
  "supplier_id" uuid,
  "customer_order_id" uuid,
  "job_id" uuid,
  "template_id" uuid,
  "financial_record_id" uuid
);

CREATE UNIQUE INDEX "uq_employee_department_employee_department" ON "EMPLOYEE_DEPARTMENT" ("employee_id", "department_id");

CREATE INDEX "idx_employee_department_department" ON "EMPLOYEE_DEPARTMENT" ("department_id");

CREATE INDEX "idx_customer_name" ON "CUSTOMER" ("name");

CREATE INDEX "idx_customer_phone" ON "CUSTOMER" ("phone");

CREATE UNIQUE INDEX "uq_template_code_revision" ON "TEMPLATE" ("template_code", "revision");

CREATE INDEX "idx_customer_order_customer_submitted" ON "CUSTOMER_ORDER" ("customer_id", "submitted_at");

CREATE INDEX "idx_customer_order_status_due" ON "CUSTOMER_ORDER" ("status", "due_at");

CREATE INDEX "idx_customer_order_template" ON "CUSTOMER_ORDER" ("template_id");

CREATE UNIQUE INDEX "uq_job_order_sequence" ON "JOB" ("order_id", "sequence_no");

CREATE INDEX "idx_job_employee_status" ON "JOB" ("responsible_employee_id", "status");

CREATE INDEX "idx_job_machine" ON "JOB" ("machine_id");

CREATE UNIQUE INDEX "uq_job_material_job_material" ON "JOB_MATERIAL" ("job_id", "material_id");

CREATE INDEX "idx_job_material_material" ON "JOB_MATERIAL" ("material_id");

CREATE UNIQUE INDEX "uq_supplier_material_supplier_material" ON "SUPPLIER_MATERIAL" ("supplier_id", "material_id");

CREATE INDEX "idx_supplier_material_material" ON "SUPPLIER_MATERIAL" ("material_id");

CREATE UNIQUE INDEX "uq_machine_material_machine_material" ON "MACHINE_MATERIAL" ("machine_id", "material_id");

CREATE INDEX "idx_machine_material_material" ON "MACHINE_MATERIAL" ("material_id");

CREATE UNIQUE INDEX "uq_stock_balance_material_location" ON "STOCK_BALANCE" ("material_id", "location_id");

CREATE INDEX "idx_stock_balance_location" ON "STOCK_BALANCE" ("location_id");

CREATE INDEX "idx_stock_movement_material_date" ON "STOCK_MOVEMENT" ("material_id", "movement_date");

CREATE INDEX "idx_stock_movement_job_material" ON "STOCK_MOVEMENT" ("job_id", "material_id");

CREATE INDEX "idx_stock_movement_financial_record" ON "STOCK_MOVEMENT" ("financial_record_id");

CREATE INDEX "idx_financial_record_order" ON "FINANCIAL_RECORD" ("customer_order_id");

CREATE INDEX "idx_financial_record_supplier_date" ON "FINANCIAL_RECORD" ("supplier_id", "record_date");

CREATE INDEX "idx_financial_record_customer_date" ON "FINANCIAL_RECORD" ("customer_id", "record_date");

CREATE INDEX "idx_financial_record_original" ON "FINANCIAL_RECORD" ("original_record_id");

CREATE UNIQUE INDEX "uq_document_link_machine" ON "DOCUMENT_LINK" ("document_id", "machine_id");

CREATE UNIQUE INDEX "uq_document_link_asset" ON "DOCUMENT_LINK" ("document_id", "asset_id");

CREATE UNIQUE INDEX "uq_document_link_material" ON "DOCUMENT_LINK" ("document_id", "material_id");

CREATE UNIQUE INDEX "uq_document_link_supplier" ON "DOCUMENT_LINK" ("document_id", "supplier_id");

CREATE UNIQUE INDEX "uq_document_link_order" ON "DOCUMENT_LINK" ("document_id", "customer_order_id");

CREATE UNIQUE INDEX "uq_document_link_job" ON "DOCUMENT_LINK" ("document_id", "job_id");

CREATE UNIQUE INDEX "uq_document_link_template" ON "DOCUMENT_LINK" ("document_id", "template_id");

CREATE UNIQUE INDEX "uq_document_link_financial_record" ON "DOCUMENT_LINK" ("document_id", "financial_record_id");

COMMENT ON COLUMN "DEPARTMENT"."manager_id" IS 'Optional responsible employee; department membership is stored separately.';

COMMENT ON TABLE "TEMPLATE" IS 'An inserted row is an immutable design revision. Insert a new revision instead of updating or deleting it.';

COMMENT ON COLUMN "TEMPLATE"."template_code" IS 'Same code across revisions; each revision has its own UUID.';

COMMENT ON COLUMN "TEMPLATE"."design_file" IS 'Immutable NAS file for this revision; never overwrite.';

COMMENT ON COLUMN "TEMPLATE"."design_checksum" IS 'Lowercase SHA-256 of the preserved file.';

COMMENT ON TABLE "CUSTOMER_ORDER" IS 'Main flow: SUBMITTED > PLANNED > IN_PRODUCTION > QC > READY > DELIVERED. Failed QC returns to production with new appended rework steps. Completed work is preserved.';

COMMENT ON COLUMN "CUSTOMER_ORDER"."order_number" IS 'Readable reference supplied by the app, e.g. WAM-2026-000123.';

COMMENT ON COLUMN "CUSTOMER_ORDER"."template_id" IS 'May be empty at intake; references one exact immutable revision.';

COMMENT ON TABLE "JOB" IS 'A sequential production step for the full order quantity. Start after preceding steps complete. Completed steps are immutable. Rework is a new later step.';

COMMENT ON COLUMN "JOB"."machine_id" IS 'Empty for a manual step.';

COMMENT ON COLUMN "JOB"."completed_quantity" IS 'Good units completed in THIS step. Target is CUSTOMER_ORDER.quantity.';

COMMENT ON COLUMN "JOB"."schematic_file" IS 'Exact preserved approved working file; optional for steps without a file.';

COMMENT ON COLUMN "JOB_MATERIAL"."planned_quantity" IS 'Planned requirement in MATERIAL.unit, not actual usage.';

COMMENT ON COLUMN "JOB_MATERIAL"."unit_cost" IS 'EUR per MATERIAL.unit, captured for this job plan.';

COMMENT ON COLUMN "LOCATION"."name" IS 'Use a clear full name, e.g. Warehouse A / Shelf 03.';

COMMENT ON COLUMN "LOCATION"."type" IS 'Warehouse, room, shelf, workshop.';

COMMENT ON TABLE "MACHINE" IS 'Production equipment. Accessories and independent tools belong in ASSET; do not duplicate a machine there.';

COMMENT ON COLUMN "MACHINE"."purchase_price" IS 'EUR.';

COMMENT ON COLUMN "ASSET"."machine_id" IS 'Attached to this machine; its location is inherited from MACHINE.';

COMMENT ON COLUMN "ASSET"."location_id" IS 'Own storage location only when not attached to a machine.';

COMMENT ON COLUMN "ASSET"."purchase_price" IS 'EUR.';

COMMENT ON COLUMN "MATERIAL"."unit" IS 'One canonical unit for stock, planned requirements and supplier prices; immutable after use.';

COMMENT ON COLUMN "MATERIAL"."standard_unit_cost" IS 'Reference EUR cost per canonical unit; supplier quotes and job snapshots are separate.';

COMMENT ON COLUMN "SUPPLIER_MATERIAL"."unit_price" IS 'Quoted EUR price per MATERIAL.unit; normalize pack prices before saving.';

COMMENT ON TABLE "MACHINE_MATERIAL" IS 'Compatibility or normal use. This link does not consume stock.';

COMMENT ON TABLE "STOCK_BALANCE" IS 'Current physical stock, maintained only by the PostgreSQL stock-posting trigger. Opening stock is an ADJUSTMENT movement. Planning does not reserve stock.';

COMMENT ON TABLE "STOCK_MOVEMENT" IS 'Posted quantities and endpoints are immutable. Correct counts with reasoned adjustments; return unused job material with RETURN. Actual job usage = CONSUMPTION minus RETURN. Only finance linkage and reason text may be edited.';

COMMENT ON COLUMN "STOCK_MOVEMENT"."request_key" IS 'Caller-generated idempotency key; reuse the same key on a retry.';

COMMENT ON COLUMN "STOCK_MOVEMENT"."job_id" IS 'Required for RETURN; set for production CONSUMPTION. Empty for general consumable usage.';

COMMENT ON COLUMN "STOCK_MOVEMENT"."financial_record_id" IS 'Optional purchase/expense reference; may be attached after receipt.';

COMMENT ON TABLE "FINANCIAL_RECORD" IS 'Basic invoice/expense register. UNPAID when paid_amount = 0, PAID when paid_amount = amount, otherwise PARTIALLY_PAID. Several records may reference one order. Refunds must match the original party and currency and cannot exceed its total.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."reference_number" IS 'External invoice or receipt number; not globally unique across suppliers.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."customer_order_id" IS 'For order-related sales; derive the customer through the order.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."customer_id" IS 'For customer transactions without an order; leave empty when customer_order_id is set.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."original_record_id" IS 'Mandatory for a refund; points to the original sale, purchase or expense.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."amount" IS 'Positive gross total, including any tax; refund direction follows type.';

COMMENT ON COLUMN "FINANCIAL_RECORD"."paid_amount" IS 'Cumulative settled amount. Payment status is derived from this and amount.';

COMMENT ON TABLE "DOCUMENT" IS 'Visibility is a classification. The application must enforce access, and NAS permissions must agree.';

COMMENT ON COLUMN "DOCUMENT"."category" IS 'TECHNICAL, FINANCIAL, LOGISTICS, etc.';

COMMENT ON COLUMN "DOCUMENT"."file_path" IS 'One canonical NAS file path; one file can have many DOCUMENT_LINK rows.';

COMMENT ON TABLE "DOCUMENT_LINK" IS 'One target per row. Link the same receipt to a machine and finance using two rows, without copying the file.';

ALTER TABLE "EMPLOYEE_DEPARTMENT" ADD FOREIGN KEY ("employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "EMPLOYEE_DEPARTMENT" ADD FOREIGN KEY ("department_id") REFERENCES "DEPARTMENT" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DEPARTMENT" ADD FOREIGN KEY ("manager_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUSTOMER_ORDER" ADD FOREIGN KEY ("customer_id") REFERENCES "CUSTOMER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUSTOMER_ORDER" ADD FOREIGN KEY ("template_id") REFERENCES "TEMPLATE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUSTOMER_ORDER" ADD FOREIGN KEY ("intake_employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUSTOMER_ORDER" ADD FOREIGN KEY ("designer_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "CUSTOMER_ORDER" ADD FOREIGN KEY ("qc_employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "JOB" ADD FOREIGN KEY ("order_id") REFERENCES "CUSTOMER_ORDER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "JOB" ADD FOREIGN KEY ("responsible_employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "JOB" ADD FOREIGN KEY ("machine_id") REFERENCES "MACHINE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "JOB_MATERIAL" ADD FOREIGN KEY ("job_id") REFERENCES "JOB" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "JOB_MATERIAL" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MACHINE" ADD FOREIGN KEY ("location_id") REFERENCES "LOCATION" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MACHINE" ADD FOREIGN KEY ("supplier_id") REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ASSET" ADD FOREIGN KEY ("machine_id") REFERENCES "MACHINE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ASSET" ADD FOREIGN KEY ("location_id") REFERENCES "LOCATION" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ASSET" ADD FOREIGN KEY ("supplier_id") REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "SUPPLIER_MATERIAL" ADD FOREIGN KEY ("supplier_id") REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "SUPPLIER_MATERIAL" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MACHINE_MATERIAL" ADD FOREIGN KEY ("machine_id") REFERENCES "MACHINE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "MACHINE_MATERIAL" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_BALANCE" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_BALANCE" ADD FOREIGN KEY ("location_id") REFERENCES "LOCATION" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("from_location_id") REFERENCES "LOCATION" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("to_location_id") REFERENCES "LOCATION" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("job_id") REFERENCES "JOB" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("financial_record_id") REFERENCES "FINANCIAL_RECORD" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "STOCK_MOVEMENT" ADD FOREIGN KEY ("performed_by_employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "FINANCIAL_RECORD" ADD FOREIGN KEY ("customer_order_id") REFERENCES "CUSTOMER_ORDER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "FINANCIAL_RECORD" ADD FOREIGN KEY ("customer_id") REFERENCES "CUSTOMER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "FINANCIAL_RECORD" ADD FOREIGN KEY ("supplier_id") REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "FINANCIAL_RECORD" ADD FOREIGN KEY ("original_record_id") REFERENCES "FINANCIAL_RECORD" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT" ADD FOREIGN KEY ("uploaded_by_employee_id") REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("document_id") REFERENCES "DOCUMENT" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("machine_id") REFERENCES "MACHINE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("asset_id") REFERENCES "ASSET" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("material_id") REFERENCES "MATERIAL" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("supplier_id") REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("customer_order_id") REFERENCES "CUSTOMER_ORDER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("job_id") REFERENCES "JOB" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("template_id") REFERENCES "TEMPLATE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "DOCUMENT_LINK" ADD FOREIGN KEY ("financial_record_id") REFERENCES "FINANCIAL_RECORD" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;


-- Row-level constraints corresponding to the WAM v2 diagram.
ALTER TABLE "TEMPLATE" ADD CONSTRAINT "template_revision_positive" CHECK (revision > 0);
ALTER TABLE "TEMPLATE" ADD CONSTRAINT "template_checksum_sha256" CHECK (design_checksum ~ '^[0-9a-f]{64}$');
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_status_valid" CHECK (status IN ('SUBMITTED','PLANNED','IN_PRODUCTION','QC','READY','DELIVERED','CANCELLED'));
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_qc_valid" CHECK (qc_result IN ('NOT_CHECKED','PASSED','FAILED'));
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_qc_evidence" CHECK ((qc_result = 'NOT_CHECKED' AND qc_checked_at IS NULL) OR (qc_result IN ('PASSED','FAILED') AND qc_employee_id IS NOT NULL AND qc_checked_at IS NOT NULL));
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_release_requires_qc" CHECK (status NOT IN ('READY','DELIVERED') OR qc_result = 'PASSED');
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_delivery_date_matches_status" CHECK ((status = 'DELIVERED') = (delivered_at IS NOT NULL));
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_delivery_after_intake" CHECK (delivered_at IS NULL OR delivered_at >= submitted_at);
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT "order_qc_after_intake" CHECK (qc_checked_at IS NULL OR qc_checked_at >= submitted_at);
ALTER TABLE "JOB" ADD CONSTRAINT "job_quantities_valid" CHECK (sequence_no > 0 AND completed_quantity >= 0);
ALTER TABLE "JOB" ADD CONSTRAINT "job_status_valid" CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED'));
ALTER TABLE "JOB" ADD CONSTRAINT "job_progress_matches_status" CHECK ((status = 'PENDING' AND started_at IS NULL AND completed_at IS NULL AND completed_quantity = 0) OR (status = 'IN_PROGRESS' AND started_at IS NOT NULL AND completed_at IS NULL) OR (status = 'COMPLETED' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND completed_quantity > 0));
ALTER TABLE "JOB" ADD CONSTRAINT "job_started_requires_employee" CHECK (status = 'PENDING' OR responsible_employee_id IS NOT NULL);
ALTER TABLE "JOB" ADD CONSTRAINT "job_completion_after_start" CHECK (completed_at IS NULL OR completed_at >= started_at);
ALTER TABLE "JOB" ADD CONSTRAINT "job_file_snapshot_complete" CHECK ((schematic_file IS NULL AND schematic_checksum IS NULL AND schematic_revision IS NULL) OR (schematic_file IS NOT NULL AND schematic_checksum IS NOT NULL AND schematic_checksum ~ '^[0-9a-f]{64}$'));
ALTER TABLE "JOB_MATERIAL" ADD CONSTRAINT "job_material_quantity_positive" CHECK (planned_quantity > 0);
ALTER TABLE "JOB_MATERIAL" ADD CONSTRAINT "job_material_cost_nonnegative" CHECK (unit_cost IS NULL OR unit_cost >= 0);
ALTER TABLE "MACHINE" ADD CONSTRAINT "machine_status_valid" CHECK (status IN ('ACTIVE','MAINTENANCE','OUT_OF_SERVICE'));
ALTER TABLE "MACHINE" ADD CONSTRAINT "machine_price_nonnegative" CHECK (purchase_price IS NULL OR purchase_price >= 0);
ALTER TABLE "ASSET" ADD CONSTRAINT "asset_location_has_one_source" CHECK (machine_id IS NULL OR location_id IS NULL);
ALTER TABLE "ASSET" ADD CONSTRAINT "asset_price_nonnegative" CHECK (purchase_price IS NULL OR purchase_price >= 0);
ALTER TABLE "MATERIAL" ADD CONSTRAINT "material_type_valid" CHECK (type IN ('RAW_MATERIAL','CONSUMABLE'));
ALTER TABLE "MATERIAL" ADD CONSTRAINT "material_min_stock_nonnegative" CHECK (min_stock >= 0);
ALTER TABLE "MATERIAL" ADD CONSTRAINT "material_cost_nonnegative" CHECK (standard_unit_cost IS NULL OR standard_unit_cost >= 0);
ALTER TABLE "SUPPLIER_MATERIAL" ADD CONSTRAINT "supplier_material_price_nonnegative" CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER TABLE "STOCK_BALANCE" ADD CONSTRAINT "stock_balance_nonnegative" CHECK (quantity >= 0);
ALTER TABLE "STOCK_MOVEMENT" ADD CONSTRAINT "stock_movement_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "STOCK_MOVEMENT" ADD CONSTRAINT "stock_movement_type_valid" CHECK (movement_type IN ('RECEIPT','TRANSFER','CONSUMPTION','RETURN','ADJUSTMENT'));
ALTER TABLE "STOCK_MOVEMENT" ADD CONSTRAINT "stock_movement_locations_distinct" CHECK (from_location_id IS NULL OR to_location_id IS NULL OR from_location_id <> to_location_id);
ALTER TABLE "STOCK_MOVEMENT" ADD CONSTRAINT "stock_movement_direction_valid" CHECK ((movement_type = 'RECEIPT' AND from_location_id IS NULL AND to_location_id IS NOT NULL AND job_id IS NULL) OR (movement_type = 'TRANSFER' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL AND job_id IS NULL) OR (movement_type = 'CONSUMPTION' AND from_location_id IS NOT NULL AND to_location_id IS NULL) OR (movement_type = 'RETURN' AND from_location_id IS NULL AND to_location_id IS NOT NULL AND job_id IS NOT NULL) OR (movement_type = 'ADJUSTMENT' AND num_nonnulls(from_location_id, to_location_id) = 1 AND job_id IS NULL AND reason IS NOT NULL AND length(btrim(reason)) > 0));
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_type_valid" CHECK (type IN ('PURCHASE','EXPENSE','SALE','SALE_REFUND','PURCHASE_REFUND'));
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_amounts_valid" CHECK (amount > 0 AND paid_amount >= 0 AND paid_amount <= amount);
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_currency_format" CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_party_valid" CHECK ((type IN ('SALE','SALE_REFUND') AND supplier_id IS NULL AND num_nonnulls(customer_order_id, customer_id) = 1) OR (type IN ('PURCHASE','PURCHASE_REFUND') AND supplier_id IS NOT NULL AND customer_order_id IS NULL AND customer_id IS NULL) OR (type = 'EXPENSE' AND customer_order_id IS NULL AND customer_id IS NULL));
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_refund_requires_original" CHECK ((type IN ('SALE_REFUND','PURCHASE_REFUND')) = (original_record_id IS NOT NULL));
ALTER TABLE "FINANCIAL_RECORD" ADD CONSTRAINT "finance_refund_not_self" CHECK (original_record_id IS NULL OR original_record_id <> id);
ALTER TABLE "DOCUMENT" ADD CONSTRAINT "document_visibility_valid" CHECK (visibility IN ('INTERNAL','RESTRICTED','CUSTOMER'));
ALTER TABLE "DOCUMENT_LINK" ADD CONSTRAINT "document_link_exactly_one_target" CHECK (num_nonnulls(machine_id, asset_id, material_id, supplier_id, customer_order_id, job_id, template_id, financial_record_id) = 1);


-- Cross-table business rules for the WAM v2 structural schema.

CREATE FUNCTION wam_template_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Template revisions are immutable; insert a new revision';
END;
$$;
CREATE TRIGGER template_immutable BEFORE UPDATE OR DELETE ON "TEMPLATE"
FOR EACH ROW EXECUTE FUNCTION wam_template_immutable();

CREATE FUNCTION wam_material_unit_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unit IS DISTINCT FROM OLD.unit THEN
    RAISE EXCEPTION 'Material canonical unit is fixed; create a different material';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER material_unit_fixed BEFORE UPDATE ON "MATERIAL"
FOR EACH ROW EXECUTE FUNCTION wam_material_unit_fixed();

CREATE FUNCTION wam_guard_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_has_jobs boolean;
  v_has_started boolean;
  v_all_complete boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'SUBMITTED' OR NEW.qc_result <> 'NOT_CHECKED' THEN
      RAISE EXCEPTION 'New orders must start as SUBMITTED without a QC result';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Order identity is immutable';
  END IF;
  IF OLD.status IN ('DELIVERED','CANCELLED') THEN
    RAISE EXCEPTION 'Delivered or cancelled orders are closed';
  END IF;
  SELECT count(*) > 0, coalesce(bool_or(started_at IS NOT NULL), false),
         coalesce(bool_and(status = 'COMPLETED' AND completed_quantity = NEW.quantity), false)
    INTO v_has_jobs, v_has_started, v_all_complete
    FROM "JOB" WHERE order_id = OLD.id;

  IF v_has_started AND
     ROW(NEW.customer_id, NEW.template_id, NEW.quantity) IS DISTINCT FROM
     ROW(OLD.customer_id, OLD.template_id, OLD.quantity) THEN
    RAISE EXCEPTION 'Customer, template revision and ordered quantity are frozen after production starts';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND
     EXISTS (SELECT 1 FROM "FINANCIAL_RECORD" WHERE customer_order_id = OLD.id) THEN
    RAISE EXCEPTION 'An invoiced order cannot be moved to another customer';
  END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity AND
     EXISTS (SELECT 1 FROM "JOB" WHERE order_id = OLD.id AND completed_quantity > NEW.quantity) THEN
    RAISE EXCEPTION 'Order quantity cannot be below existing step progress';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'SUBMITTED' AND NEW.status IN ('PLANNED','CANCELLED')) OR
       (OLD.status = 'PLANNED' AND NEW.status IN ('SUBMITTED','IN_PRODUCTION','CANCELLED')) OR
       (OLD.status = 'IN_PRODUCTION' AND NEW.status IN ('QC','CANCELLED')) OR
       (OLD.status = 'QC' AND NEW.status IN ('IN_PRODUCTION','READY','CANCELLED')) OR
       (OLD.status = 'READY' AND NEW.status IN ('IN_PRODUCTION','DELIVERED','CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Invalid order transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status IN ('PLANNED','IN_PRODUCTION','QC','READY','DELIVERED') AND NEW.template_id IS NULL THEN
    RAISE EXCEPTION 'Select a template revision before planning or production';
  END IF;
  IF NEW.status IN ('IN_PRODUCTION','QC','READY','DELIVERED') AND NOT v_has_jobs THEN
    RAISE EXCEPTION 'Production requires at least one job';
  END IF;
  IF NEW.status IN ('QC','READY','DELIVERED') AND NOT v_all_complete THEN
    RAISE EXCEPTION 'Every production step must complete the ordered quantity before QC or release';
  END IF;
  IF NEW.status IN ('SUBMITTED','PLANNED','IN_PRODUCTION') AND NEW.qc_result <> 'NOT_CHECKED' THEN
    RAISE EXCEPTION 'Clear the QC result and timestamp before returning to production';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_guard BEFORE INSERT OR UPDATE ON "CUSTOMER_ORDER"
FOR EACH ROW EXECUTE FUNCTION wam_guard_order();

CREATE FUNCTION wam_guard_job() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order "CUSTOMER_ORDER"%ROWTYPE;
  v_order_id uuid;
  v_max_started_sequence integer;
BEGIN
  IF TG_OP = 'DELETE' THEN v_order_id := OLD.order_id; ELSE v_order_id := NEW.order_id; END IF;
  SELECT * INTO STRICT v_order FROM "CUSTOMER_ORDER" WHERE id = v_order_id FOR UPDATE;
  IF v_order.status NOT IN ('SUBMITTED','PLANNED','IN_PRODUCTION') THEN
    RAISE EXCEPTION 'Jobs can change only during intake, planning or production';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'Started jobs cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'New jobs must start as PENDING'; END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      RAISE EXCEPTION 'Job identity and parent order are immutable';
    END IF;
    IF OLD.status = 'COMPLETED' THEN RAISE EXCEPTION 'Completed jobs are immutable; append a rework step'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'PENDING' AND NEW.status = 'IN_PROGRESS') OR
         (OLD.status = 'IN_PROGRESS' AND NEW.status = 'COMPLETED')) THEN
      RAISE EXCEPTION 'Invalid job transition: % -> %', OLD.status, NEW.status;
    END IF;
    IF OLD.started_at IS NOT NULL AND
       ROW(NEW.sequence_no, NEW.machine_id, NEW.schematic_file, NEW.schematic_revision, NEW.schematic_checksum, NEW.started_at)
       IS DISTINCT FROM
       ROW(OLD.sequence_no, OLD.machine_id, OLD.schematic_file, OLD.schematic_revision, OLD.schematic_checksum, OLD.started_at) THEN
      RAISE EXCEPTION 'Started step sequence, machine and working-file snapshot are frozen';
    END IF;
  END IF;
  SELECT max(sequence_no) INTO v_max_started_sequence
    FROM "JOB" WHERE order_id = NEW.order_id AND started_at IS NOT NULL AND id <> NEW.id;
  IF (TG_OP = 'INSERT' OR NEW.sequence_no IS DISTINCT FROM OLD.sequence_no)
     AND v_max_started_sequence IS NOT NULL AND NEW.sequence_no <= v_max_started_sequence THEN
    RAISE EXCEPTION 'New or reordered steps must follow previously started steps';
  END IF;
  IF NEW.completed_quantity > v_order.quantity THEN
    RAISE EXCEPTION 'Step progress cannot exceed the ordered quantity';
  END IF;
  IF NEW.status <> 'PENDING' THEN
    IF v_order.status <> 'IN_PRODUCTION' THEN RAISE EXCEPTION 'Start the order production stage first'; END IF;
    IF EXISTS (SELECT 1 FROM "JOB" WHERE order_id = NEW.order_id AND sequence_no < NEW.sequence_no AND status <> 'COMPLETED') THEN
      RAISE EXCEPTION 'Complete preceding steps first';
    END IF;
    IF NEW.machine_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status = 'PENDING') THEN
      PERFORM 1 FROM "MACHINE" WHERE id = NEW.machine_id AND status = 'ACTIVE' FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Assigned machine must be ACTIVE'; END IF;
    END IF;
    IF NEW.started_at < v_order.submitted_at THEN RAISE EXCEPTION 'A job cannot start before order intake'; END IF;
  END IF;
  IF NEW.status = 'COMPLETED' AND NEW.completed_quantity <> v_order.quantity THEN
    RAISE EXCEPTION 'A completed step must finish the full ordered quantity';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_guard BEFORE INSERT OR UPDATE OR DELETE ON "JOB"
FOR EACH ROW EXECUTE FUNCTION wam_guard_job();

CREATE FUNCTION wam_guard_job_material() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_job_id uuid;
  v_order_id uuid;
  v_order_status varchar;
  v_job_status varchar;
BEGIN
  IF TG_OP = 'DELETE' THEN v_job_id := OLD.job_id; ELSE v_job_id := NEW.job_id; END IF;
  IF TG_OP = 'UPDATE' AND
     ROW(NEW.id, NEW.job_id, NEW.material_id) IS DISTINCT FROM ROW(OLD.id, OLD.job_id, OLD.material_id) THEN
    RAISE EXCEPTION 'A material plan identity cannot be reassigned; delete and recreate it before work starts';
  END IF;
  SELECT order_id INTO STRICT v_order_id FROM "JOB" WHERE id = v_job_id;
  SELECT status INTO v_order_status FROM "CUSTOMER_ORDER" WHERE id = v_order_id FOR UPDATE;
  SELECT status INTO v_job_status FROM "JOB" WHERE id = v_job_id;
  IF v_order_status NOT IN ('SUBMITTED','PLANNED','IN_PRODUCTION') OR v_job_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Material plans are frozen when their step starts';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER job_material_guard BEFORE INSERT OR UPDATE OR DELETE ON "JOB_MATERIAL"
FOR EACH ROW EXECUTE FUNCTION wam_guard_job_material();

CREATE FUNCTION wam_stock_balance_managed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Stock balances are managed through STOCK_MOVEMENT only';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER stock_balance_managed BEFORE INSERT OR UPDATE OR DELETE ON "STOCK_BALANCE"
FOR EACH ROW EXECUTE FUNCTION wam_stock_balance_managed();
CREATE TRIGGER stock_balance_no_truncate BEFORE TRUNCATE ON "STOCK_BALANCE"
FOR EACH STATEMENT EXECUTE FUNCTION wam_stock_balance_managed();

CREATE FUNCTION wam_stock_movement_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Posted stock movements cannot be deleted'; END IF;
  IF (to_jsonb(NEW) - ARRAY['financial_record_id','reason']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['financial_record_id','reason']) THEN
    RAISE EXCEPTION 'Posted stock quantities and endpoints are immutable; post a correction';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_movement_immutable BEFORE UPDATE OR DELETE ON "STOCK_MOVEMENT"
FOR EACH ROW EXECUTE FUNCTION wam_stock_movement_immutable();

CREATE FUNCTION wam_prevent_posted_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Posted business records cannot be truncated';
END;
$$;
CREATE TRIGGER stock_movement_no_truncate BEFORE TRUNCATE ON "STOCK_MOVEMENT"
FOR EACH STATEMENT EXECUTE FUNCTION wam_prevent_posted_truncate();
CREATE TRIGGER template_no_truncate BEFORE TRUNCATE ON "TEMPLATE"
FOR EACH STATEMENT EXECUTE FUNCTION wam_prevent_posted_truncate();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON "FINANCIAL_RECORD"
FOR EACH STATEMENT EXECUTE FUNCTION wam_prevent_posted_truncate();

CREATE FUNCTION wam_stock_finance_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.financial_record_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "FINANCIAL_RECORD" WHERE id = NEW.financial_record_id AND type IN ('PURCHASE','EXPENSE')
  ) THEN RAISE EXCEPTION 'Stock finance reference must be a purchase or expense'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_finance_reference BEFORE INSERT OR UPDATE ON "STOCK_MOVEMENT"
FOR EACH ROW EXECUTE FUNCTION wam_stock_finance_reference();

CREATE FUNCTION wam_post_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_id uuid;
  v_order_status varchar;
  v_job_status varchar;
  v_actual numeric;
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    SELECT order_id INTO STRICT v_order_id FROM "JOB" WHERE id = NEW.job_id;
    SELECT status INTO v_order_status FROM "CUSTOMER_ORDER" WHERE id = v_order_id FOR UPDATE;
    SELECT status INTO v_job_status FROM "JOB" WHERE id = NEW.job_id;
    IF NEW.movement_type = 'CONSUMPTION' AND
       (v_order_status <> 'IN_PRODUCTION' OR v_job_status <> 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'Production material can be issued only to an active production step';
    END IF;
    IF NEW.movement_type = 'RETURN' THEN
      SELECT coalesce(sum(CASE movement_type WHEN 'CONSUMPTION' THEN quantity WHEN 'RETURN' THEN -quantity ELSE 0 END),0)
        INTO v_actual FROM "STOCK_MOVEMENT"
        WHERE job_id = NEW.job_id AND material_id = NEW.material_id AND id <> NEW.id;
      IF NEW.quantity > v_actual THEN RAISE EXCEPTION 'Job returns cannot exceed its net issued material'; END IF;
    END IF;
  END IF;

  -- Both creation and locking use canonical location order to avoid inverse-transfer deadlocks.
  INSERT INTO "STOCK_BALANCE" (material_id, location_id, quantity)
    SELECT NEW.material_id, loc, 0
    FROM unnest(ARRAY[NEW.from_location_id, NEW.to_location_id]) AS loc
    WHERE loc IS NOT NULL ORDER BY loc
    ON CONFLICT (material_id, location_id) DO NOTHING;
  PERFORM 1 FROM "STOCK_BALANCE"
    WHERE material_id = NEW.material_id AND location_id IN (NEW.from_location_id, NEW.to_location_id)
    ORDER BY location_id FOR UPDATE;
  IF NEW.from_location_id IS NOT NULL THEN
    UPDATE "STOCK_BALANCE" SET quantity = quantity - NEW.quantity
      WHERE material_id = NEW.material_id AND location_id = NEW.from_location_id AND quantity >= NEW.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock at source location'; END IF;
  END IF;
  IF NEW.to_location_id IS NOT NULL THEN
    UPDATE "STOCK_BALANCE" SET quantity = quantity + NEW.quantity
      WHERE material_id = NEW.material_id AND location_id = NEW.to_location_id;
  END IF;
  RETURN NEW;
END;
$$;
-- AFTER INSERT is deliberate: ON CONFLICT(request_key) DO NOTHING must not post a duplicate balance change.
CREATE TRIGGER stock_post AFTER INSERT ON "STOCK_MOVEMENT"
FOR EACH ROW EXECUTE FUNCTION wam_post_stock();

CREATE FUNCTION wam_guard_finance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_original "FINANCIAL_RECORD"%ROWTYPE;
  v_refunded numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial records cannot be deleted; preserve the register'; END IF;
  IF TG_OP = 'UPDATE' AND
     ROW(NEW.id, NEW.type, NEW.customer_order_id, NEW.customer_id, NEW.supplier_id, NEW.original_record_id, NEW.amount, NEW.currency)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.type, OLD.customer_order_id, OLD.customer_id, OLD.supplier_id, OLD.original_record_id, OLD.amount, OLD.currency) THEN
    RAISE EXCEPTION 'Posted financial identity, party, type, total and currency are immutable';
  END IF;
  IF NEW.customer_order_id IS NOT NULL THEN
    -- Serialize invoice linkage with any attempted change to the order customer.
    PERFORM 1 FROM "CUSTOMER_ORDER" WHERE id = NEW.customer_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order does not exist'; END IF;
  END IF;
  IF NEW.original_record_id IS NOT NULL THEN
    SELECT * INTO STRICT v_original FROM "FINANCIAL_RECORD" WHERE id = NEW.original_record_id FOR UPDATE;
    IF NOT ((NEW.type = 'SALE_REFUND' AND v_original.type = 'SALE') OR
            (NEW.type = 'PURCHASE_REFUND' AND v_original.type IN ('PURCHASE','EXPENSE'))) THEN
      RAISE EXCEPTION 'Refund type must match an original sale, purchase or expense';
    END IF;
    IF ROW(NEW.customer_order_id, NEW.customer_id, NEW.supplier_id, NEW.currency) IS DISTINCT FROM
       ROW(v_original.customer_order_id, v_original.customer_id, v_original.supplier_id, v_original.currency) THEN
      RAISE EXCEPTION 'Refund party, order and currency must match the original';
    END IF;
    SELECT coalesce(sum(amount),0) INTO v_refunded FROM "FINANCIAL_RECORD"
      WHERE original_record_id = NEW.original_record_id AND id <> NEW.id;
    IF v_refunded + NEW.amount > v_original.amount THEN
      RAISE EXCEPTION 'Combined refunds cannot exceed the original amount';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_guard BEFORE INSERT OR UPDATE OR DELETE ON "FINANCIAL_RECORD"
FOR EACH ROW EXECUTE FUNCTION wam_guard_finance();

-- Fast reverse attachment lookup from each supported target.
CREATE INDEX document_link_machine ON "DOCUMENT_LINK" (machine_id) WHERE machine_id IS NOT NULL;
CREATE INDEX document_link_asset ON "DOCUMENT_LINK" (asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX document_link_material ON "DOCUMENT_LINK" (material_id) WHERE material_id IS NOT NULL;
CREATE INDEX document_link_supplier ON "DOCUMENT_LINK" (supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX document_link_order ON "DOCUMENT_LINK" (customer_order_id) WHERE customer_order_id IS NOT NULL;
CREATE INDEX document_link_job ON "DOCUMENT_LINK" (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX document_link_template ON "DOCUMENT_LINK" (template_id) WHERE template_id IS NOT NULL;
CREATE INDEX document_link_finance ON "DOCUMENT_LINK" (financial_record_id) WHERE financial_record_id IS NOT NULL;

COMMENT ON TABLE "STOCK_BALANCE" IS 'Derived on-hand stock. Write STOCK_MOVEMENT; never manually overwrite balances.';
COMMENT ON TABLE "TEMPLATE" IS 'Immutable design revision with a preserved external file and SHA-256.';
COMMENT ON TABLE "FINANCIAL_RECORD" IS 'Basic document register with cumulative settlement. It is not a double-entry ledger or payment-event history.';

-- v3 additions: employee attendance and machine maintenance.
-- Daily attendance register (parousiologio): one record per employee/workday.
-- Workday dates use Europe/Athens; timestamps retain their absolute instant.
CREATE TABLE "ATTENDANCE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "employee_id" uuid NOT NULL,
  "attendance_date" date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Athens')::date),
  "status" varchar(30) NOT NULL DEFAULT 'PRESENT',
  "check_in_at" timestamptz,
  "check_out_at" timestamptz,
  "notes" text,
  "recorded_by_employee_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "fk_attendance_employee" FOREIGN KEY ("employee_id")
    REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "fk_attendance_recorded_by" FOREIGN KEY ("recorded_by_employee_id")
    REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "attendance_status_valid" CHECK (
    status IN ('PRESENT', 'ABSENT', 'LEAVE', 'SICK_LEAVE', 'DAY_OFF')
  ),
  CONSTRAINT "attendance_checkout_valid" CHECK (
    check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at > check_in_at)
  ),
  CONSTRAINT "attendance_times_require_presence" CHECK (
    status = 'PRESENT' OR (check_in_at IS NULL AND check_out_at IS NULL)
  ),
  CONSTRAINT "attendance_checkin_matches_workday" CHECK (
    check_in_at IS NULL OR attendance_date = (check_in_at AT TIME ZONE 'Europe/Athens')::date
  )
);

CREATE UNIQUE INDEX "uq_attendance_employee_date"
  ON "ATTENDANCE" ("employee_id", "attendance_date");
CREATE INDEX "idx_attendance_date_status"
  ON "ATTENDANCE" ("attendance_date", "status");
CREATE INDEX "idx_attendance_recorded_by"
  ON "ATTENDANCE" ("recorded_by_employee_id");

CREATE FUNCTION wam_attendance_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON "ATTENDANCE"
FOR EACH ROW EXECUTE FUNCTION wam_attendance_updated_at();

COMMENT ON TABLE "ATTENDANCE" IS
  'Daily employee attendance. Missing row means unrecorded, not absent. One row per employee and Athens workday. Not payroll or per-job time tracking.';
COMMENT ON COLUMN "ATTENDANCE"."attendance_date" IS
  'Europe/Athens workday; for overnight attendance, use the local date of check-in.';
COMMENT ON COLUMN "ATTENDANCE"."status" IS
  'PRESENT, ABSENT, LEAVE, SICK_LEAVE, DAY_OFF. PRESENT can be recorded without clock times.';
COMMENT ON COLUMN "ATTENDANCE"."recorded_by_employee_id" IS
  'Employee who most recently entered or corrected the record. The API supplies and authorizes this employee on every write.';
COMMENT ON COLUMN "ATTENDANCE"."check_in_at" IS
  'Optional arrival timestamp. Paired timestamps measure elapsed presence, not paid or productive hours.';

-- Machine service history: completed maintenance, repairs and inspections.
CREATE TABLE "MACHINE_MAINTENANCE" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "machine_id" uuid NOT NULL,
  "maintenance_type" varchar(30) NOT NULL DEFAULT 'PREVENTIVE',
  "title" varchar(180) NOT NULL,
  "performed_at" timestamptz NOT NULL DEFAULT (now()),
  "performed_by_employee_id" uuid,
  "supplier_id" uuid,
  "next_due_date" date,
  "notes" text,
  "recorded_by_employee_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "fk_maintenance_machine" FOREIGN KEY ("machine_id")
    REFERENCES "MACHINE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "fk_maintenance_employee" FOREIGN KEY ("performed_by_employee_id")
    REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "fk_maintenance_supplier" FOREIGN KEY ("supplier_id")
    REFERENCES "SUPPLIER" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "fk_maintenance_recorded_by" FOREIGN KEY ("recorded_by_employee_id")
    REFERENCES "EMPLOYEE" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT "maintenance_type_valid" CHECK (
    maintenance_type IN ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION')
  ),
  CONSTRAINT "maintenance_title_not_empty" CHECK (length(btrim(title)) > 0),
  CONSTRAINT "maintenance_performer_required" CHECK (
    performed_by_employee_id IS NOT NULL OR supplier_id IS NOT NULL
  ),
  CONSTRAINT "maintenance_next_due_valid" CHECK (
    next_due_date IS NULL OR next_due_date >= (performed_at AT TIME ZONE 'Europe/Athens')::date
  )
);

CREATE INDEX "idx_maintenance_machine_performed"
  ON "MACHINE_MAINTENANCE" ("machine_id", "performed_at");
CREATE INDEX "idx_maintenance_next_due"
  ON "MACHINE_MAINTENANCE" ("next_due_date");
CREATE INDEX "idx_maintenance_employee"
  ON "MACHINE_MAINTENANCE" ("performed_by_employee_id");
CREATE INDEX "idx_maintenance_supplier"
  ON "MACHINE_MAINTENANCE" ("supplier_id");
CREATE INDEX "idx_maintenance_recorded_by"
  ON "MACHINE_MAINTENANCE" ("recorded_by_employee_id");

CREATE FUNCTION wam_maintenance_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER maintenance_updated_at BEFORE UPDATE ON "MACHINE_MAINTENANCE"
FOR EACH ROW EXECUTE FUNCTION wam_maintenance_updated_at();

-- Reuse the existing save-once document model for service reports and invoices.
ALTER TABLE "DOCUMENT_LINK" ADD COLUMN "maintenance_id" uuid;
ALTER TABLE "DOCUMENT_LINK" ADD CONSTRAINT "fk_document_link_maintenance"
  FOREIGN KEY ("maintenance_id") REFERENCES "MACHINE_MAINTENANCE" ("id")
  ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
CREATE UNIQUE INDEX "uq_document_link_maintenance"
  ON "DOCUMENT_LINK" ("document_id", "maintenance_id");
CREATE INDEX "document_link_maintenance"
  ON "DOCUMENT_LINK" ("maintenance_id") WHERE "maintenance_id" IS NOT NULL;
ALTER TABLE "DOCUMENT_LINK" DROP CONSTRAINT "document_link_exactly_one_target";
ALTER TABLE "DOCUMENT_LINK" ADD CONSTRAINT "document_link_exactly_one_target" CHECK (
  num_nonnulls(machine_id, asset_id, material_id, supplier_id, customer_order_id,
              job_id, template_id, financial_record_id, maintenance_id) = 1
);

COMMENT ON TABLE "MACHINE_MAINTENANCE" IS
  'Completed maintenance history per machine: preventive service, corrective repair, or inspection. Record the employee and/or external supplier who performed it.';
COMMENT ON COLUMN "MACHINE_MAINTENANCE"."next_due_date" IS
  'Optional follow-up date. For a simple due list, use only the latest performed record per machine and maintenance type; older dates are historical.';
COMMENT ON COLUMN "MACHINE_MAINTENANCE"."recorded_by_employee_id" IS
  'Employee who last entered or corrected the record; the API supplies and authorizes this employee on every write.';
COMMENT ON COLUMN "DOCUMENT_LINK"."maintenance_id" IS
  'Optional service record target. Use separate link rows to attach the same service document to maintenance, its machine, and finance.';

-- WAM v4: accounts, audit history, approvals and operator maintenance guidance.
CREATE SEQUENCE wam_employee_code_seq;
CREATE SEQUENCE wam_machine_code_seq;
CREATE SEQUENCE wam_asset_code_seq;
ALTER TABLE "EMPLOYEE" ADD COLUMN employee_code varchar(40) NOT NULL DEFAULT ('EMP-' || nextval('wam_employee_code_seq'));
CREATE UNIQUE INDEX uq_employee_code ON "EMPLOYEE" (employee_code);
ALTER TABLE "EMPLOYEE" ADD COLUMN employment_start_date date, ADD COLUMN employment_end_date date;
ALTER TABLE "EMPLOYEE" ADD CONSTRAINT employee_dates_valid CHECK (employment_end_date IS NULL OR employment_start_date IS NULL OR employment_end_date >= employment_start_date);
ALTER TABLE "MACHINE" ADD COLUMN equipment_code varchar(40) NOT NULL DEFAULT ('MCH-' || nextval('wam_machine_code_seq'));
ALTER TABLE "ASSET" ADD COLUMN equipment_code varchar(40) NOT NULL DEFAULT ('AST-' || nextval('wam_asset_code_seq'));
CREATE UNIQUE INDEX uq_machine_equipment_code ON "MACHINE" (equipment_code);
CREATE UNIQUE INDEX uq_asset_equipment_code ON "ASSET" (equipment_code);
ALTER TABLE "MACHINE" ADD COLUMN purchase_date date, ADD COLUMN warranty_expires_on date;
ALTER TABLE "ASSET" ADD COLUMN purchase_date date, ADD COLUMN warranty_expires_on date;
ALTER TABLE "MACHINE" ADD CONSTRAINT machine_warranty_dates CHECK (purchase_date IS NULL OR warranty_expires_on IS NULL OR warranty_expires_on >= purchase_date);
ALTER TABLE "ASSET" ADD CONSTRAINT asset_warranty_dates CHECK (purchase_date IS NULL OR warranty_expires_on IS NULL OR warranty_expires_on >= purchase_date);
ALTER TABLE "CUSTOMER" ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE "SUPPLIER" ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE "MATERIAL" ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE "MACHINE" ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE "ASSET" ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE "DOCUMENT" ADD COLUMN original_filename varchar(255), ADD COLUMN mime_type varchar(150), ADD COLUMN file_size_bytes bigint, ADD COLUMN file_checksum char(64);
ALTER TABLE "DOCUMENT" ADD CONSTRAINT document_size_valid CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0);
ALTER TABLE "DOCUMENT" ADD CONSTRAINT document_checksum_valid CHECK (file_checksum IS NULL OR file_checksum ~ '^[0-9a-f]{64}$');

CREATE TABLE "USER_ACCOUNT" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES "EMPLOYEE"(id) ON DELETE RESTRICT,
  auth_provider varchar(80) NOT NULL,
  auth_subject varchar(255) NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'VIEWER',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  record_version integer NOT NULL DEFAULT 1,
  CONSTRAINT account_role_valid CHECK (role IN ('ADMIN','MANAGER','OFFICE','PRODUCTION','FINANCE','VIEWER')),
  CONSTRAINT account_identity_not_empty CHECK (length(btrim(auth_provider)) > 0 AND length(btrim(auth_subject)) > 0)
);
CREATE UNIQUE INDEX uq_user_account_employee ON "USER_ACCOUNT"(employee_id);
CREATE UNIQUE INDEX uq_user_account_provider_subject ON "USER_ACCOUNT"(auth_provider,auth_subject);

CREATE TABLE "MAINTENANCE_PLAN" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES "MACHINE"(id) ON DELETE RESTRICT,
  title varchar(180) NOT NULL,
  maintenance_type varchar(30) NOT NULL DEFAULT 'PREVENTIVE',
  instructions text NOT NULL,
  interval_days integer,
  next_due_date date,
  remind_before_days integer NOT NULL DEFAULT 3,
  last_completed_at timestamptz,
  assigned_employee_id uuid REFERENCES "EMPLOYEE"(id) ON DELETE RESTRICT,
  display_to_operator boolean NOT NULL DEFAULT true,
  operator_can_complete boolean NOT NULL DEFAULT false,
  requires_machine_stop boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by_employee_id uuid NOT NULL REFERENCES "EMPLOYEE"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  record_version integer NOT NULL DEFAULT 1,
  CONSTRAINT maintenance_plan_text_valid CHECK (length(btrim(title)) > 0 AND length(btrim(instructions)) > 0),
  CONSTRAINT maintenance_plan_type_valid CHECK (maintenance_type IN ('PREVENTIVE','CORRECTIVE','INSPECTION')),
  CONSTRAINT maintenance_plan_interval_valid CHECK (interval_days IS NULL OR interval_days > 0),
  CONSTRAINT maintenance_plan_reminder_valid CHECK (remind_before_days >= 0),
  CONSTRAINT maintenance_plan_recurring_due CHECK (interval_days IS NULL OR next_due_date IS NOT NULL)
);
CREATE INDEX idx_maintenance_plan_machine ON "MAINTENANCE_PLAN"(machine_id,is_active);
CREATE INDEX idx_maintenance_plan_due ON "MAINTENANCE_PLAN"(next_due_date);
CREATE INDEX idx_maintenance_plan_assignee ON "MAINTENANCE_PLAN"(assigned_employee_id);
CREATE INDEX idx_maintenance_plan_creator ON "MAINTENANCE_PLAN"(created_by_employee_id);
ALTER TABLE "MACHINE_MAINTENANCE" ADD COLUMN plan_id uuid REFERENCES "MAINTENANCE_PLAN"(id) ON DELETE RESTRICT;
ALTER TABLE "MACHINE_MAINTENANCE" ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX uq_maintenance_request_key ON "MACHINE_MAINTENANCE"(request_key);
CREATE INDEX idx_maintenance_plan_history ON "MACHINE_MAINTENANCE"(plan_id,performed_at);
ALTER TABLE "DOCUMENT_LINK" ADD COLUMN maintenance_plan_id uuid REFERENCES "MAINTENANCE_PLAN"(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_document_link_maintenance_plan ON "DOCUMENT_LINK"(document_id,maintenance_plan_id);
CREATE INDEX document_link_maintenance_plan ON "DOCUMENT_LINK"(maintenance_plan_id) WHERE maintenance_plan_id IS NOT NULL;
ALTER TABLE "DOCUMENT_LINK" DROP CONSTRAINT document_link_exactly_one_target;
ALTER TABLE "DOCUMENT_LINK" ADD CONSTRAINT document_link_exactly_one_target CHECK (
  num_nonnulls(machine_id,asset_id,material_id,supplier_id,customer_order_id,job_id,template_id,financial_record_id,maintenance_id,maintenance_plan_id)=1
);

ALTER TABLE "CUSTOMER_ORDER" ADD COLUMN approval_required boolean NOT NULL DEFAULT false;
-- Preserve existing order eligibility; approval becomes mandatory for newly inserted orders.
ALTER TABLE "CUSTOMER_ORDER" ALTER COLUMN approval_required SET DEFAULT true;
ALTER TABLE "CUSTOMER_ORDER" ADD COLUMN approved_template_id uuid REFERENCES "TEMPLATE"(id) ON DELETE RESTRICT,
  ADD COLUMN customer_approved_at timestamptz, ADD COLUMN approved_by_contact varchar(180),
  ADD COLUMN approval_document_id uuid REFERENCES "DOCUMENT"(id) ON DELETE RESTRICT,
  ADD COLUMN cancelled_at timestamptz, ADD COLUMN cancellation_reason text;
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT order_approval_complete CHECK (
  (approved_template_id IS NULL AND customer_approved_at IS NULL AND approved_by_contact IS NULL AND approval_document_id IS NULL)
  OR (approved_template_id IS NOT NULL AND customer_approved_at IS NOT NULL AND approved_by_contact IS NOT NULL
      AND length(btrim(approved_by_contact))>0 AND template_id IS NOT NULL AND approved_template_id=template_id AND customer_approved_at>=submitted_at)
);
ALTER TABLE "CUSTOMER_ORDER" ADD CONSTRAINT order_cancellation_fields_valid CHECK (
  (cancelled_at IS NULL AND cancellation_reason IS NULL)
  OR (status='CANCELLED' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason))>0 AND cancelled_at>=submitted_at)
);
CREATE FUNCTION wam_order_approval_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    NEW.approved_template_id:=NULL; NEW.customer_approved_at:=NULL;
    NEW.approved_by_contact:=NULL; NEW.approval_document_id:=NULL;
  END IF;
  IF NEW.status='CANCELLED' AND (TG_OP='INSERT' OR OLD.status<>'CANCELLED') THEN
    IF NEW.cancellation_reason IS NULL OR length(btrim(NEW.cancellation_reason))=0 THEN
      RAISE EXCEPTION 'A cancellation requires a reason';
    END IF;
    NEW.cancelled_at:=coalesce(NEW.cancelled_at,now());
  END IF;
  IF NEW.approval_required AND NEW.status IN ('IN_PRODUCTION','QC','READY','DELIVERED')
     AND (NEW.approved_template_id IS NULL OR NEW.approved_template_id IS DISTINCT FROM NEW.template_id OR NEW.customer_approved_at IS NULL) THEN
    RAISE EXCEPTION 'Customer approval of the selected template revision is required';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER a_order_approval_cancellation BEFORE INSERT OR UPDATE ON "CUSTOMER_ORDER"
FOR EACH ROW EXECUTE FUNCTION wam_order_approval_cancellation();

CREATE FUNCTION wam_job_machine_available() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.machine_id IS NOT NULL AND NEW.status='IN_PROGRESS' AND (TG_OP='INSERT' OR OLD.status='PENDING') THEN
    PERFORM 1 FROM "MACHINE" WHERE id=NEW.machine_id AND is_active AND status='ACTIVE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An archived or unavailable machine cannot start a job'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER a_job_machine_available BEFORE INSERT OR UPDATE ON "JOB"
FOR EACH ROW EXECUTE FUNCTION wam_job_machine_available();

CREATE FUNCTION wam_maintenance_plan_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "MAINTENANCE_PLAN"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.plan_id IS NOT NULL THEN RAISE EXCEPTION 'Plan completion history must be preserved'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (OLD.plan_id IS NOT NULL OR NEW.plan_id IS NOT NULL) AND
     ROW(NEW.plan_id,NEW.machine_id,NEW.maintenance_type,NEW.performed_at,NEW.request_key) IS DISTINCT FROM ROW(OLD.plan_id,OLD.machine_id,OLD.maintenance_type,OLD.performed_at,OLD.request_key) THEN
    RAISE EXCEPTION 'Completed plan identity and service date are fixed; correct notes or append another service';
  END IF;
  IF NEW.plan_id IS NOT NULL THEN
    IF NEW.request_key IS NULL THEN RAISE EXCEPTION 'Plan completion requires a retry-safe request key'; END IF;
    IF NEW.performed_at>now() THEN RAISE EXCEPTION 'A plan cannot be completed in the future'; END IF;
    SELECT * INTO STRICT p FROM "MAINTENANCE_PLAN" WHERE id=NEW.plan_id FOR UPDATE;
    IF NEW.machine_id<>p.machine_id OR NEW.maintenance_type<>p.maintenance_type THEN
      RAISE EXCEPTION 'Maintenance must match the plan machine and type';
    END IF;
    IF TG_OP='INSERT' AND NOT p.is_active THEN RAISE EXCEPTION 'Cannot complete an inactive plan'; END IF;
    IF NEW.next_due_date IS NOT NULL THEN RAISE EXCEPTION 'Use the linked plan for next due dates'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER a_maintenance_plan_history_guard BEFORE INSERT OR UPDATE OR DELETE ON "MACHINE_MAINTENANCE"
FOR EACH ROW EXECUTE FUNCTION wam_maintenance_plan_history_guard();
CREATE FUNCTION wam_advance_maintenance_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_id IS NOT NULL THEN
    UPDATE "MAINTENANCE_PLAN" SET last_completed_at=NEW.performed_at,
      next_due_date=CASE WHEN interval_days IS NULL THEN NULL ELSE (NEW.performed_at AT TIME ZONE 'Europe/Athens')::date+interval_days END
    WHERE id=NEW.plan_id AND (last_completed_at IS NULL OR NEW.performed_at>last_completed_at);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER maintenance_plan_advance AFTER INSERT ON "MACHINE_MAINTENANCE"
FOR EACH ROW EXECUTE FUNCTION wam_advance_maintenance_plan();
CREATE FUNCTION wam_guard_maintenance_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.last_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Record completions through maintenance history'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.last_completed_at IS DISTINCT FROM OLD.last_completed_at AND pg_trigger_depth()<2 THEN
      RAISE EXCEPTION 'Completion date is maintained from service history';
    END IF;
    IF ROW(NEW.machine_id,NEW.maintenance_type) IS DISTINCT FROM ROW(OLD.machine_id,OLD.maintenance_type)
       AND EXISTS(SELECT 1 FROM "MACHINE_MAINTENANCE" WHERE plan_id=OLD.id) THEN
      RAISE EXCEPTION 'Create another plan instead of changing a completed plan machine/type';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER maintenance_plan_guard BEFORE INSERT OR UPDATE ON "MAINTENANCE_PLAN"
FOR EACH ROW EXECUTE FUNCTION wam_guard_maintenance_plan();

CREATE VIEW "OPERATOR_MAINTENANCE" AS
SELECT p.id AS plan_id,p.machine_id,m.name AS machine_name,m.equipment_code,p.title,p.maintenance_type,
 p.instructions,p.next_due_date,p.last_completed_at,p.assigned_employee_id,p.operator_can_complete,p.requires_machine_stop,
 CASE WHEN p.next_due_date IS NULL THEN 'TIP'
      WHEN p.next_due_date<(now() AT TIME ZONE 'Europe/Athens')::date THEN 'OVERDUE'
      WHEN p.next_due_date=(now() AT TIME ZONE 'Europe/Athens')::date THEN 'DUE_TODAY'
      WHEN p.next_due_date<=(now() AT TIME ZONE 'Europe/Athens')::date+p.remind_before_days THEN 'UPCOMING'
      ELSE 'SCHEDULED' END AS reminder_status
FROM "MAINTENANCE_PLAN" p JOIN "MACHINE" m ON m.id=p.machine_id
WHERE p.is_active AND p.display_to_operator AND m.is_active;

-- Metadata is added only to mutable records. Existing immutable ledger/revision rules stay intact.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EMPLOYEE','DEPARTMENT','EMPLOYEE_DEPARTMENT','ATTENDANCE','CUSTOMER','CUSTOMER_ORDER','JOB','JOB_MATERIAL','LOCATION','MACHINE','SUPPLIER','ASSET','MATERIAL','SUPPLIER_MATERIAL','MACHINE_MATERIAL','MACHINE_MAINTENANCE','FINANCIAL_RECORD','DOCUMENT','DOCUMENT_LINK','USER_ACCOUNT','MAINTENANCE_PLAN'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()',t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()',t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS record_version integer NOT NULL DEFAULT 1',t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (record_version>0)',t,lower(t)||'_record_version_valid');
  END LOOP;
END; $$;
CREATE FUNCTION wam_record_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.record_version:=1;
  ELSE
    NEW.created_at:=OLD.created_at;
    NEW.updated_at:=now();
    NEW.record_version:=OLD.record_version+1;
  END IF;
  RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['EMPLOYEE','DEPARTMENT','EMPLOYEE_DEPARTMENT','ATTENDANCE','CUSTOMER','CUSTOMER_ORDER','JOB','JOB_MATERIAL','LOCATION','MACHINE','SUPPLIER','ASSET','MATERIAL','SUPPLIER_MATERIAL','MACHINE_MATERIAL','MACHINE_MAINTENANCE','FINANCIAL_RECORD','DOCUMENT','DOCUMENT_LINK','USER_ACCOUNT','MAINTENANCE_PLAN'] LOOP
    EXECUTE format('CREATE TRIGGER zz_wam_record_metadata BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION wam_record_metadata()',t);
  END LOOP;
END; $$;

CREATE TABLE "AUDIT_LOG" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid REFERENCES "USER_ACCOUNT"(id) ON DELETE RESTRICT,
 entity_type varchar(64) NOT NULL,
 entity_id uuid NOT NULL,
 action varchar(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
 changed_columns text[] NOT NULL,
 before_data jsonb, after_data jsonb,
 change_reason text,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity_time ON "AUDIT_LOG"(entity_type,entity_id,occurred_at);
CREATE INDEX idx_audit_actor_time ON "AUDIT_LOG"(actor_user_id,occurred_at);
CREATE INDEX idx_audit_occurred_at ON "AUDIT_LOG"(occurred_at);
CREATE FUNCTION wam_audit_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b jsonb; a jsonb; cols text[]; actor uuid; entity uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN b:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN a:=to_jsonb(NEW); END IF;
  actor:=nullif(current_setting('wam.actor_user_id',true),'')::uuid;
  IF actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."USER_ACCOUNT" u JOIN public."EMPLOYEE" e ON e.id=u.employee_id WHERE u.id=actor AND u.is_active AND e.is_active) THEN
    RAISE EXCEPTION 'Audit actor must be an active account of an active employee';
  END IF;
  SELECT coalesce(array_agg(k ORDER BY k),ARRAY[]::text[]) INTO cols
    FROM jsonb_object_keys(coalesce(a,b)) k WHERE (a->k) IS DISTINCT FROM (b->k);
  entity:=coalesce(a->>'id',b->>'id')::uuid;
  -- Keep field names, while excluding free text and personal/contact/auth values from snapshots.
  b:=b-ARRAY['auth_subject','email','phone','notes','special_requests','qc_notes','instructions','approved_by_contact'];
  a:=a-ARRAY['auth_subject','email','phone','notes','special_requests','qc_notes','instructions','approved_by_contact'];
  INSERT INTO public."AUDIT_LOG"(actor_user_id,entity_type,entity_id,action,changed_columns,before_data,after_data,change_reason)
    VALUES(actor,TG_TABLE_NAME,entity,TG_OP,cols,b,a,nullif(current_setting('wam.change_reason',true),''));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
CREATE FUNCTION wam_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit history is append-only'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION wam_audit_immutable();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "AUDIT_LOG" FOR EACH STATEMENT EXECUTE FUNCTION wam_audit_immutable();
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON "AUDIT_LOG" FROM PUBLIC;
REVOKE ALL ON FUNCTION wam_audit_record() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['EMPLOYEE','DEPARTMENT','EMPLOYEE_DEPARTMENT','ATTENDANCE','CUSTOMER','TEMPLATE','CUSTOMER_ORDER','JOB','JOB_MATERIAL','LOCATION','MACHINE','SUPPLIER','ASSET','MATERIAL','SUPPLIER_MATERIAL','MACHINE_MATERIAL','STOCK_BALANCE','STOCK_MOVEMENT','MACHINE_MAINTENANCE','FINANCIAL_RECORD','DOCUMENT','DOCUMENT_LINK','USER_ACCOUNT','MAINTENANCE_PLAN'] LOOP
    EXECUTE format('CREATE TRIGGER zzz_wam_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION wam_audit_record()',t);
  END LOOP;
END; $$;
COMMENT ON TABLE "USER_ACCOUNT" IS 'External authentication identity linked one-to-one to an employee. No passwords. API enforces roles and active employee/account checks.';
COMMENT ON TABLE "AUDIT_LOG" IS 'Append-only activity history. Entity links are historical identifiers. API sets transaction-local actor/reason after authenticating; missing actor denotes a system/unattributed write, not proven trusted attribution.';
COMMENT ON TABLE "MAINTENANCE_PLAN" IS 'Manufacturer-approved instructions, evergreen tips, one-off reminders or recurring calendar-day service tasks. Operator permissions and equipment safety procedures are enforced by the application/workplace.';
COMMENT ON VIEW "OPERATOR_MAINTENANCE" IS 'Operator machine-page read model. Filter by assigned machine; sort OVERDUE, DUE_TODAY, UPCOMING, SCHEDULED, TIP. In-app reminders only; no notification delivery service.';

COMMIT;
