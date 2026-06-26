import { QuoteBuilder } from '../components/QuoteBuilder';
import { NextStepsPanel } from '../components/NextStepsPanel';

export function QuotePage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="contact-hero-grid">
            <div>
              <p className="section-kicker">Start a project</p>
              <h1>Build a rough quote before sending an enquiry.</h1>
              <p>
                Select the services or features you may need to get an estimated total.
                The final quote is confirmed after scope, assumptions, and timescale are
                reviewed.
              </p>
            </div>

            <aside className="service-summary-box" aria-label="Quote guidance">
              <p className="deposit-policy-label">Planning estimate</p>
              <h2>Use this as a starting point.</h2>
              <p>
                It helps frame the conversation before any deposit or project slot is
                agreed.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <QuoteBuilder />
        </div>
      </section>
      <NextStepsPanel />
    </>
  );
}
