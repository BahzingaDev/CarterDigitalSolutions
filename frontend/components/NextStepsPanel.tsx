const nextSteps = [
  {
    title: 'Review',
    description: 'Your enquiry is checked against the goal, scope, timeline, and any selected quote items.',
  },
  {
    title: 'Clarify',
    description: 'If anything is unclear, you will receive a short follow-up before any estimate is treated as final.',
  },
  {
    title: 'Confirm',
    description: 'Suitable next steps, deposit, scheduling, and handover expectations are agreed in writing.',
  },
];

export function NextStepsPanel() {
  return (
    <section className="page-section section-muted">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">After You Submit</p>
          <h2>What happens next.</h2>
        </div>

        <div className="next-steps-grid">
          {nextSteps.map((step, index) => (
            <article className="next-step-card" key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
