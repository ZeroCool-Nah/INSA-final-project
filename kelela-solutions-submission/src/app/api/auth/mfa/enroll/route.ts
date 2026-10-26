import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { withAnySession } from "@/lib/auth";

export const POST = withAnySession(async (_req, session) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: session.sub } });
  if (user.mfaEnabled) {
    return Response.json({ error: { code: "CONFLICT", message: "MFA is already enabled." } }, { status: 409 });
  }

  // TODO: encrypt with your KMS/envelope-encryption key before storing —
  // this stub stores the pending secret in plaintext, which is only
  // acceptable for local development.
  const secret = authenticator.generateSecret();
  await db.user.update({ where: { id: user.id }, data: { mfaPendingSecret: secret } });

  const otpauthUrl = authenticator.keyuri(user.email, "Kelela Solutions", secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return Response.json({ data: { qrCodeDataUrl, secret, otpauthUrl } });
});
