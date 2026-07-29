import { Link } from "react-router-dom";

/**
 * Public account-deletion page, reachable at /delete-account. Required by Google
 * Play (and used for Apple) so users can request deletion of their account and
 * data without opening the app. Keep in step with the privacy policy and the
 * in-app Settings → Delete Account flow (delete-account edge function). Not legal advice.
 */
export default function DeleteAccount() {
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
            Account Deletion
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">
            Delete your account
          </h1>
          <p className="mt-3 text-sm text-[#5f5850]">
            Russia Revision · operated by Tom Bradshaw
          </p>
        </header>

        <div className="mt-8 space-y-4 text-[17px] leading-relaxed [&_h2]:mt-11 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_a]:text-[#7a2e2e] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2 [&_strong]:font-semibold">
          <p className="text-lg">
            You can delete your Russia Revision account, and all of the data tied
            to it, at any time. There are two ways to do it.
          </p>

          <h2>Delete it inside the app (fastest)</h2>
          <p>
            Open the app and go to <strong>Settings → Delete Account</strong>,
            then confirm. This <strong>immediately and permanently</strong>{" "}
            removes your account and every piece of data associated with it. It
            cannot be undone.
          </p>

          <h2>Request deletion without the app</h2>
          <p>
            If you have uninstalled the app or can&rsquo;t sign in, email us from
            the address on your account and we&rsquo;ll delete it for you:
          </p>
          <ul>
            <li>
              Email{" "}
              <a href="mailto:support@tsarist-communist-russia-1h.co.uk?subject=Delete%20my%20account">
                support@tsarist-communist-russia-1h.co.uk
              </a>{" "}
              from the email address you use to sign in.
            </li>
            <li>
              Put <strong>&ldquo;Delete my account&rdquo;</strong> in the subject
              line so we can find it quickly.
            </li>
          </ul>
          <p>
            We action email requests within <strong>30 days</strong> (usually
            much sooner). We may reply to confirm the request came from the
            account holder before deleting.
          </p>

          <h2>What gets deleted</h2>
          <p>Deleting your account permanently removes:</p>
          <ul>
            <li>
              your account and sign-in details (your email, and your name if you
              signed in with Google or Microsoft);
            </li>
            <li>your revision progress, scores, and topic coverage;</li>
            <li>
              your typed answers, blank-recall notes, and extract attempts;
            </li>
            <li>any feedback you have sent us;</li>
            <li>
              your conversations with the AI study tutor (&ldquo;Potemkin&rdquo;).
            </li>
          </ul>
          <p>
            We do not keep your personal information after your account is
            deleted. Browsing the app <strong>without</strong> an account creates
            no account and stores no personal data in the first place.
          </p>

          <h2>Questions</h2>
          <p>
            For anything else, contact{" "}
            <a href="mailto:support@tsarist-communist-russia-1h.co.uk">
              support@tsarist-communist-russia-1h.co.uk
            </a>
            . See our <Link to="/privacy">Privacy Policy</Link> for the full
            detail on what we handle and why.
          </p>
        </div>
      </div>
    </div>
  );
}
