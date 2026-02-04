import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { RequireAuth } from "../components/RequireAuth";
import { supabase } from "../lib/supabase";

interface FeedPost {
  id: string;
  added_at: string;
  lists: {
    id: string;
    name: string;
    slug: string;
    visibility: string;
    owner_id: string;
  };
  username: string | null;
}

export default function FeedPage() {
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFeed = async () => {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Get feed posts with lists
        const { data: feedData, error: fetchError } = await supabase
          .from("feed_posts")
          .select(
            `
            id,
            added_at,
            lists!inner(
              id,
              name,
              slug,
              visibility,
              owner_id
            )
          `
          )
          .eq("lists.visibility", "public")
          .order("added_at", { ascending: false })
          .limit(50);

        if (fetchError) {
          if (import.meta.env.DEV) {
            console.error("Error loading feed:", fetchError);
          }
          setError("Failed to load feed. Please try again.");
          setLoading(false);
          return;
        }

        if (!feedData || feedData.length === 0) {
          setFeedPosts([]);
          setLoading(false);
          return;
        }

        // Step 2: Get unique owner IDs
        const ownerIds = [
          ...new Set(
            feedData
              .map((post) => {
                // Supabase returns lists as an object (not array) with !inner
                const lists = post.lists as unknown as {
                  id: string;
                  name: string;
                  slug: string;
                  visibility: string;
                  owner_id: string;
                };
                return lists?.owner_id;
              })
              .filter((id): id is string => Boolean(id))
          ),
        ];

        // Step 3: Fetch profiles for all owners
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", ownerIds);

        if (profilesError) {
          if (import.meta.env.DEV) {
            console.error("Error loading profiles:", profilesError);
          }
          // Continue without profiles - usernames will show as "Unknown"
        }

        // Step 4: Create a map of owner_id -> username
        const usernameMap = new Map<string, string>();
        if (profilesData) {
          profilesData.forEach((profile) => {
            if (profile.username) {
              usernameMap.set(profile.id, profile.username);
            }
          });
        }

        // Step 5: Combine feed posts with usernames
        const feedPostsWithUsernames: FeedPost[] = feedData.map((post) => {
          // Supabase returns lists as an object (not array) with !inner
          const listsData = post.lists as unknown as {
            id: string;
            name: string;
            slug: string;
            visibility: string;
            owner_id: string;
          };
          
          if (!listsData) {
            throw new Error("Missing lists data in feed post");
          }
          
          const list = {
            id: String(listsData.id),
            name: String(listsData.name),
            slug: String(listsData.slug),
            visibility: String(listsData.visibility),
            owner_id: String(listsData.owner_id),
          };
          
          return {
            id: post.id,
            added_at: post.added_at,
            lists: list,
            username: usernameMap.get(list.owner_id) || null,
          };
        });

        setFeedPosts(feedPostsWithUsernames);
        setLoading(false);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Unexpected error loading feed:", err);
        }
        setError("An unexpected error occurred");
        setLoading(false);
      }
    };

    loadFeed();
  }, []);

  if (loading) {
    return (
      <RequireAuth>
        <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Foodly Feed
          </h1>
          <p className="text-text/70">
            Discover public lists shared by the community
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {feedPosts.length === 0 ? (
          <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center md:p-12">
            <p className="text-lg text-text/60">No lists in feed yet.</p>
            <p className="mt-2 text-sm text-text/50">
              Be the first to share a list with the community!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedPosts.map((post) => {
              const username = post.username || "Unknown";
              const listName = post.lists.name;
              const listSlug = post.lists.slug;

              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-surface/60 bg-surface/30 p-6 shadow-neon-sm transition-all duration-300 hover:shadow-neon-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-text/60">
                          @{username}
                        </span>
                        <span className="text-text/40">•</span>
                        <span className="text-sm text-text/50">
                          {new Date(post.added_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h2 className="mb-3 text-xl font-semibold text-text">
                        {listName}
                      </h2>
                      <Link
                        to="/l/$slug"
                        params={{ slug: listSlug }}
                        className="inline-block rounded-lg border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
                      >
                        View List
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
