# Brooks Process Solutions website

Static site for Brooks Process Solutions, served by GitHub Pages from `main`.

The current site sells one package to trades and home improvement firms: **Never Miss an Enquiry**
(instant enquiry replies, missed-call text back, quote follow-up, review requests and a Google
Business Profile tidy-up).

## Files

- `index.html`: the home page (the trades package)
- `assets/styles.css`: shared styles (the theme)
- `assets/sector.css`: extra components (workflow rows, tool chips) used by the home page
- `assets/site.js`: home page interactions: menu, missed-jobs calculator, contact form and Cal.com booking
- `results.html`, `assets/results.*`: example client results dashboard
- `privacy.html`: privacy policy, linked from the forms and the footer
- `trades.html`, `professional-services.html`: redirects to the home page (old links keep working)
- `404.html`: not-found page
- `archive/consultancy-v1/`: archived copy of the earlier AI consultancy site (Audit, Sprint, Partner),
  hidden from search engines. It still runs on `assets/main.js`.

## Settings in `assets/site.js`

| Setting | What it does |
| --- | --- |
| `CONTACT_EMAIL` | Where enquiries go, and the address in the "email us directly" fallback |
| `FORM_ENDPOINT` | FormSubmit endpoint, using the private alias so the email address isn't in the page |
| `MAKE_WEBHOOK` | Make webhook that copies every enquiry into HubSpot |
| `BOOKING_URL` | Cal.com link embedded in the booking section |

`assets/main.js` has its own copy of these settings for the archived site. Change both if any of them change.
