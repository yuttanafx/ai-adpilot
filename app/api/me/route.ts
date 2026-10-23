import { json, withUser } from "@/lib/http";
import { keyStatus } from "@/lib/profile";

export const GET = withUser(async (_req, user) =>
  json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    provider: user.provider,
    model: user.model,
    keys: await keyStatus(user.id),
  }),
);
