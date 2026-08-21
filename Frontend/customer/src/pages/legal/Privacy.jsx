
import PageHeader from '@/components/layout/PageHeader'

export default function Privacy() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageHeader title="Privacy Policy" showBackButton />

      <main className="flex-1 px-5 py-6 max-w-3xl mx-auto space-y-6 text-foreground" aria-label="Privacy Policy">
        <div className="border-b border-border pb-4">
          <h1 className="font-display text-2xl font-bold text-primary">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground mt-1">Last updated: August 2026 — Gaunle Swad Cloud Kitchen (Pokhara, Nepal)</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">1. Information We Collect</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We collect information you provide directly to us when using Gaunle Swad, including your name, mobile phone number, delivery addresses, order preferences, and transaction history.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-xs sm:text-sm text-muted-foreground space-y-1.5 pl-1">
            <li>To process, prepare, and deliver your food orders efficiently.</li>
            <li>To send order status notifications, delivery updates, and SMS/Push notifications.</li>
            <li>To manage loyalty rewards, daily meal subscriptions, and promotional discounts.</li>
            <li>To improve our cloud kitchen operations, customer service, and food quality.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">3. Location Data</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            With your explicit permission, we collect precise location coordinates to auto-detect your delivery address and facilitate accurate dispatch by our delivery personnel. Location data is used strictly for order fulfillment.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">4. Data Security & Sharing</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We do not sell or rent your personal data to third parties. Data is shared only with essential service partners (such as delivery personnel and SMS gateway providers) strictly as required to fulfill your orders.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="font-display text-base font-semibold text-foreground">5. Your Rights & Account Deletion</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            You have the right to view, update, or request the deletion of your account and saved addresses at any time directly through the <strong>Profile</strong> settings in the app.
          </p>
        </section>
      </main>
    </div>
  )
}
