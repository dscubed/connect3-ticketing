import { Resend } from "resend";
import { LineItem } from "@/components/templates/receipt";
import { ReceiptTemplate } from "@/components/templates/receipt";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendTicketEmail(
  email: string,
  customerName: string,
  orderId: string,
  qrBuffer: Buffer,
  lineItems: LineItem[]
) {
  const { data: _, error } = await resend.emails.send({
    from: "Connect3 <ticketing@mail.connect3.app>",
    to: [email!],
    subject: "You're Checked In",
    attachments: [
      {
        filename: "qr-code.png",
        content: qrBuffer.toString("base64"),
        contentId: "ticket-qr",
      },
    ],
    react: ReceiptTemplate({
      firstName: customerName,
      orderId: orderId,
      lineItems: lineItems,
      ticketQrCodeUrl: "cid:ticket-qr",
    }),
  });

  if (error) {
    throw new Error("Failed to send ticket email");
  }
}
