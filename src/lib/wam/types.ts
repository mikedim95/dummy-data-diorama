export type Operator = { id: string; name: string; role: string; pin?: string };
export type MachineStatus = "operational" | "attention" | "down";
export type Machine = {
  code: string;
  name: string;
  model: string;
  location: string;
  status: MachineStatus;
};

export type MaintenancePriority = "safety" | "overdue" | "high" | "normal";
export type MaintenanceItem = {
  id: string;
  phase: "start" | "end";
  title: string;
  kind: "required" | "info";
  priority: MaintenancePriority;
  instructions?: string;
  dueNote?: string;
};
export type CheckState = "done" | "skipped";

export type TaskStatus = "pending" | "active" | "completed" | "blocked";
export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type Activity = {
  id: string;
  at: string;
  by: string;
  type: "comment" | "photo" | "status";
  text?: string | undefined;
  photos?: string[] | undefined;
};
export type Task = {
  plannedMaterials?: {
    materialId: string;
    name: string;
    unit: string;
    plannedQuantity: number;
    actualQuantity: number;
  }[];
  referenceFiles?: {
    id: string;
    title: string;
    filename: string;
    url: string;
    available: boolean;
  }[];
  recordVersion?: number;
  id: string;
  job: string;
  title: string;
  customer: string;
  machine: string;
  priority: TaskPriority;
  estMin: number;
  status: TaskStatus;
  blockedReason?: string;
  sequence: number;
  material: string;
  quantity: number;
  template: string;
  orderStage: string;
  instructions: string;
  files: string[];
  assignee?: string;
  startedAt?: string;
  completedAt?: string;
  activity: Activity[];
};
