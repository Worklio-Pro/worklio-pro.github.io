// Guides that ship with the app (lib/guides.js seeds each one once, as a draft, and emails the reviewer). key: never change it once shipped.
// Same rules as the weekly writer: lib/guides.js STYLE.
const GUIDES = [
  {
    key: 'snow-pricing-2026-11', slug: 'how-to-price-snow-removal', industry: 'snow-removal', category: 'pricing',
    title: 'How to Price Snow Removal: Per Push, Per Season or Per Inch',
    summary: 'What to charge for residential snow removal, how to work out your own per-push price from your costs, and when a seasonal contract beats per-push pricing (and when it bites you).',
    keywords: 'snow removal pricing, how much to charge for snow plowing, per push snow removal, seasonal snow removal contract, snow plowing rates',
    sources: [
      { title: 'Housecall Pro: Snow removal prices', url: 'https://www.housecallpro.com/resources/snow-removal-prices/' },
      { title: 'Angi: How much does an annual snow removal contract cost?', url: 'https://www.angi.com/articles/how-much-does-annual-snow-removal-contract-cost.htm' },
      { title: 'Aspire: How to charge per push for snow removal', url: 'https://www.youraspire.com/blog/charge-per-push-snow-removal' },
    ],
    body: `<p>Most residential snow removal companies charge somewhere between <strong>$30 and $75 per push</strong> for a regular driveway, or <strong>$300 to $700 for the season</strong>. Salting and walkways usually cost extra. Those are national ranges, though. Your price should come from your own costs and how much snow your town actually gets, not from what someone in another state charges.</p>
<p>This guide walks through the three ways to price snow work, how to work out your own per-push number, and how to write a seasonal contract that doesn't lose you money in a heavy winter.</p>

<h2>The three ways to charge</h2>
<table>
<thead><tr><th>Model</th><th>How it works</th><th>Good for</th><th>Watch out for</th></tr></thead>
<tbody>
<tr><td><strong>Per push</strong></td><td>A set price every time you plow, once snow passes your trigger depth (usually 2 inches)</td><td>New businesses, areas with unpredictable winters</td><td>Clients get a surprise bill after a big week and start skipping pushes</td></tr>
<tr><td><strong>Seasonal</strong></td><td>One price for the whole winter, paid in installments</td><td>Steady income, filling your route before the first storm</td><td>A heavy winter. Without a cap on visits you can work at a loss</td></tr>
<tr><td><strong>Per inch (tiered)</strong></td><td>Per push, but the price steps up with depth: 2 to 4 inches, 4 to 8, 8 to 12</td><td>Areas that get both light dustings and real dumps</td><td>Arguments over how deep it was. Write down how you measure</td></tr>
</tbody>
</table>
<p>Most owners end up offering two: per push for clients who want it, and a seasonal contract with a visit cap for everyone else. Seasonal is where your cash flow comes from.</p>

<h2>Work out your per-push price from your costs</h2>
<p>Everything else is built on your per-push price, so get this one right. You need three numbers.</p>
<ol>
<li><strong>What an hour on the road costs you.</strong> Fuel, plow and truck wear, insurance spread across the season, and pay for whoever drives (with payroll taxes if they're an employee). For a one-truck operation this often lands between $60 and $90 an hour.</li>
<li><strong>How many driveways you can do in an hour.</strong> Include drive time between stops. Time a real route if you can. A tight neighborhood route might do 4 an hour; a spread-out rural one might do 2.</li>
<li><strong>The profit you want to keep</strong> on top of covering costs. Snow is seasonal and risky, so aim higher than you would for lawn work.</li>
</ol>
<div class="example">
<p>Say your truck, plow, fuel, insurance and driver cost <strong>$70 an hour</strong> all in, and your route does <strong>20 driveways in 6 hours</strong>, drive time included.</p>
<p>Cost per driveway: $70 × 6 hours = $420, divided by 20 driveways = <strong>$21 per push</strong>.</p>
<p>At <strong>$45 per push</strong>, each driveway leaves you $24. One storm brings in $900 against $420 of cost, so you keep about $480 before salt and walkways.</p>
<p>If you charged $35 because that's what the guy down the road charges, you'd keep $280 a storm. Over a 15-storm winter that's $3,000 less for the same work.</p>
</div>
<p>Price bigger driveways by how much longer they take, not by guesswork. A driveway that takes twice as long should cost close to twice as much. The <a href="/tools/pricing-calculator/snow-removal">snow removal pricing calculator</a> does this math for you if you enter your materials, hours and the margin you want.</p>

<h2>Add-ons that should never be free</h2>
<p>Charge for these separately, or build them into a higher seasonal price on purpose:</p>
<ul>
<li><strong>Salt or ice melt:</strong> often $20 to $60 per application on a home driveway. Salt costs went up sharply in some recent winters, so check your supplier price before you quote.</li>
<li><strong>Walkways and steps</strong> shoveled by hand: often $10 to $30. It's slow work and it's what clients notice most.</li>
<li><strong>Clearing around mailboxes, hydrants or a second parking pad.</strong></li>
<li><strong>Snow hauling or stacking</strong> after a big storm when there's nowhere left to push it.</li>
<li><strong>Priority service</strong> for clients who need to be cleared by a set time, like a 6 a.m. shift worker.</li>
</ul>

<h2>How to set a seasonal price that survives a bad winter</h2>
<p>A seasonal contract is a bet. In a light winter you win; in a heavy one you lose. You can make it a fair bet with two things: real snowfall history and a visit cap.</p>
<ol>
<li><strong>Find your average number of plowable events.</strong> Look up the last 5 to 10 winters for your town (NOAA's climate data or your local weather service office). Count the storms that crossed your trigger depth, not total inches. Many northern towns land between 10 and 20.</li>
<li><strong>Multiply by your per-push price.</strong> 15 events × $45 = $675.</li>
<li><strong>Take off a little for the guaranteed money.</strong> Clients pay you whether it snows or not, so a 5 to 10% discount is fair. $675 becomes about $625.</li>
<li><strong>Cap the visits.</strong> Include, say, 20 pushes. After that, each push is billed at your per-push price. This one line is what saves you in a record winter.</li>
</ol>
<div class="example">
<p>Seasonal price: <strong>$625</strong> for November 15 to April 1, up to 20 pushes at 2 inches or more, paid in three installments ($210 by November 15, $210 by January 1, $205 by February 1). Each push after the 20th: $45. Salt: $30 per application, only when asked.</p>
<p>Light winter, 9 pushes: you earn $625 for $189 of cost. Average winter, 15 pushes: $625 for $315 of cost. Record winter, 26 pushes: $625 + 6 × $45 = $895 for $546 of cost. You still make money.</p>
</div>
<div class="note">Get the first installment paid before the first snow. Chasing a seasonal payment in March, after a light winter, is the hardest money you'll ever try to collect.</div>

<h2>Put it in writing</h2>
<p>Most snow disputes come from things nobody wrote down. Your agreement or quote should say:</p>
<ul>
<li><strong>Trigger depth</strong> (2 inches is common) and how depth is measured, for example at the end of the snowfall at a set spot.</li>
<li><strong>Service window:</strong> for example, "cleared within 12 hours after the snow stops". Don't promise "before you leave for work" to everyone; you can't keep it.</li>
<li><strong>Season dates</strong> and what happens with snow outside them.</li>
<li><strong>What's included:</strong> the driveway only, or walks, steps and the mailbox too.</li>
<li><strong>Damage terms:</strong> clients mark the edges with stakes before the ground freezes; you aren't responsible for unmarked items or the usual lawn edge scraping, and you repair anything you clearly damaged.</li>
<li><strong>The payment schedule</strong> and what happens if an installment is late (service pauses).</li>
</ul>
<p>Send it as a quote the client approves and signs online, and take the first installment as a deposit when they approve. In {product} the deposit is paid at approval and comes off the invoice automatically, so the paperwork is done before the first flake. The <a href="/tools/estimate-template/snow-removal">snow removal estimate template</a> is a free starting point if you're doing it on paper.</p>

<h2>Commercial lots are a different job</h2>
<p>Parking lots, churches and small businesses usually pay per push or per hour by equipment, with salting on every visit, because their liability is higher. Don't sell a commercial lot a flat seasonal price without a cap, and check that your insurance covers commercial snow work before you quote it. Slip-and-fall claims are where commercial snow gets expensive.</p>

<h2>When to raise your prices</h2>
<p>Raise them before the season, not during it. Send current clients their new price in September or October with the renewal, and keep it simple: what it was, what it is, and the main reason (fuel, salt, insurance). A $5 per push or $50 per season increase rarely loses good clients. The ones it does lose were usually your slowest-paying.</p>

<h2>The short version</h2>
<ul>
<li>Work out your per-push price from your cost per hour and driveways per hour, not from a competitor's flyer.</li>
<li>Charge for salt, walkways and hauling separately.</li>
<li>Price seasonal contracts from your town's average plowable events, then cap the visits.</li>
<li>Get the first installment paid before the first storm.</li>
<li>Write down the trigger depth, service window, season dates and damage terms.</li>
</ul>`,
  },
  {
    key: 'cleaning-pricing-2026-11', slug: 'how-much-to-charge-for-house-cleaning', industry: 'house-cleaning', category: 'pricing',
    title: 'How Much to Charge for House Cleaning (and How to Quote It)',
    summary: 'Work out an hourly rate that actually pays you, turn it into flat prices clients like, and price first cleans, recurring visits and add-ons without guessing.',
    keywords: 'how much to charge for house cleaning, house cleaning prices, cleaning rates per hour, house cleaning price per square foot, cleaning quote',
    sources: [
      { title: 'Housecall Pro: House cleaning prices', url: 'https://www.housecallpro.com/resources/house-cleaning-prices/' },
      { title: 'Jobber: How much to charge for house cleaning', url: 'https://getjobber.com/academy/cleaning/how-much-to-charge-for-house-cleaning/' },
      { title: 'HomeAdvisor: House cleaning prices and rates', url: 'https://www.homeadvisor.com/cost/cleaning-services/' },
    ],
    body: `<p>Most house cleaning businesses in the US land between <strong>$40 and $55 an hour per cleaner</strong>, which works out to roughly <strong>$140 to $220 for a standard clean of a 2,000 square foot home</strong>. Deep cleans and move-outs cost more. But plenty of cleaners charge those prices and still struggle, because their rate never covered drive time, supplies and the hours they spend on the office side.</p>
<p>Here's how to work out the rate that pays you, and how to turn it into prices clients understand.</p>

<h2>Start with what an hour costs you</h2>
<p>Before you think about what clients will pay, add up what one hour of cleaning costs you to deliver. Most people forget at least two of these:</p>
<ul>
<li><strong>Labor:</strong> what you pay the cleaner, plus payroll taxes and workers' comp if they're an employee (often 12 to 18% on top of the wage). If it's just you, use the hourly wage you want to pay yourself.</li>
<li><strong>Supplies:</strong> chemicals, cloths, vacuum bags and replacing worn-out equipment. Often $1.50 to $3 per cleaning hour.</li>
<li><strong>Drive time and gas:</strong> 20 minutes between houses is unpaid time unless your price covers it.</li>
<li><strong>Overhead:</strong> insurance and bonding, your phone, software, advertising, the hours you spend quoting and scheduling. Add it up for a month and divide by the hours you clean that month.</li>
</ul>
<div class="example">
<p>A cleaner earns <strong>$18 an hour</strong>. Payroll taxes and workers' comp add about 15%: <strong>$20.70</strong>.</p>
<p>Supplies: <strong>$2</strong> an hour. Drive time and gas spread over the cleaning hours: <strong>$3</strong>. Overhead (insurance, software, phone, ads) of $1,200 a month across 150 cleaning hours: <strong>$8</strong>.</p>
<p>Real cost per cleaning hour: $20.70 + $2 + $3 + $8 = <strong>$33.70</strong>.</p>
<p>To keep a 30% profit margin: $33.70 ÷ 0.70 = <strong>$48 an hour</strong>. Charge $35 because it "sounds fair" and you're making about $1 an hour on every hour your cleaner works.</p>
</div>
<p>The <a href="/tools/pricing-calculator/house-cleaning">house cleaning pricing calculator</a> runs the same math if you'd rather plug in your own numbers.</p>

<h2>Turn your hourly rate into flat prices</h2>
<p>Clients don't like open-ended hourly bills. They want to know the price before you show up. So use your hourly rate behind the scenes and quote flat prices.</p>
<ol>
<li><strong>Estimate the hours.</strong> A rough starting point for one cleaner on a standard recurring clean is 600 to 700 square feet an hour. A deep clean goes about half as fast. Adjust for pets, clutter and the number of bathrooms, which take far longer than bedrooms.</li>
<li><strong>Multiply by your rate.</strong></li>
<li><strong>Round to a clean number</strong> and set a minimum so small jobs still pay for the drive.</li>
</ol>
<div class="example">
<p>A 2,000 square foot home, 3 bedrooms, 2 bathrooms, one dog, cleaned every two weeks.</p>
<p>2,000 ÷ 650 square feet an hour ≈ <strong>3 hours</strong> for one cleaner. 3 × $48 = $144. Round to <strong>$150 per visit</strong>.</p>
<p>That's about $0.075 a square foot, right inside the national range.</p>
</div>
<p>Once you've priced a dozen homes this way, you'll see a pattern and can build a simple price list by bedrooms and bathrooms. Keep the hourly math in your head for unusual houses.</p>
<table>
<thead><tr><th>Home</th><th>Standard (recurring)</th><th>First clean or deep clean</th></tr></thead>
<tbody>
<tr><td>1 to 2 bed, 1 bath</td><td>$110 to $130</td><td>$190 to $240</td></tr>
<tr><td>3 bed, 2 bath</td><td>$140 to $170</td><td>$250 to $320</td></tr>
<tr><td>4 bed, 2.5 to 3 bath</td><td>$180 to $220</td><td>$320 to $420</td></tr>
</tbody>
</table>
<p>That table is an example built from the $48 an hour above. Use your own rate and your own timing, and your list will look different.</p>

<h2>Always charge more for the first clean</h2>
<p>The first visit at a new home is almost always a deep clean in disguise: baseboards nobody has touched in a year, soap scum, the top of the fridge. Price it as a deep clean, usually 1.5 to 2 times your standard price, and tell the client why. "The first clean takes longer because we're getting everything to a level we can keep up. After that, your regular price is $150."</p>
<div class="tip">Quote the first clean and the recurring price together on one quote, so the client sees where they'll land. Good / Better / Best options work well here: monthly, every two weeks and weekly, side by side.</div>

<h2>Recurring discounts: keep them small</h2>
<p>Recurring clients are worth a lot. They fill your schedule and cost nothing to market to. But the house also stays cleaner, so each visit is faster. Common discounts are around 5% for monthly, 10% for every two weeks and 15% for weekly, compared with a one-time standard clean. Go deeper than that and you're paying them to stay.</p>

<h2>Price the extras</h2>
<p>Add-ons are where a lot of cleaning profit hides, because they take little extra drive time. Put them on your price list so clients can pick them:</p>
<ul>
<li>Inside the oven or the fridge</li>
<li>Inside windows or blinds</li>
<li>Inside cabinets, often for move-outs</li>
<li>A load of laundry, or changing bed linens</li>
<li>Baseboards and walls, if they aren't in your standard clean</li>
</ul>
<p>Price each one by the minutes it takes at your hourly rate, then round up. An inside-oven clean that takes 30 minutes at $48 an hour is $24, so list it at $25 or $30.</p>

<h2>Walk-through or phone quote?</h2>
<p>For recurring and deep cleans, see the home first, in person or on a short video call. You'll spot the clutter and the pet hair a phone call misses. For small, simple jobs, a phone quote with a clause like "the price may change if the home differs from what was described" is fine. Write that clause into the quote so it's not a surprise.</p>
<p>Then send the quote the same day. A homeowner who asks three cleaners for prices usually books whoever answers first with a clear, professional quote. The <a href="/tools/estimate-template/house-cleaning">house cleaning estimate template</a> is free if you need one.</p>

<h2>When to raise prices</h2>
<p>Once a year, with 30 days' notice, in writing. If you're booked solid and turning down work, your price is too low. Raise it for new clients first, then bring existing ones up gradually.</p>

<h2>The short version</h2>
<ul>
<li>Add up your real cost per cleaning hour: labor and payroll taxes, supplies, drive time and overhead.</li>
<li>Divide by 0.70 for a 30% margin. For many businesses that lands around $45 to $55 an hour.</li>
<li>Quote flat prices from estimated hours, with a minimum charge.</li>
<li>Charge 1.5 to 2 times your standard price for the first clean, and keep recurring discounts small.</li>
<li>Put add-ons on a price list so clients can choose them.</li>
</ul>`,
  },
  {
    key: 'google-reviews-2026-11', slug: 'how-to-get-more-google-reviews', industry: '', category: 'finding-work',
    title: 'How to Get More Google Reviews Without Being Pushy',
    summary: 'When to ask, exactly what to say, how to make it a one-tap job for the client, and what Google’s rules don’t allow. With examples from three trades.',
    keywords: 'how to get more google reviews, ask customers for reviews, google review link, google review qr code, review request text',
    sources: [
      { title: 'BrightLocal: Local Consumer Review Survey', url: 'https://www.brightlocal.com/research/local-consumer-review-survey/' },
      { title: 'Google: Maps user contributed content policy (fake engagement)', url: 'https://support.google.com/contributionpolicy/answer/7400114' },
      { title: 'FTC: Final rule banning fake reviews and testimonials (2024)', url: 'https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials' },
    ],
    body: `<p>Almost everyone looking for a local service reads reviews first. BrightLocal's latest consumer survey puts it at <strong>97% of people</strong>. When someone searches "plumber near me", the businesses with more recent, good reviews get the calls. The good news: most happy clients will leave one. They just need to be asked at the right moment, with a link that takes ten seconds.</p>
<p>Here's a simple routine that works for any trade.</p>

<h2>Ask at the moment of relief</h2>
<p>There's a short window when a client is happiest with you: right after the problem is solved. The furnace is running again. The house smells clean. The lawn looks sharp before the party. Ask then, not two weeks later with the invoice reminder.</p>
<ul>
<li><strong>HVAC or plumbing:</strong> when you show them it's fixed and they say thanks.</li>
<li><strong>Cleaning:</strong> after the first clean, when they walk through and see the difference. Ask once, not every visit.</li>
<li><strong>Lawn care or landscaping:</strong> after a big visible job, like a spring cleanup or a new bed install, rather than a routine mow.</li>
</ul>

<h2>Ask in person, then send the link</h2>
<p>A spoken ask works far better than a cold email, because it's personal and the client says yes out loud. Then the text with the link is just a reminder of something they already agreed to.</p>
<blockquote><p>"I'm glad it's sorted. Can I ask a small favor? We're a small local business and Google reviews are how most of our new customers find us. If you were happy with the work, would you leave us a quick review? I'll text you the link so it takes a minute."</p></blockquote>
<p>Send the text within an hour or two, while they still remember your name:</p>
<blockquote><p>"Hi Sarah, it's Mike from Northside Heating. Thanks again for having us out today. Here's the link for that review, it only takes a minute: [link]. It really helps us."</p></blockquote>
<div class="tip">Mention what you did ("the furnace", "the move-out clean"). Clients often copy it into the review, which helps you show up when other people search for that job.</div>

<h2>Make it one tap</h2>
<p>Every extra step loses people. "Search for us on Google and find the review button" loses most of them. Use your <strong>direct review link</strong>, which opens the review box with your stars ready to tap.</p>
<p>You can get it from your Google Business Profile (look for "Ask for reviews" or "Get more reviews"), or use the free <a href="/tools/google-review-qr-code">review link and QR code generator</a>. It also makes a QR code, a printable counter sign and business cards, so clients can scan it on the spot. Some techs keep a small card with the QR code to hand over after the job.</p>

<h2>Follow up once, then let it go</h2>
<p>If there's no review after three or four days, send one friendly reminder. After that, stop. A third ask turns a happy client into an annoyed one. Keep the link somewhere you can paste it in two taps, like a saved text on your phone, so the ask still happens on busy days. In {product} your Google review link sits at the top of Reviews, ready to copy.</p>

<h2>What not to do</h2>
<p>Some shortcuts can get your reviews removed or your profile penalized, and since 2024 a few can get you fined.</p>
<ul>
<li><strong>Don't pay or reward people for reviews.</strong> Google's rules don't allow offering discounts, gifts or money in exchange for a review, even an honest one.</li>
<li><strong>Don't only ask the happy ones.</strong> Sending unhappy clients to a private feedback form and only happy ones to Google (called "review gating") is against Google's policy. Ask everyone the same way.</li>
<li><strong>Don't write fake reviews</strong> or have friends and family review work you never did for them. The FTC's 2024 rule allows fines for fake reviews and for buying them.</li>
<li><strong>Don't ask clients to review you on the spot on your phone or tablet.</strong> Reviews from your device can be flagged and filtered.</li>
</ul>
<div class="note">This is a general summary, not legal advice. Google's policies change, so check its current rules on its contributed content policy page.</div>

<h2>Answer every review, good and bad</h2>
<p>People read your replies as much as the reviews. A short, specific thank-you shows there's a real person behind the business. For a bad review, stay calm and take it offline: say you're sorry they had a bad experience, give your number, and offer to make it right. Never argue in public. A fair reply to a one-star review often wins more trust than another five-star one.</p>
<blockquote><p>"Thanks for letting us know, Dan. That's not the experience we want anyone to have. I'd like to make it right. Please call me directly at 555-0142 and ask for Mike."</p></blockquote>

<h2>Track one number</h2>
<p>Count your reviews against your finished jobs each month. If you finish 60 jobs and get 3 reviews, the ask isn't happening, or the link is too hard. Many small businesses that ask every client in person and follow up by text get a review from somewhere between 1 in 10 and 1 in 4 jobs. Steady new reviews matter more than a big pile from two years ago, because people look at how recent they are.</p>

<h2>The short version</h2>
<ul>
<li>Ask right after the problem is solved, in person.</li>
<li>Text the direct review link within a couple of hours, and mention the job you did.</li>
<li>Make it one tap with a direct link or a QR code.</li>
<li>Follow up once, then stop.</li>
<li>Never pay for reviews, gate them or fake them. Reply to every review, especially the bad ones.</li>
</ul>`,
  },
];

module.exports = { GUIDES };
