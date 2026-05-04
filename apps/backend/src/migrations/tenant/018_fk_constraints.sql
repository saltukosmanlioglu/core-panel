ALTER TABLE "{{schema}}".area_calculations
  ADD CONSTRAINT fk_area_calculations_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;

ALTER TABLE "{{schema}}".project_3d_models
  ADD CONSTRAINT fk_3d_models_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;

ALTER TABLE "{{schema}}".property_owners
  ADD CONSTRAINT fk_property_owners_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;

ALTER TABLE "{{schema}}".payment_plans
  ADD CONSTRAINT fk_payment_plans_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;

ALTER TABLE "{{schema}}".progress_payments
  ADD CONSTRAINT fk_progress_payments_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;

ALTER TABLE "{{schema}}".general_expenses
  ADD CONSTRAINT fk_general_expenses_project
  FOREIGN KEY (project_id) REFERENCES "{{schema}}".projects(id) ON DELETE CASCADE;
