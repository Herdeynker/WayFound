"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import {
  dashboardFixture,
  type DashboardFixture,
  type OpportunityFixture,
} from "@/features/dashboard/dashboard-fixtures";
import { Icon, type IconName } from "./icons";
import { DesktopRouteSignature, MobileProgressRoute, SidebarRouteSignature } from "./route-signatures";
import { WayfoundLogo } from "./wayfound-logo";
import { Avatar, Chip, IconButton, SearchInput, Step } from "./ui";
import { FirstUseWalkthrough } from "@/features/dashboard/first-use-walkthrough";
import { GettingStartedChecklist } from "@/features/dashboard/getting-started-checklist";

type NavigationItem = { label: string; icon: IconName; href: string };

const desktopNavigation: NavigationItem[] = [
  { label: "Home", icon: "home", href: "/dashboard" },
  { label: "Opportunities", icon: "briefcase", href: "/opportunities" },
  { label: "My Applications", icon: "file", href: "/applications" },
  { label: "Readiness", icon: "readiness", href: "/onboarding" },
  { label: "Saved", icon: "bookmark", href: "/opportunities?saved=true" },
  { label: "Messages", icon: "message", href: "/settings/notifications" },
  { label: "Profile", icon: "profile", href: "/settings/account" },
];

const mobileNavigation: NavigationItem[] = [
  { label: "Home", icon: "home", href: "/dashboard" },
  { label: "Explore", icon: "search", href: "/opportunities" },
  { label: "Applications", icon: "file", href: "/applications" },
  { label: "Prepare", icon: "readiness", href: "/prepare/ielts" },
  { label: "Profile", icon: "profile", href: "/settings/account" },
];

export function DashboardShell({ model = dashboardFixture }: { model?: DashboardFixture }) {
  const fixture = model === dashboardFixture;
  const [savedIds, setSavedIds] = useState<string[]>(
    model.opportunities.filter((item) => item.saved).map((item) => item.id),
  );
  const [saveMessage, setSaveMessage] = useState("");

  const toggleSaved = async (opportunity: OpportunityFixture) => {
    const wasSaved = savedIds.includes(opportunity.id);
    setSavedIds((current) =>
      wasSaved ? current.filter((savedId) => savedId !== opportunity.id) : [...current, opportunity.id],
    );
    if (opportunity.source === "fixture") return;
    const response = await fetch("/api/opportunities/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(opportunity.matchId ? { matchId: opportunity.matchId } : { opportunityId: opportunity.id }),
        eventType: wasSaved ? "match_unsaved" : "match_saved",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    if (!response.ok) {
      setSavedIds((current) =>
        wasSaved ? [...current, opportunity.id] : current.filter((id) => id !== opportunity.id),
      );
      setSaveMessage("That change could not be saved. Please try again.");
    } else setSaveMessage(wasSaved ? "Removed from saved." : "Saved to your list.");
  };

  return (
    <div className="app-shell" id="home">
      <DesktopSidebar />
      <div className="app-content">
        <DesktopTopBar model={model} />
        <MobileHeader model={model} />
        <main className="dashboard-main" id="main-content">
          <div className="dashboard-container">
            <GreetingHeader model={model} />
            <MobileReadinessStrip model={model} />
            <div className="dashboard-route-wrap">
              <DesktopRouteSignature />
            </div>
            <div className="desktop-dashboard-grid">
              <OpportunityPathCard model={model} variant="desktop" />
              <NextBestActionCard model={model} variant="desktop" />
              <UtilityRail model={model} />
            </div>
            <div className="mobile-dashboard-stack">
              <OpportunityPathCard model={model} variant="mobile" />
              <NextBestActionCard model={model} variant="mobile" />
            </div>
            <MatchSection model={model} savedIds={savedIds} onToggleSaved={toggleSaved} />
            <GettingStartedChecklist fixture={fixture} initial={model.checklist} />
            <p aria-live="polite" className="dashboard-save-message" role="status">
              {saveMessage}
            </p>
          </div>
        </main>
        <MobileBottomNav />
      </div>
      <FirstUseWalkthrough fixture={fixture} initial={model.walkthrough} />
    </div>
  );
}

function DesktopSidebar() {
  return (
    <aside className="desktop-sidebar" aria-label="Application sidebar">
      <div className="sidebar-brand">
        <WayfoundLogo variant="light" />
      </div>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        {desktopNavigation.map((item) => (
          <NavigationLink active={item.label === "Home"} item={item} key={item.label} />
        ))}
      </nav>
      <div className="sidebar-signature">
        <SidebarRouteSignature />
      </div>
    </aside>
  );
}

function NavigationLink({ active, item }: { active: boolean; item: NavigationItem }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`sidebar-link ${active ? "is-active" : ""}`}
      href={item.href as Route}
      id={item.label === "Opportunities" ? "sidebar-opportunities" : undefined}
    >
      <Icon name={item.icon} size={23} />
      <span>{item.label}</span>
    </Link>
  );
}

