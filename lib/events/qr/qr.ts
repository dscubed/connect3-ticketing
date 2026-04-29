import QRCode from "qrcode";

export async function generateQRCodeBuffer(destination: string) {
  return QRCode.toBuffer(destination, { width: 300, margin: 2, type: "png" });
}
