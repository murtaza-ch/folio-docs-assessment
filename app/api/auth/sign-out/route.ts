import {
  clearSessionCookie,
  handle,
  json,
  sameOrigin,
} from "../../../../lib/server-http";
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    await clearSessionCookie();
    return json({ user: null });
  });
}
