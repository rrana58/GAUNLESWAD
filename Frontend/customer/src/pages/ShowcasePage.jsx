import React, { useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { colors, spacing, radius, shadows } from '@shared/theme'
import { Button, Badge, QuantityStepper } from '@shared/ui'
import { Star, ShieldCheck, Flame, Leaf, Utensils, ShoppingBag, Clock } from 'lucide-react'

export default function ShowcasePage() {
  const [stepperVal, setStepperVal] = useState(2)

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAF8F5]">
      <PageHeader title="Design System Showcase" showBackButton />

      <div className="flex-1 px-5 py-6 max-w-4xl mx-auto space-y-10">
        {/* Intro Banner */}
        <div className="bg-[#1B3A25] text-white p-6 rounded-2xl shadow-md">
          <span className="text-xs uppercase font-mono tracking-widest text-[#B58A63] font-bold">Official QA Specification</span>
          <h1 className="font-display text-2xl font-bold mt-1">Gharko Swaad Design System Showcase</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Visual QA reference displaying tokens, components, functional states, and color distribution (70% Warm Ivory/White, 20% Forest Green, 10% Faded Copper).
          </p>
        </div>

        {/* 1. Color Palette Tokens */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">1. Color System & Tokens</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ColorTile name="Forest Green (Primary)" hex={colors.primary} ratio="20%" text="light" />
            <ColorTile name="Faded Copper (Accent)" hex={colors.secondary} ratio="10%" text="light" />
            <ColorTile name="Warm Ivory (Canvas)" hex={colors.bgCanvas} ratio="70%" text="dark" border />
            <ColorTile name="Pure White (Surface)" hex={colors.surface} ratio="70%" text="dark" border />
          </div>

          <h3 className="font-display text-sm font-semibold text-slate-700 mt-4">Functional Status Palette</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatusTile label="Success / Delivered" hex={colors.status.success} />
            <StatusTile label="Pending / Warning" hex={colors.status.warning} />
            <StatusTile label="Kitchen Cooking" hex={colors.status.preparing} />
            <StatusTile label="Ready for Pickup" hex={colors.status.ready} />
            <StatusTile label="Out for Delivery" hex={colors.status.transit} />
            <StatusTile label="Error / Cancelled" hex={colors.status.error} />
            <StatusTile label="Confirmed / Info" hex={colors.status.info} />
            <StatusTile label="Rating Accent" hex={colors.status.rating} />
          </div>
        </section>

        {/* 2. Typography Scale */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">2. Typography System</h2>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <div>
              <p className="text-[10px] font-mono text-slate-400">Display Hero (32px / Bold)</p>
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">Authentic Pokhara Thali</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-400">H1 Title (24px / SemiBold)</p>
              <p className="font-display text-xl font-bold text-slate-900">Fresh Cloud Kitchen Specials</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-400">Body Primary (14px / Regular)</p>
              <p className="text-sm text-slate-700">Handcrafted thalis and momos cooked fresh with local spices and delivered hot.</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-400">Price Tag (IBM Plex Mono / 15px Bold)</p>
              <p className="font-mono font-bold text-base text-[#1B3A25]">NPR 450.00</p>
            </div>
          </div>
        </section>

        {/* 3. Buttons & Component States */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">3. Button Variants & Component States</h2>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={ShoppingBag}>Primary CTA</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Action</Button>
              <Button variant="danger">Cancel / Delete</Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="primary" isLoading>Loading State</Button>
              <Button variant="primary" isDisabled>Disabled Button</Button>
              <Button variant="secondary" size="sm">Small Action</Button>
            </div>
          </div>
        </section>

        {/* 4. Badges & Chips */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">4. Status Badges & Rating Accents</h2>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap gap-2.5 items-center">
            <Badge status="pending">Pending (Amber)</Badge>
            <Badge status="confirmed">Confirmed (Blue)</Badge>
            <Badge status="preparing">Cooking (Purple)</Badge>
            <Badge status="ready">Ready (Teal)</Badge>
            <Badge status="transit">On The Way (Cyan)</Badge>
            <Badge status="delivered">Delivered (Green)</Badge>
            <Badge status="cancelled">Cancelled (Red)</Badge>
            <Badge status="promo">LOYALTY REWARD</Badge>
          </div>
        </section>

        {/* 5. Interactive Controls */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">5. Quantity Stepper & Stepper Controls</h2>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Quantity Control</p>
              <p className="text-xs text-slate-500">Interactive quantity counter</p>
            </div>
            <QuantityStepper value={stepperVal} onChange={setStepperVal} />
          </div>
        </section>

      </div>
    </div>
  )
}

function ColorTile({ name, hex, ratio, text, border }) {
  return (
    <div className={`p-3.5 rounded-xl flex flex-col justify-between h-24 ${border ? 'border border-slate-200 shadow-2xs' : 'shadow-sm'}`} style={{ backgroundColor: hex }}>
      <span className={`text-[10px] font-bold ${text === 'light' ? 'text-white/80' : 'text-slate-500'}`}>{ratio}</span>
      <div>
        <p className={`text-xs font-bold leading-tight ${text === 'light' ? 'text-white' : 'text-slate-900'}`}>{name}</p>
        <p className={`text-[10px] font-mono ${text === 'light' ? 'text-white/70' : 'text-slate-400'}`}>{hex}</p>
      </div>
    </div>
  )
}

function StatusTile({ label, hex }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
      <span className="text-xs font-medium text-slate-800 truncate">{label}</span>
    </div>
  )
}
