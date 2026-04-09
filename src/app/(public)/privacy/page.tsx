import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "BWL Privacy Policy — how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-black tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 9, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Baloch Warriors League (&quot;BWL&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website
              bwlleague.com and the BWL League mobile application (collectively, the &quot;Service&quot;).
              This Privacy Policy explains how we collect, use, and protect your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>

            <h3 className="text-base font-semibold mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Admin account information (email, name, password) when you register as a tournament administrator</li>
              <li>Player profiles (name, nickname, nationality, position, date of birth, bio) created by administrators</li>
              <li>Team information (name, logo, roster) created by administrators</li>
              <li>Tournament data (match results, standings, awards) entered by administrators</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Push notification tokens (Firebase Cloud Messaging) when you enable notifications</li>
              <li>Web Push subscription endpoints when you subscribe to browser notifications</li>
              <li>Basic analytics data (page views, device type) via Vercel Analytics</li>
              <li>Performance metrics via Vercel Speed Insights</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-2">2.3 Information We Do NOT Collect</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>We do not collect personal information from public visitors (no login required to browse)</li>
              <li>We do not track your location</li>
              <li>We do not sell or share your data with third parties for advertising</li>
              <li>We do not use cookies for tracking (only session cookies for admin authentication)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>To operate and maintain the tournament management platform</li>
              <li>To display player profiles, match results, and standings publicly</li>
              <li>To send push notifications about match results, tournament updates, and news (only if you opt in)</li>
              <li>To authenticate administrators and manage access control</li>
              <li>To improve the Service through anonymous analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. Push Notifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use Firebase Cloud Messaging (FCM) for the mobile app and the Web Push API for browsers
              to send notifications. You can opt in or out of notifications at any time by tapping the bell
              icon in the app or browser. We store your device token solely for the purpose of delivering
              notifications. Tokens are automatically deleted when they expire or when you unsubscribe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on secure servers hosted by Railway (PostgreSQL database) and served
              via Vercel (web hosting). Admin passwords are hashed using bcrypt and are never stored in
              plain text. We use HTTPS encryption for all data in transit. Access to the admin panel is
              protected by role-based access control (RBAC).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">We use the following third-party services:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Vercel</strong> — web hosting and analytics</li>
              <li><strong>Railway</strong> — database hosting</li>
              <li><strong>Firebase Cloud Messaging</strong> — push notifications for the Android app</li>
              <li><strong>Cloudinary</strong> — image storage (optional, for player/team photos)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Each of these services has their own privacy policy. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Tournament data (match results, standings, player stats) is retained indefinitely as part of
              the league&apos;s historical record. Admin activity logs are retained for 90 days. Push notification
              tokens are deleted when they expire or when you unsubscribe. You may request deletion of your
              data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">8. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not directed to children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and believe
              your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">9. Your Rights</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>You can opt out of push notifications at any time</li>
              <li>You can request access to your personal data</li>
              <li>You can request deletion of your personal data</li>
              <li>You can request correction of inaccurate data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong> admin@bwlleague.com<br />
              <strong>Website:</strong> bwlleague.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
