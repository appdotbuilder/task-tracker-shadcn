import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type DeleteTaskInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function deleteTask(input: DeleteTaskInput, userId: number): Promise<{ success: boolean }> {
  try {
    // First verify the task exists and belongs to the authenticated user
    const existingTask = await db.select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.id, input.id),
          eq(tasksTable.user_id, userId)
        )
      )
      .execute();

    if (existingTask.length === 0) {
      throw new Error('Task not found or does not belong to the authenticated user');
    }

    // Delete the task from database
    const result = await db.delete(tasksTable)
      .where(
        and(
          eq(tasksTable.id, input.id),
          eq(tasksTable.user_id, userId)
        )
      )
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Task deletion failed:', error);
    throw error;
  }
}