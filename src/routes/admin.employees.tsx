import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { RecordShortcut } from "@/components/admin/RecordShortcut";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Briefcase, CalendarOff, Palmtree, UserCheck, Users } from "lucide-react";
import {
  chartTheme,
  DataList,
  KpiCard,
  Panel,
  PageHeader,
  Pill,
  useDrill,
  type AdminSearch,
  type Col,
} from "@/components/admin/ui";
import { db } from "@/lib/wam/admin-api";
import { attendanceToday, startOfDay, DAY } from "@/lib/wam/admin-logic";
import type { Employee } from "@/lib/wam/admin-types";

export const Route = createFileRoute("/admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees · WAM Management" },
      { name: "description", content: "Workforce, attendance and assignments." },
      { property: "og:title", content: "Employees · WAM Management" },
      { property: "og:description", content: "Workforce, attendance and assignments." },
    ],
  }),
  component: Employees,
});

function Employees() {
  useLanguage();
  const s = Route.useSearch() as AdminSearch;
  const { open, go } = useDrill();
  const att = attendanceToday(db.ATTENDANCE, db.EMPLOYEES);
  const t0 = startOfDay(Date.now());
  const todayRow = (id: string) =>
    db.ATTENDANCE.find((a) => a.employeeId === id && startOfDay(new Date(a.date).getTime()) === t0);
  const days = Math.min(Number(s.range ?? "7"), 30);
  const chart = Array.from({ length: Math.max(days, 7) }, (_, i) => {
    const d = t0 - (Math.max(days, 7) - 1 - i) * DAY;
    const rows = db.ATTENDANCE.filter((a) => startOfDay(new Date(a.date).getTime()) === d);
    return {
      label: new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      present: rows.filter((r) => r.status === "present").length,
      absent: rows.filter((r) => r.status === "absent").length,
      leave: rows.filter((r) => r.status === "leave").length,
    };
  }).filter((x) => x.present + x.absent + x.leave > 0);

  const rows = db.EMPLOYEES.filter((e) => s.f !== "today" || todayRow(e.id)?.status === "present");
  const cols: Col<Employee>[] = [
    {
      key: "n",
      label: "Employee",
      render: (e) => <span className="font-medium">{tv(e.name)}</span>,
    },
    { key: "d", label: "Department", render: (e) => e.department },
    { key: "t", label: "Title", render: (e) => e.title },
    {
      key: "a",
      label: "Today",
      render: (e) => {
        const r = todayRow(e.id);
        return r ? (
          <Pill
            tone={r.status === "present" ? "success" : r.status === "leave" ? "gold" : "critical"}
          >
            {tv(r.status)}
          </Pill>
        ) : (
          <Pill>{t("Not recorded")}</Pill>
        );
      },
    },
    {
      key: "j",
      label: "Open jobs",
      render: (e) =>
        db.JOBS.filter((j) => j.employeeId === e.id && j.status !== "completed").length,
    },
    {
      key: "w",
      label: "Active now",
      render: (e) =>
        db.JOBS.find((j) => j.employeeId === e.id && j.status === "active")?.name ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <RecordShortcut entity="EMPLOYEE" />
      </div>
      <PageHeader
        title={t("Employees")}
        subtitle={t(
          "Attendance shows recorded rows only — missing rows are 'not recorded', never absent.",
        )}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label={t("Active employees")}
          value={db.EMPLOYEES.filter((e) => e.status === "active").length}
          icon={Users}
          onClick={() => go("/admin/employees")}
        />
        <KpiCard
          label={t("Present today")}
          value={att.present}
          icon={UserCheck}
          onClick={() => go("/admin/employees", { f: "today" })}
        />
        <KpiCard
          label={t("Absent today")}
          value={att.absent}
          sub={t("Explicitly recorded")}
          icon={CalendarOff}
          onClick={() => go("/admin/employees")}
        />
        <KpiCard
          label={t("On leave")}
          value={att.leave}
          icon={Palmtree}
          onClick={() => go("/admin/employees")}
        />
        <KpiCard
          label={t("Active assignments")}
          value={db.JOBS.filter((j) => j.status === "active").length}
          icon={Briefcase}
          onClick={() => go("/admin/production", { f: "active" })}
        />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Panel title={t("Daily attendance")} className="xl:col-span-1">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={chartTheme.axis}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={10}
                />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={11}
                  allowDecimals={false}
                  width={24}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: "var(--elevated)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="present" name={t("Present")} stackId="a" fill="var(--success)" />
                <Bar dataKey="leave" name={t("Leave")} stackId="a" fill="var(--brass)" />
                <Bar
                  dataKey="absent"
                  name={t("Absent")}
                  stackId="a"
                  fill="var(--critical)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("{0} employees", rows.length)} className="xl:col-span-2">
          <DataList
            rows={rows}
            cols={cols}
            rowKey={(e) => e.id}
            onRow={(e) => open(`employee:${e.id}`)}
          />
        </Panel>
      </div>
    </>
  );
}
