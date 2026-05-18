-- Tenants (contractors)
CREATE TABLE IF NOT EXISTS "{{schema}}".tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  tax_id VARCHAR(50),
  bank_account VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS "{{schema}}".categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Suppliers
CREATE TABLE IF NOT EXISTS "{{schema}}".material_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant <-> Category join
CREATE TABLE IF NOT EXISTS "{{schema}}".tenant_categories (
  tenant_id UUID NOT NULL REFERENCES "{{schema}}".tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES "{{schema}}".categories(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, category_id)
);

-- Material Supplier <-> Category join
CREATE TABLE IF NOT EXISTS "{{schema}}".material_supplier_categories (
  supplier_id UUID NOT NULL REFERENCES "{{schema}}".material_suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES "{{schema}}".categories(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, category_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS "{{schema}}".projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  status_note TEXT,
  status_updated_by UUID,
  status_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status 
  ON "{{schema}}".projects(status);
