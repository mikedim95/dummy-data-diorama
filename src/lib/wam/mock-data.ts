// Demo data. Replace with WAM backend calls inside src/lib/wam/api.ts.
import type { Machine, MaintenanceItem, Operator, Task } from "./types";

export const OPERATORS: Operator[] = [
  { id: "OP-104", name: "Nikos Papadakis", role: "CNC Operator", pin: "1234" },
  { id: "OP-117", name: "Eleni Markou", role: "Laser Operator", pin: "1234" },
];

export const MACHINES: Machine[] = [
  { code: "WAM-CNC-01", name: "CNC Router 01", model: "Biesse Rover A 1532", location: "Hall A · Bay 3", status: "operational" },
  { code: "WAM-LSR-02", name: "Fiber Laser 02", model: "Trumpf TruLaser 1030", location: "Hall B · Bay 1", status: "attention" },
  { code: "WAM-PRT-03", name: "UV Printer 03", model: "Mimaki UJF-7151", location: "Hall C · Bay 2", status: "operational" },
];

const pre = (m: string, items: Omit<MaintenanceItem, "id" | "phase">[]): MaintenanceItem[] =>
  items.map((it, i) => ({ ...it, id: `${m}-pre-${i}`, phase: "start" }));
const post = (m: string, items: Omit<MaintenanceItem, "id" | "phase">[]): MaintenanceItem[] =>
  items.map((it, i) => ({ ...it, id: `${m}-end-${i}`, phase: "end" }));

export const MAINTENANCE: Record<string, MaintenanceItem[]> = {
  "WAM-CNC-01": [
    ...pre("cnc", [
      { title: "Verify emergency stop accessibility", kind: "required", priority: "safety", instructions: "Press and release both E-stops. Confirm the control panel reports the interlock and that nothing obstructs either button." },
      { title: "Check cutting tool condition", kind: "required", priority: "high", instructions: "Inspect the loaded tools (T1–T6) for chipped edges or burn marks. Replace any 6mm compression bit with more than 18h of runtime." },
      { title: "Spindle lubrication overdue", kind: "required", priority: "overdue", instructions: "Last performed 9 days ago (interval 7 days). Apply 2 shots of Kluber grease at the spindle nipple.", dueNote: "Overdue by 2 days" },
      { title: "Inspect dust extraction", kind: "required", priority: "normal", instructions: "Open the damper, check the hose for blockages and confirm suction gauge reads above 1800 Pa." },
      { title: "Clean working surface", kind: "required", priority: "normal", instructions: "Vacuum the spoilboard and remove offcuts so vacuum hold-down seals properly." },
      { title: "Walnut stock is acclimatised", kind: "info", priority: "normal", instructions: "Today's walnut was delivered Monday and has reached workshop humidity. No action needed." },
    ]),
    ...post("cnc", [
      { title: "Clean machine working area", kind: "required", priority: "normal", instructions: "Vacuum the bed, gantry rails and tool changer. Do not use compressed air near the linear guides." },
      { title: "Remove material leftovers", kind: "required", priority: "normal", instructions: "Return reusable offcuts to rack R2 and dispose of dust bags above 80% full." },
      { title: "Inspect tooling", kind: "required", priority: "high", instructions: "Log any worn tools in the comment so tomorrow's operator is aware." },
      { title: "Follow shutdown sequence", kind: "required", priority: "safety", instructions: "Park spindle at home → vacuum pump off → extraction off → main isolator off." },
      { title: "Report damage or malfunction", kind: "info", priority: "normal", instructions: "If anything sounded or behaved unusually, report it in the shift handover note." },
    ]),
  ],
  "WAM-LSR-02": [
    ...pre("lsr", [
      { title: "Confirm enclosure interlocks", kind: "required", priority: "safety", instructions: "Open each door and confirm the beam is inhibited." },
      { title: "Clean protective lens", kind: "required", priority: "overdue", instructions: "Use lens tissue and isopropyl alcohol only.", dueNote: "Overdue by 1 day" },
      { title: "Check assist gas pressure", kind: "required", priority: "high", instructions: "Nitrogen should read 14–16 bar." },
      { title: "Chiller running", kind: "info", priority: "normal", instructions: "Chiller should display 22°C before cutting." },
    ]),
    ...post("lsr", [
      { title: "Empty slag tray", kind: "required", priority: "normal", instructions: "Wear gloves; slag may be hot." },
      { title: "Close gas supply", kind: "required", priority: "safety", instructions: "Close the main nitrogen valve at the manifold." },
      { title: "Report damage or malfunction", kind: "info", priority: "normal", instructions: "Note anything unusual in the handover." },
    ]),
  ],
  "WAM-PRT-03": [
    ...pre("prt", [
      { title: "Run nozzle check", kind: "required", priority: "high", instructions: "Print the nozzle pattern and clean heads if lines are missing." },
      { title: "Clean the vacuum table", kind: "required", priority: "normal", instructions: "Wipe with a lint-free cloth." },
      { title: "UV lamp hours", kind: "info", priority: "normal", instructions: "Lamp at 1,840h of 2,000h. Replacement is scheduled." },
    ]),
    ...post("prt", [
      { title: "Cap the print heads", kind: "required", priority: "high", instructions: "Return heads to capping station to prevent drying." },
      { title: "Report damage or malfunction", kind: "info", priority: "normal", instructions: "Note anything unusual in the handover." },
    ]),
  ],
};

