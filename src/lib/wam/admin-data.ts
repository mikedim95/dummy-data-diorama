// DEMO DATA for the management dashboard. Deterministic (seeded) and anchored to
// today so date filters behave realistically. Replace with WAM DB queries in admin-api.ts.
import type {
  AdminMachine, Attendance, Customer, CustomerOrder, DocumentRec, Employee, FinancialRecord,
  Job, MachineMaintenance, MaintenancePlan, Material, OrderStatus, StockBalance, StockMovement,
} from "./admin-types";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const r = rng(42);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));

const DAY = 86400000;
const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
export const dayISO = (offset: number, hour = 9, min = 0) => new Date(today0 + offset * DAY + hour * 3600000 + min * 60000).toISOString();

export const CUSTOMERS: Customer[] = [
  ["C01", "Atelier Kostas", "Athens"], ["C02", "Nordhaus Interiors", "Thessaloniki"], ["C03", "Hotel Elaia", "Chania"],
  ["C04", "Kafeneio 1912", "Nafplio"], ["C05", "Marina Flisvos", "Piraeus"], ["C06", "Law Office Raptis", "Athens"],
  ["C07", "Taverna Thalassa", "Paros"], ["C08", "Studio Lyra Architects", "Athens"], ["C09", "Ktima Gerovassiliou", "Epanomi"],
].map(([id, name, city]) => ({ id: id!, name: name!, city: city!, email: `${name!.toLowerCase().replace(/[^a-z]/g, "")}@example.gr` }));

export const ADMIN_MACHINES: AdminMachine[] = [
  { code: "WAM-CNC-01", name: "CNC Router 01", model: "Biesse Rover A 1532", location: "Hall A · Bay 3", status: "operational" },
  { code: "WAM-CNC-02", name: "CNC Router 02", model: "SCM Morbidelli M100", location: "Hall A · Bay 4", status: "maintenance" },
  { code: "WAM-LSR-02", name: "Fiber Laser 02", model: "Trumpf TruLaser 1030", location: "Hall B · Bay 1", status: "operational" },
  { code: "WAM-PRT-03", name: "UV Printer 03", model: "Mimaki UJF-7151", location: "Hall C · Bay 2", status: "operational" },
  { code: "WAM-EDG-04", name: "Edge Bander 04", model: "Holz-Her Streamer 1057", location: "Hall A · Bay 1", status: "out_of_service" },
];

export const EMPLOYEES: Employee[] = [
  { id: "OP-104", name: "Nikos Papadakis", department: "Machining", title: "CNC Operator", status: "active" },
  { id: "OP-117", name: "Eleni Markou", department: "Cutting", title: "Laser Operator", status: "active" },
  { id: "OP-121", name: "Giorgos Alexiou", department: "Machining", title: "CNC Operator", status: "active" },
  { id: "OP-130", name: "Maria Iliopoulou", department: "Finishing", title: "Print Technician", status: "active" },
  { id: "OP-133", name: "Dimitris Karras", department: "Assembly", title: "Cabinet Maker", status: "active" },
  { id: "OP-140", name: "Sofia Antoniou", department: "Quality", title: "QC Inspector", status: "active" },
  { id: "OP-142", name: "Yannis Vlachos", department: "Assembly", title: "Cabinet Maker", status: "on_leave" },
  { id: "OP-150", name: "Katerina Zervou", department: "Design", title: "CAD Designer", status: "active" },
  { id: "OP-155", name: "Petros Lambrou", department: "Logistics", title: "Warehouse Lead", status: "active" },
];

