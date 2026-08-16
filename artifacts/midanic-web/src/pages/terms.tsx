import { useTranslation } from 'react-i18next';

export default function Terms() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-8" data-testid="text-page-title">
          Terms of Service
        </h1>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Agreement to Terms</h2>
            <p>
              By accessing or using Midanic's software products and services, you agree to be bound by
              these Terms of Service. If you disagree with any part of these terms, you may not access
              our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">License Grant</h2>
            <p>
              Subject to your compliance with these Terms, Midanic grants you a limited, non-exclusive,
              non-transferable license to use our software products in accordance with your purchased
              license type.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">License Types</h2>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Trial:</strong> Limited-time evaluation license with full features</li>
              <li><strong>Monthly/Quarterly/Semi-Annual/Yearly:</strong> Subscription licenses with automatic renewal</li>
              <li><strong>Lifetime:</strong> Perpetual license with ongoing updates</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Restrictions</h2>
            <p>You may not:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Modify, reverse engineer, or decompile the software</li>
              <li>Distribute or resell the software without authorization</li>
              <li>Use the software for illegal purposes</li>
              <li>Remove or alter any proprietary notices</li>
              <li>Exceed the usage limits of your license</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Payment and Billing</h2>
            <p>
              All fees are due as specified in your invoice. Subscription licenses will automatically
              renew unless cancelled at least 7 days before the renewal date. Refunds are handled on
              a case-by-case basis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Support and Updates</h2>
            <p>
              Active licenses include access to software updates and technical support. Support is
              provided in English, French, and Arabic during business hours (Algeria timezone).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Termination</h2>
            <p>
              We may terminate or suspend your license immediately if you breach these Terms. Upon
              termination, you must cease all use of the software and destroy all copies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
            <p>
              Midanic shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages arising from your use of our software or services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact</h2>
            <p>
              For questions about these Terms, please contact us at legal@midanic.dz
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
