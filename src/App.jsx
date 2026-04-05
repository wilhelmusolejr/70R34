import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Link,
  NavLink,
  Routes,
  Route,
} from "react-router-dom";
import { loginAccount, registerAccount } from "./api/auth";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ImageAssetDetailPage } from "./pages/ImageAssetDetailPage";
import { ImagesPage } from "./pages/ImagesPage";
import { PageDetailPage } from "./pages/PageDetailPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { PagesPage } from "./pages/PagesPage";
import { ProfileDetailPage } from "./pages/ProfileDetailPage";
import "./App.css";

function AuthField({ label, value, onChange, type = "text" }) {
  return (
    <label className="npm-field">
      <span className="npm-label">{label}</span>
      <input
        className="npm-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ThemeIcon({ theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0116 0" />
    </svg>
  );
}

function Layout({ children }) {
  const { currentUser, login, logout } = useAuth();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("pv_theme") || "light",
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [wipFeature, setWipFeature] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pv_theme", theme);
  }, [theme]);

  function openAuth(mode) {
    setAuthMode(mode);
    setUsername("");
    setPassword("");
    setAuthError("");
    setIsAuthOpen(true);
  }

  function closeAuth() {
    setIsAuthOpen(false);
    setAuthError("");
  }

  function toggleAccountMenu() {
    if (currentUser) {
      setIsAccountMenuOpen((current) => !current);
      return;
    }
    openAuth("login");
  }

  async function handleAuthSubmit() {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setAuthError("Username and password are required.");
      return;
    }

    try {
      setAuthError("");
      const result =
        authMode === "register"
          ? await registerAccount({
              username: trimmedUsername,
              password: trimmedPassword,
            })
          : await loginAccount({
              username: trimmedUsername,
              password: trimmedPassword,
            });

      login(result.user);
      setIsAccountMenuOpen(false);
      closeAuth();
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    }
  }

  function handleLogout() {
    logout();
    setIsAccountMenuOpen(false);
    closeAuth();
  }

  function showWipModal(e, feature) {
    e.preventDefault();
    setWipFeature(feature);
  }

  function closeWipModal() {
    setWipFeature("");
  }

  return (
    <div>
      {/* Nav */}
      <nav>
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <span className="nav-word">70R34</span>
          </Link>
          <div className="nav-links">
            <NavLink to="/" end>
              Profiles
            </NavLink>
            <NavLink to="/images">Images</NavLink>
            <NavLink to="/pages">Pages</NavLink>
            <a href="#" onClick={(e) => showWipModal(e, "Proxy")}>
              Proxy
            </a>
            <a href="#" onClick={(e) => showWipModal(e, "Anti-Bot ML")}>
              Anti-Bot ML
            </a>
            <a href="#" onClick={(e) => showWipModal(e, "Analytics")}>
              Analytics
            </a>
          </div>
          <div className="nav-meta">
            <button
              type="button"
              className="theme-switcher"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              <span className="theme-switcher-icon">
                <ThemeIcon theme={theme} />
              </span>
              {theme === "dark" ? "Black" : "Light"}
            </button>
            <button
              type="button"
              className="theme-switcher"
              onClick={toggleAccountMenu}
            >
              <span className="theme-switcher-icon">
                <AccountIcon />
              </span>
              {currentUser?.username || "Account"}
            </button>
            {currentUser?.role === "guest" && (
              <span className="nav-pill">GUEST</span>
            )}
            {currentUser && isAccountMenuOpen && (
              <div className="account-menu">
                <div className="account-menu-label">Signed in as</div>
                <div className="account-menu-user">{currentUser.username}</div>
                <div className="account-menu-divider" />
                <button
                  type="button"
                  className="account-menu-item"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
            <span className="nav-divider" />
            <div className="nav-today">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}

      {isAuthOpen && (
        <div className="npm-backdrop" onClick={closeAuth}>
          <div
            className="npm-modal auth-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Account Access</div>
                <h2 className="npm-title">
                  {authMode === "login" ? "Login" : "Register"}
                </h2>
              </div>
              <button className="npm-close" type="button" onClick={closeAuth}>
                x
              </button>
            </div>

            <div className="npm-body">
              <div className="auth-switch-row">
                <button
                  type="button"
                  className={`auth-switch-btn ${authMode === "login" ? "active" : ""}`}
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`auth-switch-btn ${authMode === "register" ? "active" : ""}`}
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                  }}
                >
                  Register
                </button>
              </div>

              <div className="npm-grid auth-grid">
                <AuthField
                  label="Username"
                  value={username}
                  onChange={setUsername}
                />
                <AuthField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
              </div>

              {authError ? (
                <div className="npm-submit-error">{authError}</div>
              ) : null}

              <div className="npm-footer">
                <button type="button" className="btn-s" onClick={closeAuth}>
                  Cancel
                </button>
                <div className="npm-footer-actions">
                  {currentUser ? (
                    <button
                      type="button"
                      className="btn-s"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-p"
                    onClick={handleAuthSubmit}
                  >
                    {authMode === "login" ? "Login" : "Register"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {wipFeature && (
        <div className="npm-backdrop" onClick={closeWipModal}>
          <div
            className="npm-modal wip-modal max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="npm-header">
              <div>
                <div className="npm-kicker">Work In Progress</div>
                <h2 className="npm-title">{wipFeature}</h2>
              </div>
              <button
                className="npm-close"
                type="button"
                onClick={closeWipModal}
              >
                x
              </button>
            </div>
            asda
            <div className="npm-body">
              <div className="npm-grid auth-grid">
                <div style={{ color: "var(--text2)", fontSize: "13px" }}>
                  This feature is still under development.
                </div>
              </div>

              <div className="npm-footer">
                <div className="npm-footer-actions">
                  <button
                    type="button"
                    className="btn-p"
                    onClick={closeWipModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<ProfilesPage />} />
            <Route path="/images" element={<ImagesPage />} />
            <Route path="/images/:id" element={<ImageAssetDetailPage />} />
            <Route path="/pages" element={<PagesPage />} />
            <Route path="/pages/:id" element={<PageDetailPage />} />
            <Route path="/profile/:id" element={<ProfileDetailPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
