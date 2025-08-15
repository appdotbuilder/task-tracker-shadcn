import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type GetTasksInput, type Task } from '../schema';
import { eq, and, desc, SQL } from 'drizzle-orm';

export const getTasks = async (input: GetTasksInput, userId: number): Promise<Task[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [
      eq(tasksTable.user_id, userId) // Always filter by user
    ];

    // Apply optional filters
    if (input.completed !== undefined) {
      conditions.push(eq(tasksTable.is_completed, input.completed));
    }

    if (input.priority !== undefined) {
      conditions.push(eq(tasksTable.priority, input.priority));
    }

    // Build and execute query in one go
    const results = await db.select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(desc(tasksTable.created_at))
      .execute();

    // Return results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Get tasks failed:', error);
    throw error;
  }
};