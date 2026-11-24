import { createMiddleware } from "@solidjs/start/middleware";
import { publicResponse } from "./server/public.server";

export default createMiddleware({
  onRequest: async (event) => publicResponse(event.request),
});
