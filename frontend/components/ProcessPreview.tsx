const steps = [
  {
    title: 'Discover',
    description: 'Clarify the goal, audience, requirements, and practical constraints.',
  },
  {
    title: 'Build',
    description: 'Design and implement the site, tool, or workflow in focused stages.',
  },
  {
    title: 'Launch',
    description: 'Test, refine, deploy, and hand over with support where needed.',
  },
];

export function ProcessPreview() {
  return (
    <section className="page-section section-muted">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Workflow</p>
          <h2>A simple path from idea to launch.</h2>
        </div>

        <div className="row g-3">
          {steps.map((step, index) => (
            <div className="col-12 col-md-4" key={step.title}>
              <article className="step-card h-100">
                <span className="step-number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
