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
      <span className="block text-sm text-[#c4d9d5] mt-1 uppercase tracking-widest">{label}</span>
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
      color: 'text-primary',
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
      <section className="relative bg-[#142e3e] overflow-hidden">
        {/* Geometric background pattern */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <svg className="absolute right-0 top-0 w-[600px] opacity-10" viewBox="0 0 600 600" fill="none">
            <circle cx="400" cy="150" r="300" stroke="#58b6a5" strokeWidth="1.5" />
            <circle cx="400" cy="150" r="200" stroke="#58b6a5" strokeWidth="1" />
            <circle cx="400" cy="150" r="100" stroke="#58b6a5" strokeWidth="0.8" />
          </svg>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 rounded-full px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-300" />
                <span className="text-teal-200 text-sm font-medium">Midanic</span>
              </div>

              <h1
                className="editorial-title text-5xl md:text-6xl lg:text-7xl text-white leading-[1.02] tracking-tight"
                data-testid="text-hero-title"
              >
                {t('home.hero_title')}
              </h1>

              <p
                className="text-lg text-[#d4e0df] leading-relaxed max-w-lg"
                data-testid="text-hero-subtitle"
              >
                {t('home.hero_subtitle')}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/trial" data-testid="link-cta-products">
                  <Button
                    size="lg"
                    className="gap-2 bg-[#b77a43] hover:bg-[#ca8d55] text-white shadow-lg shadow-black/20 border-0"
                  >
                    {t('home.cta_primary')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/demo" data-testid="link-cta-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-white/25 text-white hover:bg-white/10 bg-transparent"
                  >
                    {t('home.cta_secondary')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Brand-safe workspace photography */}
            <div className="relative hidden lg:block">
              <div className="relative aspect-[1.08/1] overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl shadow-black/30">
                <img src="/midanic-hero.jpg" alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b2130]/60 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full border border-teal-300/35" aria-hidden="true" />
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
      <section className="py-24 bg-[#f0ede4] dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">
              {t('home.pillars_eyebrow')}
            </p>
            <h2 className="editorial-title text-4xl md:text-5xl">{t('home.pillars_title')}</h2>
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
                <p className="eyebrow mb-3">
                  {t('home.products_eyebrow')}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-featured-title">
                  {t('home.featured_products')}
                </h2>
              </div>
              <Link href="/products" data-testid="link-all-products">
                <Button variant="ghost" className="gap-2 text-primary">
                  {t('home.all_products')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <Link key={product.id} href={`/products/${product.slug}`} data-testid={`card-product-${product.id}`}>
                  <Card className="group h-full hover:border-primary transition-all hover:shadow-lg cursor-pointer overflow-hidden">
                    <div className="aspect-video overflow-hidden bg-[#e8eee9] dark:bg-slate-800">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_20%_20%,rgba(47,129,117,0.14),transparent_55%),linear-gradient(135deg,#eef2eb,#dce8e1)] dark:bg-[radial-gradient(ellipse_at_20%_20%,rgba(47,129,117,0.25),transparent_55%),linear-gradient(135deg,#1d3440,#142e3e)]">
                          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-primary/15" aria-hidden="true" />
                          <div className="absolute -bottom-16 -left-8 h-48 w-48 rounded-full border border-primary/10" aria-hidden="true" />
                          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/70 bg-white/70 text-primary shadow-lg shadow-[#142e3e]/10 backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                            <Package className="h-9 w-9" aria-hidden="true" />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">
                          {product.category}
                        </span>
                        {product.trialDays && (
                          <span className="text-xs bg-[#dcebe5] dark:bg-green-900/30 text-[#236b5d] dark:text-green-400 px-2 py-0.5 rounded-full">
                            {t('products.trial_available')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-snug">{product.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.shortDescription || product.description}
                      </p>
                      <div className="pt-1 flex items-center gap-1 text-primary text-sm font-medium group-hover:gap-2 transition-all">
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
      <section className="py-24 bg-[#142e3e]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="eyebrow !text-[#9acfc3] mb-3">
              {t('home.how_eyebrow')}
            </p>
            <h2 className="editorial-title text-4xl md:text-5xl text-white">{t('home.how_title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-gradient-to-r from-teal-500/0 via-teal-300/50 to-teal-500/0 pointer-events-none" />

            {steps.map(({ icon: Icon, num, title, desc }) => (
              <div key={num} className="relative text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-teal-400/10 border border-teal-300/25 flex flex-col items-center justify-center">
                  <Icon className="w-7 h-7 text-[#9acfc3]" />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#b77a43] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {num.slice(-1)}
                </div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-[#cad7d8] leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. STATS SOCIAL PROOF ──────────────────────────────────────── */}
      {stats && (
        <section className="py-24 bg-[#1e756a]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <p className="eyebrow !text-[#d1e9e3] mb-3">
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
        <section className="py-24 bg-[#f0ede4] dark:bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="eyebrow mb-3">
                  {t('home.blog_eyebrow')}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-blog-title">
                  {t('home.blog_title')}
                </h2>
              </div>
              <Link href="/blog" data-testid="link-blog">
                <Button variant="ghost" className="gap-2 text-primary">
                  {t('home.view_blog')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogData.posts.map((post, i) => (
                <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`card-blog-${post.id}`}>
                  <Card className={`group h-full hover:border-primary transition-all hover:shadow-md cursor-pointer overflow-hidden ${i === 0 ? 'md:row-span-1' : ''}`}>
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
                        <span className="text-xs text-primary font-medium">
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
      <section className="py-24 bg-[#142e3e]">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <div className="mb-4">
            <span className="inline-block w-10 h-1 bg-[#c88951] rounded-full" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="text-newsletter-title">
            {t('home.newsletter_title')}
          </h2>
          <p className="text-[#d4e0df] text-lg mb-8" data-testid="text-newsletter-subtitle">
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
              className="bg-white/10 border-white/20 text-white placeholder:text-white/55 focus:border-teal-300"
              data-testid="input-newsletter-email"
            />
            <Button
              type="submit"
              disabled={subscribeNewsletter.isPending}
              className="bg-[#b77a43] hover:bg-[#ca8d55] text-white border-0 shrink-0"
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
