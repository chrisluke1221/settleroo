import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useProperties } from '../contexts/PropertyContext';
import { limitLabel, upgradeMessage } from '../lib/entitlements';

// Global plan-limit dialog. Renders whenever a check_entitlement call blocks
// an action (state lives in PropertyContext, set by requireEntitlement), so
// individual pages never build their own limit UI.
const UpgradeModal = () => {
  const { entitlementBlock, clearEntitlementBlock } = useProperties();
  if (!entitlementBlock) return null;

  const label = limitLabel(entitlementBlock.key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-secondary-900/40" onClick={clearEntitlementBlock} />
      <div className="relative card max-w-sm w-full">
        <div className="flex items-start space-x-3 mb-4">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-secondary-900">You've hit a plan limit</h3>
            <p className="text-sm text-secondary-600 mt-1">
              {upgradeMessage(entitlementBlock)} To {label.action}, upgrade to Pro — unlimited
              properties, tenants, and bills.
            </p>
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button className="btn-secondary" onClick={clearEntitlementBlock}>
            Not now
          </button>
          <Link to="/pricing" className="btn-primary" onClick={clearEntitlementBlock}>
            See plans
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
