import {
  auth,
  signInSchema,
  trustedClientIp,
} from "../../../../lib/server-auth";
import {
  handle,
  json,
  parseBody,
  sameOrigin,
  setSessionCookie,
} from "../../../../lib/server-http";
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const value = await parseBody(request, signInSchema);
    const session = await auth.signIn(value, trustedClientIp(request));
    await setSessionCookie(session.token, request);
    return json({ user: session.user });
  });
}
