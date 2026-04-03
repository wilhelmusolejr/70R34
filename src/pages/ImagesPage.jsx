import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { imageAssets } from "../data/imageAssets";
import "../App.css";

function EmptyState({ title, description }) {
  return (
    <div className="empty-st">
      <div className="et">{title}</div>
      <div className="ed">{description}</div>
    </div>
  );
}

export function ImagesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const assets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return imageAssets.filter((asset) => {
      if (!normalizedSearch) return true;

      return [asset.name, asset.profileUrl, asset.images.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [search]);

  const totalImages = assets.reduce((sum, asset) => sum + asset.images.length, 0);
  const totalPossibleProfiles = assets.reduce(
    (sum, asset) => sum + asset.possibleProfiles,
    0,
  );
  const totalUses = assets.reduce((sum, asset) => sum + asset.usedBy, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Images</h1>
          <p>Temporary image asset inventory using dummy data for now.</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{assets.length}</div>
          <div className="slabel">Asset Sets</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {totalImages}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Images Inside
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--amber)" }}>
            {totalPossibleProfiles}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--amber)" }} />
            Possible Profile
          </div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--green)" }}>
            {totalUses}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--green)" }} />
            Users Used Asset
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
            placeholder="Search asset name or profile URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{assets.length} assets</span>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title="No image assets found"
          description="Try a different search term."
        />
      ) : (
        <div className="twrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Images Inside</th>
                <th>Possible Profile</th>
                <th>Users Used Asset</th>
                <th>Profile URL</th>
                <th>Visit</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="page-name-cell">
                      <div className="pname">{asset.name}</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.images.length}</div>
                      <div className="da">Files in this set</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.possibleProfiles}</div>
                      <div className="da">Profiles supported</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.usedBy}</div>
                      <div className="da">Users already using it</div>
                    </div>
                  </td>
                  <td>
                    {asset.profileUrl ? (
                      <a
                        href={asset.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="el"
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Open Profile
                      </a>
                    ) : (
                      <span className="nol">No profile URL</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="vbtn"
                      onClick={() => navigate(`/images/${asset.id}`)}
                    >
                      Visit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
