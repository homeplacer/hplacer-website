import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marked } from "marked";

const posts = JSON.parse(readFileSync("data/blog-posts.json", "utf8"));
const article = (slug) => {
  const post = posts.find((candidate) => candidate.slug === slug);
  assert.ok(post, slug);
  return post;
};
const insurance = article("manufactured-home-insurance-cost-grand-strand-sc");
const downPayment = article("manufactured-home-down-payment-requirements");

test("insurance and down-payment edits preserve authored identities, dates, reading fields, and tags", () => {
  for (const [post, date, tags] of [
    [insurance, "2026-07-09", ["insurance", "manufactured homes", "South Carolina", "Grand Strand", "wind and hail", "flood insurance", "home buying"]],
    [downPayment, "2026-07-23", ["manufactured home financing", "down payment", "FHA loans", "VA loans", "USDA loans", "Horry County", "land-home package"]],
  ]) {
    assert.equal(post.date, date);
    assert.equal(post.readMinutes, 6);
    assert.deepEqual(post.tags, tags);
  }
  assert.equal(downPayment.title, "How Much Down Payment Do You Really Need for a Home on Land?");
  assert.doesNotMatch(insurance.description, /insures better/);
  assert.doesNotMatch(downPayment.description, /FHA ~3\.5%|VA & USDA zero down|land can cover the down payment/);
});

test("insurance asks for underwriting and actual coverage instead of promising a cheaper policy", () => {
  const body = insurance.bodyMarkdown;
  assert.doesNotMatch(body, /true homeowner's policy rather than|pricier, narrower mobile-home coverage|New and permanent simply gets treated better|land on the better side of every one|stand up to coastal winds|how our buyers get standard homeowner's coverage/);
  assert.match(body, /not an insurance agent or insurer/);
  assert.match(body, /cannot quote a premium, select your coverage, or promise/);
  assert.match(body, /do not assume that buying new, owning the lot, or installing a permanent foundation automatically/);
  assert.match(body, /Real-property classification also requires its own review/);
  assert.match(body, /does not establish insurance eligibility, a premium, or protection/);
  assert.match(body, /Home Placer provides a one-year builder warranty for defects/);
  assert.match(body, /two years of mechanical coverage and ten years of structural coverage through the 2–10 company/);
  assert.match(body, /Coverage, exclusions, and claim procedures follow your written warranties/);
});

test("down-payment guidance separates borrower review, land equity, and remaining cash", () => {
  const body = downPayment.bodyMarkdown;
  assert.doesNotMatch(body, /VA allows 100% financing.*as long as|your land \*is\* the down payment|walking into a new home with little or nothing out of pocket|lenders following the standard guidelines treat the value/);
  for (const qualification of [
    "Home Placer is a manufactured-home dealer, not a lender",
    "Certificate of Eligibility and entitlement", "credit and income review",
    "A map result is not loan approval", "does not mean no closing costs or other cash requirements",
    "Your land is not automatically", "whether land equity can be recognized under its specific product",
    "An appraisal, ownership documents, outstanding balances, liens, and transaction details",
    "Do not assume land debt will be rolled into a new loan",
    "work that remains unpriced or outside the financing",
    "information request is not a loan application or approval",
  ]) assert.ok(body.includes(qualification), qualification);
  assert.doesNotMatch(body, /\$\d|\d+(?:\.\d+)?%/);
});

test("qualified articles retain written-quote, official-resource, and direct contact paths", () => {
  for (const post of [insurance, downPayment]) {
    const html = marked.parse(post.bodyMarkdown, { async: false });
    for (const path of ["/land-packages", "/homes", "/financing", "/contact"]) {
      assert.ok(html.includes(`href="${path}"`), `${post.slug}: ${path}`);
    }
    assert.match(html, /\(843\) 849-HOME/);
  }
  for (const path of ["https://www.doi.sc.gov/613/Homeowners-Insurance", "https://online.doi.sc.gov/Eng/Public/Faqs/hofaq.aspx", "/warranty"]) {
    assert.ok(insurance.bodyMarkdown.includes(`](${path})`), path);
  }
  for (const path of ["https://www.va.gov/housing-assistance/home-loans/loan-types/purchase-loan/", "https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do", "/buyer-resources#financing", "/down-payment-assistance", "/guides/home-land-scope"]) {
    assert.ok(downPayment.bodyMarkdown.includes(`](${path})`), path);
  }
});
