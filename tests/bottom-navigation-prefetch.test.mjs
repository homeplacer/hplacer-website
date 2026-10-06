import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync("src/components/bottom-navigation.tsx", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
});
const destinations = ["/", "/homes", "/land-packages", "/contact"];
const Link = ({ prefetch, onPointerEnter, onFocus, onTouchStart, children, ...props }) =>
  React.createElement("a", props, children);
const Icon = (props) => React.createElement("svg", { "aria-hidden": true, ...props });

function loadNavigation(pathname, react = React) {
  const fixtureModule = { exports: {} };
  runInNewContext(outputText, {
    module: fixtureModule,
    exports: fixtureModule.exports,
    require(specifier) {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") return require(specifier);
      if (specifier === "next/link") return { default: Link };
      if (specifier === "next/navigation") return { usePathname: () => pathname };
      if (specifier === "@/components/icons") return {
        GridIcon: Icon, HomeMark: Icon, MapIcon: Icon, MessageIcon: Icon,
      };
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return fixtureModule.exports.BottomNavigation;
}

function interactiveNavigation(pathname = "/about") {
  let prefetchHref;
  const BottomNavigation = loadNavigation(pathname, {
    ...React,
    useState: () => [prefetchHref, (href) => { prefetchHref = href; }],
  });
  function links() {
    const tree = BottomNavigation();
    return tree.props.children.props.children.map((element) => element.props);
  }
  return { links };
}

test("initial mobile dock opts out of all four automatic viewport prefetches", () => {
  const links = interactiveNavigation().links();
  assert.deepEqual(Array.from(links, (link) => link.href), destinations);
  assert.equal(links.filter((link) => link.prefetch !== false).length, 0);
});

for (const intent of ["onPointerEnter", "onFocus", "onTouchStart"]) {
  test(`${intent} restores Next's default prefetch for only the intended destination`, () => {
    const fixture = interactiveNavigation();
    for (const href of destinations) {
      fixture.links().find((link) => link.href === href)[intent]();
      const links = fixture.links();
      assert.equal(links.find((link) => link.href === href).prefetch, null);
      assert.equal(links.filter((link) => link.prefetch !== false).length, 1);
      for (const link of links) {
        assert.equal(link.onClick, undefined, "no click interception or wait for prefetch");
        assert.equal(link.tabIndex, undefined, "native anchor keyboard order is preserved");
      }
    }
  });
}

test("prefetch intent does not change the current-page indication on nested routes", () => {
  for (const [pathname, current] of [
    ["/", "/"], ["/homes/ultra-flex-28-68", "/homes"],
    ["/land-packages/example", "/land-packages"], ["/contact", "/contact"],
    ["/about", undefined],
  ]) {
    const fixture = interactiveNavigation(pathname);
    const before = fixture.links().filter((link) => link["aria-current"] === "page");
    assert.deepEqual(Array.from(before, (link) => link.href), current ? [current] : []);
    fixture.links().find((link) => link.href === "/homes").onFocus();
    const after = fixture.links().filter((link) => link["aria-current"] === "page");
    assert.deepEqual(Array.from(after, (link) => link.href), current ? [current] : []);
  }
});

test("server markup keeps the four labeled native anchors available without JavaScript", () => {
  const html = renderToStaticMarkup(React.createElement(loadNavigation("/about")));
  assert.match(html, /<nav aria-label="Quick navigation"/);
  assert.equal((html.match(/<a /g) ?? []).length, 4);
  for (const href of destinations) assert.ok(html.includes(`href="${href}"`));
  for (const label of ["Home", "Homes", "Packages", "Contact"]) {
    assert.ok(html.includes(`<span>${label}</span>`));
  }
  assert.doesNotMatch(html, /<button|aria-disabled|tabindex|data-prefetch/);
});
