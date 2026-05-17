-- Persist Business Profile physical address edits from the offline app.
-- `address` exists in the initial schema; this keeps the cloud schema aligned
-- with the local `physical_address` alias used by the Settings profile form.

ALTER TABLE IF EXISTS businesses
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS physical_address TEXT;

UPDATE businesses
SET physical_address = COALESCE(physical_address, address)
WHERE physical_address IS NULL
  AND address IS NOT NULL;
