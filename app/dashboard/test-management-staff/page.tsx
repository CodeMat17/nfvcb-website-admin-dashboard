"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TestManagementStaffPage() {
  const staff = useQuery(api.managementStaff.list);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Management Staff Test Page</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Temporary — for testing fetched management staff display.
        </p>
      </div>

      {staff === undefined && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {staff?.length === 0 && (
        <p className="text-muted-foreground text-center py-20">
          No staff members found.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {staff?.map((member) => (
          <div
            key={member._id}
            className="flex flex-col items-center text-center space-y-3 border rounded-xl p-6"
          >
            {member.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.imageUrl}
                alt={member.name}
                className="w-28 h-28 rounded-full object-cover"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                No image
              </div>
            )}

            <div>
              <p className="font-semibold text-lg leading-tight">{member.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {member.designation}
              </p>
            </div>

            <Badge variant="outline" className="text-xs">
              Order: {member.order}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
