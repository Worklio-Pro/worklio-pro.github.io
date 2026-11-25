// Free invoice generator (/tools/invoice-generator) and estimate template (/tools/estimate-template), plus one page per trade in
// lib/industries.js (/tools/invoice-generator/plumbing …), for searches like "plumbing invoice template" or "free roofing estimate template".
// Visitors fill in a form and see the document drawn beside it (public/doc-maker.js); "Download PDF" prints just the document, so
// the browser saves it as a PDF. Nothing is sent to the server: the business details and logo are remembered in that browser only.
// Each trade starts with example lines for its example job (the same job as its pricing calculator). The prices are examples to change,
// not market rates: the page says so.
const tenancy = require('./tenancy');
const industries = require('./industries');
const calculator = require('./calculator');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const lower = (n) => n.replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase());

// example lines per trade: [description, quantity, rate]; note: what that trade should spell out on its invoices and estimates
const TRADES = {
  hvac: { items: [['3-ton AC condenser, 16 SEER', 1, 3200], ['Installation labor', 1, 1450], ['New pad, disconnect and line set flush', 1, 220], ['Permit & refrigerant disposal', 1, 150]],
    note: 'List the equipment by model and efficiency, the warranty term, and the permit. Clients compare HVAC quotes line by line, and a clear equipment line answers most of their questions.' },
  plumbing: { items: [['50-gallon gas water heater', 1, 900], ['Remove old heater and install new', 1, 450], ['Expansion tank and fittings', 1, 120], ['Permit & haul-away', 1, 75]],
    note: 'Show the trip or diagnostic fee as its own line, then the parts and labor. For emergency calls, note the after-hours rate so the total isn’t a surprise.' },
  electrical: { items: [['200-amp panel and main breaker', 1, 1400], ['Panel upgrade labor', 16, 95], ['Grounding and bonding', 1, 180], ['Permit & inspection', 1, 250]],
    note: 'Name the panel size, the breakers and the permit, and say who meets the inspector. Code work is easy to undersell when it’s buried in one line.' },
  'lawn-care': { items: [['Weekly mow, edge and blow (¼ acre)', 4, 45], ['Spring cleanup', 1, 180], ['Mulch, installed (yards)', 3, 85]],
    note: 'For recurring service, show the price per visit and the number of visits. Put one-time work like cleanups and mulch on their own lines so clients see what repeats.' },
  'house-cleaning': { items: [['Standard clean, 3 bed / 2 bath', 1, 165], ['Inside the oven', 1, 35], ['Inside the fridge', 1, 30]],
    note: 'Name the type of clean (standard, deep, move-out) and list add-ons separately. It sets expectations for the next visit, too.' },
  'commercial-cleaning': { items: [['Nightly office cleaning, 5,000 sq ft (visits)', 22, 140], ['Restroom supplies restock', 1, 85], ['Monthly floor buff', 1, 175]],
    note: 'Bill contracts per month with the number of visits shown, and list supplies and periodic work (floors, windows) on their own lines.' },
  roofing: { items: [['Tear-off, 1 layer (squares)', 20, 85], ['Architectural shingles, installed (squares)', 20, 310], ['Drip edge, flashing and vents', 1, 650], ['Dumpster & permit', 1, 600]],
    note: 'Price by the square and list tear-off, flashing, decking replacement and disposal separately. Say what happens if bad decking is found under the old roof.' },
  'pest-control': { items: [['Initial general pest treatment', 1, 150], ['Quarterly service (visits)', 3, 95], ['Exterior perimeter granules', 1, 25]],
    note: 'Show the initial treatment and the recurring visits separately, and note what’s covered between visits (free re-treatments, for example).' },
  'pool-service': { items: [['Weekly pool cleaning (visits)', 4, 40], ['Chemicals', 1, 60], ['Filter cleaning', 1, 85]],
    note: 'Show the visits for the month and bill chemicals as their own line, so price changes during the season are easy to explain.' },
  painting: { items: [['Bedroom walls, 2 coats (12 × 14)', 1, 420], ['Ceiling, 1 coat', 1, 160], ['Trim and door', 1, 140], ['Paint and supplies', 1, 120]],
    note: 'Name the rooms or surfaces, the number of coats and the paint brand and sheen. List prep work such as patching and wallpaper removal on its own line.' },
  handyman: { items: [['Mount a TV on drywall (up to 65")', 1, 129], ['Hang floating shelves', 3, 45], ['Mounting hardware', 1, 20]],
    note: 'List each task on its own line, even small ones. Clients see the value in a list of five jobs more than in one total.' },
  'pressure-washing': { items: [['House wash, two-story', 1, 375], ['Driveway, up to 800 sq ft', 1, 150], ['Gutter brightening', 1, 95]],
    note: 'Name each surface and its size, and say whether it’s a soft wash or a pressure wash. It shows the client what they paid for and makes add-ons easy next time.' },
  'window-cleaning': { items: [['Windows, inside and out', 25, 9], ['Screen cleaning', 25, 2], ['Second-story ladder work', 1, 45]],
    note: 'Price per window or pane and list screens, tracks and hard-to-reach glass separately. For recurring clients, note the next scheduled visit.' },
  'carpet-cleaning': { items: [['Carpet cleaning (rooms, up to 250 sq ft each)', 4, 45], ['Hallway', 1, 25], ['Pet odor treatment', 1, 40], ['Carpet protector', 1, 35]],
    note: 'Price by the room with a size limit, and list stairs, stains, pet treatment and protector as add-ons, so the total matches what the client chose.' },
  'tree-care': { items: [['Remove 40 ft oak, in sections', 1, 1400], ['Stump grinding', 1, 250], ['Haul away wood and debris', 1, 300]],
    note: 'List removal, stump grinding and haul-away as separate lines the client can choose, and note who’s responsible for permits and any damage to the lawn.' },
  moving: { items: [['3 movers and truck (hours)', 6, 165], ['Packing materials', 1, 60], ['Stair carry', 1, 50]],
    note: 'Show the crew size, the hourly rate and the minimum, then materials and extras like stairs or long carries. Note how travel time is billed.' },
  remodeling: { items: [['Demolition and disposal', 1, 1200], ['Plumbing rough-in and fixtures', 1, 2400], ['Tile, shower and floor', 1, 3800], ['Vanity, toilet and fixtures (allowance)', 1, 1800]],
    note: 'Break the job into phases with a payment schedule, and mark allowances for finishes the client hasn’t picked yet, so changes are easy to price.' },
  'decks-fencing': { items: [['6 ft wood privacy fence (linear ft)', 150, 32], ['Walk gate', 1, 350], ['Remove old fence', 1, 400]],
    note: 'Price fences per linear foot and decks per square foot, and list gates, stairs and removal of the old one separately. Date the quote, since lumber prices move.' },
  flooring: { items: [['Luxury vinyl plank, installed (sq ft)', 500, 4.5], ['Remove old carpet and pad', 1, 300], ['Baseboard and transitions', 1, 250]],
    note: 'Price install per square foot and list tear-out, subfloor prep, trim and furniture moving separately. Note the extra material ordered for cuts.' },
  'low-voltage': { items: [['Cat6 drops, terminated and tested', 8, 165], ['Patch panel and rack hardware', 1, 280], ['Labeling and test report', 1, 75]],
    note: 'Price per drop and say what each includes (jack, termination, testing). Harder runs through finished ceilings or firewalls belong on their own lines.' },
  networking: { items: [['Mesh Wi-Fi system, 3 nodes', 1, 650], ['Wired access points', 2, 180], ['Setup and configuration', 1, 350]],
    note: 'List the equipment by model, then setup, and offer a monthly support plan as a separate line, so it’s easy to say yes to.' },
  'security-cameras': { items: [['4K PoE cameras', 4, 260], ['NVR with 2 TB storage', 1, 450], ['Installation and cabling', 1, 900], ['App setup on client phones', 1, 75]],
    note: 'List each camera, the recorder and its storage, then installation. Note how long footage is kept and the warranty on the equipment.' },
  'audio-video': { items: [['TV wall mount, installed', 1, 199], ['In-wall wire concealment', 1, 150], ['5.1 surround sound installation', 1, 550], ['Calibration', 1, 120]],
    note: 'Price mounting, wire concealment and calibration as separate lines, and list equipment by model, so the client can see what they’re getting.' },
  'garage-doors': { items: [['Torsion spring replacement (pair)', 1, 245], ['Door tune-up and lubrication', 1, 85], ['Service call', 1, 75]],
    note: 'List the parts and the labor separately and name the spring size or opener model, so the client knows what they paid for if they call again.' },
  'appliance-repair': { items: [['Diagnostic visit', 1, 89], ['Washer drain pump (part)', 1, 95], ['Labor, pump replacement', 1, 120]],
    note: 'Put the diagnostic fee on its own line and say whether it comes off the repair. Name the model number and part, so warranty questions are easy later.' },
  'junk-removal': { items: [['Half truck load', 1, 325], ['Mattress disposal', 2, 40], ['Stair carry', 1, 35]],
    note: 'Price by the share of the truck and list items with their own disposal fees separately, so a bigger load or an extra mattress is easy to add on site.' },
  'snow-removal': { items: [['Driveway plowing (per push)', 3, 55], ['Walkway shoveling', 3, 20], ['Ice melt application', 2, 25]],
    note: 'List each push and salt application with its date, so clients see what each storm cost and trust the bill.' },
  irrigation: { items: [['Spring start-up (up to 8 zones)', 1, 95], ['Replace sprinkler head', 2, 28], ['Controller programming', 1, 35]],
    note: 'Price the start-up by zone count and list each repair separately, so the client sees exactly what was fixed.' },
  locksmith: { items: [['Service call', 1, 65], ['Rekey lock cylinder', 4, 25], ['Keys cut', 4, 4]],
    note: 'Put the service call and any after-hours fee on their own lines, then each lock. Clients pay without arguing when they approved it first.' },
  'chimney-dryer-vent': { items: [['Chimney sweep and inspection', 1, 189], ['Chimney cap installation', 1, 175], ['Dryer vent cleaning', 1, 125]],
    note: 'Keep the sweep, the inspection and any repairs on separate lines, and include photos of what you found.' },
  'concrete-masonry': { items: [['Broom-finish concrete patio (sq ft)', 192, 9], ['Excavation and gravel base', 1, 450], ['Sealing', 1, 180]],
    note: 'Price by the square foot and show prep, finish and sealing on separate lines. Say how much the deposit is and what it covers.' },
  'holiday-lighting': { items: [['Roofline lighting (per foot)', 120, 4], ['Wrapped trees', 2, 85], ['Takedown and storage', 1, 150]],
    note: 'Price lights by the foot and list takedown and storage separately, so the January visit is part of the deal from day one.' },
  'auto-detailing': { items: [['Full detail, mid-size SUV', 1, 249], ['Pet hair removal', 1, 45], ['Headlight restoration', 1, 60]],
    note: 'Name the package and list add-ons separately, so clients see what they paid for and can pick them again next time.' },
  drywall: { items: [['Hang and finish drywall (per sheet)', 22, 38], ['Corner bead and trim', 1, 95], ['Debris disposal', 1, 75]],
    note: 'Price by the sheet or by the patch and say what level of finish is included, so there’s no surprise when the painter shows up.' },
  tile: { items: [['Shower wall tile install (sq ft)', 60, 14], ['Waterproofing membrane', 1, 260], ['Tile (client selection)', 1, 480]],
    note: 'Show labor by the square foot and list waterproofing, trim and the tile itself separately. Say how much of the deposit goes to materials.' },
  insulation: { items: [['Blown-in attic insulation to R-49 (sq ft)', 1000, 1.6], ['Air sealing', 1, 350], ['Attic baffles', 8, 12]],
    note: 'State the R-value and the area, and list air sealing and removal of old insulation separately, so clients can compare quotes fairly.' },
  'cabinets-countertops': { items: [['Stock cabinets (linear ft)', 20, 240], ['Cabinet installation (linear ft)', 20, 65], ['Hardware', 1, 180]],
    note: 'List materials and installation separately and say what the deposit covers. Note who handles the plumbing and electrical disconnects.' },
  'foundation-waterproofing': { items: [['Interior drain tile (linear ft)', 30, 85], ['Sump pump with basin', 1, 950], ['Crack injection', 2, 450]],
    note: 'List each repair and its warranty, and say when each payment is due. Photos of the problem help the client say yes.' },
  'paving-sealcoating': { items: [['Driveway sealcoat (sq ft)', 1000, 0.25], ['Crack filling (linear ft)', 60, 1.5], ['Edge trimming', 1, 40]],
    note: 'Show the area and the number of coats, and list crack filling separately. Say how long to stay off the driveway.' },
  'home-inspection': { items: [['Home inspection, up to 2,000 sq ft', 1, 425], ['Radon test', 1, 150], ['Sewer scope', 1, 195]],
    note: 'List the inspection and each add-on separately, and say when the report will be delivered.' },
  'home-watch': { items: [['Weekly home check (visits)', 4, 45], ['Storm check', 1, 60], ['Mail and package collection', 1, 25]],
    note: 'Show the number of visits in the month and list extra visits separately, so owners see what was done while they were away.' },
  'solar-panel-cleaning': { items: [['Solar panel cleaning (per panel)', 24, 9], ['Two-story access', 1, 45], ['Bird guard installation (ft)', 40, 6]],
    note: 'Price per panel and list access charges and add-ons separately, with the date of the next recommended cleaning.' },
  'rental-cleaning': { items: [['Turnover clean, 2 bed / 2 bath', 1, 135], ['Laundry, linens and towels', 1, 35], ['Restock supplies', 1, 15]],
    note: 'Show the clean, laundry and restocking separately, and list the date of each turnover when you bill a host for the month.' },
  'duct-cleaning': { items: [['Supply vent cleaning', 12, 25], ['Return cleaning', 2, 35], ['Dryer vent cleaning', 1, 99]],
    note: 'Count every vent and return and list them, plus extras, so the client sees the full price before you start.' },
  'hood-cleaning': { items: [['Exhaust hood cleaning (12 ft)', 1, 425], ['Exhaust fan cleaning', 1, 125], ['Access panel installation', 1, 95]],
    note: 'List the hood, fans and ducts separately with the date, so the restaurant has a record for the fire inspector.' },
  restoration: { items: [['Water extraction', 1, 650], ['Dehumidifier and air movers (per day)', 3, 225], ['Moisture monitoring visit', 3, 95]],
    note: 'List extraction, each day of equipment and each monitoring visit separately, with dates, so the bill matches the drying log.' },
  'mold-remediation': { items: [['Containment setup', 1, 450], ['Mold removal and cleaning (sq ft)', 50, 18], ['HEPA air scrubbing (per day)', 2, 150]],
    note: 'List containment, removal and air scrubbing separately, and say what testing after the work is included, if any.' },
  'backflow-testing': { items: [['Backflow test (per device)', 2, 75], ['Water district filing', 1, 15], ['Trip charge', 1, 35]],
    note: 'List each device by location and serial number, and say whether filing with the water district is included.' },
  'fire-safety': { items: [['Extinguisher yearly inspection', 20, 9], ['Recharge', 2, 35], ['Inspection tags', 20, 1]],
    note: 'List devices by count and type, with any recharges or replacements, and the inspection date.' },
  'ev-generators': { items: [['Level 2 EV charger (unit)', 1, 599], ['Installation with 30 ft wire run', 1, 650], ['Permit', 1, 125]],
    note: 'Show the unit, labor, wiring and permit separately, and say what happens if the panel needs an upgrade.' },
  'well-septic': { items: [['Septic pumping, up to 1,000 gal', 1, 375], ['Locate and dig to lid', 1, 85], ['Filter cleaning', 1, 45]],
    note: 'Note the tank size and condition, list digging and extras separately, and recommend the next pumping date.' },
  'wildlife-removal': { items: [['Inspection', 1, 125], ['Trapping and removal (daily checks included)', 1, 350], ['Roof vent exclusion', 2, 175]],
    note: 'List each stage separately and state any warranty on the exclusion work.' },
  'pet-waste-removal': { items: [['Weekly yard cleanup, 2 dogs (visits)', 4, 18], ['Initial cleanup', 1, 60], ['Deodorizer treatment', 1, 15]],
    note: 'Show the visits in the month and list one-time cleanups separately, so the monthly price stays simple.' },
  'pet-grooming': { items: [['Full groom, medium dog', 1, 95], ['De-matting (per 15 min)', 1, 20], ['Nail grinding', 1, 15]],
    note: 'Price by size and coat, and list add-ons, so clients know what changes the price next time.' },
};
const GENERAL = { items: [['Service call', 1, 95], ['Labor (hours)', 3, 85], ['Parts and materials', 1, 140]],
  note: 'Describe the work in plain words, with one line for each part of the job. Clients pay faster when they can see what each charge is for.' };

