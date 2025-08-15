import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  registerInputSchema, 
  loginInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  deleteTaskInputSchema,
  getTasksInputSchema,
  getTaskInputSchema
} from './schema';

// Import handlers
import { register } from './handlers/register';
import { login } from './handlers/login';
import { createTask } from './handlers/create_task';
import { getTasks } from './handlers/get_tasks';
import { getTask } from './handlers/get_task';
import { updateTask } from './handlers/update_task';
import { deleteTask } from './handlers/delete_task';
import { verifyToken, extractTokenFromHeader, type AuthContext } from './handlers/auth_middleware';

// Create context type
interface Context {
  auth?: AuthContext;
  authHeader?: string;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Protected procedure that requires authentication
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const token = extractTokenFromHeader(ctx.authHeader);
  
  if (!token) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication token required',
    });
  }

  try {
    const auth = await verifyToken(token);
    return next({
      ctx: {
        ...ctx,
        auth,
      },
    });
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
});

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication endpoints
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => register(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  // Task management endpoints (protected)
  createTask: protectedProcedure
    .input(createTaskInputSchema)
    .mutation(({ input, ctx }) => createTask(input, ctx.auth!.user.id)),

  getTasks: protectedProcedure
    .input(getTasksInputSchema)
    .query(({ input, ctx }) => getTasks(input, ctx.auth!.user.id)),

  getTask: protectedProcedure
    .input(getTaskInputSchema)
    .query(({ input, ctx }) => getTask(input, ctx.auth!.user.id)),

  updateTask: protectedProcedure
    .input(updateTaskInputSchema)
    .mutation(({ input, ctx }) => updateTask(input, ctx.auth!.user.id)),

  deleteTask: protectedProcedure
    .input(deleteTaskInputSchema)
    .mutation(({ input, ctx }) => deleteTask(input, ctx.auth!.user.id)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext({ req }) {
      return {
        authHeader: req.headers.authorization,
      };
    },
  });
  
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();