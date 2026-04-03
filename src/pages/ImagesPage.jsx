import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHumanAssets } from "../api/humanAssets";
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
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHumanAssets() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchHumanAssets();
        if (!cancelled) {
          setAssets(data);
        }
      } catch (err) {
        if (!cancelled) {
          setAssets([]);
          setError(err.message || "Failed to load image assets.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHumanAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return assets.filter((asset) => {
      if (!normalizedSearch) return true;

      const imageNames = (asset.images || []).map((image) => image.filename).join(" ");

      return [asset.name, imageNames]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [assets, search]);

  const totalImages = filteredAssets.reduce((sum, asset) => sum + (asset.images?.length || 0), 0);
  const totalPossibleProfiles = filteredAssets.reduce(
    (sum, asset) => sum + asset.possibleProfiles,
    0,
  );
  const totalUses = filteredAssets.reduce((sum, asset) => sum + asset.usedBy, 0);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-st">
          <div className="et">Loading image assets</div>
          <div className="ed">Fetching human asset records from the backend...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Images</h1>
          <p>Image assets connected to real human asset records from the backend.</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="sc">
          <div className="snum">{filteredAssets.length}</div>
          <div className="slabel">Human Assets</div>
        </div>
        <div className="sc">
          <div className="snum" style={{ color: "var(--accent)" }}>
            {totalImages}
          </div>
          <div className="slabel">
            <span className="sdot" style={{ background: "var(--accent)" }} />
            Linked Images
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
            Profiles Using
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
            placeholder="Search human asset name or image filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="rc">{filteredAssets.length} human assets</span>
      </div>

      {error ? (
        <EmptyState title="Unable to load image assets" description={error} />
      ) : filteredAssets.length === 0 ? (
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
                <th>Profiles Using</th>
                <th>Primary Image</th>
                <th>Visit</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="page-name-cell">
                      <div className="pname">{asset.name}</div>
                    </div>
                  </td>
                  <td>
                    <div className="dcell">
                      <div className="dv">{asset.images.length}</div>
                      <div className="da">Files linked to this human asset</div>
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
                      <div className="da">Profiles assigned</div>
                    </div>
                  </td>
                  <td>
                    {asset.images[0]?.filename ? (
                      <div className="dcell">
                        <div className="dv">{asset.images[0].filename.split("/").pop()}</div>
                        <div className="da">First linked image</div>
                      </div>
                    ) : (
                      <span className="nol">No image linked</span>
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
