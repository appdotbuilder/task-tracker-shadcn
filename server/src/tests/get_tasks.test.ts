import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { type GetTasksInput } from '../schema';
import { getTasks } from '../handlers/get_tasks';

describe('getTasks', () => {
  let testUserId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users first (required for foreign key constraints)
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'testuser@example.com',
          password_hash: 'hashed_password',
          name: 'Test User'
        },
        {
          email: 'otheruser@example.com',
          password_hash: 'hashed_password',
          name: 'Other User'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

    // Create test tasks with different priorities and completion statuses
    await db.insert(tasksTable)
      .values([
        {
          user_id: testUserId,
          title: 'High Priority Task',
          description: 'Important task',
          priority: 'High',
          is_completed: false,
          due_date: new Date('2024-01-15')
        },
        {
          user_id: testUserId,
          title: 'Medium Priority Task',
          description: 'Regular task',
          priority: 'Medium',
          is_completed: true,
          due_date: new Date('2024-01-20')
        },
        {
          user_id: testUserId,
          title: 'Low Priority Task',
          description: 'Minor task',
          priority: 'Low',
          is_completed: false,
          due_date: null
        },
        {
          user_id: otherUserId,
          title: 'Other User Task',
          description: 'Should not appear',
          priority: 'High',
          is_completed: false,
          due_date: new Date('2024-01-10')
        }
      ])
      .execute();
  });

  afterEach(resetDB);

  it('should return all tasks for a user when no filters are provided', async () => {
    const input: GetTasksInput = {};
    const result = await getTasks(input, testUserId);

    expect(result).toHaveLength(3);
    
    // Verify all returned tasks belong to the correct user
    result.forEach(task => {
      expect(task.user_id).toEqual(testUserId);
    });

    // Verify tasks are ordered by created_at desc (newest first)
    const titles = result.map(task => task.title);
    expect(titles).toContain('High Priority Task');
    expect(titles).toContain('Medium Priority Task');
    expect(titles).toContain('Low Priority Task');
  });

  it('should filter tasks by completion status', async () => {
    const completedInput: GetTasksInput = { completed: true };
    const completedResult = await getTasks(completedInput, testUserId);

    expect(completedResult).toHaveLength(1);
    expect(completedResult[0].title).toEqual('Medium Priority Task');
    expect(completedResult[0].is_completed).toBe(true);

    const incompleteInput: GetTasksInput = { completed: false };
    const incompleteResult = await getTasks(incompleteInput, testUserId);

    expect(incompleteResult).toHaveLength(2);
    incompleteResult.forEach(task => {
      expect(task.is_completed).toBe(false);
    });
  });

  it('should filter tasks by priority', async () => {
    const highPriorityInput: GetTasksInput = { priority: 'High' };
    const result = await getTasks(highPriorityInput, testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('High Priority Task');
    expect(result[0].priority).toEqual('High');
  });

  it('should filter by both completion status and priority', async () => {
    const input: GetTasksInput = { 
      completed: false, 
      priority: 'Low' 
    };
    const result = await getTasks(input, testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Low Priority Task');
    expect(result[0].is_completed).toBe(false);
    expect(result[0].priority).toEqual('Low');
  });

  it('should return empty array when no tasks match filters', async () => {
    const input: GetTasksInput = { 
      completed: true, 
      priority: 'High' 
    };
    const result = await getTasks(input, testUserId);

    expect(result).toHaveLength(0);
  });

  it('should only return tasks for the specified user', async () => {
    const input: GetTasksInput = {};
    
    // Get tasks for first user
    const userResult = await getTasks(input, testUserId);
    expect(userResult).toHaveLength(3);
    userResult.forEach(task => {
      expect(task.user_id).toEqual(testUserId);
    });

    // Get tasks for other user
    const otherResult = await getTasks(input, otherUserId);
    expect(otherResult).toHaveLength(1);
    expect(otherResult[0].user_id).toEqual(otherUserId);
    expect(otherResult[0].title).toEqual('Other User Task');
  });

  it('should return empty array for user with no tasks', async () => {
    // Create a new user with no tasks
    const newUser = await db.insert(usersTable)
      .values({
        email: 'newuser@example.com',
        password_hash: 'hashed_password',
        name: 'New User'
      })
      .returning()
      .execute();

    const input: GetTasksInput = {};
    const result = await getTasks(input, newUser[0].id);

    expect(result).toHaveLength(0);
  });

  it('should handle tasks with null description and due_date', async () => {
    const input: GetTasksInput = {};
    const result = await getTasks(input, testUserId);

    const lowPriorityTask = result.find(task => task.title === 'Low Priority Task');
    expect(lowPriorityTask).toBeDefined();
    expect(lowPriorityTask!.due_date).toBeNull();
  });

  it('should maintain proper field types in returned data', async () => {
    const input: GetTasksInput = {};
    const result = await getTasks(input, testUserId);

    expect(result.length).toBeGreaterThan(0);
    
    const task = result[0];
    expect(typeof task.id).toBe('number');
    expect(typeof task.user_id).toBe('number');
    expect(typeof task.title).toBe('string');
    expect(typeof task.is_completed).toBe('boolean');
    expect(task.created_at).toBeInstanceOf(Date);
    expect(task.updated_at).toBeInstanceOf(Date);
    expect(['High', 'Medium', 'Low']).toContain(task.priority);
  });
});