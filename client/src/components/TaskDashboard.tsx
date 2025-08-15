import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, CheckCircle2, Circle } from 'lucide-react';
// Simple date formatter function
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
import { cn } from './utils';
import { trpc } from '@/utils/trpc';
import { TaskEditDialog } from './TaskEditDialog';
import type { Task, CreateTaskInput, UpdateTaskInput, Priority, AuthResponse } from '../../../server/src/schema';

interface TaskDashboardProps {
  user: AuthResponse['user'];
  token: string;
}

// NOTE: Backend uses stub implementations - all data is mocked
// Task operations (create, update, delete) return placeholder data
export function TaskDashboard({ user }: TaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');

  const [formData, setFormData] = useState<CreateTaskInput>({
    title: '',
    description: null,
    due_date: null,
    priority: 'Medium'
  });

  const loadTasks = useCallback(async () => {
    try {
      const completed = filter === 'completed' ? true : filter === 'pending' ? false : undefined;
      const priority = priorityFilter === 'all' ? undefined : priorityFilter;
      
      const result = await trpc.getTasks.query({ completed, priority });
      setTasks(result);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }, [filter, priorityFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const newTask = await trpc.createTask.mutate(formData);
      setTasks((prev: Task[]) => [newTask, ...prev]);
      setFormData({
        title: '',
        description: null,
        due_date: null,
        priority: 'Medium'
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTask = async (updates: UpdateTaskInput) => {
    setIsLoading(true);
    try {
      const updatedTask = await trpc.updateTask.mutate(updates);
      
      setTasks((prev: Task[]) =>
        prev.map((task: Task) => task.id === updatedTask.id ? updatedTask : task)
      );
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setIsLoading(true);
    try {
      await trpc.deleteTask.mutate({ id: taskId });
      setTasks((prev: Task[]) => prev.filter((task: Task) => task.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    await handleUpdateTask({ id: task.id, is_completed: !task.is_completed });
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowEditDialog(true);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'Low':
        return 'bg-green-500/20 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  const filteredTasks = tasks.filter((task: Task) => {
    if (filter === 'completed' && !task.is_completed) return false;
    if (filter === 'pending' && task.is_completed) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  const pendingCount = tasks.filter((task: Task) => !task.is_completed).length;
  const completedCount = tasks.filter((task: Task) => task.is_completed).length;

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Circle className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{pendingCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">Pending Tasks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{completedCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">Completed Tasks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold">{tasks.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions and filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </Button>
        
        <div className="flex items-center space-x-2">
          <Select value={filter} onValueChange={(value: 'all' | 'pending' | 'completed') => setFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={(value: Priority | 'all') => setPriorityFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Create task form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
            <CardDescription>Add a new task to your list</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Task title"
                  value={formData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateTaskInput) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Textarea
                  placeholder="Task description (optional)"
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateTaskInput) => ({
                      ...prev,
                      description: e.target.value || null
                    }))
                  }
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.due_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.due_date ? formatDate(formData.due_date) : 'Pick due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.due_date || undefined}
                        onSelect={(date: Date | undefined) =>
                          setFormData((prev: CreateTaskInput) => ({ ...prev, due_date: date || null }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Select
                    value={formData.priority}
                    onValueChange={(value: Priority) =>
                      setFormData((prev: CreateTaskInput) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low Priority</SelectItem>
                      <SelectItem value="Medium">Medium Priority</SelectItem>
                      <SelectItem value="High">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tasks list */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {tasks.length === 0 
                  ? "No tasks yet. Create your first task to get started!"
                  : "No tasks match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task: Task) => (
            <Card key={task.id} className={cn(
              'transition-all duration-200 hover:shadow-md border-l-4',
              task.is_completed && 'opacity-75',
              task.priority === 'High' && 'border-l-red-500',
              task.priority === 'Medium' && 'border-l-yellow-500',
              task.priority === 'Low' && 'border-l-green-500'
            )}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => toggleTaskCompletion(task)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className={cn(
                        'font-medium',
                        task.is_completed && 'line-through text-muted-foreground'
                      )}>
                        {task.title}
                      </h3>
                      
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Task</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this task? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTask(task.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className={cn(
                        'text-sm text-muted-foreground',
                        task.is_completed && 'line-through'
                      )}>
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Created {task.created_at.toLocaleDateString()}</span>
                      {task.due_date && (
                        <span className={cn(
                          task.due_date < new Date() && !task.is_completed && 'text-red-500 font-medium'
                        )}>
                          Due {task.due_date.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Task Dialog */}
      <TaskEditDialog
        task={editingTask}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleUpdateTask}
        isLoading={isLoading}
      />
    </div>
  );
}