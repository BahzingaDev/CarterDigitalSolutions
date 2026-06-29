import type { PropsWithChildren } from 'react';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

export function ShellLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