function DesktopTopBar({ model }: { model: DashboardFixture }) {
  return (
    <header className="desktop-topbar">
      <form action="/opportunities" className="dashboard-search-form">
        <SearchInput name="q" placeholder="Search opportunities, skills or countries…" />
      </form>
      <div className="topbar-user">
        <a
          className="icon-button notification-button"
          href="/settings/notifications"
          aria-label="Notifications"
        >
          <Icon name="bell" size={22} />
        </a>
        <span className="notification-dot" aria-label="1 unread notification" role="status" />
        <span className="topbar-divider" aria-hidden="true" />
        <details className="account-menu">
          <summary aria-label="Open account menu" id="account-menu-trigger">
            <Avatar label={model.user.avatarLabel} size="medium" />
            <span className="topbar-copy">
              <strong>Hi, {model.user.firstName}</strong>
              <span>
                Keep going <span aria-hidden="true">⚡</span>
              </span>
            </span>
            <Icon name="chevron-down" size={20} />
          </summary>
          <nav aria-label="Account menu" className="account-menu-panel">
            <Link href="/settings/account">Profile and account</Link>
            <Link href="/settings/billing">Billing</Link>
            <Link href="/settings/notifications">Notifications</Link>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                });
                window.location.assign("/login?logged_out=1");
              }}
              type="button"
            >
              Sign out
            </button>
          </nav>
        </details>
      </div>
    </header>
  );
}

function MobileHeader({ model }: { model: DashboardFixture }) {
  return (
    <header className="mobile-header">
      <WayfoundLogo variant="dark" />
      <div className="mobile-header-actions">
        <div className="notification-wrap">
          <a className="icon-button" href="/settings/notifications" aria-label="Notifications">
            <Icon name="bell" size={22} />
          </a>
          <span className="notification-dot" aria-label="1 unread notification" role="status" />
        </div>
        <Link aria-label="Open profile and account" href="/settings/account" id="mobile-account-trigger">
          <Avatar label={model.user.avatarLabel} size="medium" />
        </Link>
      </div>
    </header>
  );
}

function GreetingHeader({ model }: { model: DashboardFixture }) {
  return (
    <section aria-labelledby="dashboard-greeting" className="greeting-header">
      <div>
        <h1 id="dashboard-greeting">
          Good morning, <span>{model.user.firstName}</span>
        </h1>
        <p>A brighter tomorrow. A wider you.</p>
      </div>
    </section>
  );
}

function MobileReadinessStrip({ model }: { model: DashboardFixture }) {
  return (
    <section aria-label="Profile readiness" className="mobile-readiness-strip">
      <div
        className="readiness-ring"
        style={{ "--readiness-angle": `${model.readiness.percentage * 3.6}deg` } as React.CSSProperties}
      >
        <strong>{model.readiness.percentage}%</strong>
      </div>
      <strong>Your profile is {model.readiness.percentage}% ready</strong>
      <Icon name="chevron-right" size={27} />
    </section>
  );
}

