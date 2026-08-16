import { useEffect, useState, useCallback } from 'react';
import { adminApi, type BlogPost, type NewsItem, type ContentInput } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMPTY_BLOG: ContentInput = { title: '', slug: '', excerpt: '', content: '', authorName: 'Midanic Team', published: false };
const EMPTY_NEWS: Omit<ContentInput, 'authorName'> = { title: '', slug: '', excerpt: '', content: '', published: false };

type SheetMode = 'blog' | 'news';

export default function AdminContent() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('blog');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [blogForm, setBlogForm] = useState<ContentInput>(EMPTY_BLOG);
  const [newsForm, setNewsForm] = useState<Omit<ContentInput, 'authorName'>>(EMPTY_NEWS);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; mode: SheetMode } | null>(null);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, n] = await Promise.all([adminApi.listBlog(), adminApi.listNews()]);
      setBlogs(b);
      setNews(n);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = (mode: SheetMode) => {
    setSheetMode(mode);
    setEditingId(null);
    if (mode === 'blog') setBlogForm(EMPTY_BLOG);
    else setNewsForm(EMPTY_NEWS);
    setSheetOpen(true);
  };

  const openEdit = (mode: SheetMode, item: BlogPost | NewsItem) => {
    setSheetMode(mode);
    setEditingId(item.id);
    if (mode === 'blog') {
      const b = item as BlogPost;
      setBlogForm({ title: b.title, slug: b.slug, excerpt: b.excerpt ?? '', content: b.content, authorName: b.authorName ?? '', published: b.published });
    } else {
      const n = item as NewsItem;
      setNewsForm({ title: n.title, slug: n.slug, excerpt: n.excerpt ?? '', content: n.content, published: n.published });
    }
    setSheetOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (sheetMode === 'blog') {
        if (editingId) {
          const updated = await adminApi.updateBlogPost(editingId, blogForm);
          setBlogs((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
        } else {
          const created = await adminApi.createBlogPost(blogForm);
          setBlogs((prev) => [created, ...prev]);
        }
      } else {
        if (editingId) {
          const updated = await adminApi.updateNewsItem(editingId, newsForm);
          setNews((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
        } else {
          const created = await adminApi.createNewsItem(newsForm);
          setNews((prev) => [created, ...prev]);
        }
      }
      toast({ title: editingId ? 'Updated' : 'Created' });
      setSheetOpen(false);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.mode === 'blog') {
        await adminApi.deleteBlogPost(deleteTarget.id);
        setBlogs((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      } else {
        await adminApi.deleteNewsItem(deleteTarget.id);
        setNews((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      }
      toast({ title: 'Deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const togglePublish = async (mode: SheetMode, id: number, published: boolean) => {
    try {
      if (mode === 'blog') {
        const updated = await adminApi.updateBlogPost(id, { published });
        setBlogs((prev) => prev.map((b) => (b.id === id ? updated : b)));
      } else {
        const updated = await adminApi.updateNewsItem(id, { published });
        setNews((prev) => prev.map((n) => (n.id === id ? updated : n)));
      }
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  function ContentTable({ mode, items }: { mode: SheetMode; items: (BlogPost | NewsItem)[] }) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openNew(mode)} className="gap-2">
            <Plus className="h-4 w-4" /> New {mode === 'blog' ? 'Post' : 'Article'}
          </Button>
        </div>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {mode === 'blog' && <TableHead>Author</TableHead>}
                <TableHead>Published</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: mode === 'blog' ? 5 : 4 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                    ))}</TableRow>
                  ))
                : items.length === 0
                ? <TableRow><TableCell colSpan={mode === 'blog' ? 5 : 4} className="text-center text-muted-foreground py-8">No content yet</TableCell></TableRow>
                : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-xs truncate">{item.title}</TableCell>
                    {mode === 'blog' && <TableCell className="text-sm text-muted-foreground">{(item as BlogPost).authorName ?? '—'}</TableCell>}
                    <TableCell>
                      <Switch
                        checked={item.published}
                        onCheckedChange={(v) => togglePublish(mode, item.id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(mode, item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: item.id, mode })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage blog posts and news articles</p>
      </div>

      <Tabs defaultValue="blog">
        <TabsList>
          <TabsTrigger value="blog">Blog Posts ({blogs.length})</TabsTrigger>
          <TabsTrigger value="news">News ({news.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="blog" className="mt-4"><ContentTable mode="blog" items={blogs} /></TabsContent>
        <TabsContent value="news" className="mt-4"><ContentTable mode="news" items={news} /></TabsContent>
      </Tabs>

      {/* Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingId ? 'Edit' : 'New'} {sheetMode === 'blog' ? 'Blog Post' : 'News Article'}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {sheetMode === 'blog' ? (
              <>
                <Field label="Title *" value={blogForm.title} onChange={(v) => setBlogForm((p) => ({ ...p, title: v }))} />
                <Field label="Slug *" value={blogForm.slug} onChange={(v) => setBlogForm((p) => ({ ...p, slug: v }))} />
                <Field label="Author" value={blogForm.authorName ?? ''} onChange={(v) => setBlogForm((p) => ({ ...p, authorName: v }))} />
                <Field label="Excerpt" value={blogForm.excerpt ?? ''} onChange={(v) => setBlogForm((p) => ({ ...p, excerpt: v }))} />
                <TextareaField label="Content *" value={blogForm.content} onChange={(v) => setBlogForm((p) => ({ ...p, content: v }))} />
                <div className="flex items-center gap-3">
                  <Switch id="pub" checked={blogForm.published} onCheckedChange={(v) => setBlogForm((p) => ({ ...p, published: v }))} />
                  <Label htmlFor="pub">Published</Label>
                </div>
              </>
            ) : (
              <>
                <Field label="Title *" value={newsForm.title} onChange={(v) => setNewsForm((p) => ({ ...p, title: v }))} />
                <Field label="Slug *" value={newsForm.slug} onChange={(v) => setNewsForm((p) => ({ ...p, slug: v }))} />
                <Field label="Excerpt" value={newsForm.excerpt ?? ''} onChange={(v) => setNewsForm((p) => ({ ...p, excerpt: v }))} />
                <TextareaField label="Content *" value={newsForm.content} onChange={(v) => setNewsForm((p) => ({ ...p, content: v }))} />
                <div className="flex items-center gap-3">
                  <Switch id="pub2" checked={newsForm.published} onCheckedChange={(v) => setNewsForm((p) => ({ ...p, published: v }))} />
                  <Label htmlFor="pub2">Published</Label>
                </div>
              </>
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
