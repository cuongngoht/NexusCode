import { z } from 'zod';

export const ProjectMapAiSummarySchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.object({
    title: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high']),
    evidence: z.array(z.string()),
    recommendation: z.string().min(1),
  })),
  missingPieces: z.array(z.object({
    title: z.string().min(1),
    evidence: z.array(z.string()),
    status: z.enum(['unknown', 'likely', 'confirmed']),
  })),
  nextSteps: z.array(z.object({
    title: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']),
    reason: z.string().min(1),
  })),
});

export type ProjectMapAiSummary = z.infer<typeof ProjectMapAiSummarySchema>;

export class ProjectMapSummaryValidator {
  validate(input: unknown): ProjectMapAiSummary {
    return ProjectMapAiSummarySchema.parse(input);
  }
}