export const TASKS: Task[] = [
  { id: "t1042", job: "1042", title: "Custom Walnut Panel", customer: "Atelier Kostas", machine: "WAM-CNC-01", priority: "high", estMin: 45, status: "pending", sequence: 1, material: "American walnut, 18mm, FSC", quantity: 4, template: "PNL-WAL-600x900-v3.dxf", orderStage: "Stage 2 of 4 · Machining", instructions: "Face side down. Use 6mm compression bit for profile, 3mm ball nose for the engraved logo. Leave 0.3mm skin on through-cuts.", files: ["PNL-WAL-600x900-v3.dxf", "Logo-engrave.svg"], activity: [] },
  { id: "t1043", job: "1043", title: "Oak Shelf Brackets", customer: "Nordhaus Interiors", machine: "WAM-CNC-01", priority: "normal", estMin: 30, status: "pending", sequence: 2, material: "White oak, 25mm", quantity: 12, template: "BRK-OAK-L-v1.dxf", orderStage: "Stage 1 of 3 · Machining", instructions: "Nest 12 per sheet. Drill 8mm holes before profiling.", files: ["BRK-OAK-L-v1.dxf"], activity: [] },
  { id: "t1047", job: "1047", title: "Reception Desk Front", customer: "Hotel Elaia", machine: "WAM-CNC-01", priority: "urgent", estMin: 90, status: "pending", sequence: 0, material: "Walnut veneered MDF, 22mm", quantity: 2, template: "DSK-FRONT-ELAIA.dxf", orderStage: "Stage 2 of 5 · Machining", instructions: "Fluted pattern 10mm pitch. Check veneer direction matches drawing before clamping.", files: ["DSK-FRONT-ELAIA.dxf", "Veneer-direction.jpg"], activity: [] },
  { id: "t1039", job: "1039", title: "Brass Inlay Coasters", customer: "Kafeneio 1912", machine: "WAM-CNC-01", priority: "low", estMin: 25, status: "blocked", blockedReason: "Waiting for brass inlay strips — delivery expected 14:00.", sequence: 3, material: "Walnut 12mm + brass 2mm", quantity: 40, template: "CST-INLAY-90.dxf", orderStage: "Stage 1 of 2 · Machining", instructions: "Pocket depth 2.1mm for inlay.", files: ["CST-INLAY-90.dxf"], activity: [] },
  { id: "t2051", job: "2051", title: "Steel Signage Letters", customer: "Marina Flisvos", machine: "WAM-LSR-02", priority: "high", estMin: 60, status: "pending", sequence: 1, material: "Stainless 304, 3mm", quantity: 18, template: "SIGN-FLISVOS.dxf", orderStage: "Stage 1 of 3 · Cutting", instructions: "Nitrogen cut, micro-joints on letters under 40mm.", files: ["SIGN-FLISVOS.dxf"], activity: [] },
  { id: "t2052", job: "2052", title: "Brass Name Plates", customer: "Law Office Raptis", machine: "WAM-LSR-02", priority: "normal", estMin: 20, status: "pending", sequence: 2, material: "Brass 1.5mm", quantity: 6, template: "PLATE-RAPTIS.dxf", orderStage: "Stage 1 of 2 · Cutting", instructions: "Protective film side up.", files: ["PLATE-RAPTIS.dxf"], activity: [] },
  { id: "t3011", job: "3011", title: "Acrylic Menu Boards", customer: "Taverna Thalassa", machine: "WAM-PRT-03", priority: "normal", estMin: 40, status: "pending", sequence: 1, material: "Clear acrylic 5mm", quantity: 10, template: "MENU-THAL-A4.pdf", orderStage: "Stage 2 of 3 · Printing", instructions: "White underlayer, then CMYK. Reverse print.", files: ["MENU-THAL-A4.pdf"], activity: [] },
];
