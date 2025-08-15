import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { type GetTaskInput } from '../schema';
import { getTask } from '../handlers/get_task';

describe('getTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get a task by ID for authenticated user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create test task
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: user.id,
        title: 'Test Task',
        description: 'A task for testing',
        due_date: new Date('2024-12-31'),
        priority: 'High',
        is_completed: false
      })
      .returning()
      .execute();

    const createdTask = taskResult[0];

    const input: GetTaskInput = {
      id: createdTask.id
    };

    const result = await getTask(input, user.id);

    // Verify task details
    expect(result.id).toEqual(createdTask.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.title).toEqual('Test Task');
    expect(result.description).toEqual('A task for testing');
    expect(result.due_date).toBeInstanceOf(Date);
    expect(result.priority).toEqual('High');
    expect(result.is_completed).toEqual(false);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when task does not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const user = userResult[0];

    const input: GetTaskInput = {
      id: 99999 // Non-existent task ID
    };

    await expect(getTask(input, user.id)).rejects.toThrow(/Task with ID 99999 not found or access denied/i);
  });

  it('should throw error when user tries to access task belonging to another user', async () => {
    // Create first user and their task
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword1',
        name: 'User One'
      })
      .returning()
      .execute();

    const user1 = user1Result[0];

    // Create second user
    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword2',
        name: 'User Two'
      })
      .returning()
      .execute();

    const user2 = user2Result[0];

    // Create task belonging to user1
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: user1.id,
        title: 'User 1 Task',
        description: 'This task belongs to user 1',
        due_date: new Date('2024-12-31'),
        priority: 'Medium',
        is_completed: false
      })
      .returning()
      .execute();

    const task = taskResult[0];

    const input: GetTaskInput = {
      id: task.id
    };

    // User2 tries to access User1's task
    await expect(getTask(input, user2.id)).rejects.toThrow(/Task with ID .* not found or access denied/i);
  });

  it('should handle task with null description and due_date', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create task with null optional fields
    const taskResult = await db.insert(tasksTable)
      .values({
        user_id: user.id,
        title: 'Minimal Task',
        description: null,
        due_date: null,
        priority: 'Low',
        is_completed: true
      })
      .returning()
      .execute();

    const createdTask = taskResult[0];

    const input: GetTaskInput = {
      id: createdTask.id
    };

    const result = await getTask(input, user.id);

    // Verify null fields are handled correctly
    expect(result.id).toEqual(createdTask.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.title).toEqual('Minimal Task');
    expect(result.description).toBeNull();
    expect(result.due_date).toBeNull();
    expect(result.priority).toEqual('Low');
    expect(result.is_completed).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle all priority levels correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Test each priority level
    const priorities = ['Low', 'Medium', 'High'] as const;
    const taskIds: number[] = [];

    for (const priority of priorities) {
      const taskResult = await db.insert(tasksTable)
        .values({
          user_id: user.id,
          title: `${priority} Priority Task`,
          description: `Task with ${priority} priority`,
          due_date: new Date('2024-12-31'),
          priority: priority,
          is_completed: false
        })
        .returning()
        .execute();

      taskIds.push(taskResult[0].id);
    }

    // Verify each task can be retrieved with correct priority
    for (let i = 0; i < priorities.length; i++) {
      const input: GetTaskInput = {
        id: taskIds[i]
      };

      const result = await getTask(input, user.id);
      expect(result.priority).toEqual(priorities[i]);
      expect(result.title).toEqual(`${priorities[i]} Priority Task`);
    }
  });
});