import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Receipt, Calendar, Users, CalendarDays, ArrowRight, Sparkles } from 'lucide-react';
import TenantShell from '../components/TenantShell';
import Money from '../components/Money';

const TITLE = 'See a real bill breakdown — Settleroo';

// A public, no-login demo of the exact screen a tenant sees — reusing the
// real TenantShell/Money components for visual fidelity, fed static example
// data instead of a live token lookup (src/pages/TenantBillView.js is the
// real, DB-backed version). This is intentionally not wired to a seeded DB
// record yet; Phase B's seed script is the natural place to replace this
// with a real link once it exists. Numbers below are hand-picked to land on
// clean, self-consistent totals so nothing here looks arbitrary:
// 30 person-days / 96 total = 31.25% of a $192.00 bill = exactly $60.00.
const DEMO = {
  propertyName: 'Maple Share House',
  landlordName: 'Priya',
  billType: 'electricity',
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
  tenantName: 'Jasmine',
  room: 'Room 2',
  occupants: 1,
  occupancyDays: 30,
  totalPersonDays: 96,
  percentage: 31.25,
  totalAmount: 192,
  owedAmount: 60,
  dueDate: '2026-08-14',
};

const DemoBill = () => {
  const otherPersonDays = DEMO.totalPersonDays - DEMO.occupancyDays * DEMO.occupants;

  return (
    <TenantShell propertyName={DEMO.propertyName} landlordName={DEMO.landlordName}>
      <Helmet defer={false}>
        <title>{TITLE}</title>
        <link rel="canonical" href="https://roomietab.netlify.app/demo-bill" />
      </Helmet>

      <div className="w-full max-w-lg space-y-4">
        <div className="bg-primary-600 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">This is a live example — no real tenant, no login</span>
          </div>
        </div>

        <div className="card">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
            <Receipt className="w-6 h-6 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900 capitalize mb-1">{DEMO.billType} Bill</h1>
          <p className="text-secondary-600 mb-1">
            Billing period: {DEMO.periodStart} to {DEMO.periodEnd}
          </p>
          <p className="text-secondary-500 text-sm mb-6">
            Hi {DEMO.tenantName}, here's exactly how your share was calculated.
          </p>

          <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600">You owe</p>
              <Money dollars={DEMO.owedAmount} as="p" className="text-3xl text-primary-700" />
            </div>
            <div className="text-right">
              <p className="text-sm text-secondary-600">of total bill</p>
              <Money dollars={DEMO.totalAmount} as="p" className="text-lg text-secondary-900" />
            </div>
          </div>

          <div className="border border-secondary-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-secondary-50 px-4 py-2 border-b border-secondary-200">
              <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">How this was calculated</p>
            </div>
            <div className="divide-y divide-secondary-100 text-sm">
              <div className="flex items-start justify-between px-4 py-3">
                <div className="flex items-start space-x-2">
                  <CalendarDays className="w-4 h-4 text-secondary-400 mt-0.5" />
                  <div>
                    <p className="text-secondary-900 font-medium">Your occupancy in this bill period</p>
                    <p className="text-secondary-500">{DEMO.periodStart} to {DEMO.periodEnd}</p>
                  </div>
                </div>
                <span className="font-medium text-secondary-900 whitespace-nowrap tabular-nums">{DEMO.occupancyDays} days</span>
              </div>

              <div className="flex items-start justify-between px-4 py-3">
                <div className="flex items-start space-x-2">
                  <Users className="w-4 h-4 text-secondary-400 mt-0.5" />
                  <div>
                    <p className="text-secondary-900 font-medium">Occupants in your room</p>
                    <p className="text-secondary-500">Room: {DEMO.room}</p>
                  </div>
                </div>
                <span className="font-medium text-secondary-900 whitespace-nowrap tabular-nums">{DEMO.occupants}</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3 bg-secondary-50">
                <span className="text-secondary-700">
                  Your person-days = {DEMO.occupancyDays} days &times; {DEMO.occupants} occupant
                </span>
                <span className="font-semibold text-secondary-900 whitespace-nowrap tabular-nums">
                  {DEMO.occupancyDays * DEMO.occupants}
                </span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-secondary-700">Total person-days for this bill (all tenants combined)</span>
                <span className="font-medium text-secondary-900 whitespace-nowrap tabular-nums">{DEMO.totalPersonDays}</span>
              </div>

              {otherPersonDays > 0 && (
                <div className="flex items-center justify-between px-4 py-3 text-secondary-500">
                  <span>Other tenants' person-days ({DEMO.totalPersonDays} &minus; {DEMO.occupancyDays})</span>
                  <span className="whitespace-nowrap tabular-nums">{otherPersonDays}</span>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 bg-secondary-50">
                <span className="text-secondary-700">
                  Your share = {DEMO.occupancyDays} &divide; {DEMO.totalPersonDays} person-days
                </span>
                <span className="font-semibold text-secondary-900 whitespace-nowrap tabular-nums">{DEMO.percentage}%</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-secondary-700">
                  Your amount = {DEMO.percentage}% &times; <Money dollars={DEMO.totalAmount} />
                </span>
                <Money dollars={DEMO.owedAmount} className="text-primary-700 whitespace-nowrap" />
              </div>
            </div>
          </div>

          <p className="flex items-center text-sm text-secondary-600">
            <Calendar className="w-4 h-4 mr-2" />
            Due {DEMO.dueDate}
          </p>
        </div>

        <div className="card text-center">
          <p className="text-secondary-900 font-medium mb-1">This is exactly what your tenants would see.</p>
          <p className="text-secondary-500 text-sm mb-4">No login for them, no spreadsheet for you — just the math, shown.</p>
          <Link to="/login" className="btn-primary inline-flex items-center space-x-2">
            <span>Get started free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </TenantShell>
  );
};

export default DemoBill;
