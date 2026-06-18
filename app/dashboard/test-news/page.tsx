"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TestNewsPage() {
  const items = useQuery(api.news.list);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold">News Test Page</h1>
        <p className="text-muted-foreground text-sm mt-1">Temporary — for testing fetched news display.</p>
      </div>

      {items === undefined && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {items?.length === 0 && (
        <p className="text-muted-foreground text-center py-20">No articles found.</p>
      )}

      {items?.map((item) => (
        <article key={item._id} className="space-y-4 border-b pb-12 last:border-0">
          {item.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverImageUrl}
              alt={item.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {item.category && <Badge variant="outline">{item.category}</Badge>}
            {item.featured && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Featured
              </Badge>
            )}
          </div>

          <h2 className="text-2xl font-bold">{item.title}</h2>

          {item.author && (
            <p className="text-sm text-muted-foreground">By {item.author}</p>
          )}

          <div
            className="prose prose-sm dark:prose-invert max-w-none
              [&_p]:mb-4 [&_p:last-child]:mb-0
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul_li]:mb-1
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol_li]:mb-1
              [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4
              [&_a]:text-blue-600 [&_a]:underline
              [&_img]:rounded-md [&_img]:my-4 [&_img]:max-w-full
              [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:my-4
              [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-sm"
            dangerouslySetInnerHTML={{ __html: item.body }}
          />
        </article>
      ))}
    </div>
  );
}
