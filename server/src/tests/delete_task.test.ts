import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { type DeleteTaskInput } from '../schema';
import { deleteTask } from '../handlers/delete_task';
import { eq, and } from 'drizzle-orm';

describe('deleteTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a task successfully', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test task
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: userId,
        title: 'Test Task',
        description: 'A task to be deleted',
        priority: 'Medium',
        is_completed: false
      })
      .returning()
      .execute();

    const taskId = taskResult[0].id;

    const input: DeleteTaskInput = {
      id: taskId
    };

    // Delete the task
    const result = await deleteTask(input, userId);

    // Verify the response
    expect(result.success).toBe(true);

    // Verify task was actually deleted from database
    const remainingTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(remainingTasks).toHaveLength(0);
  });

  it('should throw error when task does not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const input: DeleteTaskInput = {
      id: 999 // Non-existent task ID
    };

    // Attempt to delete non-existent task
    await expect(deleteTask(input, userId)).rejects.toThrow(/task not found/i);
  });

  it('should throw error when task belongs to different user', async () => {
    // Create first user
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        name: 'User One'
      })
      .returning()
      .execute();

    // Create second user
    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        name: 'User Two'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create task for user1
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: user1Id,
        title: 'User 1 Task',
        description: 'This belongs to user 1',
        priority: 'High',
        is_completed: false
      })
      .returning()
      .execute();

    const taskId = taskResult[0].id;

    const input: DeleteTaskInput = {
      id: taskId
    };

    // Attempt to delete task as user2 (should fail)
    await expect(deleteTask(input, user2Id)).rejects.toThrow(/task not found.*does not belong/i);

    // Verify task still exists in database
    const remainingTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(remainingTasks).toHaveLength(1);
    expect(remainingTasks[0].user_id).toBe(user1Id);
  });

  it('should handle multiple tasks correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple test tasks
    const task1Result = await db.insert(tasksTable)
      .values({
        user_id: userId,
        title: 'Task 1',
        description: 'First task',
        priority: 'Low',
        is_completed: false
      })
      .returning()
      .execute();

    const task2Result = await db.insert(tasksTable)
      .values({
        user_id: userId,
        title: 'Task 2',
        description: 'Second task',
        priority: 'Medium',
        is_completed: true
      })
      .returning()
      .execute();

    const task1Id = task1Result[0].id;
    const task2Id = task2Result[0].id;

    // Delete first task
    const input1: DeleteTaskInput = { id: task1Id };
    const result1 = await deleteTask(input1, userId);
    expect(result1.success).toBe(true);

    // Verify only first task was deleted
    const remainingTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.user_id, userId))
      .execute();

    expect(remainingTasks).toHaveLength(1);
    expect(remainingTasks[0].id).toBe(task2Id);
    expect(remainingTasks[0].title).toBe('Task 2');

    // Delete second task
    const input2: DeleteTaskInput = { id: task2Id };
    const result2 = await deleteTask(input2, userId);
    expect(result2.success).toBe(true);

    // Verify all tasks are deleted
    const finalTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.user_id, userId))
      .execute();

    expect(finalTasks).toHaveLength(0);
  });

  it('should delete completed task successfully', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create completed task
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: userId,
        title: 'Completed Task',
        description: 'This task is already done',
        priority: 'High',
        is_completed: true
      })
      .returning()
      .execute();

    const taskId = taskResult[0].id;

    const input: DeleteTaskInput = {
      id: taskId
    };

    // Delete the completed task
    const result = await deleteTask(input, userId);

    expect(result.success).toBe(true);

    // Verify task was deleted
    const remainingTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(remainingTasks).toHaveLength(0);
  });
});