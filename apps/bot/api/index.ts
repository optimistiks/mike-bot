import { handle } from "hono/vercel";

import { createApp } from "../src/app.js";
import { WEBHOOK_MAX_DURATION_SECONDS } from "../src/webhook.js";

export const runtime = "nodejs";
export const maxDuration = WEBHOOK_MAX_DURATION_SECONDS;

export default handle(createApp());
