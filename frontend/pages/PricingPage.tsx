import { CustomNeedsPrompt } from '../components/CustomNeedsPrompt';
import { PricingTable } from '../components/PricingTable';

export function PricingPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="pricing-hero-grid">
            <div>
              <p className="section-kicker">Pricing & deposit</p>
              <h1>Transparent starting points for scoped freelance work.</h1>
              <p>
                Pricing is organized by category and service type so each project can be
                estimated against its likely complexity, delivery time, and support needs.
              </p>
            </div>

            <aside className="deposit-policy-box" aria-label="Deposit policy">
              <p className="deposit-policy-label">Deposit policy</p>
              <h2>Up to 8 consultancy hours included within the deposit.</h2>
              <p>
                These hours can cover discovery, planning, scope refinement, technical
                guidance, or early project support before the main build begins.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <PricingTable />
          <CustomNeedsPrompt />
        </div>
      </section>
    </>
  );
}
