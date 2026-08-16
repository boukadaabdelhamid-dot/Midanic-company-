import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQ() {
  const { t } = useTranslation();

  const faqs = [
    {
      question: 'How do I purchase a license?',
      answer: 'You can purchase a license by contacting our sales team through the pricing page or by emailing us directly. We offer flexible payment options including monthly, quarterly, and yearly plans.',
    },
    {
      question: 'Do you offer trials for your products?',
      answer: 'Yes! Most of our products offer a free trial period. Visit the product page and click "Request Trial" to get started. Our team will set up your trial account within 24 hours.',
    },
    {
      question: 'What kind of support do you provide?',
      answer: 'We provide comprehensive local support in Arabic, French, and English. This includes email support, phone support during business hours, and access to our knowledge base and video tutorials.',
    },
    {
      question: 'Can I upgrade or downgrade my license?',
      answer: 'Absolutely. You can change your license type at any time. Contact our support team and we will help you transition to a different plan with prorated pricing.',
    },
    {
      question: 'Are updates included in my license?',
      answer: 'Yes, all active licenses include free software updates and security patches. You will always have access to the latest version of the software.',
    },
    {
      question: 'Do you offer custom development?',
      answer: 'Yes, we offer customization services for enterprise clients. Contact our sales team to discuss your specific requirements and get a quote.',
    },
    {
      question: 'What platforms do you support?',
      answer: 'Our products are available for Windows, macOS, and Linux. Some products also have web-based versions that work on any modern browser.',
    },
    {
      question: 'How secure is your software?',
      answer: 'Security is our top priority. We follow industry best practices, conduct regular security audits, and provide encrypted data storage. All our products are designed to meet enterprise security standards.',
    },
  ];

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
              {t('faq.page_title')}
            </h1>
            <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
              {t('faq.page_subtitle')}
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} data-testid={`faq-item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
