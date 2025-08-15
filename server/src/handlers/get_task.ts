import { type GetTaskInput, type Task } from '../schema';

export async function getTask(input: GetTaskInput, userId: number): Promise<Task> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch a specific task by ID for the authenticated user.
    // Steps:
    // 1. Query database for task with given ID
    // 2. Verify task belongs to the authenticated user
    // 3. Throw error if task not found or doesn't belong to user
    // 4. Return the task data
    
    return Promise.resolve({
        id: input.id,
        user_id: userId,
        title: 'Sample Task',
        description: 'This is a sample task',
        due_date: new Date(),
        priority: 'Medium' as const,
        is_completed: false,
        created_at: new Date(),
        updated_at: new Date()
    } as Task);
}