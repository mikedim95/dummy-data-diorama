// Shapes mirror WAM schema v4 entities (CUSTOMER, CUSTOMER_ORDER, JOB, ...).
export type OrderStatus = "submitted" | "planned" | "awaiting_approval" | "in_production" | "qc" | "ready" | "delivered" | "cancelled";
export type JobStatus = "pending" | "active" | "completed" | "blocked";

export type Customer = { id: string; name: string; city: string; email: string };
export type CustomerOrder = {
  id: string;
  number?: string;
  customerId: string;
  title: string;
  quantity: number;
  templateRev: string;
  approval: "approved" | "pending" | "changes_requested";
  status: OrderStatus;
  createdAt: string;
  deadline: string;
  deliveredAt?: string | undefined;
  qc?: { result: "pass" | "fail"; note: string; at: string } | undefined;
};
export type Job = {
  id: string;
  orderId: string;
  name: string;
  sequence: number;
  machineCode: string;
  employeeId?: string | undefined;
  status: JobStatus;
  blockedReason?: string | undefined;
  instructions: string;
  materialId?: string | undefined;
  materialQty?: number | undefined;
  quantityDone: number;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
};
export type Employee = { id: string; name: string; department: string; title: string; status: "active" | "on_leave" | "inactive" };
export type Attendance = { id: string; employeeId: string; date: string; status: "present" | "absent" | "leave"; checkIn?: string | undefined };
export type AdminMachine = { code: string; name: string; model: string; location: string; status: "operational" | "maintenance" | "out_of_service" };
export type MaintenancePlan = { id: string; machineCode: string; title: string; intervalDays: number; lastDoneAt: string; nextDueDate?: string | undefined };
export type MachineMaintenance = { id: string; planId?: string | undefined; machineCode: string; title: string; doneAt: string; by: string; note: string };
export type Material = { id: string; code: string; name: string; unit: string; minQty: number; supplier: string; unitCost: number };
export type StockBalance = { materialId: string; location: string; qty: number };
export type StockMovement = { id: string; materialId: string; at: string; type: "in" | "out" | "adjust"; qty: number; jobId?: string | undefined; note: string };
export type FinancialRecord = {
  id: string;
  ref: string;
  type: "sale" | "refund" | "purchase" | "expense" | "purchase_refund";
  category: string;
  counterparty: string;
  amount: number;
  paid: number;
  date: string;
  dueDate: string;
  orderId?: string | undefined;
};
export type DocumentRec = {
  id: string;
  title: string;
  kind: "drawing" | "manual" | "invoice" | "photo" | "certificate";
  classification: "internal" | "restricted";
  links: { type: "order" | "machine" | "job" | "material" | "finance"; id: string }[];
  uploadedAt: string;
};
