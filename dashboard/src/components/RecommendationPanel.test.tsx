import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assessmentFixture, googleLocationEvidence } from "../test/fixtures";
import { RecommendationPanel } from "./RecommendationPanel";

describe("selected-site evidence", () => {
  it("shows retrieval context, source links and attribution", () => {
    render(<RecommendationPanel result={assessmentFixture()} view="bws" />);

    expect(screen.getByText("Evidence provenance")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /source/i })).toHaveLength(2);
    expect(screen.getByText(/Public proxy — Ember.*retrieved 9 Aug 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Source: WRI Aqueduct/i)).toBeInTheDocument();
    expect(screen.getByText(/Public proxy — Ember \(CC BY 4.0\)/i)).toBeInTheDocument();
  });

  it("renders the PPA rationale once", () => {
    render(<RecommendationPanel result={assessmentFixture()} view="bws" />);
    expect(screen.getAllByText(/does not change the location-based factor or CUE/i)).toHaveLength(1);
  });

  it("shows the Google framework boundary for a seeded public location", () => {
    const result = assessmentFixture();
    result.site = { ...result.site, location_evidence: googleLocationEvidence };
    render(<RecommendationPanel result={result} view="bws" />);

    expect(screen.getByText("Google Water Risk Framework handoff")).toBeInTheDocument();
    expect(screen.getByText(/external regional pre-screen/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Framework/i })).toHaveAttribute("href", googleLocationEvidence.methodology_reference_url);
  });
});
