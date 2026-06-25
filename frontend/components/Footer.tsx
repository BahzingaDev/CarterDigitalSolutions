const footerLinks = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Workflow', href: '/workflow' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
];

export function Footer() {
  return (
    <footer className="site-footer border-top">
      <div className="container py-4">
        <div className="footer-inner">
          <div>
            <h2 className="footer-brand">Carter Digital Solutions</h2>
            <p className="footer-note mb-0">Freelance web and software services.</p>
          </div>

          <nav className="footer-links" aria-label="Footer navigation">
            {footerLinks.map((link) => (
              <a className="footer-link" href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </nav>

          <p className="footer-note mb-0">© 2026 Carter Digital Solutions</p>
        </div>
      </div>
    </footer>
  );
}
