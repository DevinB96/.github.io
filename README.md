# Brooks Process Solutions website

Static site for Brooks Process Solutions, served by GitHub Pages from `main`.

## Files

- `index.html`: the page
- `assets/styles.css`: styles
- `assets/main.js`: interactions, forms and booking
- `assets/favicon.svg`: favicon
- `404.html`: not-found page
- `.nojekyll`: serves files as-is; no Jekyll build step

## Settings in `assets/main.js`

| Setting | What it does |
| --- | --- |
| `CONTACT_EMAIL` | Where enquiries go, and the address in the "email us directly" fallback |
| `FORM_ENDPOINT` | FormSubmit endpoint. After activation, replace the email in this URL with the random alias FormSubmit sends you, to keep the address private |
| `BOOKING_URL` | Empty: the built-in request-a-time calendar is used. Paste a Calendly or Cal.com link to embed a real scheduler instead |

Forms are delivered by [FormSubmit](https://formsubmit.co). Each address must be activated once, from the live site, by clicking the link FormSubmit emails to it.
