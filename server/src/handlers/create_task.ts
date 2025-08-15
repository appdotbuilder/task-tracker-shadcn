import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type CreateTaskInput, type Task } from '../schema';

export async function createTask(input: CreateTaskInput, userId: number): Promise<Task> {
  try {
    // Insert task record
    const result = await db.insert(tasksTable)
      .values({
        user_id: userId,
        title: input.title,
        description: input.description,
        due_date: input.due_date,
        priority: input.priority,
        is_completed: false // Default value
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task creation failed:', error);
    throw error;
  }
}