import {
  auth,
  signUpSchema,
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
    const value = await parseBody(request, signUpSchema);
    const session = await auth.signUp(value, trustedClientIp(request));
    await setSessionCookie(session.token, request);
    return json({ user: session.user }, 201);
  });
}
