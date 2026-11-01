const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function resourceStorePolicies(resource, seller, mode) {
  const base = `/${resource.landingSlug}/`
  const name = escape(seller.legalName)
  const email = `<a href="mailto:${escape(seller.supportEmail)}">${escape(seller.supportEmail)}</a>`
  const section = (heading, text) => `<section><h2>${heading}</h2><p>${text}</p></section>`
  return [
    {
      slug: 'about', title: 'About these resources',
      summary: `${name} provides the banana-leaf business resources on aeroniqx.in: practical digital materials for researching sourcing and preparing for export registration.`,
      content: section('What is available', 'The supplier directory contains 20 researched supplier leads, source links and enquiry tools in PDF and Excel formats. The export-registration guide explains the preparation steps and links to official sources. The landing page lists the exact files, research dates and current prices.') +
        section('What you are buying', 'These products are downloadable information resources. We are not selling banana leaves, registering an export business on your behalf, or providing individual mentoring. Supplier entries are researched leads; they have not been called or sample-tested. A listing is not a guarantee of reliability, availability or a successful deal.') +
        section('Research and decisions', 'Check the dates and limitations shown in each resource. Confirm current quotes, supplier identity, product specifications and destination requirements before committing money. The resources do not guarantee income, profit or business results.') +
        section('Seller and support', `${name} · ${email}`)
    },
    {
      slug: 'contact', title: 'Contact & support',
      summary: `Contact ${name} about the banana-leaf supplier directory, export-registration guide or access to your files.`,
      content: section('Business', name) +
        section('Email support', email) +
        (seller.businessAddress ? section('Business address', escape(seller.businessAddress).replaceAll('\n', '<br>')) : '') +
        (seller.supportPhone ? section('Support phone', escape(seller.supportPhone)) : '') +
        (seller.grievanceContact ? section('Grievance contact', `${escape(seller.grievanceContact)} · ${email}`) : '') +
        section('Help us find your issue', 'Include the resource name and a short description. For a paid order, include the order or payment reference and purchase date. Do not send card details, passwords, OTPs or UPI PINs.') +
        section('Complaints', 'We acknowledge complaints within 48 hours and address them within one month, subject to any shorter deadline required by law.') +
        section('Cancellations and refunds', `Read the <a href="${base}refund-policy/">cancellation and refund policy</a>.`)
    },
    {
      slug: 'terms', title: 'Terms & conditions',
      summary: `These terms cover access to and purchases of the banana-leaf digital resources provided by ${name} on aeroniqx.in.`,
      content: section('Digital resources and delivery', 'The product description specifies the included PDF and spreadsheet files. Delivery is electronic; no physical item is shipped. You need an internet connection and a compatible PDF reader or spreadsheet application to download and use the files.' + (mode === 'free' ? '' : ' After payment verification, the page provides downloads and a private access link valid for one year. Save the files and purchase details. Downloaded files are yours to keep under the usage terms below. If payment succeeds but delivery fails, contact support with your payment reference; do not pay again.')) +
        section('Prices and purchases', mode === 'free' ? 'Both resources are currently available free. Paid checkout is not enabled and no payment is collected by these pages. If paid checkout is introduced, the price and applicable charges will be displayed before you confirm payment.' : 'The total price and applicable charges are displayed before you confirm payment. Each purchase is a one-time purchase of the selected resource. Access is provided after payment is verified.') +
        section('Using your copy', 'You may use the resource for your own learning and internal business planning. Do not resell, repackage or publicly redistribute the files as your own product. Third-party material and source websites remain subject to their owners’ rights and terms.') +
        section('Scope and limitations', 'The resources are general information, not personalised legal, tax, financial or business advice. They do not include mentoring, supplier due diligence on your behalf, sourcing fulfilment or registration services. No earnings, business outcome, supplier response or government approval is guaranteed. Confirm current requirements and supplier information independently. These statements do not exclude responsibility for delivering the product as described.') +
        section('Cancellation and refund terms', `There are no change-of-mind refunds after purchase. Payment errors, non-delivery, defects and statutory remedies are covered in our <a href="${base}refund-policy/">cancellation and refund policy</a>.`) +
        section('Privacy and support', `Read our <a href="${base}privacy/">privacy policy</a>. For support, contact ${email}.`) +
        section('Applicable rights and changes', 'Applicable Indian law governs these terms, without restricting mandatory consumer rights or available consumer remedies. Changes to the terms apply prospectively; they do not remove rights attached to an earlier purchase. The product description and terms presented when you purchase form the basis of that purchase.')
    },
    {
      slug: 'privacy', title: 'Privacy policy',
      summary: `This policy explains how ${name} handles information in the banana-leaf resource pages and related support requests.`,
      content: section('Browsing and downloads', (mode === 'free' ? 'The pages currently provide free downloads without requiring an account, phone number or email address.' : 'You can read the starting guide without creating an account. Paid resources unlock after payment verification. Essential secure cookies remember your purchase access for up to one year; browser storage retains an unfinished order reference for recovery. Your private access link contains a signed purchase reference. Keep it private: anyone with that link can access the purchased files while it is valid. We do not add payment details to marketing lists.') + ' The guide’s checklist runs in your browser. These standalone resource pages do not load the Aeroniqx tools navigation or its usage-measurement script.') +
        section('Hosting', 'Cloudflare hosts and delivers this website. It may process your IP address, request details and other technical metadata to deliver pages, prevent abuse and operate its services. Browser caching can keep copies of public pages and assets on your device.') +
        section('When you contact us', 'We use the contact details, message and relevant order information you choose to send to investigate and respond to your request. Email delivery is handled by our email provider. Do not send payment credentials or unrelated sensitive documents. We retain correspondence only for as long as needed for support, record-keeping or applicable legal obligations.') +
        section('Payments', mode === 'free' ? 'Payment collection is not enabled on these pages. We will update this policy before introducing paid checkout to explain the payment provider, order information used and access-delivery process.' : 'Razorpay processes payments and the contact and payment information entered in its checkout, under its privacy notice. We use order and payment references, the selected product, amount and payment status to verify payment, deliver files, check refunds and handle support. Order and transaction records are retained in Razorpay according to applicable record-keeping requirements. Our site does not store card numbers, CVV, OTPs or UPI PINs. We do not ask you to send these to our support email.') +
        section('Marketing and sharing', 'Browsing, downloading a resource or contacting support does not sign you up for marketing. We do not sell information from support requests. Information may be shared with service providers where needed to respond to the request or to meet an applicable legal obligation.') +
        section('Questions and requests', `Contact ${email} for privacy questions or requests about information you have provided. Include enough context to locate the relevant correspondence. We may need to verify a request and retain records that are required by law.`)
    }
  ]
}