const MODES = {
  invoice: { path: '/tools/invoice-generator', name: 'Invoice generator', doc: 'invoice', title: (n) => (n ? `${n} invoice template` : 'Free invoice generator'),
    lead: (n) => `Make a ${n ? esc(lower(n)) + ' ' : ''}invoice in a minute: add your logo, your client and the work, then download a PDF to email, text or print. Free, with no sign-up.`,
    cta: 'Send invoices clients pay by card, free for 30 days', ctaNote: `${product()} sends the invoice, reminds the client and takes card payments, so you’re not chasing checks.` },
  estimate: { path: '/tools/estimate-template', name: 'Estimate template', doc: 'estimate', title: (n) => (n ? `${n} estimate template` : 'Free estimate template'),
    lead: (n) => `Write a ${n ? esc(lower(n)) + ' ' : ''}estimate clients can say yes to: your logo, the work line by line, a deposit and a signature line. Download it as a PDF. Free, with no sign-up.`,
    cta: 'Send estimates clients sign online, free for 30 days', ctaNote: `${product()} sends the estimate as a link: the client picks an option, signs and pays the deposit from their phone.` },
};

const FAQ = {
  invoice: (n) => [
    ['Is this invoice generator really free?', 'Yes. There’s no sign-up and no watermark across the invoice, only a small line at the bottom. Nothing you type is sent to us: your business details and logo are remembered in this browser, so they’re filled in next time.'],
    ['How do I save the invoice as a PDF?', 'Tap Download PDF and choose “Save as PDF” as the printer. On an iPhone, tap the share button in the print screen, then Save to Files. You can also print it on paper.'],
    [`What should a ${n ? lower(n) + ' ' : ''}invoice include?`, 'Your business name and contact details, the client’s name and address, an invoice number, the invoice date and due date, each charge on its own line, tax, the total, and how to pay you.'],
    ['When should I send an invoice?', 'As soon as the work is done, ideally before you leave the job. The longer an invoice waits, the longer you wait to get paid. Net 14 or due on receipt is common for service work.'],
  ],
  estimate: (n) => [
    ['Is this estimate template really free?', 'Yes. There’s no sign-up and no watermark across the estimate, only a small line at the bottom. Nothing you type is sent to us: your business details and logo are remembered in this browser, so they’re filled in next time.'],
    ['What’s the difference between an estimate and a quote?', 'An estimate is your best guess at the price, which can change once work starts. A quote is a fixed price for the work described. Many service businesses use the words interchangeably, so say on the document whether the price is fixed.'],
    [`How long should a ${n ? lower(n) + ' ' : ''}estimate be valid?`, '30 days is common. A shorter window (7 to 14 days) makes sense when material prices move quickly, and it gives the client a reason to decide.'],
    ['Should I ask for a deposit?', 'For larger jobs, yes: a deposit covers materials and holds the date on your schedule. 25% to 50% is common for jobs with a lot of materials. Put the deposit on the estimate so it’s agreed before you start.'],
  ],
};
const HOW = {
  invoice: ['<b>Add your business.</b> Your logo, name, address, phone and email. They’re remembered in this browser for next time.', '<b>Add the client and the work.</b> One line for each charge, with the quantity and price. Tax and the total add up as you type.', '<b>Download and send.</b> Save it as a PDF, then email or text it to your client, with how to pay in the notes.'],
  estimate: ['<b>Add your business and the client.</b> Your logo and contact details, and who the estimate is for.', '<b>List the work.</b> One line for each part of the job, so the client can see what they’re paying for. Add a deposit for larger jobs.', '<b>Download, send and get it signed.</b> Save it as a PDF; the signature line at the bottom is where the client accepts it.'],
};
const NOTES = {
  invoice: 'Thank you for your business! Payment is due by the due date. We accept card, check and bank transfer.',
  estimate: 'This estimate is valid until the date above. Prices include labor and materials listed. Any changes to the work will be quoted before they’re done.',
};

