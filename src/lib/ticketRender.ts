import path from "path";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";
import { signTicket } from "./ticketSign";

// Portrait ticket — sized to read nicely full-screen on a phone.
// Rendered with Skia (@napi-rs/canvas) and fonts bundled in assets/fonts,
// so text output is identical on any machine or host — no system-font,
// fontconfig, or SVG-text dependencies.
const W = 760;
const H = 1300;
const QR_PLATE = 440;
const QR_SIZE = 384;

const FONTS_DIR = path.join(process.cwd(), "assets/fonts");
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const fonts: Array<[string, string]> = [
    ["cinzel-700.ttf", "Cinzel"],
    ["lora-600.ttf", "Lora"],
    ["lora-500.ttf", "Lora"],
    ["courier-prime-700.ttf", "Courier Prime"],
    ["noto-naskh-arabic-600.ttf", "Noto Naskh Arabic"],
  ];
  for (const [file, family] of fonts) {
    const p = path.join(FONTS_DIR, file);
    if (!fs.existsSync(p)) {
      throw new Error(`Ticket font missing: ${p} — did assets/fonts get deployed?`);
    }
    GlobalFonts.registerFromPath(p, family);
  }
  fontsReady = true;
}

const SERIF = `Lora, "Noto Naskh Arabic"`;
const DISPLAY = `Cinzel, Lora, "Noto Naskh Arabic"`;
const MONO = `"Courier Prime"`;

type TicketData = {
  id: string;
  shortCode: string;
  tier: string;
  holderName: string | null;
};

type EventData = {
  name: string;
  venue: string;
  startsAt: Date;
};

function fitFont(text: string, base: number, maxChars: number): number {
  if (text.length <= maxChars) return base;
  return Math.max(Math.floor((base * maxChars) / text.length), Math.floor(base * 0.42));
}

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSpaced(
  ctx: SKRSContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number
) {
  // manual letter-spacing for Latin small-caps labels (never used for Arabic)
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, y);
    x += widths[i] + spacing;
  });
}

