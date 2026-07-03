import path from "path";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";

// A4-ratio station poster for print (≥12cm QR when printed A4).
const W = 1240;
const H = 1754;

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

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderStationPoster(
  station: { slug: string; nameEn: string; nameAr: string; floor: string },
  scanUrl: string
): Promise<Buffer> {
  ensureFonts();
  const gold = "#e6c47c";
  const parchment = "#f3ead6";
  const cx = W / 2;

  const themeDir = path.join(process.cwd(), "public/theme");
  const [bg, crest, qrImg] = await Promise.all([
    fs.promises.readFile(path.join(themeDir, "ticket-bg-vip.jpg")).then(loadImage),
    fs.promises.readFile(path.join(themeDir, "crest-white.png")).then(loadImage),
    QRCode.toBuffer(scanUrl, {
      width: 760,
      margin: 2,
      errorCorrectionLevel: "H", // posters get damaged — max correction
      color: { dark: "#14100a", light: parchment },
    }).then(loadImage),
  ]);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";

  // background
  const scale = Math.max(W / bg.width, H / bg.height);
  ctx.drawImage(bg, 0, 0, W / scale, H / scale, 0, 0, W, H);
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

  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 7;
  rr(ctx, 26, 26, W - 52, H - 52, 30);
  ctx.stroke();

  // crest + heading
  ctx.drawImage(crest, cx - 60, 70, 120, 120);
  ctx.fillStyle = gold;
  ctx.font = "bold 56px Cinzel";
  ctx.fillText("TREASURE HUNT", cx, 280);
  ctx.fillStyle = parchment;
  ctx.font = '700 46px "Aref Ruqaa", Amiri, Lora';
  ctx.fillText("كنز الأخوية", cx, 348);

  // station name
  ctx.fillStyle = parchment;
  ctx.font = "bold 110px Cinzel";
  ctx.fillText(station.nameEn.toUpperCase(), cx, 500);
  ctx.font = '700 68px "Aref Ruqaa", Amiri, Lora';
  ctx.fillText(station.nameAr, cx, 590);

  // QR plate
  const plate = 860;
  ctx.fillStyle = parchment;
  rr(ctx, cx - plate / 2, 660, plate, plate, 36);
  ctx.fill();
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 5;
  rr(ctx, cx - plate / 2 - 12, 648, plate + 24, plate + 24, 42);
  ctx.stroke();
  ctx.drawImage(qrImg, cx - 380, 710, 760, 760);

  // footer
  ctx.fillStyle = gold;
  ctx.font = "bold 46px Cinzel";
  ctx.fillText("SCAN TO CLAIM THIS MARK", cx, 1620);
  ctx.fillStyle = parchment;
  ctx.font = '700 40px Amiri, Lora';
  ctx.fillText("امسح الرمز لتحصل على العلامة", cx, 1682);

  return canvas.encode("png");
}
