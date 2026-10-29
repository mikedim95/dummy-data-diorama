SELECT set_config('wam.change_reason','Normalize legacy operator state and add application workflows',true);

CREATE FUNCTION wam_legacy_json(value text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN value::jsonb; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
$$;
CREATE FUNCTION wam_legacy_timestamp(value text) RETURNS timestamptz LANGUAGE plpgsql AS $$
BEGIN RETURN value::timestamptz; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
$$;

ALTER TABLE "CUSTOMER" ADD COLUMN city varchar(100);
UPDATE "CUSTOMER" SET city=notes WHERE notes IN ('Athens','Thessaloniki','Chania','Nafplio','Piraeus','Paros','Epanomi');
ALTER TABLE "MACHINE" ADD COLUMN model varchar(160);
UPDATE "MACHINE" SET model=type;
ALTER TABLE "JOB" ADD COLUMN priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN estimated_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN instructions text NOT NULL DEFAULT '', ADD COLUMN blocked_reason text,
  ADD CONSTRAINT job_priority_valid CHECK(priority IN ('URGENT','HIGH','NORMAL','LOW')),
  ADD CONSTRAINT job_estimate_valid CHECK(estimated_minutes>=0);

-- Completed jobs stay immutable to the app; this transaction only copies their legacy fields.
ALTER TABLE "JOB" DISABLE TRIGGER job_guard;
UPDATE "JOB" SET
  instructions=coalesce(wam_legacy_json(notes)->>'instructions',CASE WHEN wam_legacy_json(notes) IS NULL THEN notes END,''),
  priority=CASE WHEN upper(wam_legacy_json(notes)->>'priority') IN ('URGENT','HIGH','NORMAL','LOW') THEN upper(wam_legacy_json(notes)->>'priority') ELSE 'NORMAL' END,
  estimated_minutes=CASE WHEN wam_legacy_json(notes)->>'estMin' ~ '^\d{1,6}$' THEN (wam_legacy_json(notes)->>'estMin')::int ELSE 0 END,
  blocked_reason=wam_legacy_json(notes)->>'blockedReason';
ALTER TABLE "JOB" ENABLE TRIGGER job_guard;

ALTER TABLE "MAINTENANCE_PLAN" ADD COLUMN operator_check_phase varchar(5) NOT NULL DEFAULT 'START',
  ADD COLUMN priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  ADD CONSTRAINT maintenance_check_phase_valid CHECK(operator_check_phase IN ('START','END')),
  ADD CONSTRAINT maintenance_priority_valid CHECK(priority IN ('SAFETY','HIGH','NORMAL'));
UPDATE "MAINTENANCE_PLAN" SET
  operator_check_phase=CASE WHEN wam_legacy_json(instructions)->>'phase'='end' THEN 'END' ELSE 'START' END,
  priority=CASE WHEN upper(wam_legacy_json(instructions)->>'priority') IN ('SAFETY','HIGH') THEN upper(wam_legacy_json(instructions)->>'priority') ELSE 'NORMAL' END,
  instructions=coalesce(wam_legacy_json(instructions)->>'instructions',instructions);

CREATE TABLE "OPERATOR_SHIFT" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES "EMPLOYEE"(id) ON DELETE RESTRICT,
  attendance_id uuid NOT NULL REFERENCES "ATTENDANCE"(id) ON DELETE RESTRICT,
  machine_id uuid REFERENCES "MACHINE"(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  status varchar(10) NOT NULL DEFAULT 'OPEN', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  record_version integer NOT NULL DEFAULT 1 CHECK(record_version>0),
  CONSTRAINT shift_dates_valid CHECK(ended_at IS NULL OR ended_at>=started_at),
  CONSTRAINT shift_status_valid CHECK((status='OPEN' AND ended_at IS NULL) OR (status='CLOSED' AND ended_at IS NOT NULL) OR status='LEGACY')
);
CREATE INDEX idx_shift_employee_started ON "OPERATOR_SHIFT"(employee_id,started_at);
CREATE INDEX idx_shift_machine ON "OPERATOR_SHIFT"(machine_id);
CREATE INDEX idx_shift_attendance ON "OPERATOR_SHIFT"(attendance_id);

INSERT INTO "OPERATOR_SHIFT"(id,employee_id,attendance_id,machine_id,started_at,ended_at,status,notes)
SELECT md5('shift:'||a.id::text)::uuid,a.employee_id,a.id,m.id,a.check_in_at,a.check_out_at,
  CASE WHEN a.check_out_at IS NOT NULL THEN 'CLOSED'
       WHEN row_number() OVER(PARTITION BY a.employee_id ORDER BY a.check_in_at DESC)=1 THEN 'OPEN' ELSE 'LEGACY' END,
  wam_legacy_json(a.notes)->>'handover'
FROM "ATTENDANCE" a LEFT JOIN "MACHINE" m ON m.equipment_code=wam_legacy_json(a.notes)->>'machineCode'
WHERE a.check_in_at IS NOT NULL;
CREATE UNIQUE INDEX uq_employee_open_shift ON "OPERATOR_SHIFT"(employee_id) WHERE status='OPEN';

CREATE TABLE "SHIFT_CHECK" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES "OPERATOR_SHIFT"(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES "MAINTENANCE_PLAN"(id) ON DELETE RESTRICT,
  phase varchar(5) NOT NULL CHECK(phase IN ('START','END')),
  state varchar(10) NOT NULL CHECK(state IN ('DONE','SKIPPED')),
  maintenance_id uuid REFERENCES "MACHINE_MAINTENANCE"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  record_version integer NOT NULL DEFAULT 1 CHECK(record_version>0),
  CONSTRAINT uq_shift_check_plan UNIQUE(shift_id,plan_id,phase)
);
CREATE INDEX idx_shift_check_plan ON "SHIFT_CHECK"(plan_id);
CREATE INDEX idx_shift_check_maintenance ON "SHIFT_CHECK"(maintenance_id);
INSERT INTO "SHIFT_CHECK"(shift_id,plan_id,phase,state)
SELECT s.id,p.id,phase.name,upper(entry.value)
FROM "OPERATOR_SHIFT" s JOIN "ATTENDANCE" a ON a.id=s.attendance_id
CROSS JOIN (VALUES('START','startChecks'),('END','endChecks')) AS phase(name,key)
CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(wam_legacy_json(a.notes)->phase.key)='object' THEN wam_legacy_json(a.notes)->phase.key ELSE '{}'::jsonb END) entry
JOIN "MAINTENANCE_PLAN" p ON p.id::text=entry.key AND p.machine_id=s.machine_id
WHERE entry.value IN ('done','skipped');

