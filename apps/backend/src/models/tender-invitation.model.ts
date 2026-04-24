import { z } from 'zod';

export const updateInvitationsSchema = z.object({
  tenantIds: z.array(z.string().uuid()),
});

export type UpdateInvitationsRequest = z.infer<typeof updateInvitationsSchema>;
