// Client-side companions to the check_entitlement RPC. The RPC is the only
// enforcement point (never trust the client); these helpers just translate
// its result into UI copy and a typed error the upgrade modal can catch.

export class EntitlementError extends Error {
  constructor(result) {
    super('Plan limit reached');
    this.name = 'EntitlementError';
    this.entitlement = result;
  }
}

// Human labels for the limit keys stored in plans.limits.
const LIMIT_LABELS = {
  max_properties: { noun: 'property', plural: 'properties', action: 'add another property' },
  max_active_tenants: { noun: 'active tenant', plural: 'active tenants', action: 'add another tenant' },
  max_bills_per_month: { noun: 'bill this month', plural: 'bills per month', action: 'create another bill' },
};

export const limitLabel = (key) => LIMIT_LABELS[key] || { noun: key, plural: key, action: 'do this' };

// One-sentence explanation for the upgrade modal, e.g.
// "The Starter plan includes 1 property — you're using 1."
export const upgradeMessage = (result) => {
  if (!result) return '';
  const label = limitLabel(result.key);
  const limit = result.limit;
  const limitText = typeof limit === 'number' ? `${limit} ${limit === 1 ? label.noun : label.plural}` : label.plural;
  return `The ${result.plan_name} plan includes ${limitText} — you're using ${result.current}.`;
};
