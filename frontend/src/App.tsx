import { ShellLayout } from '../layouts/ShellLayout';
import { AdminPage } from '../pages/AdminPage';
import { AboutPage } from '../pages/AboutPage';
import { ContactPage } from '../pages/ContactPage';
import { FaqPage } from '../pages/FaqPage';
import { HomePage } from '../pages/HomePage';
import { PricingPage } from '../pages/PricingPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { QuotePage } from '../pages/QuotePage';
import { ReadinessPage } from '../pages/ReadinessPage';
import { ServicePage } from '../pages/ServicePage';
import { WorkflowPage } from '../pages/WorkflowPage';

function getCurrentPage() {
  const serviceMatch = window.location.pathname.match(/^\/services\/([^/]+)$/);

  if (serviceMatch) {
    return <ServicePage slug={serviceMatch[1]} />;
  }

  if (window.location.pathname === '/pricing') {
    return <PricingPage />;
  }

  if (window.location.pathname === '/workflow') {
    return <WorkflowPage />;
  }

  if (window.location.pathname === '/about') {
    return <AboutPage />;
  }

  if (window.location.pathname === '/contact') {
    return <ContactPage />;
  }

  if (window.location.pathname === '/quote') {
    return <QuotePage />;
  }

  if (window.location.pathname === '/faq') {
    return <FaqPage />;
  }

  if (window.location.pathname === '/readiness') {
    return <ReadinessPage />;
  }

  if (window.location.pathname === '/privacy') {
    return <PrivacyPage />;
  }

  return <HomePage />;
}

export function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }

  return (
    <ShellLayout>
      {getCurrentPage()}
    </ShellLayout>
  );
}
