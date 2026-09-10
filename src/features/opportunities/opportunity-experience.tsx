"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import type {
  FeedResult,
  OpportunityCardModel,
  getOpportunityDetail,
} from "@/server/opportunity-experience/query";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  IconButton,
  SearchInput,
  Select,
  Toast,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreateApplicationButton } from "@/features/applications/application-tracker";

function deadlineLabel(item: OpportunityCardModel) {
  if (item.rollingDeadline) return "Rolling deadline";
  if (!item.deadline) return "Deadline not stated";
  return `Deadline ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${item.deadline}T00:00:00`))}`;
}
function outcomeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function OpportunityFeed({ initial, query }: { initial: FeedResult; query: Record<string, string> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [items, setItems] = useState(initial.items);
  const active = useMemo(
    () => Object.entries(query).filter(([key, value]) => value && !["page", "sort"].includes(key)),
    [query],
  );
  const update = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    next.delete("page");
    router.push(`/opportunities?${next.toString()}` as never);
  };
  const event = async (
    item: OpportunityCardModel,
    type: "match_saved" | "match_unsaved" | "match_dismissed",
  ) => {
    const prior = items;
    setItems((current) =>
      type === "match_dismissed"
        ? current.filter((card) => card.matchId !== item.matchId)
        : current.map((card) =>
            card.matchId === item.matchId ? { ...card, saved: type === "match_saved" } : card,
          ),
    );
    const response = await fetch("/api/opportunities/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: item.matchId, eventType: type, idempotencyKey: crypto.randomUUID() }),
    });
    if (!response.ok) {
      setItems(prior);
      setToast("That change could not be saved. Please try again.");
      return;
    }
    setToast(
      type === "match_dismissed"
        ? "Opportunity dismissed."
        : type === "match_saved"
          ? "Saved to your list."
          : "Removed from saved.",
    );
  };
  if (initial.state === "passport_incomplete")
    return (
      <EmptyState
        description="Finish and confirm your Opportunity Passport to receive explainable matches."
        title="Complete your Passport first"
      />
    );
  if (initial.state === "matching_unavailable")
    return (
      <EmptyState
        description="Your match evaluation has not run yet. Your Passport remains available while we prepare your results."
        title="Matches are being prepared"
      />
    );
  if (initial.state === "permission_denied")
    return (
      <ErrorState
        description="Your opportunity results are private to your signed-in account. Please sign in again to continue."
        title="We could not verify access to your matches"
      />
    );
  if (initial.state === "empty")
    return (
      <EmptyState
        description="Try changing your search or filters. WAYFOUND never fills this state with pretend opportunities."
        title="No opportunities match these choices"
      />
    );
  return (
    <section className="opportunity-experience" aria-labelledby="explore-title">
      <div className="explore-hero">
        <div>
          <p className="eyebrow">YOUR OPPORTUNITIES</p>
          <h1 id="explore-title">Find where you fit.</h1>
          <p>Every result is a fit indicator, not a guarantee of admission, work, sponsorship or a visa.</p>
        </div>
        <Badge tone="teal">Personalized ranking</Badge>
      </div>
      <form
        className="explore-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          update({ q: String(data.get("q") ?? "").trim(), sort: String(data.get("sort") ?? "best") });
        }}
      >
        <SearchInput
          defaultValue={query.q}
          name="q"
          placeholder="Search title, organisation or destination"
        />
        <Select aria-label="Sort opportunities" defaultValue={query.sort ?? "best"} name="sort">
          <option value="best">Best match</option>
          <option value="deadline">Deadline soonest</option>
          <option value="recent">Recently verified</option>
          <option value="readiness">Readiness</option>
        </Select>
        <Button type="submit" variant="teal">
          Search
        </Button>
        <Button onClick={() => setDrawer(true)} type="button" variant="secondary">
          <Icon name="more" size={20} /> Filters
        </Button>
      </form>
      {active.length ? (
        <div className="active-filters" aria-label="Active filters">
          {active.map(([key, value]) => (
            <button key={key} onClick={() => update({ [key]: undefined })} type="button">
              {key}: {value} <span aria-hidden>×</span>
            </button>
          ))}
          <button onClick={() => router.push("/opportunities" as never)} type="button">
            Reset all
          </button>
        </div>
      ) : null}
      <p aria-live="polite" className="feed-count">
        {items.length} safe match{items.length === 1 ? "" : "es"} on this page
      </p>
      <div className="opportunity-feed">
        {items.map((item) => (
          <OpportunityCard
            item={item}
            key={item.matchId}
            onDismiss={() => event(item, "match_dismissed")}
            onSave={() => event(item, item.saved ? "match_unsaved" : "match_saved")}
          />
        ))}
      </div>
      {initial.hasMore ? (
        <Button onClick={() => update({ page: String(initial.page + 1) })} variant="secondary">
          Load more safe matches
        </Button>
      ) : null}
      <Drawer onClose={() => setDrawer(false)} open={drawer} title="Filter opportunities">
        <FilterForm
          query={query}
          onApply={(values) => {
            setDrawer(false);
            update(values);
          }}
        />
      </Drawer>
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </section>
  );
}

function FilterForm({
  query,
  onApply,
}: {
  query: Record<string, string>;
  onApply: (values: Record<string, string | undefined>) => void;
}) {
  const [type, setType] = useState(query.type ?? "");
  const [destination, setDestination] = useState(query.destination ?? "");
  const [outcome, setOutcome] = useState(query.outcome ?? "");
  const [readiness, setReadiness] = useState(query.readiness ?? "");
  return (
    <form
      className="filter-form"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ type, destination, outcome, readiness });
      }}
    >
      <label>
        Opportunity type
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          <option>Scholarship</option>
          <option>Professional role</option>
          <option>Skilled trade</option>
          <option>Fellowship</option>
        </Select>
      </label>
      <label>
        Destination
        <Select value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="">All destinations</option>
          <option>Canada</option>
          <option>Germany</option>
          <option>United Kingdom</option>
        </Select>
      </label>
      <label>
        Match status
        <Select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="">All actionable states</option>
          <option value="eligible">Eligible</option>
          <option value="more_information_needed">Needs information</option>
          <option value="manual_confirmation_required">Needs confirmation</option>
        </Select>
      </label>
      <label>
        Readiness
        <Select value={readiness} onChange={(event) => setReadiness(event.target.value)}>
          <option value="">Any readiness</option>
          <option value="ready">Ready</option>
          <option value="missing">Missing</option>
          <option value="in_progress">In progress</option>
        </Select>
      </label>
      <Button type="submit" variant="teal">
        Apply filters
      </Button>
    </form>
  );
}

export function OpportunityCard({
  item,
  onSave,
  onDismiss,
}: {
  item: OpportunityCardModel;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const warning =
    item.decision !== "allow" || item.sponsorship.includes("only") || item.sponsorship.includes("not stated");
  return (
    <article className="explore-card">
      <div className="explore-card-top">
        <Badge tone="teal">{item.type}</Badge>
        <div>
          <IconButton
            icon="bookmark"
            label={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
            onClick={onSave}
          />
          <IconButton icon="x" label={`Dismiss ${item.title}`} onClick={onDismiss} />
        </div>
      </div>
      <h2>
        <Link href={`/opportunities/${item.id}` as never}>{item.title}</Link>
      </h2>
      <p className="org-line">
        {item.organization} · {item.destination}
      </p>
      <div className="fit-row">
        <strong>{item.matchScore}%</strong>
        <span>Fit score</span>
        <Badge tone={item.eligibility === "eligible" ? "teal" : "amber"}>
          {outcomeLabel(item.eligibility)}
        </Badge>
      </div>
      <p className="reason-line">
        <Icon name="spark" size={18} /> {item.reason ?? "Match details are available in the explanation."}
      </p>
      <p className="deadline-line">
        <Icon name="calendar" size={18} /> {deadlineLabel(item)}
      </p>
      {warning ? (
        <p className="warning-line" role="note">
          ⚠ {item.sponsorship}. Review the source wording.
        </p>
      ) : null}
      <div className="card-footer">
        <Badge tone={item.readiness === "ready" ? "teal" : "amber"}>{outcomeLabel(item.readiness)}</Badge>
        <a className="detail-link" href={`/opportunities/${item.id}`}>
          View details <Icon name="arrow-right" size={18} />
        </a>
      </div>
    </article>
  );
}

export function OpportunityDetail({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>;
}) {
  const { card } = detail;
  return (
    <article className="opportunity-detail">
      <Link className="back-link" href={"/opportunities" as never}>
        ← All opportunities
      </Link>
      <header>
        <Badge tone="teal">{card.type}</Badge>
        <h1>{card.title}</h1>
        <p>
          {card.organization} · {card.destination}
        </p>
        <div className="fit-row">
          <strong>{card.matchScore}%</strong>
          <span>Fit score, not a probability</span>
        </div>
      </header>
      <DetailSection title="Why this matches">
        {detail.reasons.map((reason) => (
          <p key={`${reason.reason_type}-${reason.message}`}>✦ {reason.message}</p>
        ))}
      </DetailSection>
      <DetailSection title="Eligibility and requirements">
        <ul>
          {detail.requirements.map((requirement) => (
            <li key={`${requirement.requirement_category}-${requirement.outcome}`}>
              <strong>{requirement.requirement_category.replaceAll("_", " ")}</strong>
              <Badge tone={requirement.outcome === "met" ? "teal" : "amber"}>
                {outcomeLabel(requirement.outcome)}
              </Badge>
              <span>{requirement.explanation}</span>
            </li>
          ))}
        </ul>
      </DetailSection>
      <DetailSection title="Readiness">
        <ul>
          {detail.readiness.map((item) => (
            <li key={item.item_key}>
              <strong>{item.document_type ?? item.item_key}</strong>
              <Badge tone={item.state === "ready" ? "teal" : "amber"}>{outcomeLabel(item.state)}</Badge>
              <span>{item.explanation}</span>
            </li>
          ))}
        </ul>
      </DetailSection>
      {detail.action ? (
        <DetailSection title="Next Best Action">
          <div className="next-detail-action">
            <Badge tone="amber">Priority action</Badge>
            <h2>{detail.action.title}</h2>
            <p>{detail.action.explanation}</p>
            <Link className="ui-button ui-button-primary" href="/onboarding">
              Update your Passport <Icon name="arrow-right" size={20} />
            </Link>
          </div>
        </DetailSection>
      ) : null}
      <DetailSection title="Sponsorship and safety">
        <p className="warning-line" role="note">
          ⚠ {card.sponsorship}. WAYFOUND does not treat employer-register capability, visa help or relocation
          support as vacancy sponsorship.
        </p>
        <p>
          Last checked:{" "}
          {card.lastCheckedAt
            ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(card.lastCheckedAt))
            : "Not stated"}
          .
        </p>
      </DetailSection>
      <DetailSection title="Important information">
        <p>
          {deadlineLabel(card)}. Use the official application link only after reviewing the source. WAYFOUND
          does not guarantee eligibility, funding, work, sponsorship, admission or visa approval.
        </p>
        {detail.application.available ? (
          <a
            className="ui-button ui-button-primary"
            href={detail.application.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Apply on the official site <Icon name="arrow-right" size={20} />
          </a>
        ) : (
          <p className="application-unavailable" role="note">
            Official application link unavailable: {detail.application.reason}
          </p>
        )}
        <div className="workspace-action">
          <CreateApplicationButton matchId={card.matchId} />
          <p>Creates a private preparation workspace only. WAYFOUND never submits an application for you.</p>
        </div>
      </DetailSection>
    </article>
  );
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function FeedError() {
  return (
    <ErrorState
      description="We could not load opportunities right now. Your Passport and saved information remain private."
      title="Matches are temporarily unavailable"
    />
  );
}