export const MATERIALS: Material[] = [
  { id: "M01", code: "WAL-18", name: "American walnut 18mm", unit: "m²", minQty: 12, supplier: "Xylemporiki SA", unitCost: 92 },
  { id: "M02", code: "OAK-25", name: "White oak 25mm", unit: "m²", minQty: 10, supplier: "Xylemporiki SA", unitCost: 78 },
  { id: "M03", code: "MDF-22V", name: "Walnut-veneered MDF 22mm", unit: "sheet", minQty: 8, supplier: "Finsa Hellas", unitCost: 64 },
  { id: "M04", code: "SS304-3", name: "Stainless steel 304, 3mm", unit: "kg", minQty: 150, supplier: "Sidenor", unitCost: 4.2 },
  { id: "M05", code: "BRS-15", name: "Brass sheet 1.5mm", unit: "kg", minQty: 40, supplier: "Elval Colour", unitCost: 11.5 },
  { id: "M06", code: "ACR-5", name: "Clear acrylic 5mm", unit: "sheet", minQty: 15, supplier: "Plexi Hellas", unitCost: 38 },
  { id: "M07", code: "UV-INK-W", name: "UV ink, white", unit: "L", minQty: 2, supplier: "Mimaki Europe", unitCost: 145 },
  { id: "M08", code: "EDGE-WAL", name: "Walnut edge tape 23mm", unit: "m", minQty: 300, supplier: "Rehau", unitCost: 0.9 },
  { id: "M09", code: "BIT-6C", name: "6mm compression bit", unit: "pcs", minQty: 6, supplier: "Leitz", unitCost: 58 },
  { id: "M10", code: "OIL-HW", name: "Hardwax oil, satin", unit: "L", minQty: 5, supplier: "Osmo", unitCost: 41 },
];

export const STOCK_BALANCES: StockBalance[] = [
  ["M01", "Rack R1", 6.4], ["M01", "Hall A", 2.1], ["M02", "Rack R1", 14.8], ["M03", "Rack R2", 5], ["M03", "Hall A", 2],
  ["M04", "Metal store", 212], ["M05", "Metal store", 22.5], ["M06", "Rack R3", 31], ["M07", "Print room", 1.2],
  ["M08", "Rack R2", 640], ["M09", "Tool cabinet", 4], ["M10", "Finishing", 9.5],
].map(([materialId, location, qty]) => ({ materialId: materialId as string, location: location as string, qty: qty as number }));

const PLAN_DEFS: [string, string, number, number][] = [
  ["WAM-CNC-01", "Spindle lubrication", 7, -9], ["WAM-CNC-01", "Vacuum pump service", 90, -40], ["WAM-CNC-01", "Linear guide cleaning", 14, -14],
  ["WAM-CNC-02", "Spindle bearing replacement", 365, -370], ["WAM-CNC-02", "Spindle lubrication", 7, -3],
  ["WAM-LSR-02", "Protective lens cleaning", 3, -1], ["WAM-LSR-02", "Chiller filter change", 60, -48], ["WAM-LSR-02", "Nozzle centring check", 7, -7],
  ["WAM-PRT-03", "Print head deep clean", 30, -12], ["WAM-PRT-03", "UV lamp replacement", 180, -170],
  ["WAM-EDG-04", "Glue pot cleaning", 14, -30],
];
export const MAINTENANCE_PLANS: MaintenancePlan[] = PLAN_DEFS.map(([machineCode, title, intervalDays, last], i) => ({
  id: `MP-${String(i + 1).padStart(3, "0")}`, machineCode, title, intervalDays, lastDoneAt: dayISO(last, 8),
}));
export const MAINTENANCE_RECORDS: MachineMaintenance[] = MAINTENANCE_PLANS.flatMap((p) => {
  const out: MachineMaintenance[] = [];
  const last = (new Date(p.lastDoneAt).getTime() - today0) / DAY;
  for (let k = 0; k < 4; k++) {
    const off = Math.round(last - k * p.intervalDays);
    if (off < -120) break;
    out.push({ id: `MM-${p.id}-${k}`, planId: p.id, machineCode: p.machineCode, title: p.title, doneAt: dayISO(off, 8, 30), by: pick(EMPLOYEES).name, note: k === 0 ? "Completed per checklist." : "Routine — no issues found." });
  }
  return out;
}).concat([{ id: "MM-X1", machineCode: "WAM-EDG-04", title: "Pressure roller fault reported", doneAt: dayISO(-2, 15), by: "Dimitris Karras", note: "Roller bearing seized. Machine taken out of service, spare part ordered." }]);