/** cover-fit an image onto the canvas */
function drawCover(
  ctx: SKRSContext2D,
  img: Awaited<ReturnType<typeof loadImage>>,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

export async function renderTicketPng(
  ticket: TicketData,
  event: EventData
): Promise<Buffer> {
  ensureFonts();

  const vip = ticket.tier === "VIP";
  const holder = ticket.holderName ?? "BEARER";
  const cx = W / 2;

  const gold = "#e6c47c";
  const goldDeep = "#a8862f";
  const steel = "#9aa3ad";
  const parchment = "#f3ead6";
  const mutedInk = "#8b8676";
  const accent = vip ? gold : steel;

  const themeDir = path.join(process.cwd(), "public/theme");
  // load via buffers — works across @napi-rs/canvas versions and avoids URL parsing
  const [bg, crest, wordmark, qrImg] = await Promise.all([
    fs.promises
      .readFile(path.join(themeDir, vip ? "ticket-bg-vip.jpg" : "ticket-bg-normal.jpg"))
      .then(loadImage),
    fs.promises.readFile(path.join(themeDir, "crest-white.png")).then(loadImage),
    fs.promises.readFile(path.join(themeDir, "mego-wordmark-rounded.png")).then(loadImage),
    QRCode.toBuffer(signTicket(ticket.id), {
      width: QR_SIZE,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#14100a", light: parchment },
    }).then(loadImage),
  ]);

  const dateStr = event.startsAt
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const timeStr = event.startsAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // ── background + fade ────────────────────────────────────────────────
  drawCover(ctx, bg, W, H);
  const fade = ctx.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, `rgba(11,13,16,${vip ? 0.9 : 0.88})`);
  fade.addColorStop(0.45, `rgba(11,13,16,${vip ? 0.8 : 0.74})`);
  fade.addColorStop(1, "rgba(11,13,16,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  const goldGrad = ctx.createLinearGradient(0, 0, W, H);
  goldGrad.addColorStop(0, "#f0d494");
  goldGrad.addColorStop(0.5, gold);
  goldGrad.addColorStop(1, goldDeep);

  // ── frames ───────────────────────────────────────────────────────────
  ctx.strokeStyle = vip ? goldGrad : steel;
  ctx.lineWidth = vip ? 5 : 3;
  rr(ctx, 14, 14, W - 28, H - 28, 22);
  ctx.stroke();

  if (vip) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.6;
    rr(ctx, 30, 30, W - 60, H - 60, 16);
    ctx.stroke();
    ctx.restore();

    // corner diamonds
    ctx.fillStyle = goldGrad;
    for (const [x, y] of [[54, 54], [W - 54, 54], [54, H - 54], [W - 54, H - 54]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + 11, y);
      ctx.lineTo(x, y + 11);
      ctx.lineTo(x - 11, y);
      ctx.closePath();
      ctx.fill();
    }

    // giant watermark behind QR
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = gold;
    ctx.font = `bold 330px ${DISPLAY}`;
    ctx.fillText("VIP", cx, 860);
    ctx.restore();
  }

  // ── crest ────────────────────────────────────────────────────────────
  const crestW = 64;
  const crestH = (crest.height / crest.width) * crestW;
  ctx.drawImage(crest, cx - crestW / 2, 34, crestW, crestH);

  // ── tier banner ──────────────────────────────────────────────────────
  if (vip) {
    ctx.fillStyle = goldGrad;
    rr(ctx, 56, 122, W - 112, 74, 12);
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = "rgba(20,16,10,0.35)";
    ctx.lineWidth = 1.4;
    rr(ctx, 62, 128, W - 124, 62, 9);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#241a08";
    ctx.font = `bold 32px ${DISPLAY}`;
    drawSpaced(ctx, "VIP", cx, 164, 14);
    // diamond accents flanking the VIP lettering (drawn, not glyphs —
    // decorative unicode isn't in the bundled fonts)
    for (const dx of [-105, 105]) {
      const dy = 152;
      ctx.beginPath();
      ctx.moveTo(cx + dx, dy - 9);
      ctx.lineTo(cx + dx + 9, dy);
      ctx.lineTo(cx + dx, dy + 9);
      ctx.lineTo(cx + dx - 9, dy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#3d2f12";
    ctx.font = `bold 14px ${DISPLAY}`;
    drawSpaced(ctx, "BROTHERHOOD TIER · PRIORITY ENTRY", cx, 187, 3);
  } else {
    ctx.fillStyle = "#232830";
    rr(ctx, cx - 170, 130, 340, 58, 10);
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = "rgba(154,163,173,0.55)";
    ctx.lineWidth = 1.4;
    rr(ctx, cx - 170, 130, 340, 58, 10);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#e8e2d5";
    ctx.font = `bold 20px ${DISPLAY}`;
    drawSpaced(ctx, "GENERAL ADMISSION", cx, 160, 3);
    ctx.fillStyle = mutedInk;
    ctx.font = `bold 13px ${DISPLAY}`;
    drawSpaced(ctx, "RECRUIT TIER", cx, 181, 4);
  }

  // ── event block ──────────────────────────────────────────────────────
  ctx.fillStyle = parchment;
  ctx.font = `bold ${fitFont(event.name, 54, 20)}px ${DISPLAY}`;
  ctx.fillText(event.name, cx, 286);

  // ornament divider
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 190, 318);
  ctx.lineTo(cx - 26, 318);
  ctx.moveTo(cx + 26, 318);
  ctx.lineTo(cx + 190, 318);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, 310);
  ctx.lineTo(cx + 8, 318);
  ctx.lineTo(cx, 326);
  ctx.lineTo(cx - 8, 318);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── info columns: DATE | TIME | VENUE ────────────────────────────────
  ctx.fillStyle = mutedInk;
  ctx.font = `bold 15px ${DISPLAY}`;
  drawSpaced(ctx, "DATE", 176, 368, 4);
  drawSpaced(ctx, "TIME", cx, 368, 4);
  drawSpaced(ctx, "VENUE", W - 176, 368, 4);

  ctx.fillStyle = parchment;
  ctx.font = `600 25px ${SERIF}`;
  ctx.fillText(dateStr, 176, 404);
  ctx.fillText(timeStr, cx, 404);
  ctx.font = `600 ${fitFont(event.venue, 25, 16)}px ${SERIF}`;
  ctx.fillText(event.venue, W - 176, 404);

  ctx.strokeStyle = "#3a4048";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 128, 352);
  ctx.lineTo(cx - 128, 408);
  ctx.moveTo(cx + 128, 352);
  ctx.lineTo(cx + 128, 408);
  ctx.stroke();

  // ── QR plate ─────────────────────────────────────────────────────────
  const qrTop = 452;
  if (vip) {
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 3;
    rr(ctx, cx - QR_PLATE / 2 - 8, qrTop - 8, QR_PLATE + 16, QR_PLATE + 16, 26);
    ctx.stroke();
  }
  ctx.fillStyle = parchment;
  rr(ctx, cx - QR_PLATE / 2, qrTop, QR_PLATE, QR_PLATE, 20);
  ctx.fill();
  ctx.drawImage(
    qrImg,
    cx - QR_SIZE / 2,
    qrTop + (QR_PLATE - QR_SIZE) / 2,
    QR_SIZE,
    QR_SIZE
  );

  // ── short code ───────────────────────────────────────────────────────
  const codeY = qrTop + QR_PLATE + 78;
  ctx.fillStyle = accent;
  ctx.font = `bold 34px ${MONO}`;
  drawSpaced(ctx, ticket.shortCode, cx, codeY, 8);

  // ── admit panel ──────────────────────────────────────────────────────
  const admitTop = codeY + 44;
  ctx.fillStyle = "rgba(17,20,26,0.82)";
  rr(ctx, 80, admitTop, W - 160, 150, 16);
  ctx.fill();
  ctx.strokeStyle = vip ? goldGrad : "#3a4048";
  ctx.lineWidth = vip ? 2.4 : 1.5;
  rr(ctx, 80, admitTop, W - 160, 150, 16);
  ctx.stroke();

  ctx.fillStyle = vip ? gold : mutedInk;
  ctx.font = `bold 16px ${DISPLAY}`;
  drawSpaced(ctx, vip ? "ADMIT · VIP GUEST" : "ADMIT · GUEST", cx, admitTop + 42, 5);

  ctx.fillStyle = parchment;
  ctx.font = `600 ${fitFont(holder, 48, 18)}px ${SERIF}`;
  ctx.fillText(holder, cx, admitTop + 108);

  // ── footer ───────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(90, H - 104);
  ctx.lineTo(W - 90, H - 104);
  ctx.stroke();
  ctx.restore();

  const wmW = 150;
  const wmH = (wordmark.height / wordmark.width) * wmW;
  ctx.drawImage(wordmark, cx - wmW / 2, H - 92, wmW, wmH);

  ctx.fillStyle = mutedInk;
  ctx.font = `bold 15px ${DISPLAY}`;
  drawSpaced(ctx, "SCAN AT THE GATE", cx, H - 36, 4);

  return canvas.encode("png");
}
