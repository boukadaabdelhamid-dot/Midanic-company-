import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, Download, ShieldCheck, Zap, Wifi, Star,
  CheckCircle2, Settings, Rocket, Package,
} from 'lucide-react';
import {
  useGetPublicStats,
  useGetFeaturedProducts,
  useListBlogPosts,
  useSubscribeNewsletter,
} from '@workspace/api-client-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (target === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
            else setValue(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

// ── Animated stat ──────────────────────────────────────────────────────────
function AnimatedStat({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const { value: display, ref } = useCountUp(value);
  return (
    <div className="text-center">
      <span ref={ref} className="block text-4xl md:text-5xl font-black text-white">
        {display.toLocaleString()}{suffix}
      </span>
      <span className="block text-sm text-blue-200 mt-1 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Home() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const { data: stats } = useGetPublicStats();
  const { data: featuredProducts } = useGetFeaturedProducts();
  const { data: blogData } = useListBlogPosts({ page: 1, limit: 3 });
  const subscribeNewsletter = useSubscribeNewsletter();

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    subscribeNewsletter.mutate(
      { data: { email } },
      {
        onSuccess: () => { toast.success(t('home.newsletter_success')); setEmail(''); },
        onError: () => { toast.error(t('common.error')); },
      }
    );
  };

  const pillars = [
    {
      icon: Star,
      title: t('home.pillar_quality'),
      desc: t('home.pillar_quality_desc'),
      color: 'text-blue-500',
    },
    {
      icon: ShieldCheck,
      title: t('home.pillar_security'),
      desc: t('home.pillar_security_desc'),
      color: 'text-green-500',
    },
    {
      icon: Zap,
      title: t('home.pillar_performance'),
      desc: t('home.pillar_performance_desc'),
      color: 'text-yellow-500',
    },
    {
      icon: Wifi,
      title: t('home.pillar_availability'),
      desc: t('home.pillar_availability_desc'),
      color: 'text-purple-500',
    },
  ];

  const steps = [
    { icon: CheckCircle2, num: '01', title: t('home.step1_title'), desc: t('home.step1_desc') },
    { icon: Settings,     num: '02', title: t('home.step2_title'), desc: t('home.step2_desc') },
    { icon: Rocket,       num: '03', title: t('home.step3_title'), desc: t('home.step3_desc') },
  ];

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden">

      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section className="relative bg-[#0f172a] overflow-hidden">
        {/* Geometric background pattern */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <svg className="absolute right-0 top-0 w-[600px] opacity-10" viewBox="0 0 600 600" fill="none">
            <circle cx="400" cy="150" r="300" stroke="#3b82f6" strokeWidth="1.5" />
            <circle cx="400" cy="150" r="200" stroke="#3b82f6" strokeWidth="1" />
            <circle cx="400" cy="150" r="100" stroke="#3b82f6" strokeWidth="0.8" />
          </svg>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-2xl" />
        </div>

        <div className="relative container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-sm font-medium">MidanicSoftware</span>
              </div>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight"
                data-testid="text-hero-title"
              >
                {t('home.hero_title')}
              </h1>

              <p
                className="text-lg text-blue-100/80 leading-relaxed max-w-lg"
                data-testid="text-hero-subtitle"
              >
                {t('home.hero_subtitle')}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/trial" data-testid="link-cta-products">
                  <Button
                    size="lg"
                    className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 border-0"
                  >
                    {t('home.cta_primary')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/demo" data-testid="link-cta-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    {t('home.cta_secondary')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 bg-[#1e293b]">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#0f172a] border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                  <div className="w-3 h-3 rounded-full bg-green-400/70" />
                  <div className="ml-3 flex-1 bg-white/5 rounded px-3 py-1 text-xs text-white/30">
                    app.midanic.com/dashboard
                  </div>
                </div>
                {/* Dashboard preview grid */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {['التراخيص النشطة', 'المنتجات', 'العملاء'].map((label, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-xl font-bold text-white">{[24, 3, 18][i]}</div>
                        <div className="text-xs text-white/40 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                    <div className="text-xs text-white/40 mb-3">نشاط التراخيص — آخر 6 أشهر</div>
                    <div className="flex items-end gap-1.5 h-16">
                      {[40, 65, 45, 80, 55, 90].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-blue-500/60" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['ترخيص سنوي — شركة المستقبل', 'ترخيص شهري — مؤسسة النور'].map((row, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-2 border border-white/5">
                        <span className="text-xs text-white/60">{row}</span>
                        <span className={`text-xs font-medium ${i === 0 ? 'text-green-400' : 'text-blue-400'}`}>
                          {i === 0 ? 'نشط' : 'جديد'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Glow */}
              <div className="absolute -inset-4 bg-blue-500/10 rounded-2xl blur-2xl -z-10" />
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        {stats && (
          <div className="border-t border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <AnimatedStat value={stats.totalClients} label={t('home.stats_clients')} suffix="+" />
                <AnimatedStat value={stats.totalProducts} label={t('home.stats_products')} />
                <AnimatedStat value={stats.totalDownloads} label={t('home.stats_downloads')} suffix="+" />
                <AnimatedStat value={stats.totalCountries} label={t('home.stats_countries')} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. VALUE PILLARS ───────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
              {t('home.pillars_eyebrow')}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold">{t('home.pillars_title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map(({ icon: Icon, title, desc, color }) => (
              <Card key={title} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className={`w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. PRODUCT SHOWCASE ────────────────────────────────────────── */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                  {t('home.products_eyebrow')}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-featured-title">
                  {t('home.featured_products')}
                </h2>
              </div>
              <Link href="/products" data-testid="link-all-products">
                <Button variant="ghost" className="gap-2 text-blue-600 dark:text-blue-400">
                  {t('home.all_products')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <Link key={product.id} href={`/products/${product.slug}`} data-testid={`card-product-${product.id}`}>
                  <Card className="group h-full hover:border-blue-500 transition-all hover:shadow-lg cursor-pointer overflow-hidden">
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                          {product.category}
                        </span>
                        {product.trialDays && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Trial {product.trialDays}j
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-snug">{product.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.shortDescription || product.description}
                      </p>
                      <div className="pt-1 flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
                        {t('home.discover')} <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="py-24 bg-[#0f172a]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
              {t('home.how_eyebrow')}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{t('home.how_title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 pointer-events-none" />

            {steps.map(({ icon: Icon, num, title, desc }) => (
              <div key={num} className="relative text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex flex-col items-center justify-center">
                  <Icon className="w-7 h-7 text-blue-400" />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-blue-600/40">
                  {num.slice(-1)}
                </div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-blue-100/60 leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. STATS SOCIAL PROOF ──────────────────────────────────────── */}
      {stats && (
        <section className="py-24 bg-blue-600">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-2">
                {t('home.stats_eyebrow')}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-stats-title">
                {t('home.stats_title')}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              <AnimatedStat value={stats.totalProducts} label={t('home.stats_products')} />
              <AnimatedStat value={stats.totalClients} label={t('home.stats_clients')} suffix="+" />
              <AnimatedStat value={stats.totalDownloads} label={t('home.stats_downloads')} suffix="+" />
              <AnimatedStat value={stats.totalCountries} label={t('home.stats_countries')} />
            </div>
          </div>
        </section>
      )}

      {/* ── 6. BLOG PREVIEW ────────────────────────────────────────────── */}
      {blogData && blogData.posts.length > 0 && (
        <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase tracking-widest mb-2">
                  {t('home.blog_eyebrow')}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-blog-title">
                  {t('home.blog_title')}
                </h2>
              </div>
              <Link href="/blog" data-testid="link-blog">
                <Button variant="ghost" className="gap-2 text-blue-600 dark:text-blue-400">
                  {t('home.view_blog')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogData.posts.map((post, i) => (
                <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`card-blog-${post.id}`}>
                  <Card className={`group h-full hover:border-blue-500 transition-all hover:shadow-md cursor-pointer overflow-hidden ${i === 0 ? 'md:row-span-1' : ''}`}>
                    {post.coverImageUrl && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-2">
                      {post.authorName && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {t('blog.by')} {post.authorName}
                        </span>
                      )}
                      <h3 className="text-base font-semibold leading-snug line-clamp-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. NEWSLETTER ──────────────────────────────────────────────── */}
      <section className="py-24 bg-[#0f172a]">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <div className="mb-2">
            <span className="inline-block w-10 h-1 bg-blue-500 rounded-full" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="text-newsletter-title">
            {t('home.newsletter_title')}
          </h2>
          <p className="text-blue-100/70 text-lg mb-8" data-testid="text-newsletter-subtitle">
            {t('home.newsletter_subtitle')}
          </p>
          <form
            onSubmit={handleNewsletterSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            data-testid="form-newsletter"
          >
            <Input
              type="email"
              placeholder={t('home.newsletter_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
              data-testid="input-newsletter-email"
            />
            <Button
              type="submit"
              disabled={subscribeNewsletter.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white border-0 shrink-0"
              data-testid="button-newsletter-submit"
            >
              {t('home.newsletter_button')}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
