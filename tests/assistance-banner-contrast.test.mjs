import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/page.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');
const banner = page.match(/<section className="([^"]*bg-accent-500[^"]*)">([\s\S]*?)<\/section>/);
assert.ok(banner, 'The homepage assistance banner must exist');

function tokenColor(name) {
  const hex = css.match(new RegExp(`--color-${name}:\\s*#([0-9a-f]{6})`, 'i'))?.[1];
  assert.ok(hex, `Missing ${name} color token`);
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function composite(foreground, background, alpha) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

function luminance(color) {
  const channels = color.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function whiteTextColor(classes, background) {
  const color = classes.split(/\s+/).find((value) => /^text-white(?:\/\d+)?$/.test(value));
  assert.ok(color, 'Banner text must explicitly declare its white color');
  const opacity = color.includes('/') ? Number(color.split('/')[1]) / 100 : 1;
  return composite([255, 255, 255], background, opacity);
}

test('contrast calculation follows sRGB luminance and alpha compositing', () => {
  assert.equal(contrast([255, 255, 255], [0, 0, 0]), 21);
  assert.equal(contrast([255, 255, 255], [255, 255, 255]), 1);
  assert.deepEqual(composite([255, 255, 255], [0, 0, 0], 0.8), [204, 204, 204]);
});

test('assistance banner small text meets WCAG AA against its actual layered colors', () => {
  const overlay = banner[2].match(/className="([^"]*bg-brand-950\/(\d+)[^"]*)"/);
  assert.ok(overlay, 'The banner background overlay must be accounted for');
  const background = composite(tokenColor('brand-950'), tokenColor('accent-500'), Number(overlay[2]) / 100);
  const label = banner[2].match(/<p className="([^"]*)">\s*Down-payment assistance/);
  const description = banner[2].match(/<p className="([^"]*)">\s*We&apos;ll help/);
  for (const [name, element] of [['label', label], ['description', description]]) {
    assert.ok(element, `Missing assistance ${name}`);
    const ratio = contrast(whiteTextColor(element[1], background), background);
    assert.ok(ratio >= 4.5, `${name} contrast ${ratio.toFixed(2)} must be at least 4.5:1`);
  }
  // The previous 80%-white small label fails against this background.
  assert.ok(contrast(composite([255, 255, 255], background, 0.8), background) < 4.5);
});

test('contrast repair preserves the assistance range, restrictions, and in-page inquiry action', () => {
  assert.ok(banner[2].includes('$5,000–$50,000 may be available'));
  assert.ok(banner[2].includes('Restrictions apply:'));
  assert.ok(banner[2].includes('program funding, property, location, and buyer eligibility'));
  assert.match(banner[2], /<DownPaymentAssistanceDialog\s+label="Find out if you may qualify"/);
});
