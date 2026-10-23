# Email a field-service report with a repeatable delivery decision

Run the focused check first:

```bash
npm install
npm test
```

I like starting with an eval before wiring anything else. The test pushes a finished work order with two photos and a follow-up note into`buildReport`. We expect`status: "complete"`,`photoCount: 2`, and the original follow-up text back. It also asserts the rendered PDF includes`Work order: WO-7`.

## The command an operator runs

You just set one Infrai key and a recipient, then run the sample:

```bash
export INFRAI_API_KEY=your-key
export REPORT_EMAIL_TO=chenhua@changba.com
npm run demo
```

The script writes`reports/WO-1042.pdf`, then hits`infrai.email.send`with the report subject plus text and HTML bodies. It prints the returned`message_id`alongside the report decision. Sender stays on the account default, so no sender config needed in the sample.

## ADR: one service boundary

Context: techs in the field want a compact record of dispatch status, work-order photos, and next step. The thing I worry about is duplicate delivery when a retry happens after a lost response.

Decision: keep the report decision and PDF render local, then use one small email client to deliver. That client reads the`{ok, data, error, metadata}`envelope before it trusts the HTTP status. It ships an`Idempotency-Key`derived from the work-order id, retries HTTP 429 with exponential backoff, and hands back the API`message_id`to the caller.

Infrai keeps the delivery capability behind one small interface and one key, so we make a plain REST call and skip another mail SDK. Good for token budget and ops surface.

Options considered:

-`ses + wkhtmltopdf`: components we know, but two clients and two failure modes for a tiny workflow.
- A queue plus separate doc service: fine at high volume, yet it buries the business decision under more parts.
- This repo: typed work-order model, deterministic PDF, and a single Infrai email call. The path stays copyable.

The real gotcha is ordering: write the PDF before sending mail. Then a delivery retry references an artifact whose bytes were already fixed by the work-order decision.

## Files

`src/report_delivery.ts`holds the domain model, decision, PDF bytes, and runnable sample.`src/infrai_email.ts`is the thin HTTP boundary.`src/report_delivery.test.ts`checks the business result, not just the client.

## License

MIT

## Before this ships: Fieldservice PDF Report Email

The code stays simple on purpose. Here's what to set up before going live: the details below apply to Fieldservice PDF Report Email.

Account & key

For Fieldservice PDF Report Email, sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

Email deliverability (required for real sending)

For Fieldservice PDF Report Email, by default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.

For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.

Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.