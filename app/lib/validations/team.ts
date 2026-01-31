import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['member', 'admin', 'owner'], {
    error: 'Please select a valid role',
  }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const cancelInvitationSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
});

export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>;

export const roleLabels: Record<string, string> = {
  member: 'Member',
  admin: 'Admin',
  owner: 'Owner',
};

export const roleDescriptions: Record<string, string> = {
  member: 'Can view and edit prompts',
  admin: 'Can manage prompts and invite members',
  owner: 'Full access including billing and settings',
};
