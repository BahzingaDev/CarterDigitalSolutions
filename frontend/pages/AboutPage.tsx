import { ContactCTA } from '../components/ContactCTA';

const principles = [
  'Clear communication before clever complexity.',
  'Secure, maintainable foundations for every build.',
  'Practical solutions that fit the client, budget, and workflow.',
  'Plain-language handover so the work remains usable after launch.',
];

const capabilities = [
  'Flask and Python backend services',
  'React, TypeScript, Vite, and Bootstrap interfaces',
  'Workflow audits, automation, and productivity support',
  'Website planning, implementation, launch, and support',
];

export function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="service-hero-grid">
            <div>
              <p className="section-kicker">About</p>
              <h1>Freelance digital work with a practical engineering mindset.</h1>
              <p>
                Carter Digital Solutions helps businesses and individuals plan, build,
                improve, and maintain digital systems that are clear, secure, and useful.
              </p>
            </div>

            <aside className="service-summary-box" aria-label="About summary">
              <p className="deposit-policy-label">Focus</p>
              <h2>Websites, software, workflows, and support.</h2>
              <p>
                The work is shaped around real needs rather than unnecessary technical
                theatre.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>Working principles</h2>
                <ul className="feature-list">
                  {principles.map((principle) => (
                    <li key={principle}>{principle}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>Core capabilities</h2>
                <ul className="feature-list">
                  {capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
