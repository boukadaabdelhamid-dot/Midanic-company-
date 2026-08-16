import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Products from '@/pages/products';
import ProductDetail from '@/pages/product-detail';
import Pricing from '@/pages/pricing';
import About from '@/pages/about';
import Contact from '@/pages/contact';
import FAQ from '@/pages/faq';
import Help from '@/pages/help';
import Blog from '@/pages/blog';
import BlogDetail from '@/pages/blog-detail';
import News from '@/pages/news';
import NewsDetail from '@/pages/news-detail';
import Downloads from '@/pages/downloads';
import Trial from '@/pages/trial';
import Demo from '@/pages/demo';
import Privacy from '@/pages/privacy';
import Terms from '@/pages/terms';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Dashboard from '@/pages/dashboard';
import { AdminLayout } from '@/pages/admin/layout';
import { AdminSettingsProvider } from '@/contexts/admin-settings-context';
import AdminOverview from '@/pages/admin/overview';
import AdminUsers from '@/pages/admin/users';
import AdminProducts from '@/pages/admin/products';
import AdminLicenses from '@/pages/admin/licenses';
import AdminContent from '@/pages/admin/content';
import AdminCRM from '@/pages/admin/crm';
import AdminTickets from '@/pages/admin/tickets';
import AdminErp from '@/pages/admin/erp';
import AdminSettings from '@/pages/admin/settings';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminRouter() {
  return (
    <AdminSettingsProvider>
      <AdminLayout>
        <Switch>
          <Route path="/admin" component={AdminOverview} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/products" component={AdminProducts} />
          <Route path="/admin/licenses" component={AdminLicenses} />
          <Route path="/admin/content" component={AdminContent} />
          <Route path="/admin/crm" component={AdminCRM} />
          <Route path="/admin/tickets" component={AdminTickets} />
          <Route path="/admin/erp" component={AdminErp} />
          <Route path="/admin/settings" component={AdminSettings} />
        </Switch>
      </AdminLayout>
    </AdminSettingsProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith('/admin');

  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <AdminRouter />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/products" component={Products} />
        <Route path="/products/:slug" component={ProductDetail} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/faq" component={FAQ} />
        <Route path="/help" component={Help} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogDetail} />
        <Route path="/news" component={News} />
        <Route path="/news/:slug" component={NewsDetail} />
        <Route path="/downloads" component={Downloads} />
        <Route path="/trial" component={Trial} />
        <Route path="/demo" component={Demo} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
            <SonnerToaster position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
