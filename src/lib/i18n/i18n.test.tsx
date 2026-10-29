import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";
import { LanguageSelect } from "../../components/LanguageSwitcher";
import { getLocale, setLanguage, translate, useLanguage } from "./index";
import { greek } from "./el";
import { RECORD_ENTITIES } from "../wam/record-catalog";

afterEach(() => {
  cleanup();
  setLanguage("el");
  localStorage.clear();
});
describe("WAM English and Greek", () => {
  it("translates every management collection, group, field and enum label without changing stored values", () => {
    for (const entity of RECORD_ENTITIES) {
      for (const key of [entity.label, entity.group, ...entity.fields.map((field) => field.label)])
        expect(greek[key], key).toBeDefined();
      for (const field of entity.fields)
        for (const option of field.options ?? []) {
          const label = option
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/^./, (letter) => letter.toUpperCase());
          expect(greek[label], `${entity.key}.${field.key}: ${option}`).toBeDefined();
        }
    }
    expect(translate("IN_PRODUCTION")).toBe("Σε παραγωγή");
    expect(
      RECORD_ENTITIES.find((entity) => entity.key === "CUSTOMER_ORDER")!.fields.find(
        (field) => field.key === "status",
      )!.options,
    ).toContain("IN_PRODUCTION");
  });
  it("switches visible content immediately and keeps form drafts and canonical option values", () => {
    function Form() {
      useLanguage();
      const [draft, setDraft] = useState("");
      return (
        <>
          <LanguageSelect />
          <h1>{translate("Customer")}</h1>
          <input
            aria-label="draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <select aria-label="status">
            <option value="IN_PRODUCTION">{translate("In production")}</option>
          </select>
        </>
      );
    }
    render(<Form />);
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "My unchanged draft" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Γλώσσα" }), { target: { value: "en" } });
    expect(screen.getByRole("heading").textContent).toBe("Customer");
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("My unchanged draft");
    expect((screen.getByLabelText("status") as HTMLSelectElement).value).toBe("IN_PRODUCTION");
    expect(localStorage.getItem("wam-language")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(getLocale()).toBe("en-GB");
  });
  it("translates parameterized messages, database rules, field errors and permission failures", () => {
    expect(translate("Job #{0} is now active", "123")).toBe("Η εργασία #123 είναι πλέον ενεργή");
    expect(translate("Due 2 day(s) ago (every 7 days).")).toBe(
      "Έπρεπε να ολοκληρωθεί πριν από 2 ημέρες (ανά 7 ημέρες).",
    );
    expect(translate("Stage 2 of 4")).toBe("Στάδιο 2 από 4");
    expect(translate("CNC Router 01 — Spindle lubrication overdue")).toBe(
      "Φρέζα CNC 01 — Λίπανση ατράκτου εκπρόθεσμο",
    );
    expect(translate("Insufficient stock at source location")).toBe(
      "Ανεπαρκές απόθεμα στην τοποθεσία προέλευσης",
    );
    expect(translate("values.name: Invalid input: expected string, received undefined")).toBe(
      "Όνομα: Συμπληρώστε αυτό το υποχρεωτικό πεδίο.",
    );
    expect(translate("Your account does not have permission for this action.")).toBe(
      "Ο λογαριασμός σας δεν έχει δικαίωμα για αυτή την ενέργεια.",
    );
    expect(translate("WAM-CNC-01")).toBe("WAM-CNC-01");
    expect(translate("Unlisted customer text")).toBe("Unlisted customer text");
  });
});
