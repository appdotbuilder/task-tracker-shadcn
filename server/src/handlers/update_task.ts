import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type UpdateTaskInput, type Task } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updateTask(input: UpdateTaskInput, userId: number): Promise<Task> {
  try {
    // First verify task exists and belongs to the authenticated user
    const existingTask = await db.select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.id, input.id),
          eq(tasksTable.user_id, userId)
        )
      )
      .limit(1)
      .execute();

    if (existingTask.length === 0) {
      throw new Error('Task not found or access denied');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date() // Always update timestamp
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.due_date !== undefined) {
      updateData.due_date = input.due_date;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }
    if (input.is_completed !== undefined) {
      updateData.is_completed = input.is_completed;
    }

    // Update the task
    const result = await db.update(tasksTable)
      .set(updateData)
      .where(
        and(
          eq(tasksTable.id, input.id),
          eq(tasksTable.user_id, userId)
        )
      )
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update task');
    }

    return result[0];
  } catch (error) {
    console.error('Task update failed:', error);
    throw error;
  }
}