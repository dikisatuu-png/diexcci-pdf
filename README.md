# DIEXCCI PDF

A static, browser-based PDF tools MVP for `diexcci.web.id`.

## Included in this starter
- Merge multiple PDF files
- Split/extract selected pages (example: `1-3, 5`)
- Rotate all pages
- Basic PDF re-save/optimization using pdf-lib object streams
- Optional Supabase email/password authentication
- Optional metadata-only activity history for signed-in users
- Responsive dark premium UI

## Important limitations
- PDF processing happens locally in the visitor's browser. The PDF file is not uploaded to Supabase or Cloudflare.
- The "Optimize PDF" action is basic re-saving, not advanced image recompression. It may not make every PDF smaller.
- PDF to Word, OCR, password removal, and advanced compression are not included in this MVP.
- Browser-only processing is not a substitute for server-side malware scanning or a guaranteed secure document workflow. Users should only open trusted PDFs.
- This starter uses third-party CDN libraries (pdf-lib and Supabase JS). For production, pin and review dependency versions and consider self-hosting them.
- Supabase free projects may pause after inactivity and have plan limits. Check current Supabase pricing/limits before relying on it for production.

## Run locally
1. Install Visual Studio Code.
2. Open this folder in VS Code.
3. Install the "Live Server" extension.
4. Right-click `index.html` and choose "Open with Live Server".
5. The app should open at `http://127.0.0.1:5500` or `http://localhost:5500`.

You can also use a local static server. Do not open the HTML directly as a `file://` URL.

## Configure Supabase (optional)
1. Create a Supabase project.
2. In Supabase > SQL Editor, run all of `supabase.sql`.
3. In Supabase > Project Settings > API Keys, copy:
   - Project URL
   - Publishable key (`sb_publishable_...`)
4. Paste those values into `js/config.js`.
5. In Supabase > Authentication > URL Configuration:
   - Set Site URL to your local development URL while testing, e.g. `http://localhost:5500`.
   - Add Redirect URLs for your local URL and later `https://diexcci.web.id/**`.
6. Test sign-up and sign-in. If email confirmation is enabled, confirm from your inbox.

Never put a Supabase secret key, service_role key, database password, or other private credential in frontend code.

## Deploy to Cloudflare Pages with GitHub
1. Create a GitHub repository, e.g. `diexcci-pdf`.
2. Upload all files and folders from this project to the repository root (not inside an extra nested folder).
3. In Cloudflare Dashboard, go to Workers & Pages > Create application > Pages > Connect to Git.
4. Authorize GitHub and select the repository.
5. Framework preset: None.
6. Build command: leave blank.
7. Build output directory: `/` (or `.` if Cloudflare asks for a relative directory).
8. Deploy.
9. Test the generated `*.pages.dev` URL before connecting your custom domain.

## Connect diexcci.web.id
1. In the Pages project, open Custom domains > Set up a custom domain.
2. Enter `diexcci.web.id` and follow Cloudflare's instructions.
3. If Cloudflare requires the domain zone to be active on Cloudflare, add the domain to Cloudflare and update nameservers at IDwebhost to the exact pair Cloudflare provides.
4. Do not delete existing DNS records until you have checked whether the domain is used for email or other services. Recreate required MX, TXT, and other records in Cloudflare DNS before changing nameservers.
5. Wait for DNS and TLS provisioning. Test `https://diexcci.web.id`.

## Update Supabase URLs after deployment
In Supabase > Authentication > URL Configuration:
- Set Site URL to `https://diexcci.web.id`
- Add Redirect URL `https://diexcci.web.id/**`
Keep local development redirect URLs if you still use them.

## Database notes
Run `supabase.sql` once. It creates `profiles` and `pdf_history`, enables RLS, and allows each signed-in user to read/insert only their own history. History contains filenames/tool metadata only, not PDF content.

## Before public launch
- Add a privacy policy and terms of use.
- Decide maximum file size and fair-use limits.
- Test large, malformed, encrypted, and unusual PDFs.
- Add monitoring and a support contact.
- Review current Cloudflare and Supabase plan limits.
