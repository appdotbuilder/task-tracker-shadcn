import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { type UpdateTaskInput } from '../schema';
import { updateTask } from '../handlers/update_task';
import { eq, and } from 'drizzle-orm';

describe('updateTask', () => {
  let testUserId: number;
  let otherUserId: number;
  let testTaskId: number;
  let otherUserTaskId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashed_password',
          name: 'Test User'
        },
        {
          email: 'other@example.com',
          password_hash: 'hashed_password',
          name: 'Other User'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

    // Create test tasks
    const tasks = await db.insert(tasksTable)
      .values([
        {
          user_id: testUserId,
          title: 'Original Task',
          description: 'Original description',
          priority: 'Medium',
          is_completed: false
        },
        {
          user_id: otherUserId,
          title: 'Other User Task',
          description: 'Other user description',
          priority: 'High',
          is_completed: false
        }
      ])
      .returning()
      .execute();

    testTaskId = tasks[0].id;
    otherUserTaskId = tasks[1].id;
  });

  afterEach(resetDB);

  it('should update task title', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Updated Task Title'
    };

    const result = await updateTask(input, testUserId);

    expect(result.id).toEqual(testTaskId);
    expect(result.title).toEqual('Updated Task Title');
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.priority).toEqual('Medium'); // Unchanged
    expect(result.is_completed).toEqual(false); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update task description to null', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      description: null
    };

    const result = await updateTask(input, testUserId);

    expect(result.id).toEqual(testTaskId);
    expect(result.title).toEqual('Original Task'); // Unchanged
    expect(result.description).toBeNull();
    expect(result.priority).toEqual('Medium'); // Unchanged
    expect(result.is_completed).toEqual(false); // Unchanged
  });

  it('should update task priority', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      priority: 'High'
    };

    const result = await updateTask(input, testUserId);

    expect(result.priority).toEqual('High');
    expect(result.title).toEqual('Original Task'); // Unchanged
  });

  it('should update task completion status', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      is_completed: true
    };

    const result = await updateTask(input, testUserId);

    expect(result.is_completed).toEqual(true);
    expect(result.title).toEqual('Original Task'); // Unchanged
  });

  it('should update due date', async () => {
    const dueDate = new Date('2024-12-31');
    const input: UpdateTaskInput = {
      id: testTaskId,
      due_date: dueDate
    };

    const result = await updateTask(input, testUserId);

    expect(result.due_date).toEqual(dueDate);
    expect(result.title).toEqual('Original Task'); // Unchanged
  });

  it('should update multiple fields at once', async () => {
    const dueDate = new Date('2024-12-31');
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Multi Update Task',
      description: 'Updated description',
      priority: 'High',
      is_completed: true,
      due_date: dueDate
    };

    const result = await updateTask(input, testUserId);

    expect(result.id).toEqual(testTaskId);
    expect(result.title).toEqual('Multi Update Task');
    expect(result.description).toEqual('Updated description');
    expect(result.priority).toEqual('High');
    expect(result.is_completed).toEqual(true);
    expect(result.due_date).toEqual(dueDate);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update task in database', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Database Update Test',
      priority: 'Low'
    };

    await updateTask(input, testUserId);

    // Verify task was updated in database
    const updatedTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, testTaskId))
      .limit(1)
      .execute();

    expect(updatedTask).toHaveLength(1);
    expect(updatedTask[0].title).toEqual('Database Update Test');
    expect(updatedTask[0].priority).toEqual('Low');
    expect(updatedTask[0].updated_at).toBeInstanceOf(Date);
  });

  it('should always update the updated_at timestamp', async () => {
    // Get original timestamp
    const originalTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, testTaskId))
      .limit(1)
      .execute();

    const originalTimestamp = originalTask[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateTaskInput = {
      id: testTaskId,
      title: 'Timestamp Test'
    };

    const result = await updateTask(input, testUserId);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should throw error when task does not exist', async () => {
    const input: UpdateTaskInput = {
      id: 99999, // Non-existent task ID
      title: 'Non-existent Task'
    };

    expect(updateTask(input, testUserId)).rejects.toThrow(/task not found or access denied/i);
  });

  it('should throw error when task belongs to different user', async () => {
    const input: UpdateTaskInput = {
      id: otherUserTaskId, // Task belongs to otherUserId
      title: 'Unauthorized Update'
    };

    expect(updateTask(input, testUserId)).rejects.toThrow(/task not found or access denied/i);
  });

  it('should not update task when user does not own it', async () => {
    const input: UpdateTaskInput = {
      id: otherUserTaskId,
      title: 'Should Not Update'
    };

    try {
      await updateTask(input, testUserId);
      expect(true).toBe(false); // Should not reach this line
    } catch (error) {
      // Verify original task remains unchanged
      const unchangedTask = await db.select()
        .from(tasksTable)
        .where(eq(tasksTable.id, otherUserTaskId))
        .limit(1)
        .execute();

      expect(unchangedTask).toHaveLength(1);
      expect(unchangedTask[0].title).toEqual('Other User Task'); // Original title
      expect(unchangedTask[0].user_id).toEqual(otherUserId);
    }
  });

  it('should handle minimal update with only id', async () => {
    const input: UpdateTaskInput = {
      id: testTaskId
      // No other fields - should only update timestamp
    };

    const result = await updateTask(input, testUserId);

    expect(result.id).toEqual(testTaskId);
    expect(result.title).toEqual('Original Task'); // Unchanged
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.priority).toEqual('Medium'); // Unchanged
    expect(result.is_completed).toEqual(false); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});