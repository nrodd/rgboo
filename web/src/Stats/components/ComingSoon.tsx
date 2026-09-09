import { Link } from "react-router-dom";
import LogoIcon from "../../assets/pumpkin.svg?react";

/**
 * What the page shows before there is a month of colours to show.
 *
 * Stands in for the whole dashboard, not just for an empty chart: a grid of
 * zeroes and a flat bar chart look like something broken, where this reads
 * as deliberate. It also covers the case where the aggregates cannot be
 * fetched at all -- a visitor gains nothing from a red error banner, and
 * the two situations look identical from their side.
 */
export const ComingSoon = () => (
  <section className="stats-card stats-soon" aria-labelledby="soon-heading">
    <LogoIcon
      viewBox="0 0 441 409"
      className="stats-soon-pumpkin"
      aria-hidden="true"
    />
    <p className="stats-eyebrow stats-eyebrow--accent">Coming soon</p>
    <h2 id="soon-heading" className="stats-soon-heading mt-2">
      Nothing stirs here yet
    </h2>
    <p className="stats-soon-body mt-4">
      The spirits are still gathering. Check back soon.
    </p>
    <Link to="/" className="admin-secondary-button stats-soon-link mt-8">
      Go pick a colour
    </Link>
  </section>
);
