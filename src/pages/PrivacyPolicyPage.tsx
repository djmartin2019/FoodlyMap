import { Link } from "@tanstack/react-router";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
      <article className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-6 text-sm text-text/50">
          <p className="italic">This is a template and will be updated as the product evolves.</p>
        </div>
        
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-accent md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mb-8 text-sm text-text/60">
          Last updated: January 26, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-8 text-text/80">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">1. Introduction</h2>
            <p className="mb-4 leading-relaxed">
              Foodly Map ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">2. Information We Collect</h2>
            <p className="mb-4 leading-relaxed">
              We collect the following types of information:
            </p>
            <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your email address and 
                user ID. You may also provide optional information such as username, first name, last name, and phone number.
              </li>
              <li>
                <strong>Saved Places and Lists:</strong> We store the places you save, lists you create, categories you 
                assign, and any notes or metadata you add to your personal food map.
              </li>
              <li>
                <strong>Location Data:</strong> Location data is collected only when you explicitly enable location 
                services in your browser. This is optional and used solely to show your current location on the map. 
                We do not store continuous background location tracking unless you explicitly enable such features in the future.
              </li>
              <li>
                <strong>Usage Data:</strong> We may collect basic analytics about how you use the Service (e.g., pages 
                visited, features used). We may add more detailed analytics in the future, which will be disclosed in 
                an updated Privacy Policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">3. What We Do Not Do</h2>
            <p className="mb-4 leading-relaxed">
              We are committed to your privacy:
            </p>
            <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
              <li>We do not sell your personal data to third parties</li>
              <li>We do not store continuous background location data unless you explicitly enable such features</li>
              <li>We do not use your data for advertising purposes</li>
              <li>We do not share your personal information except as described in this Privacy Policy</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">4. How We Use Your Information</h2>
            <p className="mb-4 leading-relaxed">
              We use your information to:
            </p>
            <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
              <li>Provide and maintain the Service</li>
              <li>Authenticate your account and manage your profile</li>
              <li>Store and display your saved places, lists, and other content</li>
              <li>Provide customer support and respond to your inquiries</li>
              <li>Improve the Service and develop new features</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">5. Data Sharing</h2>
            <p className="mb-4 leading-relaxed">
              We share your information only with trusted service providers who help us operate the Service:
            </p>
            <ul className="mb-4 ml-6 list-disc space-y-2 leading-relaxed">
              <li>
                <strong>Supabase:</strong> We use Supabase for data storage, authentication, and database services. 
                Your data is stored securely and subject to Supabase's privacy practices.
              </li>
              <li>
                <strong>Mapbox:</strong> We use Mapbox for mapping functionality. When you use location features, 
                Mapbox may receive location data in accordance with their privacy policy.
              </li>
            </ul>
            <p className="mb-4 leading-relaxed">
              These service providers are contractually obligated to protect your information and use it only for the 
              purposes we specify.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">6. Data Retention and Deletion</h2>
            <p className="mb-4 leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide the Service. 
              If you wish to delete your account and all associated data, please contact us through our{" "}
              <Link to="/contact" className="text-accent/70 transition-colors hover:text-accent">
                Contact page
              </Link>
              {" "}and we will process your request within a reasonable timeframe.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">7. Security</h2>
            <p className="mb-4 leading-relaxed">
              We implement reasonable security measures to protect your information, including encryption, secure 
              authentication, and access controls. However, no method of transmission over the Internet or electronic 
              storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">8. Children's Privacy</h2>
            <p className="mb-4 leading-relaxed">
              The Service is not intended for children under 13 years of age. We do not knowingly collect personal 
              information from children under 13. If you are a parent or guardian and believe your child has provided 
              us with personal information, please contact us and we will delete such information.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">9. Changes to This Privacy Policy</h2>
            <p className="mb-4 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by updating 
              the "Last updated" date at the top of this page. Your continued use of the Service after such changes 
              constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-text">10. Contact</h2>
            <p className="mb-4 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your rights regarding your personal 
              data, please contact us through our{" "}
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
