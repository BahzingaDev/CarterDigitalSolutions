import { ContactCTA } from '../components/ContactCTA';
import { HeroSection } from '../components/HeroSection';
import { PricingPreview } from '../components/PricingPreview';
import { ProcessPreview } from '../components/ProcessPreview';
import { ServiceOverview } from '../components/ServiceOverview';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <ServiceOverview />
      <ProcessPreview />
      <PricingPreview />
      <ContactCTA />
    </>
  );
}
