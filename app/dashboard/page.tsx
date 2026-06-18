import Link from "next/link";
import { Newspaper, Film, LayoutDashboard, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    href: "/dashboard/post-news",
    icon: Newspaper,
    label: "News",
    description: "Create, edit, and delete news articles.",
  },
  {
    href: "/dashboard/approved-movies",
    icon: Film,
    label: "Approved Movies",
    description: "Post and update monthly approved movies.",
  },
  {
    href: "/dashboard/management-staff",
    icon: Users,
    label: "Management Staff",
    description: "Upload and manage management staff profiles.",
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-nfvcb-green" />
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage site content from one place.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full hover:border-nfvcb-green transition-colors cursor-pointer">
              <CardContent className="flex items-start gap-4 py-6">
                <div className="p-2.5 rounded-lg bg-nfvcb-green/10 shrink-0">
                  <Icon className="h-5 w-5 text-nfvcb-green" />
                </div>
                <div>
                  <p className="font-semibold">{label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