function OpportunityPathCard({ model, variant }: { model: DashboardFixture; variant: "desktop" | "mobile" }) {
  const ready = model.readiness.percentage === 100;
  const actionHref = ready ? "/opportunities" : "/onboarding";
  if (variant === "mobile") {
    return (
      <section aria-labelledby="mobile-path-title" className="opportunity-path-card opportunity-path-mobile">
        <div className="mobile-path-copy">
          <span className="card-eyebrow">YOUR OPPORTUNITY PATH</span>
          <h2 id="mobile-path-title">{model.readiness.percentage}% ready</h2>
          <p>
            {ready
              ? "Your confirmed profile is ready for personalized opportunities."
              : "Complete a few more steps to unlock even more opportunities."}
          </p>
        </div>
        <MobileProgressRoute />
        <div className="mobile-path-footer">
          <span>Bigger opportunities ahead</span>
          <a className="ui-button ui-button-teal" href={actionHref}>
            {ready ? "View matches" : "Continue setup"} <Icon name="arrow-right" size={22} />
          </a>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="desktop-path-title" className="opportunity-path-card opportunity-path-desktop">
      <picture>
        <source srcSet="/images/opportunity-path-artwork.webp" type="image/webp" />
        <img
          alt="A person looking toward a sunrise over a winding opportunity path"
          className="path-artwork"
          src="/images/opportunity-path-artwork.png"
        />
      </picture>
      <div className="path-overlay" />
      <div className="path-copy">
        <span className="card-eyebrow">YOUR OPPORTUNITY PATH</span>
        <h2 id="desktop-path-title">Your Opportunity Path</h2>
        <p>
          {ready ? (
            "Your confirmed profile is ready for personalized opportunities."
          ) : (
            <>
              Complete a few more steps to unlock
              <br className="desktop-only" /> even more opportunities.
            </>
          )}
        </p>
        <div className="desktop-step-route">
          <Step complete label="Profile completed" />
          <Step complete label="Skills & experience" />
          <Step complete label="Documents" />
          <Step complete={ready} current={!ready} label="Application practice" />
        </div>
        <a className="ui-button ui-button-primary" href={actionHref}>
          {ready ? "View matches" : "Continue setup"} <Icon name="arrow-right" size={23} />
        </a>
      </div>
      <strong className="path-readiness">
        <span>{model.readiness.percentage}%</span> ready
      </strong>
    </section>
  );
}

function NextBestActionCard({ model, variant }: { model: DashboardFixture; variant: "desktop" | "mobile" }) {
  const href = model.readiness.percentage < 100 ? "/onboarding" : "/opportunities";
  if (variant === "mobile")
    return (
      <Link className="next-action-mobile" href={href}>
        <span className="next-action-icon">
          <ProfileIllustration compact />
        </span>
        <span>
          <small>{model.nextAction.label}</small>
          <strong>{model.nextAction.title}</strong>
        </span>
        <Icon name="chevron-right" size={25} />
      </Link>
    );
  return (
    <section aria-labelledby="next-action-title" className="next-action-card">
      <div className="next-action-copy">
        <span className="card-eyebrow">{model.nextAction.label}</span>
        <h2 id="next-action-title">{model.nextAction.title}</h2>
        <p>{model.nextAction.description}</p>
      </div>
      <ProfileIllustration />
      <Link className="ui-button ui-button-primary" href={href}>
        {model.readiness.percentage < 100 ? "Continue setup" : "View matches"}{" "}
        <Icon name="arrow-right" size={22} />
      </Link>
    </section>
  );
}

function ProfileIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`profile-illustration ${compact ? "is-compact" : ""}`}
      viewBox="0 0 120 130"
    >
      <rect height="84" rx="14" width="68" x="26" y="25" />
      <circle cx="60" cy="52" r="15" />
      <path d="M47 55c2-7 6-10 13-10s11 3 13 10M43 79h34M43 91h25M43 103h16" />
      <path d="m99 25 7-10m-2 25 14-2m-14 13 10 6" />
    </svg>
  );
}

function UtilityRail({ model }: { model: DashboardFixture }) {
  return (
    <aside className="utility-rail" aria-label="Your progress summaries">
      <UtilitySummaryCard
        icon="file"
        title="Applications"
        value={`${model.applications.count} active`}
        description={model.applications.description}
        href="/applications"
      />
      <UtilitySummaryCard
        icon="readiness"
        title={model.ielts.label}
        value={model.ielts.score}
        description={model.ielts.description}
        bars
        href="/prepare/ielts"
      />
    </aside>
  );
}

