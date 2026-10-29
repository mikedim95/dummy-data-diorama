SELECT set_config('wam.change_reason','Unify account email and password sign-in',true);

ALTER TABLE "USER_ACCOUNT" ADD COLUMN login_email varchar(255);
UPDATE "USER_ACCOUNT" u SET login_email=lower(
  CASE WHEN e.email IS NOT NULL AND (SELECT count(*) FROM "EMPLOYEE" other WHERE lower(other.email)=lower(e.email))=1 THEN trim(e.email)
       WHEN e.employee_code='WAM-MANAGER-01' THEN 'admin@wam.example'
       WHEN e.employee_code='OP-104' THEN 'nikos@wam.example'
       WHEN e.employee_code='OP-117' THEN 'eleni@wam.example'
       ELSE lower(e.employee_code)||'@wam.example' END),
  auth_provider=CASE u.auth_provider WHEN 'local-demo' THEN 'password-local' ELSE 'password-preview' END
FROM "EMPLOYEE" e WHERE e.id=u.employee_id AND u.auth_provider IN ('local-demo','seed-preview');
CREATE UNIQUE INDEX uq_account_login_email ON "USER_ACCOUNT"(lower(login_email)) WHERE login_email IS NOT NULL;
ALTER TABLE "USER_ACCOUNT" ADD CONSTRAINT account_login_email_valid CHECK(login_email IS NULL OR (login_email=lower(trim(login_email)) AND login_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
ALTER TABLE "USER_ACCOUNT" ADD CONSTRAINT password_account_email_required CHECK(auth_provider NOT IN ('password-local','password-preview') OR login_email IS NOT NULL);

CREATE TABLE wam_internal.password_credentials (
  account_id uuid PRIMARY KEY REFERENCES "USER_ACCOUNT"(id) ON DELETE CASCADE,
  password_hash text NOT NULL CHECK(password_hash ~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
