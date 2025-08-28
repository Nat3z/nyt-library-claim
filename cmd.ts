import { env } from "bun";

if (env.CMD === 'server') {
  import('./route');
} else if (env.CMD === 'executor') {
  import('./index');
} else {
  throw new Error('Invalid command');
}