import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";

export function RecordShortcut({ entity, record }: { entity: string; record?: string }) {
  return (
    <Button asChild variant="metal" size="sm">
      <Link to="/admin/records" search={{ entity, ...(record ? { record } : {}) }}>
        <Database className="size-4" />
        Manage records
      </Link>
    </Button>
  );
}
