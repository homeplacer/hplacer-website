// Spam trap: a decoy "company" field hidden from real users — display:none, off
// the tab order, aria-hidden, autocomplete off — so humans never see or fill it.
// Bots that blindly populate every input will, and the /api/lead route drops any
// submission where it's non-empty. No `id` (and no htmlFor) so multiple forms can
// coexist on one page without duplicate ids. Zero effect on real visitors.
export function Honeypot() {
  return (
    <div aria-hidden="true" style={{ display: "none" }}>
      <label>
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
