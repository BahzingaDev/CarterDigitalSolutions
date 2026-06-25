import { ShellLayout } from '../layouts/ShellLayout';
import { AboutPage } from '../pages/AboutPage';
import { ContactPage } from '../pages/ContactPage';
import { HomePage } from '../pages/HomePage';
import { PricingPage } from '../pages/PricingPage';
import { QuotePage } from '../pages/QuotePage';
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

  return <HomePage />;
}

export function App() {
  return (
    <ShellLayout>
      {getCurrentPage()}
    </ShellLayout>
  );
}
