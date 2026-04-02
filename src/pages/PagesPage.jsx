import { useEffect, useMemo, useState } from "react";
import { fetchProfiles } from "../api/profiles";
import "../App.css";

function derivePageStatus(profile) {
  if (!profile.hasPage || !profile.pageUrl) {
    return "Available";
  }

  if (["Pending Profile", "Need Setup"].includes(profile.status)) {
    return "Pending";
  }

  return "Claimed";
}

function derivePageName(profile) {
  return (
    profile.work?.[0]?.company ||
    `${profile.firstName} ${profile.lastName}`.trim() ||
    "Untitled Page"
  );
}

function derivePageRows(profiles) {
  return profiles.map((profile) => ({
    id: profile.id,
    pageName: derivePageName(profile),
    status: derivePageStatus(profile),
    tags: profile.tags || [],
    bio: profile.bio || "",
    pageUrl: profile.pageUrl || "",
  }));
}

function PageStatusBadge({ status }) {
  const className =
    status === "Available"
      ? "sp"
      : status === "Pending"
        ? "sa"
        : "sg";

  return (
    <span className={`sbadge ${className}`}>
      <span className="sdot2" />
      {status}
    </span>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

function PagesTable({ title, rows }) {
  if (!rows.length) {
    return (
      <div className="page-section">
        <div className="page-section-head">
          <h2>{title}</h2>
          <span>{rows.length} pages</span>
        </div>
        <EmptyState
          title={`No ${title.toLowerCase()} pages`}
          description="Try a different search or wait for more pages to be added."
        />
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-section-head">
        <h2>{title}</h2>
        <span>{rows.length} pages</span>
      </div>
      <div className="twrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Status</th>
              <th>Category</th>
              <th>Bio</th>
              <th>Page Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((page) => (
              <tr key={`${title}-${page.id}`}>
                <td>
                  <div className="page-name-cell">
                    <div className="pname">{page.pageName}</div>
                  </div>
                </td>
                <td>
                  <PageStatusBadge status={page.status} />
                </td>
                <td>
                  {page.tags.length ? (
                    <div className="tag-list">
                      {page.tags.map((tag) => (
                        <span key={`${page.id}-${tag}`} className="tag-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="nol">No category</span>
                  )}
                </td>
                <td>
                  <div className="page-bio-cell">
                    {page.bio || <span className="nol">No bio</span>}
                  </div>
                </td>
                <td>
                  {page.pageUrl ? (
                    <a
                      href={page.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="el"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Open Page
                    </a>
                  ) : (
                    <span className="nol">No link</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PagesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProfiles();
        if (!cancelled) {
          setProfiles(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load pages.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const pageRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return derivePageRows(profiles).filter((page) => {
      if (!normalizedSearch) return true;

      return [
        page.pageName,
        page.status,
        page.bio,
        page.pageUrl,
        page.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [profiles, search]);

  const availablePages = pageRows.filter((page) => page.status === "Available");
  const pendingPages = pageRows.filter((page) => page.status === "Pending");
  const claimedPages = pageRows.filter((page) => page.status === "Claimed");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pages</h1>
          <p>Browse page inventory grouped by availability and claim status.</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{pageRows.length}</div>
          <div className="slabel">Total Pages</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {availablePages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Available
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--amber)" }}>
            {pendingPages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--amber)" }} />
            Pending
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--green)" }}>
            {claimedPages.length}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--green)" }} />
            Claimed
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="sw">
          <span className="si">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className="fsearch"
            placeholder="Search page name, category, bio, or link..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{pageRows.length} pages</span>
      </div>

      {loading ? (
        <EmptyState
          title="Loading pages"
          description="Fetching page inventory from the API..."
        />
      ) : error ? (
        <EmptyState title="Unable to load pages" description={error} />
      ) : (
        <div className="page-sections">
          <PagesTable title="Available" rows={availablePages} />
          <PagesTable title="Pending" rows={pendingPages} />
          <PagesTable title="Claimed" rows={claimedPages} />
        </div>
      )}
    </div>
  );
}
