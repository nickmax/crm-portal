"use client";
import Link from "next/link";
import { useCrm } from "@/lib/crm/store";
import { Empty } from "@/components/crm/ui";
import type { Role } from "@/lib/crm/types";

// Client-side role gate for pages outside a role's permission table.
// APIs enforce their own gates server-side; this keeps the UI honest.
export function Gate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { currentUser } = useCrm();
  if (!roles.includes(currentUser.role)) {
    return (
      <div className="py-10">
        <Empty
          title="Not permitted"
          body={`Your ${currentUser.role} role doesn't include this area. Ask your administrator if you need access.`}
        />
        <Link href="/" className="mt-4 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm text-background">
          Back to home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
