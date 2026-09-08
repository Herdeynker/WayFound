"use client";

import React, { useState } from "react";
import { dashboardFixture, type OpportunityFixture } from "@/features/dashboard/dashboard-fixtures";
import { DestinationArtwork } from "./destination-artwork";
import { Icon, type IconName } from "./icons";
import { DesktopRouteSignature, MobileProgressRoute, SidebarRouteSignature } from "./route-signatures";
import { WayfoundLogo } from "./wayfound-logo";
import { Avatar, Chip, IconButton, SearchInput, Step } from "./ui";

type NavigationItem = { label: string; icon: IconName; href: string };

const desktopNavigation: NavigationItem[] = [
  { label: "Home", icon: "home", href: "#home" },
  { label: "Opportunities", icon: "briefcase", href: "#opportunities" },
  { label: "My Applications", icon: "file", href: "#applications" },
  { label: "Readiness", icon: "readiness", href: "#readiness" },
  { label: "Saved", icon: "bookmark", href: "#saved" },
  { label: "Messages", icon: "message", href: "#messages" },
  { label: "Profile", icon: "profile", href: "#profile" },
];

const mobileNavigation: NavigationItem[] = [
  { label: "Home", icon: "home", href: "#home" },
  { label: "Explore", icon: "search", href: "#explore" },
  { label: "Applications", icon: "file", href: "#applications" },
  { label: "Prepare", icon: "readiness", href: "#prepare" },
  { label: "Profile", icon: "profile", href: "#profile" },
];

export function DashboardShell() {
  const [activeNav, setActiveNav] = useState("Home");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const selectNav = (label: string) => setActiveNav(label);
  const toggleSaved = (id: string) =>
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
    );

  return (
    <div className="app-shell" id="home">
      <DesktopSidebar activeNav={activeNav} onSelect={selectNav} />
      <div className="app-content">
        <DesktopTopBar />
        <MobileHeader />
        <main className="dashboard-main" id="main-content">
          <div className="dashboard-container">
            <GreetingHeader />
            <MobileReadinessStrip />
            <div className="dashboard-route-wrap">
              <DesktopRouteSignature />
            </div>
            <div className="desktop-dashboard-grid">
              <OpportunityPathCard variant="desktop" />
              <NextBestActionCard variant="desktop" />
              <UtilityRail />
            </div>
            <div className="mobile-dashboard-stack">
              <OpportunityPathCard variant="mobile" />
              <NextBestActionCard variant="mobile" />
            </div>
            <MatchSection savedIds={savedIds} onToggleSaved={toggleSaved} />
          </div>
        </main>
        <MobileBottomNav activeNav={activeNav} onSelect={selectNav} />
      </div>
    </div>
  );
}

function DesktopSidebar({ activeNav, onSelect }: { activeNav: string; onSelect: (label: string) => void }) {
  return (
    <aside className="desktop-sidebar" aria-label="Application sidebar">
      <div className="sidebar-brand">
        <WayfoundLogo variant="light" />
      </div>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        {desktopNavigation.map((item) => (
          <NavigationLink
            active={activeNav === item.label}
            item={item}
            key={item.label}
            onSelect={onSelect}
          />
        ))}
      </nav>
      <div className="sidebar-signature">
        <SidebarRouteSignature />
      </div>
    </aside>
  );
}

function NavigationLink({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: NavigationItem;
  onSelect: (label: string) => void;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={`sidebar-link ${active ? "is-active" : ""}`}
      href={item.href}
      onClick={(event) => {
        event.preventDefault();
        onSelect(item.label);
      }}
    >
      <Icon name={item.icon} size={23} />
      <span>{item.label}</span>
    </a>
  );
}

function DesktopTopBar() {
  return (
    <header className="desktop-topbar">
      <SearchInput placeholder="Search opportunities, skills or countries…" />
      <div className="topbar-user">
        <IconButton className="notification-button" icon="bell" label="Notifications" />
        <span className="notification-dot" aria-label="1 unread notification" role="status" />
        <span className="topbar-divider" aria-hidden="true" />
        <Avatar label="Amara" size="medium" />
        <div className="topbar-copy">
          <strong>Hi, Amara</strong>
          <span>
            Keep going <span aria-hidden="true">⚡</span>
          </span>
        </div>
        <IconButton icon="chevron-down" label="Open account menu" />
      </div>
    </header>
  );
}

function MobileHeader() {
  return (
    <header className="mobile-header">
      <WayfoundLogo variant="dark" />
      <div className="mobile-header-actions">
        <div className="notification-wrap">
          <IconButton icon="bell" label="Notifications" />
          <span className="notification-dot" aria-label="1 unread notification" role="status" />
        </div>
        <Avatar label="Amara" size="medium" />
      </div>
    </header>
  );
}

function GreetingHeader() {
  return (
    <section aria-labelledby="dashboard-greeting" className="greeting-header">
      <div>
        <h1 id="dashboard-greeting">
          Good morning, <span>Amara</span>
        </h1>
        <p>A brighter tomorrow. A wider you.</p>
      </div>
    </section>
  );
}

