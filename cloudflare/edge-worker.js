// Worklio Pro edge Worker: carries businesses' own domains (Cloudflare for SaaS custom hostnames) to the app.
//
// SiteGround only answers for names it knows, so a request for app.theirbusiness.com is sent on to ORIGIN_HOST (a name on the
// platform's zone that SiteGround serves), with the domain the visitor typed and their IP in headers the app trusts only with the
// shared secret. The platform's own addresses (workliopro.com and its subdomains) pass straight through, untouched.
//
// Set up once in Cloudflare:
//   1. Workers & Pages → Create → Worker, name it worklio-edge, paste this file and Deploy.
//   2. The Worker → Settings → Variables and Secrets → Add → type Secret, name EDGE_SECRET, value = CF_EDGE_SECRET from the server's .env.
//   3. workliopro.com → Workers Routes → Add route: route */*  Worker worklio-edge.
const ROOT_DOMAIN = 'workliopro.com';
const ORIGIN_HOST = 'customers.workliopro.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === ROOT_DOMAIN || host.endsWith('.' + ROOT_DOMAIN) || !env.EDGE_SECRET) return fetch(request);
    url.hostname = ORIGIN_HOST;
    const headers = new Headers(request.headers);
    headers.set('X-Worklio-Host', host);
    headers.set('X-Worklio-Client-IP', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Worklio-Edge', env.EDGE_SECRET);
    return fetch(url.toString(), { method: request.method, headers, body: request.body, redirect: 'manual' });
  },
};