const PRODUCTS: [string, string, string, string][] = [
  ["Custom Walnut Panel", "WAM-CNC-01", "M01", "Machining"], ["Oak Shelf Brackets", "WAM-CNC-01", "M02", "Machining"],
  ["Reception Desk Front", "WAM-CNC-02", "M03", "Machining"], ["Steel Signage Letters", "WAM-LSR-02", "M04", "Laser cutting"],
  ["Brass Name Plates", "WAM-LSR-02", "M05", "Laser cutting"], ["Acrylic Menu Boards", "WAM-PRT-03", "M06", "UV printing"],
  ["Wine Display Rack", "WAM-CNC-01", "M02", "Machining"], ["Brass Inlay Coasters", "WAM-CNC-01", "M01", "Machining"],
];
const FOLLOW: Record<string, [string, string][]> = {
  Machining: [["Edge banding", "WAM-EDG-04"], ["Finishing & oiling", "WAM-PRT-03"]],
  "Laser cutting": [["Deburr & brush", "WAM-LSR-02"]],
  "UV printing": [["Lamination", "WAM-PRT-03"]],
};
const operatorFor = (m: string) => (m.includes("CNC") ? pick(["OP-104", "OP-121"]) : m.includes("LSR") ? "OP-117" : m.includes("PRT") ? "OP-130" : "OP-133");

export const ORDERS: CustomerOrder[] = [];
export const JOBS: Job[] = [];
export const FINANCIAL_RECORDS: FinancialRecord[] = [];

// Historical delivered orders (last ~150 days) feed the trend charts.
let n = 980;
for (let d = -150; d <= -4; d += int(1, 3)) {
  const [title, machine, mat, firstStep] = pick(PRODUCTS);
  const id = `ORD-${n++}`;
  const customer = pick(CUSTOMERS);
  const qty = int(2, 30);
  const delivered = d + int(3, 7);
  const lateBy = r() < 0.15 ? int(1, 4) : 0;
  ORDERS.push({ id, customerId: customer.id, title, quantity: qty, templateRev: `rev ${int(1, 4)}`, approval: "approved", status: delivered <= -1 ? "delivered" : "ready", createdAt: dayISO(d - 6), deadline: dayISO(delivered - lateBy), deliveredAt: delivered <= -1 ? dayISO(delivered, 16) : undefined, qc: { result: "pass", note: "Dimensions and finish within tolerance.", at: dayISO(delivered - 1, 14) } });
  const steps: [string, string][] = [[firstStep, machine], ...(FOLLOW[firstStep] ?? [])];
  steps.forEach(([name, m], i) => {
    const off = d + i;
    JOBS.push({ id: `JOB-${id.slice(4)}-${i + 1}`, orderId: id, name: `${name} · ${title}`, sequence: i + 1, machineCode: m, employeeId: operatorFor(m), status: "completed", instructions: "Per drawing.", materialId: i === 0 ? mat : undefined, materialQty: i === 0 ? int(1, 8) : undefined, quantityDone: qty, startedAt: dayISO(off, 8, 15), completedAt: dayISO(off, int(10, 16), int(0, 59)) });
  });
  const amount = int(4, 60) * 50;
  const paidFull = delivered < -35 || r() < 0.6;
  FINANCIAL_RECORDS.push({ id: `FR-S-${id}`, ref: `INV-${id.slice(4)}`, type: "sale", category: "Product sales", counterparty: customer.name, amount, paid: paidFull ? amount : r() < 0.5 ? Math.round(amount * 0.5) : 0, date: dayISO(delivered), dueDate: dayISO(delivered + 30), orderId: id });
}

