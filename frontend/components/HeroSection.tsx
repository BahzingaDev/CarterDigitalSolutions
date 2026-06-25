export function HeroSection() {
  return (
    <section className="hero-section">
      <div className="container py-5">
        <div className="row align-items-center g-4">
          <div className="col-12 col-lg-7">
            <p className="section-kicker">Freelance web and software services</p>
            <h1 className="hero-title">
              Digital systems for businesses, professionals, and independent work.
            </h1>
            <p className="hero-copy">
              I design and build clear, secure, maintainable websites, apps, and workflows
              that help people work better online.
            </p>
            <div className="hero-actions">
              <a className="btn btn-accent" href="/quote">
                Start a project
              </a>
              <a className="btn btn-outline-accent" href="/services">
                View services
              </a>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="hero-panel">
              <span className="hero-panel-label">Current focus</span>
              <ul className="hero-panel-list">
                <li>Professional websites</li>
                <li>Custom tools and automation</li>
                <li>Workflow and productivity support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
