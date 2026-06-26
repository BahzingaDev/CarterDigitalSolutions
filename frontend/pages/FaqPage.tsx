const faqs = [
  {
    question: 'How does a project usually start?',
    answer:
      'Most projects begin with a short enquiry, followed by a scope review. If the work is a good fit, the next step is a written outline covering deliverables, estimate, deposit, and expected timeline.',
  },
  {
    question: 'Are quote builder estimates final?',
    answer:
      'No. The quote builder is a planning guide. Final pricing is confirmed after the selected items, complexity, content, integrations, and timeline have been reviewed.',
  },
  {
    question: 'How do deposits work?',
    answer:
      'Deposits secure scheduled project time and are agreed before work begins. Smaller support tasks may be paid upfront, while larger builds usually use a percentage deposit.',
  },
  {
    question: 'Who owns the finished work?',
    answer:
      'Unless agreed otherwise, finished project assets and code prepared for you are handed over once the final balance is paid. Third-party services remain subject to their own terms.',
  },
  {
    question: 'Can you work with existing websites, tools, or systems?',
    answer:
      'Yes. Existing websites, spreadsheets, workflows, domains, hosting, and software can be reviewed before changes are recommended or implemented.',
  },
  {
    question: 'Do you provide ongoing support?',
    answer:
      'Yes. Support can be arranged for updates, maintenance, technical help, monitoring, or small improvements after launch.',
  },
];

export function FaqPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="section-kicker">FAQ</p>
          <h1>Common questions before starting a project.</h1>
          <p>
            A short guide to scope, estimates, deposits, ownership, and ongoing support.
          </p>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="faq-list">
            {faqs.map((item) => (
              <article className="faq-item" key={item.question}>
                <h2>{item.question}</h2>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
