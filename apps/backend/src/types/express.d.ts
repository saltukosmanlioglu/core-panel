declare namespace Express {
  interface Request {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    userCompanyId?: string | null;
    userTenantId?: string | null;
    resolvedCompanyId?: string;
  }
}
