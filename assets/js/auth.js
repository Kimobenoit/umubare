import { api, setTokens, clearTokens, getRefreshToken, isAuthenticated } from "./api.js";

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function logout() {
  const refresh = getRefreshToken();
  if (isAuthenticated() && refresh) {
    api("/auth/logout", { method: "POST", body: { refreshToken: refresh } }).catch(() => {});
  }
  clearTokens();
  currentUser = null;
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

export async function login(email, password) {
  const data = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setTokens(data.token, data.refreshToken);
  currentUser = data.user;
  window.dispatchEvent(new CustomEvent("auth:login", { detail: data.user }));
  return data.user;
}

export async function register(email, password, displayName) {
  const data = await api("/auth/register", {
    method: "POST",
    body: { email, password, displayName },
  });
  setTokens(data.token, data.refreshToken);
  currentUser = data.user;
  window.dispatchEvent(new CustomEvent("auth:login", { detail: data.user }));
  return data.user;
}

/**
 * Bootstrap auth state on app launch.
 * Calls GET /auth/me to validate the stored token and restore user data.
 * Returns true if session is valid, false if not.
 */
export async function bootstrapAuth() {
  if (!isAuthenticated()) return false;

  try {
    const data = await api("/auth/me");
    currentUser = data.user;
    return true;
  } catch {
    clearTokens();
    currentUser = null;
    return false;
  }
}

export function renderAuthView(container) {
  container.innerHTML = `
    <div class="authContainer">
      <div class="authCard">
        <div class="authHeader">
          <div class="authLogo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>
          </div>
          <h1>Student Budget Tracker</h1>
          <p>Sign in to manage your finances</p>
        </div>

        <div id="authTabs" class="authTabs">
          <button class="authTab active" data-auth="login">Sign In</button>
          <button class="authTab" data-auth="register">Create Account</button>
        </div>

        <form id="loginForm" class="authForm">
          <div class="formField">
            <label for="loginEmail" class="formLabel">Email</label>
            <input id="loginEmail" type="email" class="formInput" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="formField">
            <label for="loginPassword" class="formLabel">Password</label>
            <input id="loginPassword" type="password" class="formInput" placeholder="Your password" required autocomplete="current-password">
          </div>
          <p class="formError" id="loginError"></p>
          <button class="btn btnPrimary authSubmit" type="submit">Sign In</button>
        </form>

        <form id="registerForm" class="authForm" hidden>
          <div class="formField">
            <label for="registerName" class="formLabel">Display Name</label>
            <input id="registerName" type="text" class="formInput" placeholder="Your name" autocomplete="name">
          </div>
          <div class="formField">
            <label for="registerEmail" class="formLabel">Email</label>
            <input id="registerEmail" type="email" class="formInput" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="formField">
            <label for="registerPassword" class="formLabel">Password</label>
            <input id="registerPassword" type="password" class="formInput" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
          </div>
          <p class="formError" id="registerError"></p>
          <button class="btn btnPrimary authSubmit" type="submit">Create Account</button>
        </form>
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll(".authTab");
  const loginForm = container.querySelector("#loginForm");
  const registerForm = container.querySelector("#registerForm");
  const loginError = container.querySelector("#loginError");
  const registerError = container.querySelector("#registerError");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.auth === "login";
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
      loginError.textContent = "";
      registerError.textContent = "";
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = container.querySelector("#loginEmail").value;
    const password = container.querySelector("#loginPassword").value;
    try {
      await login(email, password);
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.textContent = "";
    const name = container.querySelector("#registerName").value;
    const email = container.querySelector("#registerEmail").value;
    const password = container.querySelector("#registerPassword").value;
    try {
      await register(email, password, name || undefined);
    } catch (err) {
      registerError.textContent = err.message;
    }
  });
}
