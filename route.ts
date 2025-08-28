import { env } from "bun";
import { Data, Effect, pipe } from "effect";
import z from "zod";
if (!env.PORT) {
  throw new Error('PORT is not set');
}

if (!env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set');
}

class JSONError extends Data.TaggedError("JSONError") {}

Bun.serve({
  port: Number(env.PORT),
  hostname: '0.0.0.0',
  fetch: async (request, server) => Effect.runPromise(
    pipe(
      Effect.gen(function* () {
        const url = new URL(request.url);
        if (url.pathname === '/') {
          return new Response('Hello World');
        }

        if (url.pathname === '/session') {
          if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

          const body = yield* Effect.tryPromise({
            try: async () => {
              const schema = z.object({
                token: z.string(),
                serverToken: z.string()
              });
              return schema.safeParse(await request.json());
            },
            catch: (e) => new JSONError()
          });
          if (!body.success) return new Response('Bad Request', { status: 400 });
          const { token, serverToken } = body.data;

          if (env.SESSION_SECRET !== serverToken) return new Response('Unauthorized', { status: 401 });

          // write to cfg/token.txt
          Bun.write('cfg/token.txt', token);
          return new Response('OK');
        }
        return new Response('Not Found', { status: 404 });
      }),
      Effect.catchTags({
        JSONError: () => Effect.succeed(new Response('Bad Request', { status: 400 }))
      })
    )
  )
})