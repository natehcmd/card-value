# Turn on accounts (about 10 minutes)

The site works without accounts. Your numbers stay in your own browser. Accounts only add
saving across devices. Until you do the steps below the "Sign in" button stays hidden.

Sign-in is handled by [Supabase](https://supabase.com) (free plan is enough). It stores
passwords as salted hashes, sends the confirmation emails, rate-limits attempts and runs the
2-step codes. This site never sees or stores a password itself.

## 1. Create the project
1. Sign up at supabase.com and create a new project. Pick a region near you.
2. Use a long random database password and keep it in a password manager. The site never uses it.

## 2. Create the table and the access rules
Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, press **Run**.
That creates one table that holds only encrypted text, and makes it so a signed-in person can
read and change only their own row. Nobody signed out can touch it.

## 3. Lock down sign-in (Authentication settings)
- **Sign In / Providers > Email**: turn **Confirm email** ON. Turn off every other provider you don't use.
- **Password**: set **Minimum password length** to 12. If your plan has it, turn on **Prevent use of leaked passwords**. (The site also checks every new password against a known-breach list, sending only 5 characters of a hash.)
- **URL Configuration**: set **Site URL** to `https://natehcmd.github.io/card-value/` and add the same address under **Redirect URLs**. Remove anything else (no wildcards).
- **Multi-Factor**: make sure **TOTP** is enabled. People can then turn on 2-step codes from their Account screen.
- **Rate limits**: leave the defaults on. Don't loosen them.
- **Do NOT turn on CAPTCHA yet.** The site doesn't show a CAPTCHA box, so sign-ups would stop working.

## 4. Connect the site
**Project Settings > API**. Copy the **Project URL** and the **anon public** key into `config.js`:

```js
window.AUTH_CONFIG = { url: "https://YOURPROJECT.supabase.co", anonKey: "eyJ..." };
```

The anon key is public by design. **Never** put the `service_role` key anywhere in this site: it
bypasses all the protection. Commit and push `config.js`, wait a minute, and the Sign in button appears.

## 5. Check it works
1. Create an account with a throwaway email. You should get a confirmation email.
2. Confirm, sign in, enter your numbers, wait a couple of seconds.
3. In Supabase **Table Editor > profiles**, the row should show only `salt`, `iv` and scrambled `ciphertext`. If you can read your numbers there, something is wrong. Stop and tell me.
4. Reload: the button says **Unlock my saved numbers**. Enter the password to open them.
5. Turn on 2-step verification from **Account** and sign in again.

## What this protects, and what it doesn't
- **Passwords**: stored by Supabase as salted hashes. Never in this repo, never in your browser storage.
- **Your saved numbers**: encrypted in your browser (AES-256-GCM, key from your password with 600,000 rounds of PBKDF2) before they are sent, and tied to your account id. The site owner and Supabase can't read them.
- **Other people's data**: each account can only see its own row (Row Level Security).
- **Scripts**: a strict Content Security Policy allows only this site's own scripts, so injected code can't run or phone home. The Supabase library is a pinned copy kept in `vendor/`, not loaded from a CDN.
- **Brute force**: Supabase rate-limits sign-ins, and the page adds growing delays after wrong passwords.
- **Not protected**: if someone steals your password they can open your numbers. If you forget your password and reset it, saved numbers can't be recovered (you enter them again). Supabase can still see your email address and when you sign in. Nothing on the internet is unbreakable. This follows the standard practice for this setup, but I can't promise it.
- **Headers**: GitHub Pages can't send security headers such as clickjacking protection. For the strongest setup, host on Cloudflare Pages or Netlify, which will use the `_headers` file in this repo.
