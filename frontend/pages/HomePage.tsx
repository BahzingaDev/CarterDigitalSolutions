import { ContactCTA } from '../components/ContactCTA';
import { CustomerPathPanel } from '../components/CustomerPathPanel';
import { HeroSection } from '../components/HeroSection';
import { NextStepsPanel } from '../components/NextStepsPanel';
import { PricingPreview } from '../components/PricingPreview';
import { ProcessPreview } from '../components/ProcessPreview';
import { ServiceOverview } from '../components/ServiceOverview';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <ServiceOverview />
      <CustomerPathPanel />
      <ProcessPreview />
      <PricingPreview />
      <NextStepsPanel />
      <ContactCTA />
    </>
  );
}
