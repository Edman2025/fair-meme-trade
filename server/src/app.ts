import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { registerAuthRoutes } from "./routes/auth";
import { registerCoreRoutes } from "./routes/core";

export const buildApp = async () => {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await registerAuthRoutes(app);
  await registerCoreRoutes(app);
  return app;
};
