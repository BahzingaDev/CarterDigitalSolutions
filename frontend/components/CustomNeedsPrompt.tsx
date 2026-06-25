export function CustomNeedsPrompt() {
  return (
    <section className="custom-needs-prompt" aria-labelledby="custom-needs-title">
      <div>
        <p className="section-kicker">Something else?</p>
        <h2 id="custom-needs-title">Need a service that is not listed here?</h2>
        <p>
          If your project sits outside the table, send the outline through and I can
          suggest the closest fit, a custom quote, or a better route forward.
        </p>
      </div>
      <a className="btn btn-accent" href="/contact">
        Ask about a custom project
      </a>
    </section>
  );
}
