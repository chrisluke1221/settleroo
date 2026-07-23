import React from 'react';

// The tenant bill page never shares the landlord's app chrome — no nav,
// no account name, no logout — since anyone holding the link can open it.
// CHR-28: Removed the "Powered by Settleroo" footer badge. JTBD analysis:
// tenants are not prospective landlords, so the viral-loop pattern borrowed
// from B2C SaaS doesn't recruit anyone — it just adds noise to a page a
// tenant visits once a month. The footer is kept minimal for clean UX.
const TenantShell = ({ propertyName, landlordName, children }) => (
  <div className="min-h-screen flex flex-col bg-secondary-50">
    <header className="border-b border-secondary-200 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <p className="font-semibold text-secondary-900">{propertyName || 'Your bill'}</p>
        {landlordName && <p className="text-sm text-secondary-500">from {landlordName}</p>}
      </div>
    </header>
    <main className="flex-1 flex items-center justify-center px-4 py-12">{children}</main>
  </div>
);

export default TenantShell;
