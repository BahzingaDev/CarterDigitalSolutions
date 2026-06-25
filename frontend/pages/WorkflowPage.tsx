import { ContactCTA } from '../components/ContactCTA';
import { WorkflowTimeline } from '../components/WorkflowTimeline';

const clientInputs = [
  'A clear point of contact for decisions and feedback.',
  'Access to existing accounts, assets, copy, images, or systems where relevant.',
  'Timely review notes at agreed checkpoints.',
  'Any legal, compliance, brand, or operational constraints before build work starts.',
];

const workingPrinciples = [
  'Scope is agreed before implementation begins.',
  'Changes are grouped into review rounds to keep momentum clear.',
  'Technical choices are explained in plain language.',
  'Launch only happens after final checks and approval.',
];

export function WorkflowPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="workflow-hero-grid">
            <div>
              <p className="section-kicker">Workflow</p>
              <h1>A clear process from first conversation to launch.</h1>
              <p>
                The workflow is designed to keep projects focused, understandable,
                and easy to review, whether the work is a website, software build,
                automation, or consultancy engagement.
              </p>
            </div>

            <aside className="workflow-policy-box" aria-label="Workflow note">
              <p className="deposit-policy-label">Included in deposit</p>
              <h2>Up to 8 consultancy hours can support planning and scope.</h2>
              <p>
                These hours help turn the initial brief into practical decisions before
                deeper delivery work begins.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <p className="section-kicker">Process</p>
            <h2>How the work moves forward.</h2>
          </div>
          <WorkflowTimeline />
        </div>
      </section>

      <section className="page-section section-muted">
        <div className="container">
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>What I need from you</h2>
                <ul className="feature-list">
                  {clientInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
            <div className="col-12 col-lg-6">
              <article className="workflow-info-panel h-100">
                <h2>How decisions are handled</h2>
                <ul className="feature-list">
                  {workingPrinciples.map((item) => (
                    <li key={item}>{item}</li>
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
