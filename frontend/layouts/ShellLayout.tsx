import type { PropsWithChildren } from 'react';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

export function ShellLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