function UtilitySummaryCard({
  icon,
  title,
  value,
  description,
  bars = false,
  href,
}: {
  icon: IconName;
  title: string;
  value: string;
  description: string;
  bars?: boolean;
  href?: string;
}) {
  return (
    <section className="utility-card">
      <div className="utility-title">
        <span className="utility-icon">
          <Icon name={icon} size={22} />
        </span>
        <h2>{title}</h2>
      </div>
      <strong className="utility-value">{value}</strong>
      <p>{description}</p>
      {bars ? (
        <div className="utility-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {href ? (
        <a aria-label={`Open ${title}`} className="icon-button utility-arrow" href={href}>
          <Icon name="chevron-right" size={20} />
        </a>
      ) : (
        <IconButton className="utility-arrow" icon="chevron-right" label={`Open ${title}`} />
      )}
    </section>
  );
}

function MatchSection({
  model,
  savedIds,
  onToggleSaved,
}: {
  model: DashboardFixture;
  savedIds: string[];
  onToggleSaved: (opportunity: OpportunityFixture) => void;
}) {
  return (
    <section aria-labelledby="matches-title" className="matches-section" id="opportunities">
      <div className="section-heading">
        <h2 id="matches-title">{model.discoveryHeading ?? "Top Matches For You"}</h2>
        <Link href="/opportunities">
          View all <Icon name="arrow-right" size={23} />
        </Link>
      </div>
      <div className="matches-track">
        {model.opportunities.map((opportunity) => (
          <OpportunityCard
            isSaved={savedIds.includes(opportunity.id)}
            key={opportunity.id}
            onToggleSaved={() => onToggleSaved(opportunity)}
            opportunity={opportunity}
          />
        ))}
        {!model.opportunities.length ? (
          <div className="dashboard-empty-matches">
            <strong>Your first matches are being prepared.</strong>
            <span>We’ll show verified opportunities here as soon as your profile has been evaluated.</span>
            <Link href="/opportunities">Check opportunities</Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OpportunityCard({
  opportunity,
  isSaved,
  onToggleSaved,
}: {
  opportunity: OpportunityFixture;
  isSaved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-image-wrap">
        {opportunity.imageSrc ? (
          <Image
            alt={opportunity.imageAlt}
            className="destination-photo"
            height={360}
            src={opportunity.imageSrc}
            width={640}
          />
        ) : (
          <div aria-label={opportunity.imageAlt} className="destination-photo-placeholder" role="img">
            <Icon name="map-pin" size={24} />
            <span>{opportunity.country}</span>
          </div>
        )}
        <Chip tone={opportunity.category === "Job" ? "teal" : "blue"}>{opportunity.category}</Chip>
        <IconButton
          className={`bookmark-button ${isSaved ? "is-saved" : ""}`}
          icon="bookmark"
          label={isSaved ? `Remove ${opportunity.title} from saved` : `Save ${opportunity.title}`}
          onClick={onToggleSaved}
        />
      </div>
      <div className="opportunity-card-body">
        <h3>{opportunity.title}</h3>
        <p className="opportunity-country">
          <Icon name="map-pin" size={17} />
          {opportunity.country}
        </p>
        <div className="match-score">
          {opportunity.match === null ? (
            <strong className="match-score-unknown">Complete Passport to calculate your match</strong>
          ) : (
            <>
              <strong>{opportunity.match}%</strong>
              <span>Match</span>
            </>
          )}
        </div>
        <p className="opportunity-deadline">
          <Icon name="calendar" size={17} />
          <span>
            <small>{opportunity.deadlineLabel}</small>
            {opportunity.deadline}
          </span>
        </p>
        <Link
          aria-label={`View ${opportunity.title}`}
          className="icon-button opportunity-arrow"
          href={`/opportunities/${opportunity.id}` as Route}
        >
          <Icon name="chevron-right" size={20} />
        </Link>
      </div>
    </article>
  );
}

function MobileBottomNav() {
  return (
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav" id="mobile-bottom-nav">
      {mobileNavigation.map((item) => (
        <Link
          aria-current={item.label === "Home" ? "page" : undefined}
          className={item.label === "Home" ? "is-active" : ""}
          href={item.href as Route}
          key={item.label}
        >
          <Icon name={item.icon} size={27} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
