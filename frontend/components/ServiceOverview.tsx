const industryServices = [
  'Professional websites',
  'Lead conversion',
  'Cloud platforms',
  'Web and mobile apps',
  'Workflow optimization',
  'Training and support',
];

const individualServices = [
  'Portfolio websites',
  'Personal websites',
  'Custom tools',
  'Automation setup',
  'Technical setup',
  'Ongoing help',
];

export function ServiceOverview() {
  return (
    <section className="page-section">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Services</p>
          <h2>Support for industry and individuals.</h2>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <article className="overview-panel h-100">
              <h3>For Industry</h3>
              <ul className="feature-list">
                {industryServices.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </article>
          </div>
          <div className="col-12 col-lg-6">
            <article className="overview-panel h-100">
              <h3>For Individuals</h3>
              <ul className="feature-list">
                {individualServices.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
