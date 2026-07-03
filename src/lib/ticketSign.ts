import crypto from "crypto";

const SECRET = () => process.env.TICKET_SECRET!;

// QR payload format: BG1.<ticketId>.<sig>
// sig = first 16 bytes of HMAC-SHA256(ticketId) hex — enough to make forgery infeasible
// while keeping the QR small and fast to scan.

export function signTicket(ticketId: string): string {
  const sig = crypto
    .createHmac("sha256", SECRET())
    .update(ticketId)
    .digest("hex")
    .slice(0, 32);
  return `BG1.${ticketId}.${sig}`;
}

export function verifyTicketPayload(payload: string): string | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "BG1") return null;
  const [, ticketId, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET())
    .update(ticketId)
    .digest("hex")
    .slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return ticketId;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L ambiguity

export function generateShortCode(): string {
  let code = "";
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `BF-${code}`;
}