const tradeList = (m, current) => `<div class="calc-trades">${industries.INDUSTRIES.filter((i) => i.slug !== current).map((i) => `<a href="${m.path}/${i.slug}">${esc(i.name)}</a>`).join('')}</div>`;

function tool(mode, t, i) {
  const m = MODES[mode]; const est = mode === 'estimate'; const job = i && calculator.TRADES[i.slug] ? calculator.TRADES[i.slug].job : '';
  const data = { mode, items: t.items, notes: NOTES[mode], product: tenancy.platform().settings.productName || 'Worklio Pro', job };
  const f = (label, input) => `<label class="dm-f"><span>${label}</span>${input}</label>`;
  return `
      <div class="dm" id="dm">
        <form class="dm-form" onsubmit="return false" autocomplete="off">
          <p class="calc-ex">${job ? `Example: <b>${esc(job)}</b>. ` : ''}The prices are examples. Change everything to your own.</p>
          <fieldset><legend>Your business</legend>
            <div class="dm-logo"><span class="dm-logo-box" id="dm-logo-box">Logo</span><span><label class="btn alt dm-up">Add logo<input type="file" id="dm-logo" accept="image/*" hidden></label> <button type="button" class="dm-link" id="dm-logo-x" hidden>Remove</button><small>PNG or JPG. Stays in this browser.</small></span></div>
            ${f('Business name', '<input id="dm-from" placeholder="Your business name">')}
            ${f('Address, phone and email', '<textarea id="dm-from2" rows="3" placeholder="123 Main St, Springfield\n(555) 123-4567\nyou@example.com"></textarea>')}
            ${f('Accent color', '<input type="color" id="dm-color" value="#2563eb">')}
          </fieldset>
          <fieldset><legend>${est ? 'Prepared for' : 'Bill to'}</legend>
            ${f('Client name', '<input id="dm-to" placeholder="Client name">')}
            ${f(est ? 'Address of the job' : 'Client address', '<textarea id="dm-to2" rows="2" placeholder="456 Oak Ave, Springfield"></textarea>')}
          </fieldset>
          <fieldset><legend>${est ? 'Estimate' : 'Invoice'} details</legend><div class="dm-row3">
            ${f(est ? 'Estimate #' : 'Invoice #', `<input id="dm-num" value="${est ? 'EST-1001' : 'INV-1001'}">`)}
            ${f('Date', '<input type="date" id="dm-date">')}
            ${f(est ? 'Valid until' : 'Due date', '<input type="date" id="dm-due">')}</div>
          </fieldset>
          <fieldset><legend>The work</legend>
            <div class="dm-items" id="dm-items"></div>
            <button type="button" class="btn alt" id="dm-add">+ Add a line</button>
            <div class="dm-row3">
              ${f('Discount', '<span class="calc-in"><i>$</i><input type="number" inputmode="decimal" min="0" step="any" id="dm-disc" value="0"></span>')}
              ${f('Tax', '<span class="calc-in"><input type="number" inputmode="decimal" min="0" step="any" id="dm-tax" value="0"><i>%</i></span>')}
              ${est ? f('Deposit to start', '<span class="calc-in"><input type="number" inputmode="decimal" min="0" max="100" step="any" id="dm-dep" value="25"><i>%</i></span>')
    : f('Already paid', '<span class="calc-in"><i>$</i><input type="number" inputmode="decimal" min="0" step="any" id="dm-paid" value="0"></span>')}
            </div>
          </fieldset>
          <fieldset><legend>Notes</legend>
            ${f(est ? 'Terms and notes' : 'Payment terms and notes', '<textarea id="dm-notes" rows="3"></textarea>')}
            ${est ? '<label class="dm-check"><input type="checkbox" id="dm-sign" checked> Add a signature line for the client</label>' : ''}
          </fieldset>
        </form>
        <div class="dm-side">
          <div class="dm-paper-wrap"><div class="dm-paper" id="dm-paper" aria-label="${est ? 'Estimate' : 'Invoice'} preview"></div></div>
          <div class="dm-acts"><button type="button" class="btn" id="dm-print">Download PDF</button><button type="button" class="btn alt" id="dm-reset">Start over</button></div>
          <div class="dm-cta"><a class="btn alt" href="/pricing${i ? `?industry=${i.slug}` : ''}" data-trial>${esc(m.cta)}</a><small>${m.ctaNote}</small></div>
        </div>
      </div>
      <script type="application/json" id="dm-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function body(mode, t, i) {
  const m = MODES[mode]; const name = i ? i.name : ''; const faq = FAQ[mode](name); const other = mode === 'invoice' ? MODES.estimate : MODES.invoice;
  return {
    faq,
    html: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <nav class="i-crumbs" aria-label="Breadcrumb" style="justify-content:center"><a href="/tools">Free tools</a><span aria-hidden="true">/</span>${i ? `<a href="${m.path}">${m.name}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span>` : `<span aria-current="page">${m.name}</span>`}</nav>
      <span class="h-eyebrow">Free tool</span>
      <h1>${esc(m.title(name))}</h1>
      <p class="lead">${m.lead(name)}</p>
    </div></section>

    <section class="h-sec" style="padding-top:8px"><div class="h-wrap">${tool(mode, t, i)}</div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap calc-read">
      <h2>How to make ${mode === 'invoice' ? 'an invoice' : 'an estimate'}</h2>
      <ol>${HOW[mode].map((s) => `<li>${s}</li>`).join('')}</ol>
      <div class="cmp-fit"><h2>${i ? `What to put on a ${esc(lower(name))} ${m.doc}` : `What makes a good ${m.doc}`}</h2><p>${esc(t.note)}</p></div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>${mode === 'invoice' ? 'Invoice' : 'Estimate'} FAQ</h2></div>
      <div class="h-faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <p class="i-more">${i ? `<a href="/tools/pricing-calculator/${i.slug}">Work out your price first: ${esc(lower(name))} pricing calculator →</a><br><a href="${other.path}/${i.slug}">${esc(other.title(name))} →</a><br><a href="/industries/${i.slug}">See how ${product()} helps ${esc(lower(name))} businesses →</a>`
    : `<a href="/tools/pricing-calculator">Work out your price first: job pricing calculator →</a><br><a href="${other.path}">${esc(other.title(''))} →</a>`}</p>
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">By industry</span><h2>${i ? `${m.doc[0].toUpperCase() + m.doc.slice(1)} templates for other industries` : 'Pick your industry'}</h2>${i ? '' : '<p>Each one starts with example lines for a typical job in that industry.</p>'}</div>
      ${tradeList(m, i && i.slug)}
    </div></section>
    <script src="/doc-maker.js?v=1"></script>`,
  };
}

function render(mode, slug) {
  const i = slug ? industries.INDUSTRIES.find((x) => x.slug === slug) : null; if (slug && (!i || !TRADES[slug])) return null;
  const b = body(mode, i ? TRADES[slug] : GENERAL, i);
  return industries.shell({ head: require('./seo').docHead(mode, i, b.faq), body: b.html });
}

module.exports = { TRADES, MODES, page: render };
