-- Add organization_id to subscription table for org-level billing
ALTER TABLE subscription ADD COLUMN organization_id TEXT REFERENCES organization(id);
CREATE INDEX idx_subscription_organization_id ON subscription(organization_id);

-- Backfill existing records: set organization_id from the owner's membership
UPDATE subscription
SET organization_id = (
  SELECT m.organization_id FROM member m
  WHERE m.user_id = subscription.user_id
  AND m.role = 'owner'
  LIMIT 1
)
WHERE organization_id IS NULL;
