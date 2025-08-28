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
  // hostname: '0.0.0.0',
  fetch: async (request, server) => Effect.runPromise(
    pipe(
      Effect.gen(function* () {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type,Authorization",
              "Access-Control-Max-Age": "86400"
            }
          });
        }

        if (url.pathname === '/') {
          return new Response('Hello World', {
            headers: {
              "Access-Control-Allow-Origin": "*"
            }
          });
        }

        if (url.pathname === '/session') {
          if (request.method !== 'POST') {
            return new Response('Method not allowed', {
              status: 405,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            });
          }

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
          if (!body.success) {
            return new Response('Bad Request', {
              status: 400,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            });
          }
          const { token, serverToken } = body.data;

          if (env.SESSION_SECRET !== serverToken) {
            return new Response('Unauthorized', {
              status: 401,
              headers: {
                "Access-Control-Allow-Origin": "*"
              }
            });
          }
          console.log('Received new token: ' + token);

          // write to cfg/token.txt
          Bun.write('cfg/token.txt', token);
          return new Response('OK', {
            headers: {
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
        return new Response('Not Found', {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        });
      }),
      Effect.catchTags({
        JSONError: () => Effect.succeed(new Response('Bad Request', {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }))
      })
    )
  )
})

console.log('Server is running on port ' + env.PORT);