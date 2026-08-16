# Midanic — Public SaaS Website

Professional enterprise software platform built for Algerian businesses. This is the public-facing website featuring product listings, pricing, authentication, and multilingual support.

## Features

### Core Functionality
- ✅ Full internationalization (i18n) with English, French, and Arabic
- ✅ RTL support for Arabic language
- ✅ Authentication system (login/register) with JWT
- ✅ Light/Dark theme toggle
- ✅ Responsive design (mobile-first)
- ✅ All 20+ pages fully implemented

### Pages Implemented
**Public Pages:**
- `/` — Home (hero, stats, featured products, blog preview, newsletter)
- `/products` — Product listing with filters
- `/products/:slug` — Product detail page
- `/pricing` — Pricing plans (Trial, Monthly, Quarterly, Semi-Annual, Yearly, Lifetime)
- `/about` — About us page
- `/contact` — Contact form
- `/faq` — FAQ with accordion
- `/help` — Help center
- `/blog` — Blog listing with pagination
- `/blog/:slug` — Blog post detail
- `/news` — News listing with pagination
- `/news/:slug` — News article detail
- `/downloads` — Downloads center
- `/trial` — Request trial form
- `/demo` — Request demo form
- `/privacy` — Privacy policy
- `/terms` — Terms of service

**Auth Pages:**
- `/login` — Login page
- `/register` — Registration page

### i18n System

The app uses **react-i18next** with three languages:
- **English (en)** — LTR, default
- **French (fr)** — LTR
- **Arabic (ar)** — RTL

**Key files:**
- `src/i18n.ts` — i18next configuration
- `src/locales/en.json` — English translations
- `src/locales/fr.json` — French translations
- `src/locales/ar.json` — Arabic translations

The language switcher is in the navbar. Selected language is persisted to:
1. `localStorage` key: `midanic_lang`
2. Server (via `useUpdateLanguage` mutation) when user is authenticated

When switching to Arabic, the app automatically sets `dir="rtl"` and `lang="ar"` on the document element.

### Authentication

**Storage:**
- `localStorage.accessToken` — JWT access token
- `localStorage.refreshToken` — Refresh token

**Auth Context:**
Located in `src/contexts/auth-context.tsx`, provides:
- `user: UserProfile | null`
- `isAuthenticated: boolean`
- `isLoading: boolean`
- `login(accessToken, refreshToken, user)`
- `logout()`

**Flow:**
1. User logs in via `/login`
2. Tokens stored in localStorage
3. `useGetProfile()` restores session on page load
4. Navbar shows user menu when authenticated

### Theme System

**Theme Context:**
Located in `src/contexts/theme-context.tsx`, provides:
- `theme: 'light' | 'dark'`
- `toggleTheme()`
- `setTheme(theme)`

Theme is persisted to `localStorage` key: `midanic_theme`

The `dark` class is toggled on the `<html>` element.

### Design System

**Color Palette:**
- Primary: Deep blue (`217 91% 60%`)
- Accent: Orange (`29 94% 52%`)
- Professional and confident aesthetic
- Inspired by enterprise software (Atlassian, Odoo)

**Typography:**
- Display/Body: DM Sans
- Monospace: Space Mono

**Components:**
- All shadcn/ui components customized with brand colors
- Consistent spacing and border radius
- Smooth transitions and hover states

### API Integration

All API calls use Orval-generated hooks from `@workspace/api-client-react`:

**Query Hooks:**
- `useHealthCheck()`
- `useListProducts(params?, options?)`
- `useGetProduct(slug, options?)`
- `useListProductVersions(slug, options?)`
- `useListProductDownloads(slug, options?)`
- `useListDownloads(options?)`
- `useListBlogPosts(params?, options?)`
- `useGetBlogPost(slug, options?)`
- `useListNews(params?, options?)`
- `useGetNewsArticle(slug, options?)`
- `useGetProfile(options?)`
- `useGetPublicStats(options?)`
- `useGetFeaturedProducts(options?)`

**Mutation Hooks:**
- `useRegister()`
- `useLogin()`
- `useRefreshToken()`
- `useLogout()`
- `useSubmitContact()`
- `useRequestTrial()`
- `useRequestDemo()`
- `useSubscribeNewsletter()`
- `useUpdateProfile()`
- `useChangePassword()`
- `useUpdateLanguage()`

### Folder Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── navbar.tsx         # Main navigation
│   │   └── footer.tsx         # Footer with links
│   └── ui/                    # shadcn/ui components
├── contexts/
│   ├── auth-context.tsx       # Auth state management
│   └── theme-context.tsx      # Theme state management
├── locales/
│   ├── en.json                # English translations
│   ├── fr.json                # French translations
│   └── ar.json                # Arabic translations
├── pages/
│   ├── home.tsx
│   ├── products.tsx
│   ├── product-detail.tsx
│   ├── pricing.tsx
│   ├── about.tsx
│   ├── contact.tsx
│   ├── faq.tsx
│   ├── help.tsx
│   ├── blog.tsx
│   ├── blog-detail.tsx
│   ├── news.tsx
│   ├── news-detail.tsx
│   ├── downloads.tsx
│   ├── trial.tsx
│   ├── demo.tsx
│   ├── privacy.tsx
│   ├── terms.tsx
│   ├── login.tsx
│   ├── register.tsx
│   └── not-found.tsx
├── i18n.ts                    # i18next configuration
├── App.tsx                    # Main app with routing
├── main.tsx                   # Entry point
└── index.css                  # Global styles + theme
```

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

### Environment Variables

No environment variables required for basic operation. The API client will use relative URLs by default (`/api/*`).

### Next Steps

This is the foundation for the Midanic platform. Future tasks include:
- **Customer Portal** — Dashboard for authenticated users to manage licenses, downloads, and support tickets
- **Admin Dashboard** — Internal admin panel for managing products, users, and content

### Notes

- All visible text uses `t()` translation keys — no hardcoded strings
- All interactive elements have `data-testid` attributes for testing
- Forms use `react-hook-form` with `zod` validation
- All pages are fully responsive (mobile-first)
- Dark mode is fully supported across all pages
- RTL layout works correctly for Arabic
