import { type UpdateTaskInput, type Task } from '../schema';

export async function updateTask(input: UpdateTaskInput, userId: number): Promise<Task> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to update an existing task for the authenticated user.
    // Steps:
    // 1. Verify task exists and belongs to the authenticated user
    // 2. Update only the provided fields (partial update)
    // 3. Update the updated_at timestamp
    // 4. Return the updated task data
    // 5. Throw error if task not found or doesn't belong to user
    
    return Promise.resolve({
        id: input.id,
        user_id: userId,
        title: input.title || 'Updated Task',
        description: input.description !== undefined ? input.description : 'Updated description',
        due_date: input.due_date !== undefined ? input.due_date : new Date(),
        priority: input.priority || 'Medium',
        is_completed: input.is_completed !== undefined ? input.is_completed : false,
        created_at: new Date(),
        updated_at: new Date()
    } as Task);
}