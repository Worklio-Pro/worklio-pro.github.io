// The public site's look (the home page's design: headline and handwriting fonts, dust, small corners, taped pictures; public/home.css, body.hv2)
// on every public page. lib/seo.js inject() runs it on the static pages (home, pricing, features, marketing, Snap to quote, Good / Better / Best,
// partners) and lib/industries.js shell() on the generated ones (industries, compare, free tools, supporters). It's safe to run twice.
const HOME_CSS = '39'; // the home.css version every public page loads, so a change there reaches every page at once
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  '
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Permanent+Marker&display=swap">';

function look(html) {
  let out = html.replace(/\/home\.css\?v=\d+/g, `/home.css?v=${HOME_CSS}`);
  if (!out.includes('/home.css')) out = out.replace(/(<link rel="stylesheet" href="\/styles\.css[^"]*">)/, `$1\n  <link rel="stylesheet" href="/home.css?v=${HOME_CSS}">`); // the pricing page has its own styles
  if (!out.includes('family=Big+Shoulders+Display')) out = out.replace('</head>', `  ${FONTS}\n</head>`);
  // body.hv2, keeping any class or attributes the page already has
  out = out.replace(/<body([^>]*)>/, (m, attrs) => {
    if (/\bclass="[^"]*\bhv2\b/.test(attrs)) return m;
    return /\bclass="/.test(attrs) ? `<body${attrs.replace(/\bclass="/, 'class="hv2 ')}>` : `<body class="hv2"${attrs}>`;
  });
  return out;
}

module.exports = { look, HOME_CSS };
