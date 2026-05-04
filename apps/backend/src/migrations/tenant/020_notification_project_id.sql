ALTER TABLE "{{schema}}".payment_notifications
ADD COLUMN IF NOT EXISTS related_project_id UUID;
