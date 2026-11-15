import { z } from 'zod';

export const AddTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  due: z.string().nullable().optional(),
  priority: z.enum(['high', 'med', 'low']).default('med'),
  project: z.string().optional(),
  repeat: z.enum(['none', 'daily', 'weekly']).default('none'),
  estimateMinutes: z.number().int().positive().optional(),
});

export const UpdateTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  title: z.string().optional(),
  due: z.string().nullable().optional(),
  priority: z.enum(['high', 'med', 'low']).optional(),
  project: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  completed: z.boolean().optional(),
});

export const CompleteTaskSchema = z.object({
  idOrTitle: z.string().min(1, 'Task ID or Title is required'),
});

export const DeleteTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  confirmed: z.boolean().optional(),
});

export const ListTasksSchema = z.object({
  filter: z.enum(['open', 'today', 'overdue', 'done', 'all']).default('open'),
});

export const SetReminderSchema = z.object({
  text: z.string().min(1, 'Reminder text is required'),
  at: z.string().optional(),
  in_minutes: z.number().positive().optional(),
  repeat: z.enum(['none', 'daily', 'weekly']).default('none'),
  taskId: z.string().optional(),
});

export const CancelReminderSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required'),
});

export const SnoozeReminderSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required'),
  minutes: z.number().positive().default(15),
});

export const StartTimerSchema = z.object({
  minutes: z.number().positive('Timer duration must be positive'),
  label: z.string().default('Focus Session'),
});

export const TrackHabitSchema = z.object({
  habitId: z.string().min(1, 'Habit ID is required'),
  completed: z.boolean().optional(),
  date: z.string().optional(),
});

export const AddExpenseSchema = z.object({
  title: z.string().min(1, 'Expense description is required'),
  amount: z.number().positive('Expense amount must be positive'),
  category: z
    .enum(['hardware', 'food', 'transport', 'hosting', 'tools', 'education', 'general'])
    .default('general'),
  notes: z.string().optional(),
});

export const LogDecisionSchema = z.object({
  title: z.string().min(1, 'Decision title is required'),
  rationale: z.string().min(1, 'Rationale is required'),
  alternatives: z.string().optional(),
});

export const AddFollowUpSchema = z.object({
  who: z.string().min(1, 'Contact name or organization is required'),
  about: z.string().min(1, 'Follow-up topic is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  draft: z.string().optional(),
});

export const SaveNoteSchema = z.object({
  title: z.string().min(1, 'Note title is required'),
  content: z.string().min(1, 'Note content is required'),
  tag: z.string().default('GENERAL'),
});

export const SearchNotesSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  tag: z.string().optional(),
});

export const RememberSchema = z.object({
  fact: z.string().min(1, 'Fact is required'),
  category: z.enum(['preference', 'project', 'team', 'security', 'personal']).default('personal'),
});

export const ForgetSchema = z.object({
  query: z.string().min(1, 'Query or key to forget is required'),
});

export const SetModeSchema = z.object({
  mode: z.enum(['COMMAND', 'CYBER', 'BUILD', 'STRATEGY', 'FOCUS']),
});

export const CreateCalendarEventSchema = z.object({
  summary: z.string().min(1, 'Event summary is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

export const DeleteCalendarEventSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export const DraftDocumentSchema = z.object({
  type: z.enum(['email', 'linkedin', 'certificate', 'script', 'letter']),
  topic: z.string().min(1, 'Document topic is required'),
  recipient: z.string().optional(),
  tone: z.string().optional(),
});

export const AnalyzeCyberSecuritySchema = z.object({
  codeOrConfig: z.string().min(1, 'Code, configuration, or email text is required'),
  scanType: z.enum(['owasp', 'password', 'phishing']).default('owasp'),
});

export const ToolSchemas: Record<string, z.ZodType<any>> = {
  add_task: AddTaskSchema,
  update_task: UpdateTaskSchema,
  complete_task: CompleteTaskSchema,
  delete_task: DeleteTaskSchema,
  list_tasks: ListTasksSchema,
  set_reminder: SetReminderSchema,
  cancel_reminder: CancelReminderSchema,
  snooze_reminder: SnoozeReminderSchema,
  start_timer: StartTimerSchema,
  track_habit: TrackHabitSchema,
  add_expense: AddExpenseSchema,
  log_decision: LogDecisionSchema,
  add_followup: AddFollowUpSchema,
  save_note: SaveNoteSchema,
  search_notes: SearchNotesSchema,
  remember: RememberSchema,
  forget: ForgetSchema,
  set_mode: SetModeSchema,
  create_calendar_event: CreateCalendarEventSchema,
  delete_calendar_event: DeleteCalendarEventSchema,
  draft_document: DraftDocumentSchema,
  analyze_cyber_security: AnalyzeCyberSecuritySchema,
};

export function validateToolArgs(toolName: string, rawArgs: any): { ok: true; data: any } | { ok: false; error: string } {
  const schema = ToolSchemas[toolName];
  if (!schema) {
    // If no schema defined, pass args through
    return { ok: true, data: rawArgs || {} };
  }
  const result = schema.safeParse(rawArgs || {});
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join('.') || 'param'}: ${i.message}`).join('; ');
    return { ok: false, error: `Invalid arguments for ${toolName}: ${errorMsg}` };
  }
  return { ok: true, data: result.data };
}
