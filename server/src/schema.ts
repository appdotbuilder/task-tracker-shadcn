import { z } from 'zod';

// Priority enum for tasks
export const priorityEnum = z.enum(['Low', 'Medium', 'High']);
export type Priority = z.infer<typeof priorityEnum>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  due_date: z.coerce.date().nullable(),
  priority: priorityEnum,
  is_completed: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Task = z.infer<typeof taskSchema>;

// Authentication schemas
export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema.omit({ password_hash: true }),
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Task input schemas
export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  due_date: z.coerce.date().nullable(),
  priority: priorityEnum
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  due_date: z.coerce.date().nullable().optional(),
  priority: priorityEnum.optional(),
  is_completed: z.boolean().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const deleteTaskInputSchema = z.object({
  id: z.number()
});

export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;

// Task query schemas
export const getTasksInputSchema = z.object({
  completed: z.boolean().optional(),
  priority: priorityEnum.optional()
});

export type GetTasksInput = z.infer<typeof getTasksInputSchema>;

export const getTaskInputSchema = z.object({
  id: z.number()
});

export type GetTaskInput = z.infer<typeof getTaskInputSchema>;