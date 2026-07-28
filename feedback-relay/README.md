# Private feedback relay

This optional Cloudflare Worker receives reports from the extension and creates
issues in a separate private GitHub repository. The GitHub token is stored only
as a Worker secret and is never bundled with the extension.

## Setup

1. Create a private repository such as `rsvp-reader-private-reports`.
2. Create a fine-grained GitHub token restricted to that repository with:
   - **Issues: Read and write**;
   - **Contents: Read and write** when page captures are enabled.
3. Review the values in `wrangler.jsonc`, especially `GITHUB_OWNER`,
   `GITHUB_REPOSITORY`, `GITHUB_BRANCH`, and `ALLOWED_ORIGINS`.
4. Store the token and deploy:

```bash
cd feedback-relay
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

5. Create `.env.local` at the project root:

```dotenv
VITE_FEEDBACK_ENABLED=true
VITE_FEEDBACK_ENDPOINT=https://rsvp-reader-feedback-relay.example.workers.dev
```

6. Run `npm run build` and reload `dist` in the browser.

Use the final published extension origin in `ALLOWED_ORIGINS`, for example
`chrome-extension://EXTENSION_ID`. An empty value accepts every origin and is
appropriate only for initial local testing. Configure rate limiting on the
Worker before publishing the endpoint.

## Disable without deleting

Set the following value in `.env.local`, rebuild, and reload the extension:

```dotenv
VITE_FEEDBACK_ENABLED=false
```

The feedback button and its event handlers will disappear while all source code
remains available.

## Data handling

- The selected excerpt is optional.
- The PDF page image is optional and disabled by default.
- No local file path is included; only the file name may be sent.
- Reports are stored as issues in the private repository.
- Optional page images are stored under `reports/REPORT_ID/page.png` in that
  private repository.

Cloudflare configuration follows the official
[Workers environment variable](https://developers.cloudflare.com/workers/configuration/environment-variables/)
and [secret](https://developers.cloudflare.com/workers/configuration/secrets/)
documentation. The relay uses GitHub's official
[Create an issue](https://docs.github.com/en/rest/issues/issues#create-an-issue)
and [Create or update file contents](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)
REST endpoints.