// Current open pipeline — explicit so alerts and drill-downs are meaningful.
const OPEN: [string, number, OrderStatus, number, CustomerOrder["approval"]][] = [
  // product index, customer index, status, deadline offset, approval
  [0, 0, "in_production", 3, "approved"], [1, 1, "in_production", 6, "approved"], [2, 2, "in_production", -2, "approved"],
  [3, 4, "in_production", 1, "approved"], [7, 3, "in_production", -1, "approved"], [5, 6, "qc", 2, "approved"],
  [4, 5, "qc", -3, "approved"], [6, 8, "ready", 1, "approved"], [0, 7, "awaiting_approval", 12, "pending"],
  [3, 7, "awaiting_approval", 15, "changes_requested"], [1, 2, "planned", 9, "approved"], [5, 0, "planned", 11, "approved"],
  [6, 1, "submitted", 20, "pending"], [2, 8, "submitted", 25, "pending"], [4, 3, "cancelled", 5, "approved"],
];
const BASE = 1040;
OPEN.forEach(([p, c, status, dl, approval], i) => {
  const [title, machine, mat, firstStep] = PRODUCTS[p]!;
  const id = `ORD-${BASE + i}`;
  const qty = int(2, 24);
  ORDERS.push({ id, customerId: CUSTOMERS[c]!.id, title, quantity: qty, templateRev: `rev ${int(1, 3)}`, approval, status, createdAt: dayISO(-int(5, 14)), deadline: dayISO(dl), qc: status === "ready" ? { result: "pass", note: "Approved for delivery.", at: dayISO(-1, 15) } : status === "qc" && i === 6 ? { result: "fail", note: "Engraving depth inconsistent on 2 plates — rework.", at: dayISO(0, 10) } : undefined });
  if (["submitted", "awaiting_approval", "cancelled"].includes(status)) return;
  const steps: [string, string][] = [[firstStep, machine], ...(FOLLOW[firstStep] ?? [])];
  steps.forEach(([name, m], k) => {
    let st: Job["status"] = "pending";
    if (status === "qc" || status === "ready") st = "completed";
    else if (status === "in_production") st = k === 0 ? (i % 2 ? "completed" : "active") : k === 1 && i % 2 ? (m === "WAM-EDG-04" ? "blocked" : "active") : "pending";
    const done = st === "completed";
    JOBS.push({
      id: `JOB-${id.slice(4)}-${k + 1}`, orderId: id, name: `${name} · ${title}`, sequence: k + 1, machineCode: m,
      employeeId: st === "pending" && status === "planned" ? undefined : operatorFor(m), status: st,
      blockedReason: st === "blocked" ? "Edge Bander 04 out of service — awaiting spare part." : undefined,
      instructions: k === 0 ? "Follow template; face side down; leave 0.3mm skin on through-cuts." : "Continue from previous step; check edge alignment.",
      materialId: k === 0 ? mat : undefined, materialQty: k === 0 ? int(1, 6) : undefined,
      quantityDone: done ? qty : st === "active" ? Math.floor(qty / 2) : 0,
      startedAt: st !== "pending" && st !== "blocked" ? dayISO(-int(0, 2), 8, 10) : undefined,
      completedAt: done ? dayISO(-int(0, 2), 13, int(0, 59)) : undefined,
    });
  });
  if (status === "ready" || status === "qc") {
    const amount = int(10, 40) * 50;
    FINANCIAL_RECORDS.push({ id: `FR-S-${id}`, ref: `INV-${id.slice(4)}`, type: "sale", category: "Product sales", counterparty: CUSTOMERS[c]!.name, amount, paid: 0, date: dayISO(-1), dueDate: dayISO(29), orderId: id });
  }
});

// Purchases, expenses, refunds over ~6 months.
for (let m = 5; m >= 0; m--) {
  const base = -m * 30;
  const items: [FinancialRecord["type"], string, string, number][] = [
    ["purchase", "Raw materials", "Xylemporiki SA", int(2800, 4200)], ["purchase", "Raw materials", "Sidenor", int(900, 1600)],
    ["purchase", "Consumables", "Leitz", int(300, 700)], ["expense", "Energy", "DEI", int(1100, 1700)],
    ["expense", "Rent", "Kifisias Properties", 2400], ["expense", "Maintenance", "Trumpf Service", int(0, 1) ? int(300, 900) : 0],
    ["expense", "Logistics", "ACS Courier", int(250, 550)],
  ];
  items.filter((x) => x[3] > 0).forEach(([type, category, counterparty, amount], i) => {
    const date = base - int(0, 25);
    FINANCIAL_RECORDS.push({ id: `FR-${type[0]}-${m}-${i}`, ref: `${type === "purchase" ? "PO" : "EX"}-${26 * 100 + m * 10 + i}`, type, category, counterparty, amount, paid: date < -40 || r() < 0.5 ? amount : 0, date: dayISO(date), dueDate: dayISO(date + 30) });
  });
}
FINANCIAL_RECORDS.push({ id: "FR-R-1", ref: "CN-0091", type: "refund", category: "Product sales", counterparty: "Kafeneio 1912", amount: 180, paid: 180, date: dayISO(-12), dueDate: dayISO(-12) });

