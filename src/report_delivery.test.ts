import assert from "node:assert/strict";
import { buildReport, renderPdf } from "./report_delivery";

const report = buildReport({
  id: "WO-7",
  site: "Depot",
  status: "complete",
  photos: ["one.jpg", "two.jpg"],
  followUp: "Schedule relay replacement.",
});

assert.deepEqual(report, {
  workOrderId: "WO-7",
  status: "complete",
  photoCount: 2,
  followUp: "Schedule relay replacement.",
});
assert.match(new TextDecoder().decode(renderPdf(report)), /Work order: WO-7/);
console.log("report decision and PDF boundary passed");
