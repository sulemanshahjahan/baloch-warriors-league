export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { getWallPosts } from "@/lib/actions/wall";
import { WallManager } from "@/components/admin/wall-manager";

export const metadata = { title: "Early Exit Wall" };

export default async function AdminWallPage() {
  await requireRole("EDITOR");
  const posts = await getWallPosts();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Early Exit Wall"
        description={`${posts.length} meme${posts.length !== 1 ? "s" : ""} on the wall`}
      />
      <main className="flex-1 p-6">
        <WallManager posts={posts} />
      </main>
    </div>
  );
}
