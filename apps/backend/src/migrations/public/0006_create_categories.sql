CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE tenant_categories (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, category_id)
);

CREATE TABLE material_supplier_categories (
  supplier_id UUID NOT NULL REFERENCES material_suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, category_id)
);

CREATE INDEX idx_categories_company_id ON categories(company_id);
CREATE INDEX idx_tenant_categories_tenant_id ON tenant_categories(tenant_id);
CREATE INDEX idx_tenant_categories_category_id ON tenant_categories(category_id);
CREATE INDEX idx_material_supplier_categories_supplier_id ON material_supplier_categories(supplier_id);
CREATE INDEX idx_material_supplier_categories_category_id ON material_supplier_categories(category_id);
