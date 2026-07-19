import { Link } from "react-router-dom";

/**
 * Public privacy policy, reachable at /privacy — this exact URL is hardcoded in
 * the native app (settings.tsx PRIVACY_POLICY_URL) and required by both app
 * stores. Content must stay in step with the Apple App Privacy labels and the
 * Google Data Safety form. Data facts verified against the code (see the
 * compliance data inventory). Not legal advice.
 */
export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Link
          to="/"
          className="text-sm font-medium text-[#7a2e2e] hover:underline"
        >
          ← Russia Revision
        </Link>

        <header className="mt-6 border-b border-[#e2dbcf] pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a2e2e]">
            Privacy Policy
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">
            Russia Revision
          </h1>
          <p className="mt-3 text-sm text-[#5f5850]">
            Effective <strong className="text-[#1c1a17]">19 July 2026</strong> ·
            operated by Tom Bradshaw
          </p>
        </header>

        <div className="mt-8 space-y-4 text-[17px] leading-relaxed [&_h2]:mt-11 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_a]:text-[#7a2e2e] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2 [&_strong]:font-semibold">
          <p className="text-lg">
            Russia Revision is a study app and website for A-Level History
            students revising Tsarist and Communist Russia, 1855–1964. This
            policy explains what information we handle, why, the legal basis for
            it, and the choices you have. You can browse without an account; we
            only collect the data below once you sign in.
          </p>

          <h2>Who we are</h2>
          <p>
            Russia Revision is built and run by <strong>Tom Bradshaw</strong>, an
            independent developer in the UK, who is the <strong>data controller</strong>{" "}
            for the personal information described here. For any privacy question,
            or to exercise your rights, contact{" "}
            <a href="mailto:support@tsarist-communist-russia-1h.co.uk">
              support@tsarist-communist-russia-1h.co.uk
            </a>
            .
          </p>

          <h2>What we collect, and why</h2>
          <div className="overflow-x-auto">
            <table className="mt-4 w-full min-w-[520px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b-2 border-[#e2dbcf] text-left text-xs uppercase tracking-wide text-[#5f5850]">
                  <th className="py-3 pr-4 font-bold">Information</th>
                  <th className="py-3 pr-4 font-bold">Why we hold it</th>
                  <th className="py-3 font-bold">Where it goes</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-[#e2dbcf]">
                  <td className="py-3 pr-4 font-semibold">Account details</td>
                  <td className="py-3 pr-4">
                    Your email address, and your name if you sign in with Google
                    or Microsoft — to create your account and keep your progress
                    with you across devices.
                  </td>
                  <td className="py-3">Stored in our database (Supabase).</td>
                </tr>
                <tr className="border-b border-[#e2dbcf]">
                  <td className="py-3 pr-4 font-semibold">Your revision activity</td>
                  <td className="py-3 pr-4">
                    The questions you attempt, the answers and blank-recall notes
                    you type, extract attempts, feedback you send, your scores and
                    topics — to show your progress and suggest what to review next.
                  </td>
                  <td className="py-3">Stored in our database (Supabase).</td>
                </tr>
                <tr className="border-b border-[#e2dbcf]">
                  <td className="py-3 pr-4 font-semibold">AI tutor content</td>
                  <td className="py-3 pr-4">
                    When you use the AI tutor ("Potemkin"), the questions you type
                    are used to find relevant course material and generate a reply,
                    and are saved to your conversation history.
                  </td>
                  <td className="py-3">
                    Stored in our database, and processed by OpenAI and Anthropic
                    (US) — see below.
                  </td>
                </tr>
                <tr className="border-b border-[#e2dbcf]">
                  <td className="py-3 pr-4 font-semibold">Microphone / voice</td>
                  <td className="py-3 pr-4">
                    If you dictate a Blank Recall answer, your speech is turned
                    into text. This happens on your device where possible; on some
                    Android devices it may use Google's cloud speech recognition.
                  </td>
                  <td className="py-3">
                    On-device, or Google (on some Android devices).
                  </td>
                </tr>
                <tr className="border-b border-[#e2dbcf]">
                  <td className="py-3 pr-4 font-semibold">Website analytics</td>
                  <td className="py-3 pr-4">
                    On our <strong>website only</strong>, we measure page use
                    (IP-anonymised) to improve it. The mobile app contains no
                    analytics or tracking.
                  </td>
                  <td className="py-3">Google Analytics (Google).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            <strong>Using the app without an account.</strong> If you don't sign
            in, we don't create a profile or store your progress; basic security
            logs (which may include an IP address) are still generated as on any
            website. <strong>The mobile app has no advertising, analytics, or
            tracking SDKs.</strong> We never sell your personal information.
          </p>

          <h2>The legal basis for using your information</h2>
          <ul>
            <li>
              <strong>Your account and revision progress</strong> — to provide
              the study service you've asked for (performance of a contract, or
              our legitimate interest in running the features you use).
            </li>
            <li>
              <strong>The AI tutor and answer-marking</strong> — to generate the
              response you request when you choose to use them.
            </li>
            <li>
              <strong>Technical and log data</strong> — our legitimate interest in
              keeping the service available and secure.
            </li>
            <li>
              <strong>Website analytics</strong> — consent, where it relies on
              non-essential cookies or identifiers.
            </li>
          </ul>

          <h2>Who we share information with</h2>
          <p>
            We do not sell your data or use it for advertising. We share it only
            with the providers that make Russia Revision work:
          </p>
          <ul>
            <li><strong>Supabase</strong> — database, sign-in, and hosting for your account and progress.</li>
            <li><strong>OpenAI</strong> — matches your AI-tutor question to relevant course material.</li>
            <li><strong>Anthropic (Claude)</strong> — generates the AI tutor replies and answer feedback.</li>
            <li><strong>Google</strong> — sign-in (if you choose it), and cloud speech recognition on some Android devices.</li>
            <li><strong>Microsoft</strong> — sign-in, if you choose it.</li>
            <li><strong>Resend</strong> — sends occasional service emails.</li>
            <li><strong>Google Analytics &amp; Netlify</strong> — website analytics and website hosting (website only).</li>
            <li><strong>Apple / Google</strong> — distribute the app through their stores.</li>
          </ul>

          <h2>Where your data is processed</h2>
          <p>
            Your account and revision data are stored by <strong>Supabase in
            London, UK</strong> (AWS eu-west-2), so they stay in the UK. The
            exception is the AI features: the text you submit is processed by{" "}
            <strong>OpenAI</strong> and <strong>Anthropic</strong> in the{" "}
            <strong>United States</strong>. For that transfer we rely on the
            safeguards required by UK law — Standard Contractual Clauses with the
            UK Addendum / the UK International Data Transfer Agreement — so your
            information keeps an equivalent level of protection.
          </p>
          <p className="text-[#5f5850]">
            Under our terms with these providers, the text you submit is not used
            to train their AI models, and is retained only briefly for security
            before deletion. We describe their commitments as they stand at this
            policy's effective date.
          </p>

          <h2>The AI marking is a study aid, not a decision about you</h2>
          <p>
            The AI answer-marking gives you automated feedback and a suggested
            score to help you practise. It is a study aid, not an assessment that
            affects your grades — it has no legal or similarly significant effect,
            and a real exam is always marked by a person.
          </p>

          <h2>How long we keep it</h2>
          <ul>
            <li>
              <strong>Account and revision data</strong> — kept while your account
              is active. If you don't sign in for <strong>24 months</strong>, we
              treat the account as dormant and delete it.
            </li>
            <li>
              <strong>AI submissions</strong> — retained by our AI providers only
              briefly (up to <strong>30 days</strong>) for security, then deleted.
            </li>
            <li>
              <strong>Technical and log data</strong> — up to <strong>90 days</strong>,
              then deleted or anonymised.
            </li>
          </ul>

          <h2>Deleting your account</h2>
          <p>
            You can delete your account and all its data at any time from{" "}
            <strong>Settings → Delete Account</strong> in the app, or by emailing{" "}
            <a href="mailto:support@tsarist-communist-russia-1h.co.uk">
              support@tsarist-communist-russia-1h.co.uk
            </a>
            . We action deletion requests within <strong>30 days</strong>.
          </p>

          <h2>Security</h2>
          <p>
            Data is stored on secure servers with database access controls
            (row-level security) and encrypted in transit (HTTPS). No online
            service can be guaranteed perfectly secure, but we take reasonable
            measures to protect your data.
          </p>

          <h2>Your rights</h2>
          <p>
            Under UK data-protection law you can ask us to access, correct,
            export, restrict, or object to the processing of your personal
            information — and to delete it (see above). If you're unhappy with how
            we've handled your data you can complain to the UK's regulator, the{" "}
            <strong>Information Commissioner's Office</strong> (
            <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
              ico.org.uk
            </a>
            , 0303 123 1113). We'd ask you to contact us first so we can put it
            right.
          </p>

          <h2>Young people</h2>
          <p>
            Russia Revision is intended for A-Level students, typically aged
            16–18, and we follow the ICO's Age Appropriate Design Code. We collect
            only what the study features need, default to the most
            privacy-protective settings, and <strong>don't profile you for
            advertising or marketing</strong>, sell your data, or use design tricks
            to push you into sharing more. The app isn't intended for children
            under 13; if you believe a child under 13 has created an account,
            contact us and we'll delete it.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            If we change how we handle information we'll update this page and
            revise the effective date above. Significant changes will be made
            clear within the app.
          </p>

          <p className="mt-10 border-t border-[#e2dbcf] pt-6 text-sm text-[#5f5850]">
            Russia Revision · Privacy Policy · last updated 19 July 2026 ·{" "}
            <a href="mailto:support@tsarist-communist-russia-1h.co.uk">
              support@tsarist-communist-russia-1h.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