function MobileReadinessStrip() {
  return (
    <section aria-label="Profile readiness" className="mobile-readiness-strip">
      <div
        className="readiness-ring"
        style={
          { "--readiness-angle": `${dashboardFixture.readiness.percentage * 3.6}deg` } as React.CSSProperties
        }
      >
        <strong>{dashboardFixture.readiness.percentage}%</strong>
      </div>
      <strong>Your profile is {dashboardFixture.readiness.percentage}% ready</strong>
      <Icon name="chevron-right" size={27} />
    </section>
  );
}

function OpportunityPathCard({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "mobile") {
    return (
      <section aria-labelledby="mobile-path-title" className="opportunity-path-card opportunity-path-mobile">
        <div className="mobile-path-copy">
          <span className="card-eyebrow">YOUR OPPORTUNITY PATH</span>
          <h2 id="mobile-path-title">78% ready</h2>
          <p>Complete a few more steps to unlock even more opportunities.</p>
        </div>
        <MobileProgressRoute />
        <div className="mobile-path-footer">
          <span>Bigger opportunities ahead</span>
          <a className="ui-button ui-button-teal" href="/onboarding">
            Continue setup <Icon name="arrow-right" size={22} />
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
          Complete a few more steps to unlock
          <br className="desktop-only" /> even more opportunities.
        </p>
        <div className="desktop-step-route">
          <Step complete label="Profile completed" />
          <Step complete label="Skills & experience" />
          <Step complete label="Documents" />
          <Step current label="Application practice" />
        </div>
        <a className="ui-button ui-button-primary" href="/onboarding">
          Continue setup <Icon name="arrow-right" size={23} />
        </a>
      </div>
      <strong className="path-readiness">
        <span>78%</span> ready
      </strong>
    </section>
  );
}

function NextBestActionCard({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "mobile")
    return (
      <button className="next-action-mobile" type="button">
        <span className="next-action-icon">
          <ProfileIllustration compact />
        </span>
        <span>
          <small>{dashboardFixture.nextAction.label}</small>
          <strong>{dashboardFixture.nextAction.title}</strong>
        </span>
        <Icon name="chevron-right" size={25} />
      </button>
    );
  return (
    <section aria-labelledby="next-action-title" className="next-action-card">
      <div className="next-action-copy">
        <span className="card-eyebrow">{dashboardFixture.nextAction.label}</span>
        <h2 id="next-action-title">{dashboardFixture.nextAction.title}</h2>
        <p>{dashboardFixture.nextAction.description}</p>
      </div>
      <ProfileIllustration />
      <a className="ui-button ui-button-primary" href="/onboarding">
        Continue setup <Icon name="arrow-right" size={22} />
      </a>
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

function UtilityRail() {
  return (
    <aside className="utility-rail" aria-label="Your progress summaries">
      <UtilitySummaryCard
        icon="file"
        title={dashboardFixture.applications.label === "active" ? "Applications" : "Applications"}
        value={`${dashboardFixture.applications.count} active`}
        description={dashboardFixture.applications.description}
      />
      <UtilitySummaryCard
        icon="readiness"
        title={dashboardFixture.ielts.label}
        value={dashboardFixture.ielts.score}
        description={dashboardFixture.ielts.description}
        bars
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
}: {
  icon: IconName;
  title: string;
  value: string;
  description: string;
  bars?: boolean;
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
      <IconButton className="utility-arrow" icon="chevron-right" label={`Open ${title}`} />
    </section>
  );
}

function MatchSection({
  savedIds,
  onToggleSaved,
}: {
  savedIds: string[];
  onToggleSaved: (id: string) => void;
}) {
  return (
    <section aria-labelledby="matches-title" className="matches-section" id="opportunities">
      <div className="section-heading">
        <h2 id="matches-title">Top Matches For You</h2>
        <a href="#all-opportunities">
          View all <Icon name="arrow-right" size={23} />
        </a>
      </div>
      <div className="matches-track">
        {dashboardFixture.opportunities.map((opportunity) => (
          <OpportunityCard
            isSaved={savedIds.includes(opportunity.id)}
            key={opportunity.id}
            onToggleSaved={() => onToggleSaved(opportunity.id)}
            opportunity={opportunity}
          />
        ))}
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
        <DestinationArtwork artwork={opportunity.artwork} title={opportunity.title} />
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
          <strong>{opportunity.match}%</strong>
          <span>Match</span>
        </div>
        <p className="opportunity-deadline">
          <Icon name="calendar" size={17} />
          <span>
            <small>{opportunity.deadlineLabel}</small>
            {opportunity.deadline}
          </span>
        </p>
        <IconButton className="opportunity-arrow" icon="chevron-right" label={`View ${opportunity.title}`} />
      </div>
    </article>
  );
}

function MobileBottomNav({ activeNav, onSelect }: { activeNav: string; onSelect: (label: string) => void }) {
  return (
    <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
      {mobileNavigation.map((item) => (
        <a
          aria-current={activeNav === item.label ? "page" : undefined}
          className={activeNav === item.label ? "is-active" : ""}
          href={item.href}
          key={item.label}
          onClick={(event) => {
            event.preventDefault();
            onSelect(item.label);
          }}
        >
          <Icon name={item.icon} size={27} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
