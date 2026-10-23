import { mkdir, writeFile } from "node:fs/promises";
import { sendEmail } from "./infrai_email";

// The call site follows the public Infrai capability name: infrai.email.send.

export type WorkOrder = {
  id: string;
  site: string;
  status: "dispatched" | "in_progress" | "complete";
  photos: string[];
  followUp: string;
};

export type FieldServiceReport = {
  workOrderId: string;
  status: WorkOrder["status"];
  photoCount: number;
  followUp: string;
};

export function buildReport(order: WorkOrder): FieldServiceReport {
  return {
    workOrderId: order.id,
    status: order.status,
    photoCount: order.photos.length,
    followUp: order.followUp,
  };
}

function pdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function renderPdf(report: FieldServiceReport): Uint8Array {
  const lines = [
    "Field service work-order report",
    `Work order: ${report.workOrderId}`,
    `Dispatch status: ${report.status}`,
    `Photos recorded: ${report.photoCount}`,
    `Technician follow-up: ${report.followUp}`,
  ];
  const stream = ["BT", "/F1 12 Tf", "72 720 Td", ...lines.map((line, i) => `(${pdfText(line)}) Tj${i === lines.length - 1 ? "" : " 0 -22 Td"}`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export async function deliverReport(to: string, order: WorkOrder): Promise<{ messageId: string; pdfPath: string; report: FieldServiceReport }> {
  const report = buildReport(order);
  const pdfPath = `reports/${order.id}.pdf`;
  await mkdir("reports", { recursive: true });
  await writeFile(pdfPath, renderPdf(report));
  const result = await sendEmail({
    to,
    subject: `Work order ${report.workOrderId} report`,
    text: `Work order ${report.workOrderId} is ${report.status}. Photos: ${report.photoCount}. Follow-up: ${report.followUp}. The PDF report is written to ${pdfPath}.`,
    html: `<p>Work order <strong>${report.workOrderId}</strong> is ${report.status}.</p><p>Photos: ${report.photoCount}. Follow-up: ${report.followUp}.</p>`,
  }, `work-order-report:${order.id}`);
  return { messageId: result.message_id, pdfPath, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const to = process.env.REPORT_EMAIL_TO;
  if (!to) throw new Error("REPORT_EMAIL_TO is required");
  const result = await deliverReport(to, {
    id: "WO-1042",
    site: "North plant",
    status: "complete",
    photos: ["arrival.jpg", "panel.jpg"],
    followUp: "Replace the worn relay during the next visit.",
  });
  console.log(JSON.stringify(result, null, 2));
}
