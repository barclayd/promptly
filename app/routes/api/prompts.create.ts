import { data } from 'react-router';
import { z } from 'zod';

const createPromptSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  project: z.string().optional(),
});

export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData();

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    project: formData.get('project') || undefined,
  };

  const result = createPromptSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // TODO: Add DB persistence here
  // const prompt = await db.insert(prompts).values(result.data);
  // return redirect(`/prompts/${prompt.id}`);

  return data({ success: true });
};
