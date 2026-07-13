export const revalidate = 300;

import type { Metadata } from "next";
import { Skull } from "lucide-react";
import { getWallPosts } from "@/lib/actions/wall";
import { WallGallery } from "@/components/public/wall-gallery";

export const metadata: Metadata = {
  title: "Early Exit Wall",
  description: "The wall of fame (and shame) — memes for BWL warriors who crashed out early.",
  openGraph: {
    title: "Early Exit Wall | Baloch Warriors League",
    description: "Memes celebrating the fallen warriors who exited their tournaments early.",
    type: "website",
  },
};

export default async function WallPage() {
  const posts = await getWallPosts();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Skull className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Hall of Shame
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Early Exit Wall</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            A loving tribute to the warriors who bowed out early. Get knocked out, get memed. 💀
          </p>
        </div>
      </section>

      {/* Gallery */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <Skull className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No early exits yet. The wall awaits its first casualty.
            </p>
          </div>
        ) : (
          <WallGallery posts={posts} />
        )}
      </div>
    </div>
  );
}
