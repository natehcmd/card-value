# Card Value

Compare credit cards on what they are actually worth to you.

Set what a point, a credit and a perk is worth, how much you spend each year, how much you travel and the annual fees you will pay. Every card re-ranks instantly. You can sort the table, filter it, pin cards to compare side by side, add a card of your own and download the table as CSV.

- Over 60 US cards: cash back, travel, airline, hotel, premium cards over $500, and a few you may not be able to get (marked).
- "What it gives" (points, credits and sign-up bonus offered) next to "what it's worth to you" (dollars after your values and the fee).
- Notes on whether each card is realistically open to you (issuer rules like Chase's 5/24), with a link to the issuer page.
- Starts by asking what you spend: type it in per month or per year (or give one monthly total and let it split it), or drop in CSV exports from your bank, card, Rocket Money or Mint. The files are read in your browser and never uploaded; only the category totals are kept.
- Works offline. Open `index.html`, or host the folder on GitHub Pages. Everything runs in your browser. Your settings stay in your browser's local storage and nothing is sent anywhere.

## Data

Card terms come from issuer pages read in October 2026, plus a few from secondary sources or memory. Cards tagged "Unchecked terms" were not read on the issuer's own page. Terms, fees and bonuses change often. Check the issuer before you apply.

The starting spending numbers are examples. Replace them with your own.

This is not financial advice, it uses no affiliate links, and it is not affiliated with any card issuer.

## Accounts (optional)

Sign-in with email and password, saved numbers that follow you across devices, and 2-step codes can be switched on with a free Supabase project. Your saved numbers are encrypted in the browser before they leave it. See [AUTH_SETUP.md](AUTH_SETUP.md). Until that is set up, the Sign in button stays hidden and everything stays in your browser.

## Private copy for bank files

[card-value-private.html](https://natehcmd.github.io/card-value/card-value-private.html) is the whole site in one file. Download it, open it from your computer, and upload your bank CSV. It works with no internet, and the browser itself is told to block every network connection from the page (`connect-src 'none'`), so it cannot send your data anywhere even while you are online. Its scripts are pinned by hash, so only the code in the file can run. It shows drawn cards instead of the issuers' photos, and card data is as of the build date, so download a fresh copy now and then.

To check your download is the real file, run `shasum -a 256 card-value-private.html` and compare it with `card-value-private.html.sha256`.
