import { useEffect, useState, useCallback, useRef } from 'react';
import {
  adminApi,
  type AdminProduct,
  type ProductInput,
  type AdminProductVersion,
  type VersionInput,
  type AdminDownloadFile,
  type DownloadInput,
} from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Star, Download, Tag, Upload, ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToStorage } from '@/lib/storage-upload';

const LICENSE_TYPES = [
  { value: 'trial', label: 'Trial' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
];

const PLATFORMS = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'web', label: 'Web' },
];

const EMPTY_PRODUCT: ProductInput = {
  name: '', slug: '', description: '', shortDescription: '',
  category: '', imageUrl: '', videoUrl: '', defaultLicenseType: '',
  featured: false, published: false, trialDays: undefined, basePrice: undefined, sortOrder: 0,
};

const EMPTY_VERSION: VersionInput = {
  version: '', releaseNotes: '', isLatest: false,
  releasedAt: new Date().toISOString().slice(0, 10),
};

const EMPTY_DOWNLOAD: DownloadInput = {
  fileName: '', fileSize: 0, platform: 'windows', version: '',
  downloadUrl: '', versionId: undefined, isPublic: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Product sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Versions
  const [versions, setVersions] = useState<AdminProductVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<AdminProductVersion | null>(null);
  const [versionForm, setVersionForm] = useState<VersionInput>(EMPTY_VERSION);
  const [savingVersion, setSavingVersion] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<number | null>(null);

  // Downloads
  const [downloads, setDownloads] = useState<AdminDownloadFile[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const [editingDownload, setEditingDownload] = useState<AdminDownloadFile | null>(null);
  const [downloadForm, setDownloadForm] = useState<DownloadInput>(EMPTY_DOWNLOAD);
  const [savingDownload, setSavingDownload] = useState(false);
  const [deleteDownloadId, setDeleteDownloadId] = useState<number | null>(null);

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  // ── Products ──────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await adminApi.listProducts());
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setVersions([]);
    setDownloads([]);
    setSheetOpen(true);
  };

  const openEdit = async (p: AdminProduct) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, description: p.description,
      shortDescription: p.shortDescription ?? '',
      category: p.category,
      imageUrl: p.imageUrl ?? '',
      videoUrl: p.videoUrl ?? '',
      defaultLicenseType: p.defaultLicenseType ?? '',
      featured: p.featured, published: p.published,
      trialDays: p.trialDays ?? undefined,
      basePrice: p.basePrice ?? undefined,
      sortOrder: p.sortOrder,
    });
    setSheetOpen(true);
    // Load versions and downloads in parallel
    setVersionsLoading(true);
    setDownloadsLoading(true);
    try {
      const [v, d] = await Promise.all([
        adminApi.listProductVersions(p.id),
        adminApi.listProductDownloads(p.id),
      ]);
      setVersions(v);
      setDownloads(d);
    } catch (e: unknown) {
      toast({ title: 'Error loading product data', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setVersionsLoading(false);
      setDownloadsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.description || !form.category) {
      toast({ title: 'Validation error', description: 'Name, slug, description and category are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        defaultLicenseType: form.defaultLicenseType || undefined,
      };
      if (editing) {
        const updated = await adminApi.updateProduct(editing.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
        setEditing(updated);
        toast({ title: 'Product updated' });
      } else {
        const created = await adminApi.createProduct(payload);
        setProducts((prev) => [...prev, created]);
        setEditing(created);
        toast({ title: 'Product created — add versions and downloads below' });
      }
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await adminApi.deleteProduct(deleteId);
      setProducts((prev) => prev.filter((p) => p.id !== deleteId));
      toast({ title: 'Product deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  // ── Versions ──────────────────────────────────────────────────────────────
  const openNewVersion = () => {
    setEditingVersion(null);
    setVersionForm({ ...EMPTY_VERSION, releasedAt: new Date().toISOString().slice(0, 10) });
    setVersionSheetOpen(true);
  };

  const openEditVersion = (v: AdminProductVersion) => {
    setEditingVersion(v);
    setVersionForm({
      version: v.version,
      releaseNotes: v.releaseNotes ?? '',
      isLatest: v.isLatest,
      releasedAt: v.releasedAt.slice(0, 10),
    });
    setVersionSheetOpen(true);
  };

  const handleSaveVersion = async () => {
    if (!editing || !versionForm.version) {
      toast({ title: 'Validation error', description: 'Version number is required.', variant: 'destructive' });
      return;
    }
    setSavingVersion(true);
    try {
      if (editingVersion) {
        const updated = await adminApi.updateProductVersion(editing.id, editingVersion.id, versionForm);
        setVersions((prev) => prev.map((v) => (v.id === editingVersion.id ? updated : v)));
        toast({ title: 'Version updated' });
      } else {
        const created = await adminApi.createProductVersion(editing.id, versionForm);
        setVersions((prev) => [created, ...prev]);
        toast({ title: 'Version added' });
      }
      setVersionSheetOpen(false);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingVersion(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deleteVersionId || !editing) return;
    try {
      await adminApi.deleteProductVersion(editing.id, deleteVersionId);
      setVersions((prev) => prev.filter((v) => v.id !== deleteVersionId));
      toast({ title: 'Version deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleteVersionId(null);
    }
  };

  const handleSetLatest = async (versionId: number) => {
    if (!editing) return;
    try {
      const updated = await adminApi.setLatestVersion(editing.id, versionId);
      setVersions((prev) => prev.map((v) => ({
        ...v,
        isLatest: v.id === updated.id,
      })));
      toast({ title: 'Latest version updated' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // ── Downloads ─────────────────────────────────────────────────────────────
  const openNewDownload = () => {
    setEditingDownload(null);
    setDownloadForm(EMPTY_DOWNLOAD);
    setDownloadSheetOpen(true);
  };

  const openEditDownload = (d: AdminDownloadFile) => {
    setEditingDownload(d);
    setDownloadForm({
      fileName: d.fileName,
      fileSize: d.fileSize,
      platform: d.platform,
      version: d.version ?? '',
      downloadUrl: d.downloadUrl,
      versionId: d.versionId ?? undefined,
      isPublic: d.isPublic,
    });
    setDownloadSheetOpen(true);
  };

  const handleSaveDownload = async () => {
    if (!editing || !downloadForm.fileName || !downloadForm.downloadUrl || !downloadForm.platform) {
      toast({ title: 'Validation error', description: 'File name, URL and platform are required.', variant: 'destructive' });
      return;
    }
    setSavingDownload(true);
    try {
      const payload = {
        ...downloadForm,
        version: downloadForm.version || undefined,
        versionId: downloadForm.versionId || undefined,
      };
      if (editingDownload) {
        const updated = await adminApi.updateProductDownload(editing.id, editingDownload.id, payload);
        setDownloads((prev) => prev.map((d) => (d.id === editingDownload.id ? updated : d)));
        toast({ title: 'Download file updated' });
      } else {
        const created = await adminApi.createProductDownload(editing.id, payload);
        setDownloads((prev) => [created, ...prev]);
        toast({ title: 'Download file added' });
      }
      setDownloadSheetOpen(false);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDeleteDownload = async () => {
    if (!deleteDownloadId || !editing) return;
    try {
      await adminApi.deleteProductDownload(editing.id, deleteDownloadId);
      setDownloads((prev) => prev.filter((d) => d.id !== deleteDownloadId));
      toast({ title: 'Download file deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleteDownloadId(null);
    }
  };

  // ── Upload handlers ───────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadFileToStorage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast({ title: 'Image uploaded successfully' });
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const url = await uploadFileToStorage(file);
      setDownloadForm((prev) => ({
        ...prev,
        downloadUrl: url,
        fileName: prev.fileName || file.name,
        fileSize: file.size,
      }));
      toast({ title: 'File uploaded — name, size and URL filled automatically' });
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const f = (key: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} products</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      {/* Products table */}
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : products.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No products yet</TableCell>
                </TableRow>
              )
              : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell>
                    {p.defaultLicenseType
                      ? <Badge variant="secondary" className="gap-1"><Tag className="h-3 w-3" />{p.defaultLicenseType}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>{p.basePrice != null ? `${p.basePrice.toLocaleString()} DZD` : '—'}</TableCell>
                  <TableCell>
                    <Badge className={p.published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600'}>
                      {p.published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.featured && <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30">Featured</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Product Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { if (!o) setSheetOpen(false); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit: ${editing.name}` : 'New Product'}</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="versions" className="flex-1" disabled={!editing}>
                Versions {editing && versions.length > 0 && `(${versions.length})`}
              </TabsTrigger>
              <TabsTrigger value="downloads" className="flex-1" disabled={!editing}>
                Downloads {editing && downloads.length > 0 && `(${downloads.length})`}
              </TabsTrigger>
            </TabsList>

            {/* ── Details Tab ────────────────────────────────────────── */}
            <TabsContent value="details" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={f('name')} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Slug *</Label>
                  <Input value={form.slug} onChange={f('slug')} placeholder="my-product" />
                </div>
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <Input value={form.category} onChange={f('category')} placeholder="erp / education / desktop…" />
                </div>
                <div className="space-y-1">
                  <Label>Default License Type</Label>
                  <Select
                    value={form.defaultLicenseType ?? ''}
                    onValueChange={(v) => setForm((p) => ({ ...p, defaultLicenseType: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select license type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {LICENSE_TYPES.map((lt) => (
                        <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Base Price (DZD)</Label>
                  <Input type="number" value={form.basePrice ?? ''} onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div className="space-y-1">
                  <Label>Trial Days</Label>
                  <Input type="number" value={form.trialDays ?? ''} onChange={(e) => setForm((p) => ({ ...p, trialDays: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Product Image</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.imageUrl ?? ''}
                      onChange={f('imageUrl')}
                      placeholder="https://… or upload below"
                      className="flex-1"
                    />
                    {form.imageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))}
                        title="Clear image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {uploadingImage ? (
                        <span className="animate-pulse">Uploading…</span>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> Upload Image</>
                      )}
                    </Button>
                    {form.imageUrl && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <img
                          src={form.imageUrl}
                          alt="preview"
                          className="h-8 w-8 rounded object-cover border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Intro Video URL</Label>
                  <Input value={form.videoUrl ?? ''} onChange={f('videoUrl')} placeholder="https://youtube.com/…" />
                </div>
                <div className="space-y-1">
                  <Label>Sort Order</Label>
                  <Input type="number" value={form.sortOrder ?? 0} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Short Description</Label>
                  <Input value={form.shortDescription ?? ''} onChange={f('shortDescription')} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Description *</Label>
                  <Textarea rows={4} value={form.description} onChange={f('description')} />
                </div>
                <div className="flex items-center gap-3 col-span-2">
                  <Switch id="published" checked={form.published} onCheckedChange={(v) => setForm((p) => ({ ...p, published: v }))} />
                  <Label htmlFor="published">Published</Label>
                  <Switch id="featured" checked={form.featured} onCheckedChange={(v) => setForm((p) => ({ ...p, featured: v }))} className="ml-4" />
                  <Label htmlFor="featured">Featured</Label>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Product')}</Button>
              </SheetFooter>
            </TabsContent>

            {/* ── Versions Tab ───────────────────────────────────────── */}
            <TabsContent value="versions" className="py-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={openNewVersion} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Version
                </Button>
              </div>
              {versionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No versions yet. Add the first version.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Released</TableHead>
                        <TableHead>Release Notes</TableHead>
                        <TableHead>Latest</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono font-medium">{v.version}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(v.releasedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                            {v.releaseNotes ?? '—'}
                          </TableCell>
                          <TableCell>
                            {v.isLatest
                              ? <Badge className="bg-green-100 text-green-700 gap-1"><Star className="h-3 w-3" />Latest</Badge>
                              : (
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleSetLatest(v.id)}>
                                  Set latest
                                </Button>
                              )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditVersion(v)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteVersionId(v.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── Downloads Tab ──────────────────────────────────────── */}
            <TabsContent value="downloads" className="py-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={openNewDownload} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Download
                </Button>
              </div>
              {downloadsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : downloads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No download files yet.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Public</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {downloads.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-sm">
                            <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                              <Download className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[140px]">{d.fileName}</span>
                            </a>
                          </TableCell>
                          <TableCell><Badge variant="outline">{d.platform}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{d.version ?? '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {d.fileSize > 0 ? `${(d.fileSize / 1024 / 1024).toFixed(1)} MB` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={d.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                              {d.isPublic ? 'Public' : 'Private'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDownload(d)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteDownloadId(d.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Version Sheet */}
      <Sheet open={versionSheetOpen} onOpenChange={setVersionSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingVersion ? 'Edit Version' : 'Add Version'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Version Number *</Label>
              <Input
                value={versionForm.version}
                onChange={(e) => setVersionForm((p) => ({ ...p, version: e.target.value }))}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-1">
              <Label>Release Date</Label>
              <Input
                type="date"
                value={versionForm.releasedAt?.slice(0, 10) ?? ''}
                onChange={(e) => setVersionForm((p) => ({ ...p, releasedAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Release Notes</Label>
              <Textarea
                rows={5}
                value={versionForm.releaseNotes ?? ''}
                onChange={(e) => setVersionForm((p) => ({ ...p, releaseNotes: e.target.value }))}
                placeholder="What's new in this version…"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isLatest"
                checked={versionForm.isLatest ?? false}
                onCheckedChange={(v) => setVersionForm((p) => ({ ...p, isLatest: v }))}
              />
              <Label htmlFor="isLatest">Mark as latest version</Label>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setVersionSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVersion} disabled={savingVersion}>
              {savingVersion ? 'Saving…' : (editingVersion ? 'Save' : 'Add Version')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Download Sheet */}
      <Sheet open={downloadSheetOpen} onOpenChange={setDownloadSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingDownload ? 'Edit Download' : 'Add Download File'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {/* Upload file to storage */}
            <div className="rounded-md border border-dashed p-4 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Upload File</p>
              <p className="text-xs text-muted-foreground">Uploads the file and auto-fills name, size and URL below.</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingFile ? (
                  <span className="animate-pulse">Uploading…</span>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> Choose & Upload File</>
                )}
              </Button>
            </div>

            <div className="space-y-1">
              <Label>File Name *</Label>
              <Input
                value={downloadForm.fileName}
                onChange={(e) => setDownloadForm((p) => ({ ...p, fileName: e.target.value }))}
                placeholder="MidanicERP-1.0.0-Setup.exe"
              />
            </div>
            <div className="space-y-1">
              <Label>Download URL *</Label>
              <Input
                value={downloadForm.downloadUrl}
                onChange={(e) => setDownloadForm((p) => ({ ...p, downloadUrl: e.target.value }))}
                placeholder="https://… or use Upload above"
              />
            </div>
            <div className="space-y-1">
              <Label>Platform *</Label>
              <Select
                value={downloadForm.platform}
                onValueChange={(v) => setDownloadForm((p) => ({ ...p, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((pl) => (
                    <SelectItem key={pl.value} value={pl.value}>{pl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Version</Label>
                <Input
                  value={downloadForm.version ?? ''}
                  onChange={(e) => setDownloadForm((p) => ({ ...p, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-1">
                <Label>File Size (bytes)</Label>
                <Input
                  type="number"
                  value={downloadForm.fileSize ?? 0}
                  onChange={(e) => setDownloadForm((p) => ({ ...p, fileSize: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Linked Version</Label>
              <Select
                value={downloadForm.versionId?.toString() ?? 'none'}
                onValueChange={(v) => setDownloadForm((p) => ({ ...p, versionId: v === 'none' ? undefined : Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select version (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.version}{v.isLatest ? ' (Latest)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isPublic"
                checked={downloadForm.isPublic ?? true}
                onCheckedChange={(v) => setDownloadForm((p) => ({ ...p, isPublic: v }))}
              />
              <Label htmlFor="isPublic">Publicly visible</Label>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDownloadSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDownload} disabled={savingDownload}>
              {savingDownload ? 'Saving…' : (editingDownload ? 'Save' : 'Add File')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Product dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all versions and download files. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Version dialog */}
      <AlertDialog open={!!deleteVersionId} onOpenChange={(o) => !o && setDeleteVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete version?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteVersion}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Download dialog */}
      <AlertDialog open={!!deleteDownloadId} onOpenChange={(o) => !o && setDeleteDownloadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete download file?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteDownload}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
