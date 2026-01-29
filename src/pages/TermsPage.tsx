import { Link } from "@tanstack/react-router";

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
      <article className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-6 text-sm text-text/50">
          <p className="italic">This is a template and will be updated as the product evolves.</p>
        </div>
        
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-accent md:text-5xl">
          Terms of Service
        </h1>
        <p className="mb-8 text-sm text-text/60">
          Last updated: January 26, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-text/80">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">1. Acceptance of Terms</h2>
            <p className="mb-4 leading-relaxed">
              By accessing or using Foodly Map ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">2. Eligibility</h2>
            <p className="mb-4 leading-relaxed">
              You must be at least 13 years old to use the Service. By using the Service, you represent and warrant that 
              you are at least 13 years of age and have the legal capacity to enter into these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">3. Account Responsibility</h2>
            <p className="mb-4 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities 
              that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">4. User Content</h2>
            <p className="mb-4 leading-relaxed">
              You retain ownership of all content you create, upload, or share through the Service, including places, 
              lists, notes, and other materials ("User Content"). By submitting User Content, you grant Foodly Map a 
              non-exclusive, worldwide, royalty-free license to use, display, and distribute your User Content within 
              the Service for the purpose of providing and improving the Service.
            </p>
            <p className="mb-4 leading-relaxed">
              You are solely responsible for your User Content and represent that you have all necessary rights to 
              grant the license described above.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">5. Prohibited Use</h2>
            <p className="mb-4 leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
              <li>Violate any applicable laws or regulations</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Scrape, crawl, or use automated systems to access the Service without permission</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Impersonate any person or entity</li>
              <li>Upload malicious code, viruses, or harmful content</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">6. Third-Party Services</h2>
            <p className="mb-4 leading-relaxed">
              The Service uses third-party services, including but not limited to Mapbox (for mapping functionality) 
              and Supabase (for data storage and authentication). Your use of these third-party services is subject to 
              their respective terms of service and privacy policies. Foodly Map is not responsible for the availability 
              or accuracy of third-party services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">7. Disclaimer of Warranties</h2>
            <p className="mb-4 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR 
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
              AND NON-INFRINGEMENT. FOODLY MAP DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">8. Limitation of Liability</h2>
            <p className="mb-4 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOODLY MAP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, 
              OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">9. Termination</h2>
            <p className="mb-4 leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, without prior notice, for 
              any reason, including if you breach these Terms. Upon termination, your right to use the Service will cease 
              immediately.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">10. Changes to Terms</h2>
            <p className="mb-4 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes by updating 
              the "Last updated" date at the top of this page. Your continued use of the Service after such changes 
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">11. Contact</h2>
            <p className="mb-4 leading-relaxed">
              If you have questions about these Terms, please contact us through our{" "}
              <Link to="/contact" className="text-accent/70 transition-colors hover:text-accent">
                Contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
