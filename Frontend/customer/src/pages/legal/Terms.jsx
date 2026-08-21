
import PageHeader from '@/components/layout/PageHeader'

export default function Terms() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageHeader title="Terms & Conditions" showBackButton />

      <main className="flex-1 px-5 py-6 max-w-3xl mx-auto space-y-6 text-foreground" aria-label="Terms and Conditions">
        <div className="border-b border-border pb-4">
          <h1 className="font-display text-2xl font-bold text-primary">Terms & Conditions</h1>
          <p className="text-xs text-muted-foreground mt-1">Last updated: August 2026 — Gaunle Swad (Pokhara, Nepal)</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">1. Introduction & Acceptance</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Welcome to Gaunle Swad ("we", "our", "us"). By accessing or using our mobile web application, ordering platform, or cloud kitchen services in Pokhara, Nepal, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">2. Services Offered</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Gaunle Swad operates a tech-enabled cloud kitchen providing home-style Nepali meals, authentic thalis, daily meal subscriptions, celebration packages, and food delivery services within specified service zones in Pokhara, Nepal.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">3. Account Registration & Security</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Users registering an account must provide accurate mobile phone numbers and account information. You are responsible for maintaining the confidentiality of your account credentials and OTP verification codes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">4. Ordering & Pricing</h2>
          <ul className="list-disc list-inside text-xs sm:text-sm text-muted-foreground space-y-1.5 pl-1">
            <li>All prices listed on the platform are in Nepalese Rupees (NPR) and include applicable taxes (13% VAT).</li>
            <li>Delivery charges apply based on order value or promotional rules. Free delivery applies for orders over NPR 500 or active subscription plan meals.</li>
            <li>We reserve the right to cancel orders due to unforeseen stock unavailability, extreme weather, or delivery area restrictions.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">5. Payments & Cash on Delivery</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We accept Cash on Delivery (COD), Loyalty Points, and designated digital wallet payments. For Cash on Delivery orders, exact payment must be handed to the delivery rider upon arrival.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-foreground">6. Order Cancellation & Refunds</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Orders can be cancelled before kitchen confirmation. Once food preparation has started, cancellations may not be eligible for a refund. In the event of missing or damaged items, please contact customer support immediately for prompt assistance.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="font-display text-base font-semibold text-foreground">7. Contact & Support</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            For questions or support regarding these terms, please reach out through the <strong>Contact Us</strong> section in the app or visit our location in Pokhara, Nepal.
          </p>
        </section>
      </main>
    </div>
  )
}
