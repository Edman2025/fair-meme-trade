import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { registerAuthRoutes } from "./routes/auth";
import { registerCoreRoutes } from "./routes/core";

export const buildApp = async () => {
  const app = Fastify({ logger: true, bodyLimit: 6 * 1024 * 1024 });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await registerAuthRoutes(app);
  await registerCoreRoutes(app);
  return app;
};
