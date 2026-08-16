import { Router, type IRouter } from "express";
import { db, blogPostsTable, newsItemsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { GetBlogPostParams, GetNewsArticleParams } from "@workspace/api-zod";

const router: IRouter = Router();

// Blog
router.get("/blog", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"), 10)));
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ total: count() })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.published, true));
  const posts = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.published, true))
    .orderBy(desc(blogPostsTable.publishedAt))
    .limit(limit)
    .offset(offset);
  res.json({ posts, total: Number(totalRow?.total ?? 0), page, limit });
});

router.get("/blog/:slug", async (req, res): Promise<void> => {
  const params = GetBlogPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.slug, params.data.slug));
  if (!post || !post.published) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

// News
router.get("/news", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "10"), 10)));
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ total: count() })
    .from(newsItemsTable)
    .where(eq(newsItemsTable.published, true));
  const articles = await db
    .select()
    .from(newsItemsTable)
    .where(eq(newsItemsTable.published, true))
    .orderBy(desc(newsItemsTable.publishedAt))
    .limit(limit)
    .offset(offset);
  res.json({ articles, total: Number(totalRow?.total ?? 0), page, limit });
});

router.get("/news/:slug", async (req, res): Promise<void> => {
  const params = GetNewsArticleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const [article] = await db
    .select()
    .from(newsItemsTable)
    .where(eq(newsItemsTable.slug, params.data.slug));
  if (!article || !article.published) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(article);
});

export default router;
