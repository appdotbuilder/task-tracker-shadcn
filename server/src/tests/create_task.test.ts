import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tasksTable, usersTable } from '../db/schema';
import { type CreateTaskInput } from '../schema';
import { createTask } from '../handlers/create_task';
import { eq } from 'drizzle-orm';

// Test user to use for task creation
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  name: 'Test User'
};

// Test input with all fields
const testInput: CreateTaskInput = {
  title: 'Test Task',
  description: 'A task for testing',
  due_date: new Date('2024-12-31'),
  priority: 'High'
};

// Test input with null fields
const minimalInput: CreateTaskInput = {
  title: 'Minimal Task',
  description: null,
  due_date: null,
  priority: 'Low'
};

describe('createTask', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a task with all fields', async () => {
    const result = await createTask(testInput, userId);

    // Basic field validation
    expect(result.title).toEqual('Test Task');
    expect(result.description).toEqual('A task for testing');
    expect(result.due_date).toEqual(new Date('2024-12-31'));
    expect(result.priority).toEqual('High');
    expect(result.user_id).toEqual(userId);
    expect(result.is_completed).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a task with null description and due_date', async () => {
    const result = await createTask(minimalInput, userId);

    expect(result.title).toEqual('Minimal Task');
    expect(result.description).toBeNull();
    expect(result.due_date).toBeNull();
    expect(result.priority).toEqual('Low');
    expect(result.user_id).toEqual(userId);
    expect(result.is_completed).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save task to database', async () => {
    const result = await createTask(testInput, userId);

    // Query using proper drizzle syntax
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks).toHaveLength(1);
    const savedTask = tasks[0];
    
    expect(savedTask.title).toEqual('Test Task');
    expect(savedTask.description).toEqual('A task for testing');
    expect(savedTask.due_date).toEqual(new Date('2024-12-31'));
    expect(savedTask.priority).toEqual('High');
    expect(savedTask.user_id).toEqual(userId);
    expect(savedTask.is_completed).toEqual(false);
    expect(savedTask.created_at).toBeInstanceOf(Date);
    expect(savedTask.updated_at).toBeInstanceOf(Date);
  });

  it('should create multiple tasks for the same user', async () => {
    const task1 = await createTask(testInput, userId);
    const task2 = await createTask(minimalInput, userId);

    expect(task1.id).not.toEqual(task2.id);
    expect(task1.user_id).toEqual(userId);
    expect(task2.user_id).toEqual(userId);

    // Verify both tasks exist in database
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.user_id, userId))
      .execute();

    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.title)).toContain('Test Task');
    expect(tasks.map(t => t.title)).toContain('Minimal Task');
  });

  it('should set correct default values', async () => {
    const result = await createTask(testInput, userId);

    expect(result.is_completed).toEqual(false);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Timestamps should be recent (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    expect(result.created_at >= oneMinuteAgo).toBe(true);
    expect(result.created_at <= now).toBe(true);
    expect(result.updated_at >= oneMinuteAgo).toBe(true);
    expect(result.updated_at <= now).toBe(true);
  });

  it('should handle all priority levels', async () => {
    const priorities = ['Low', 'Medium', 'High'] as const;
    
    for (const priority of priorities) {
      const input: CreateTaskInput = {
        title: `Task with ${priority} priority`,
        description: null,
        due_date: null,
        priority
      };
      
      const result = await createTask(input, userId);
      expect(result.priority).toEqual(priority);
    }
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentUserId = 99999;
    
    await expect(createTask(testInput, nonExistentUserId))
      .rejects
      .toThrow(/violates foreign key constraint/i);
  });
});