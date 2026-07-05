import path from "path";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";

// Station poster. Designed at A4 ratio (1240×1754) but rendered fully
// proportionally, so any width/height can be requested for print or for
// different screen sizes. Fonts scale uniformly and the QR stays square,
// so nothing distorts at any aspect ratio.
const BASE_W = 1240;
const BASE_H = 1754;

const FONTS_DIR = path.join(process.cwd(), "assets/fonts");
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const fonts: Array<[string, string]> = [
    ["cinzel-700.ttf", "Cinzel"],
    ["lora-600.ttf", "Lora"],
    ["amiri-700.ttf", "Amiri"],
    ["aref-ruqaa-700.ttf", "Aref Ruqaa"],
  ];
  for (const [file, family] of fonts) {
    const p = path.join(FONTS_DIR, file);
    if (!fs.existsSync(p)) throw new Error(`Poster font missing: ${p}`);
    GlobalFonts.registerFromPath(p, family);
  }
  fontsReady = true;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrink a font until the text fits maxWidth. Returns the chosen px size. */
function fitFont(
  ctx: SKRSContext2D,
  text: string,
  fontFor: (size: number) => string,
  startSize: number,
  maxWidth: number
): number {
  let size = startSize;
  ctx.font = fontFor(size);
  while (ctx.measureText(text).width > maxWidth && size > 8) {
    size -= 2;
    ctx.font = fontFor(size);
  }
  return size;
}

export async function renderStationPoster(
  station: { slug: string; nameEn: string; nameAr: string; floor: string },
  scanUrl: string,
  opts?: { width?: number; height?: number }
): Promise<Buffer> {
  ensureFonts();

  const W = clamp(Math.round(opts?.width ?? BASE_W), 300, 8000);
  const H = clamp(
    Math.round(opts?.height ?? W * (BASE_H / BASE_W)),
    300,
    12000
  );
  const k = Math.min(W / BASE_W, H / BASE_H); // uniform scale for fonts/strokes
  const cx = W / 2;

  const gold = "#e6c47c";
  const parchment = "#f3ead6";

  // QR plate sized to the canvas; QR generated at its exact draw size for crispness
  const plate = Math.round(Math.min(W * 0.66, H * 0.46));
  const qrPx = Math.round(plate * 0.88);
  const qrCenterY = H * 0.6;

  const themeDir = path.join(process.cwd(), "public/theme");
  const [bg, crest, qrImg] = await Promise.all([
    fs.promises.readFile(path.join(themeDir, "ticket-bg-vip.jpg")).then(loadImage),
    fs.promises.readFile(path.join(themeDir, "crest-white.png")).then(loadImage),
    QRCode.toBuffer(scanUrl, {
      width: clamp(qrPx, 200, 3000),
      margin: 2,
      errorCorrectionLevel: "H", // posters get damaged — max correction
      color: { dark: "#14100a", light: parchment },
    }).then(loadImage),
  ]);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";

  // background (cover-fit)
  const cover = Math.max(W / bg.width, H / bg.height);
  ctx.drawImage(bg, 0, 0, W / cover, H / cover, 0, 0, W, H);
  const fade = ctx.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, "rgba(11,13,16,0.92)");
  fade.addColorStop(0.5, "rgba(11,13,16,0.82)");
  fade.addColorStop(1, "rgba(11,13,16,0.94)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  const goldGrad = ctx.createLinearGradient(0, 0, W, H);
  goldGrad.addColorStop(0, "#f0d494");
  goldGrad.addColorStop(0.5, gold);
  goldGrad.addColorStop(1, "#a8862f");

  // frame
  const m = Math.round(Math.min(W, H) * 0.021);
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = Math.max(2, 7 * k);
  rr(ctx, m, m, W - m * 2, H - m * 2, 30 * k);
  ctx.stroke();

  const maxTextW = W * 0.86;

  // crest + heading
  const crestSize = Math.round(Math.min(W, H) * 0.1);
  ctx.drawImage(crest, cx - crestSize / 2, H * 0.045, crestSize, crestSize);

  ctx.fillStyle = gold;
  const titleSize = fitFont(ctx, "TREASURE HUNT", (s) => `bold ${s}px Cinzel`, 56 * k, maxTextW);
  ctx.font = `bold ${titleSize}px Cinzel`;
  ctx.fillText("TREASURE HUNT", cx, H * 0.165);

  ctx.fillStyle = parchment;
  ctx.font = `700 ${46 * k}px "Aref Ruqaa", Amiri, Lora`;
  ctx.fillText("كنز الأخوية", cx, H * 0.205);

  // station name (fit long names to width)
  ctx.fillStyle = parchment;
  const enSize = fitFont(
    ctx,
    station.nameEn.toUpperCase(),
    (s) => `bold ${s}px Cinzel`,
    110 * k,
    maxTextW
  );
  ctx.font = `bold ${enSize}px Cinzel`;
  ctx.fillText(station.nameEn.toUpperCase(), cx, H * 0.3);

  const arSize = fitFont(
    ctx,
    station.nameAr,
    (s) => `700 ${s}px "Aref Ruqaa", Amiri, Lora`,
    68 * k,
    maxTextW
  );
  ctx.font = `700 ${arSize}px "Aref Ruqaa", Amiri, Lora`;
  ctx.fillText(station.nameAr, cx, H * 0.355);

  // QR plate
  const plateTop = Math.round(qrCenterY - plate / 2);
  ctx.fillStyle = parchment;
  rr(ctx, cx - plate / 2, plateTop, plate, plate, 36 * k);
  ctx.fill();
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = Math.max(2, 5 * k);
  rr(ctx, cx - plate / 2 - 12 * k, plateTop - 12 * k, plate + 24 * k, plate + 24 * k, 42 * k);
  ctx.stroke();
  ctx.drawImage(qrImg, cx - qrPx / 2, Math.round(qrCenterY - qrPx / 2), qrPx, qrPx);

  // footer
  ctx.fillStyle = gold;
  ctx.font = `bold ${46 * k}px Cinzel`;
  ctx.fillText("SCAN TO CLAIM THIS MARK", cx, H * 0.935);
  ctx.fillStyle = parchment;
  ctx.font = `700 ${40 * k}px Amiri, Lora`;
  ctx.fillText("امسح الرمز لتحصل على العلامة", cx, H * 0.965);

  return canvas.encode("png");
}
