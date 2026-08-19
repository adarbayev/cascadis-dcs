import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EEMS_ARCHETYPE_PROFILES } from "../profiles";
import { EemsCommandCenter } from "./EemsCommandCenter";
import { EemsRegisterView } from "./EemsRegisterView";
import { SiteWorkspace } from "./SiteWorkspace";

const profile = EEMS_ARCHETYPE_PROFILES[0];

describe("EEMS portfolio components", () => {
  it("keeps map selection and site workspace actions on the assessment id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenSite = vi.fn();

    render(
      <EemsCommandCenter
        results={[]}
        profiles={[profile]}
        selectedId={null}
        onSelect={onSelect}
        onOpenSite={onOpenSite}
        mapNode={<div>Portfolio map</div>}
      />,
    );

    expect(screen.getByText("Portfolio map")).toBeInTheDocument();
    await user.click(screen.getAllByText(profile.name)[0]);
    expect(onSelect).toHaveBeenCalledWith(profile.assessmentId);
  });

  it("moves from overview to the permit register inside a site workspace", async () => {
    const user = userEvent.setup();
    render(<SiteWorkspace profile={profile} />);

    expect(screen.getByRole("tablist", { name: "Site workspace sections" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText(profile.operatingModel.label)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Compliance & permits" }));
    expect(screen.getByRole("tabpanel", { name: "Compliance & permits" })).toBeInTheDocument();
    expect(screen.getByText("Permits and operating obligations")).toBeInTheDocument();
    expect(screen.getByText(profile.permits[0].title)).toBeInTheDocument();
  });

  it("switches portfolio registers and filters records", async () => {
    const user = userEvent.setup();
    render(<EemsRegisterView profiles={[profile]} />);

    expect(screen.getByText(profile.permits[0].title)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Energy & utilities" }));
    expect(screen.getByRole("columnheader", { name: /PUE/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search site, status or record"), "no matching site");
    expect(screen.getByText("No matching records")).toBeInTheDocument();
  });

  it("keeps a dedicated portfolio register aligned with its top-level tab", () => {
    render(<EemsRegisterView profiles={[profile]} initialRegister="compliance" showRegisterNav={false} />);

    expect(screen.getByRole("heading", { name: "Compliance & permits" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Energy & utilities" })).not.toBeInTheDocument();
  });
});