CREATE TABLE "JOB_ACTIVITY" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES "JOB"(id) ON DELETE RESTRICT,
  actor_employee_id uuid REFERENCES "EMPLOYEE"(id) ON DELETE RESTRICT,
  author_name varchar(150), kind varchar(10) NOT NULL CHECK(kind IN ('COMMENT','PHOTO','STATUS')),
  notes text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_activity_timeline ON "JOB_ACTIVITY"(job_id,occurred_at);
CREATE INDEX idx_job_activity_actor ON "JOB_ACTIVITY"(actor_employee_id);
INSERT INTO "JOB_ACTIVITY"(id,job_id,actor_employee_id,author_name,kind,notes,occurred_at)
SELECT md5(j.id::text||':'||entry.ordinality::text)::uuid,j.id,e.id,left(entry.value->>'by',150),
  CASE WHEN upper(entry.value->>'type') IN ('COMMENT','PHOTO','STATUS') THEN upper(entry.value->>'type') ELSE 'COMMENT' END,
  entry.value->>'text',coalesce(wam_legacy_timestamp(entry.value->>'at'),j.created_at)
FROM "JOB" j CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(wam_legacy_json(j.notes)->'activity')='array' THEN wam_legacy_json(j.notes)->'activity' ELSE '[]'::jsonb END) WITH ORDINALITY entry(value,ordinality)
LEFT JOIN LATERAL (SELECT id FROM "EMPLOYEE" WHERE full_name=entry.value->>'by' ORDER BY id LIMIT 1) e ON true;

ALTER TABLE "DOCUMENT_LINK" ADD COLUMN job_activity_id uuid REFERENCES "JOB_ACTIVITY"(id) ON DELETE RESTRICT;
ALTER TABLE "DOCUMENT_LINK" DROP CONSTRAINT document_link_exactly_one_target;
ALTER TABLE "DOCUMENT_LINK" ADD CONSTRAINT document_link_exactly_one_target CHECK(num_nonnulls(machine_id,asset_id,material_id,supplier_id,customer_order_id,job_id,template_id,financial_record_id,maintenance_id,maintenance_plan_id,job_activity_id)=1);
CREATE UNIQUE INDEX uq_document_link_activity ON "DOCUMENT_LINK"(document_id,job_activity_id);
CREATE INDEX idx_document_link_activity ON "DOCUMENT_LINK"(job_activity_id);
INSERT INTO "DOCUMENT_LINK"(document_id,job_activity_id)
SELECT DISTINCT d.id,md5(j.id::text||':'||entry.ordinality::text)::uuid
FROM "JOB" j CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(wam_legacy_json(j.notes)->'activity')='array' THEN wam_legacy_json(j.notes)->'activity' ELSE '[]'::jsonb END) WITH ORDINALITY entry(value,ordinality)
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(entry.value->'photos')='array' THEN entry.value->'photos' ELSE '[]'::jsonb END) photo(value)
JOIN "DOCUMENT" d ON photo.value='/api/wam/files/'||d.id::text
ON CONFLICT(document_id,job_activity_id) DO NOTHING;

