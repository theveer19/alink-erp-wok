import { Badge } from "@/components/ui/badge";
import { statusColor } from "@/lib/bookings";

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusColor(status)}>{status}</Badge>;
}
