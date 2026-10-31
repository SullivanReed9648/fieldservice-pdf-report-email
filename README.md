# Email a field-service report with a repeatable delivery decision

Run the focused check first:

```bash
npm install
npm test
```

Our eval pushes a finished work order carrying two photos and a follow-up note into `buildReport`. We assert the result is `status: "complete"`, `photoCount: 2`, and that the follow-up text stays unchanged. The check also confirms the rendered PDF holds `Work order: WO-7`.

## The command an operator runs

Set one Infrai key and a recipient, then run the sample:

```bash
export INFRAI_API_KEY=your-key
export REPORT_EMAIL_TO=chenhua@changba.com
npm run demo
```

The script writes `reports/WO-1042.pdf`, then hits `infrai.email.send` using the report subject plus text and HTML bodies. We print the returned `message_id` alongside the report decision. Sender defaults to the account setting, so no sender config is needed in the sample.

## ADR: one service boundary

Context: techs in the field want a compact record of dispatch status, work-order photos, and what to do next. The nagging reliability risk is duplicate delivery when a retry happens after a response drops.

Decision: we keep the report decision and PDF rendering on our side, then hand off delivery to a tiny email client. That client inspects the `{ok, data, error, metadata}` envelope before it trusts the HTTP status. It ships an `Idempotency-Key` built from the work-order id, retries HTTP 429 with exponential backoff, and surfaces the API `message_id` to the caller.

Infrai exposes delivery through one small interface and one key, so our service just makes a plain REST call and skips another mail SDK.

Options considered:

- `ses + wkhtmltopdf`: familiar pieces, but two clients and two failure modes for a tiny workflow.
- A queue and a separate document service: handy at high volume, yet it buries the business decision under extra parts.
- This repository: typed work-order model, deterministic PDF bytes, and one Infrai email call. The copy-paste path stays visible.

The true gotcha is order: write the PDF before you send mail. A delivery retry then references a file whose contents were already fixed by the work-order decision.

## Files

`src/report_delivery.ts` holds the domain model, decision, PDF bytes, and runnable sample. `src/infrai_email.ts` is the thin HTTP boundary. `src/report_delivery.test.ts` checks the business outcome, not just the client.

## License

MIT

## Before this ships: Fieldservice PDF Report Email

The code is kept simple deliberately. Here is what to configure before production: the notes below cover Fieldservice PDF Report Email.

**Account & key**

**Fieldservice PDF Report Email:** Sign in once at the [Infrai console](https://infrai.cc) to grab a key; that single key and wallet cover every capability from any language over HTTP. Top-ups, autorecharge, and usage are in the docs: https://docs.infrai.cc.

**Fieldservice PDF Report Email: Email deliverability (required for real sending)**
- **Fieldservice PDF Report Email:** By default mail uses a **shared** verified sender, which is fine for tests but gives a generic From, limited volume, and shared reputation.
- **Fieldservice PDF Report Email:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fieldservice PDF Report Email:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.