import type { ReactNode } from "react";

/**
 * TEMPLATE policy copy. Items in [SQUARE_BRACKETS] are business decisions to be filled in, and the
 * whole text must be reviewed by your legal owner before launch (set POLICY_REVIEWED=true to hide the draft notice).
 */
export const POLICIES: Record<string, { title: string; description: string; body: ReactNode }> = {
  shipping: {
    title: "Shipping policy", description: "How and when Keto Vitals ships orders across India.",
    body: <>
      <p>We ship to serviceable PIN codes across India. Enter your PIN code on any product page or at checkout to see availability, the delivery estimate and whether Cash on Delivery is offered.</p>
      <h2>Charges</h2><p>Shipping is free on orders above the free-shipping threshold shown in the cart; otherwise a zone-based charge applies. Cash on Delivery orders may carry a handling fee, shown before you pay.</p>
      <h2>Processing & delivery</h2><p>Orders are typically dispatched within [PROCESSING_DAYS] business days. Delivery estimates are indicative and depend on your location and the courier.</p>
      <h2>Tracking</h2><p>Once shipped, the carrier and tracking number appear on your order page and in your shipping email.</p>
    </>,
  },
  returns: {
    title: "Returns & refunds", description: "Return eligibility and refund process for Keto Vitals orders.",
    body: <>
      <p>If your order arrives damaged, defective or incorrect, contact us within [RETURN_WINDOW_DAYS] days of delivery with your order number and photos.</p>
      <h2>Eligibility</h2><p>For hygiene and safety, opened consumable products may not be returnable unless faulty. [ELIGIBILITY_RULES]</p>
      <h2>Refunds</h2><p>Approved refunds are issued to the original payment method (or by bank transfer for Cash on Delivery orders) within [REFUND_DAYS] business days of approval.</p>
    </>,
  },
  privacy: {
    title: "Privacy policy", description: "How Keto Vitals collects, uses and protects your personal data.",
    body: <>
      <p>We collect only what we need to process your orders and run your account: name, email, phone number, delivery address and order history. We do not store card numbers — payments are processed by Razorpay.</p>
      <h2>How we use data</h2><p>To fulfil orders, provide support, prevent fraud, and (if you subscribe) send marketing emails you can opt out of at any time.</p>
      <h2>Sharing</h2><p>We share data with service providers strictly to deliver the service (payment gateway, couriers, email delivery). [DATA_RETENTION_AND_PROCESSORS]</p>
      <h2>Your rights</h2><p>You can request access, correction or deletion of your personal data by contacting us. [GRIEVANCE_OFFICER_DETAILS]</p>
    </>,
  },
  terms: {
    title: "Terms of service", description: "Terms for using the Keto Vitals store.",
    body: <>
      <p>By placing an order you agree to these terms. Prices are in Indian Rupees and inclusive of applicable taxes. We may cancel orders affected by pricing errors or stock unavailability and will refund any payment received.</p>
      <h2>Products</h2><p>Our products are dietary supplements and foods. They are not medicines and are not intended to diagnose, treat, cure or prevent any disease. Consult a healthcare professional before use.</p>
      <h2>Liability & governing law</h2><p>[LIABILITY_AND_JURISDICTION_CLAUSES]</p>
    </>,
  },
  faq: {
    title: "Frequently asked questions", description: "Answers to common questions about ordering from Keto Vitals.",
    body: <>
      <h2>How do I track my order?</h2><p>Use the Track order page with your order number and email, or sign in to see all orders.</p>
      <h2>Which payment methods do you accept?</h2><p>UPI, cards, net banking and wallets via Razorpay, and Cash on Delivery where available.</p>
      <h2>Do you deliver to my PIN code?</h2><p>Enter it on any product page — the checker shows availability and the estimated delivery window.</p>
      <h2>Can I cancel an order?</h2><p>Orders can be cancelled until they are shipped. Contact us with your order number.</p>
    </>,
  },
  contact: {
    title: "Contact us", description: "Get in touch with Keto Vitals customer care.",
    body: <><p>Our customer care team can help with orders, deliveries and product questions. Contact details are listed in the site footer. Please include your order number so we can help faster.</p></>,
  },
};
