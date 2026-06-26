const paths = [
  {
    title: 'I know what I need',
    description: 'Use the quote builder to outline services, complexity, and project factors.',
    href: '/quote',
    action: 'Build a quote',
  },
  {
    title: 'I need to check readiness',
    description: 'Run through the checklist before sending a project outline.',
    href: '/readiness',
    action: 'Check readiness',
  },
  {
    title: 'I want to ask first',
    description: 'Send a general enquiry if the work does not fit neatly into the quote builder.',
    href: '/contact',
    action: 'Contact me',
  },
];

export function CustomerPathPanel() {
  return (
    <section className="page-section">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Choose a route</p>
          <h2>Start from the point that matches where you are.</h2>
        </div>

        <div className="customer-path-grid">
          {paths.map((path) => (
            <article className="customer-path-card" key={path.title}>
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <a className="btn btn-outline-accent" href={path.href}>
                {path.action}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