// Attendance — only recorded rows; a missing row means "not recorded", never "absent".
export const ATTENDANCE: Attendance[] = [];
for (let d = -45; d <= 0; d++) {
  const wd = new Date(today0 + d * DAY).getDay();
  if (wd === 0 || wd === 6) continue;
  for (const e of EMPLOYEES) {
    if (e.status === "on_leave" && d > -8) { ATTENDANCE.push({ id: `A-${e.id}-${d}`, employeeId: e.id, date: dayISO(d, 0), status: "leave" }); continue; }
    const x = r();
    if (d === 0 && e.id === "OP-155") continue; // not yet recorded today
    if (x < 0.05) continue;
    ATTENDANCE.push({ id: `A-${e.id}-${d}`, employeeId: e.id, date: dayISO(d, 0), status: x < 0.1 ? "absent" : "present", checkIn: x < 0.1 ? undefined : dayISO(d, 7, int(30, 59)) });
  }
}

// Stock movements: deliveries plus consumption linked to completed jobs.
export const STOCK_MOVEMENTS: StockMovement[] = JOBS.filter((j) => j.materialId && j.completedAt && new Date(j.completedAt).getTime() > today0 - 60 * DAY)
  .map((j) => ({ id: `SM-${j.id}`, materialId: j.materialId!, at: j.completedAt!, type: "out" as const, qty: -(j.materialQty ?? 1), jobId: j.id, note: `Issued to ${j.id}` }))
  .concat(MATERIALS.flatMap((m, i) => [{ id: `SM-IN-${m.id}`, materialId: m.id, at: dayISO(-int(5, 50), 11), type: "in" as const, qty: m.minQty * 2, jobId: undefined, note: `Delivery from ${m.supplier}` }, ...(i % 4 === 0 ? [{ id: `SM-ADJ-${m.id}`, materialId: m.id, at: dayISO(-int(1, 20), 17), type: "adjust" as const, qty: -1, jobId: undefined, note: "Stock count correction" }] : [])]))
  .sort((a, b) => b.at.localeCompare(a.at));

export const DOCUMENTS: DocumentRec[] = [
  { id: "D01", title: "PNL-WAL-600x900 rev 3.dxf", kind: "drawing", classification: "internal", links: [{ type: "order", id: "ORD-1040" }, { type: "job", id: "JOB-1040-1" }], uploadedAt: dayISO(-8) },
  { id: "D02", title: "Reception desk — Hotel Elaia.pdf", kind: "drawing", classification: "internal", links: [{ type: "order", id: "ORD-1042" }], uploadedAt: dayISO(-11) },
  { id: "D03", title: "Biesse Rover A — operator manual.pdf", kind: "manual", classification: "internal", links: [{ type: "machine", id: "WAM-CNC-01" }], uploadedAt: dayISO(-300) },
  { id: "D04", title: "TruLaser 1030 maintenance guide.pdf", kind: "manual", classification: "internal", links: [{ type: "machine", id: "WAM-LSR-02" }], uploadedAt: dayISO(-260) },
  { id: "D05", title: "Edge Bander 04 — fault photos", kind: "photo", classification: "internal", links: [{ type: "machine", id: "WAM-EDG-04" }], uploadedAt: dayISO(-2) },
  { id: "D06", title: "QC report ORD-1046", kind: "certificate", classification: "internal", links: [{ type: "order", id: "ORD-1046" }], uploadedAt: dayISO(0) },
  { id: "D07", title: "Walnut FSC certificate 2026.pdf", kind: "certificate", classification: "internal", links: [{ type: "material", id: "M01" }], uploadedAt: dayISO(-60) },
  { id: "D08", title: "Invoice INV-1045.pdf", kind: "invoice", classification: "restricted", links: [{ type: "finance", id: "FR-S-ORD-1045" }, { type: "order", id: "ORD-1045" }], uploadedAt: dayISO(-1) },
  { id: "D09", title: "Signage letters — Marina Flisvos.ai", kind: "drawing", classification: "internal", links: [{ type: "order", id: "ORD-1043" }], uploadedAt: dayISO(-6) },
  { id: "D10", title: "Mimaki UJF-7151 manual.pdf", kind: "manual", classification: "internal", links: [{ type: "machine", id: "WAM-PRT-03" }], uploadedAt: dayISO(-400) },
];