CREATE FUNCTION wam_shift_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve shift history'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status<>'OPEN' OR ROW(OLD.employee_id,OLD.attendance_id,OLD.started_at) IS DISTINCT FROM ROW(NEW.employee_id,NEW.attendance_id,NEW.started_at)) THEN RAISE EXCEPTION 'Closed shift history and shift identity are immutable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "ATTENDANCE" a WHERE a.id=NEW.attendance_id AND a.employee_id=NEW.employee_id AND a.status='PRESENT') THEN RAISE EXCEPTION 'A shift requires its employee presence record'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER shift_guard BEFORE INSERT OR UPDATE OR DELETE ON "OPERATOR_SHIFT" FOR EACH ROW EXECUTE FUNCTION wam_shift_guard();
CREATE FUNCTION wam_shift_check_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "OPERATOR_SHIFT"%ROWTYPE; p "MAINTENANCE_PLAN"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN SELECT * INTO s FROM "OPERATOR_SHIFT" WHERE id=OLD.shift_id FOR UPDATE;
  ELSE
    SELECT * INTO s FROM "OPERATOR_SHIFT" WHERE id=NEW.shift_id FOR UPDATE;
    SELECT * INTO p FROM "MAINTENANCE_PLAN" WHERE id=NEW.plan_id;
    IF p.machine_id IS DISTINCT FROM s.machine_id OR NEW.phase<>p.operator_check_phase OR NOT p.operator_can_complete OR NOT p.is_active THEN RAISE EXCEPTION 'The check must match an active operator plan on the selected machine'; END IF;
    IF TG_OP='UPDATE' AND ROW(NEW.shift_id,NEW.plan_id,NEW.phase) IS DISTINCT FROM ROW(OLD.shift_id,OLD.plan_id,OLD.phase) THEN RAISE EXCEPTION 'A check identity cannot be reassigned'; END IF;
  END IF;
  IF s.status IS DISTINCT FROM 'OPEN' THEN RAISE EXCEPTION 'Checks on a closed shift are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
CREATE TRIGGER shift_check_guard BEFORE INSERT OR UPDATE OR DELETE ON "SHIFT_CHECK" FOR EACH ROW EXECUTE FUNCTION wam_shift_check_guard();
CREATE FUNCTION wam_activity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Job activity is append-only'; END; $$;
CREATE TRIGGER activity_immutable BEFORE UPDATE OR DELETE ON "JOB_ACTIVITY" FOR EACH ROW EXECUTE FUNCTION wam_activity_immutable();
CREATE TRIGGER activity_no_truncate BEFORE TRUNCATE ON "JOB_ACTIVITY" FOR EACH STATEMENT EXECUTE FUNCTION wam_activity_immutable();
CREATE TRIGGER shift_metadata BEFORE INSERT OR UPDATE ON "OPERATOR_SHIFT" FOR EACH ROW EXECUTE FUNCTION wam_record_metadata();
CREATE TRIGGER check_metadata BEFORE INSERT OR UPDATE ON "SHIFT_CHECK" FOR EACH ROW EXECUTE FUNCTION wam_record_metadata();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['OPERATOR_SHIFT','SHIFT_CHECK','JOB_ACTIVITY'] LOOP
    EXECUTE format('CREATE TRIGGER zzz_wam_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION wam_audit_record()',t);
  END LOOP;
END; $$;

CREATE OR REPLACE VIEW "OPERATOR_MAINTENANCE" AS
SELECT p.id AS plan_id,p.machine_id,m.name AS machine_name,m.equipment_code,p.title,p.maintenance_type,
 p.instructions,p.next_due_date,p.last_completed_at,p.assigned_employee_id,p.operator_can_complete,p.requires_machine_stop,
 CASE WHEN p.next_due_date IS NULL THEN 'TIP'
      WHEN p.next_due_date<(now() AT TIME ZONE 'Europe/Athens')::date THEN 'OVERDUE'
      WHEN p.next_due_date=(now() AT TIME ZONE 'Europe/Athens')::date THEN 'DUE_TODAY'
      WHEN p.next_due_date<=(now() AT TIME ZONE 'Europe/Athens')::date+p.remind_before_days THEN 'UPCOMING'
      ELSE 'SCHEDULED' END AS reminder_status,p.operator_check_phase,p.priority
FROM "MAINTENANCE_PLAN" p JOIN "MACHINE" m ON m.id=p.machine_id
WHERE p.is_active AND p.display_to_operator AND m.is_active;

ALTER TABLE wam_internal.document_content DROP CONSTRAINT document_content_content_check;
ALTER TABLE wam_internal.document_content ADD CONSTRAINT document_content_content_check CHECK(octet_length(content)<=10485760);
DROP FUNCTION wam_legacy_json(text);
DROP FUNCTION wam_legacy_timestamp(text);
