CREATE TABLE wam_internal.document_content (
  document_id uuid PRIMARY KEY REFERENCES public."DOCUMENT"(id) ON DELETE RESTRICT,
  content bytea NOT NULL CHECK (octet_length(content) <= 3145728)
);
