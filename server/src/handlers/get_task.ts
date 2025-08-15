import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type GetTaskInput, type Task } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getTask = async (input: GetTaskInput, userId: number): Promise<Task> => {
  try {
    // Query database for task with given ID that belongs to the authenticated user
    const results = await db.select()
      .from(tasksTable)
      .where(and(
        eq(tasksTable.id, input.id),
        eq(tasksTable.user_id, userId)
      ))
      .execute();

    // Check if task was found
    if (results.length === 0) {
      throw new Error(`Task with ID ${input.id} not found or access denied`);
    }

    // Return the task (no numeric conversions needed for this schema)
    return results[0];
  } catch (error) {
    console.error('Get task failed:', error);
    throw error;
  }
};