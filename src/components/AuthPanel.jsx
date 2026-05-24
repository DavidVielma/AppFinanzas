import { useState } from "react";
import { getAuthRedirectUrl, hasSupabaseConfig, supabase } from "../lib/supabase";

function getFriendlyAuthError(error, mode) {
  const message = error?.message?.toLowerCase() || "";

  if (message.includes("invalid login credentials")) {
    return "El correo o la contraseña no son correctos.";
  }

  if (message.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de ingresar.";
  }

  if (message.includes("password should be at least") || message.includes("weak password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (message.includes("already registered")) {
    return "Ese correo ya está registrado. Ingresa o recupera tu contraseña.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Hiciste demasiados intentos. Espera unos minutos y vuelve a probar.";
  }

  if (mode === "reset") {
    return "No pudimos enviar el correo de recuperación. Inténtalo nuevamente en unos minutos.";
  }

  if (mode === "register") {
    return "No pudimos crear la cuenta. Revisa los datos e inténtalo nuevamente.";
  }

  return "No pudimos iniciar sesión. Revisa tus datos e inténtalo nuevamente.";
}

export function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!hasSupabaseConfig) {
      setMessage("El acceso no está disponible en este momento. Inténtalo nuevamente más tarde.");
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    let data = null;
    let error = null;

    if (mode === "reset") {
      const response = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl("?reset-password=1")
      });
      error = response.error;
    } else if (mode === "register") {
      const cleanUsername = username.trim();
      const existingUsername = await supabase.from("profiles").select("id").eq("username", cleanUsername).maybeSingle();

      if (existingUsername.data) {
        error = { message: "Ese nombre de usuario ya existe. Elige otro." };
      } else {
        const response = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { username: cleanUsername },
            emailRedirectTo: getAuthRedirectUrl()
          }
        });
        data = response.data;
        error = response.error;

        if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          error = { message: "already registered" };
        }
      }
    } else {
      const response = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      error = response.error;
    }

    setLoading(false);

    if (error) {
      setMessage(getFriendlyAuthError(error, mode));
      return;
    }

    setMessage(
      mode === "reset"
        ? "Si el correo está registrado, recibirás un enlace para recuperar tu contraseña."
        : mode === "register"
          ? "Cuenta creada. Revisa tu correo para continuar."
          : "Sesión iniciada."
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <img src="/Fluxa_Verde.png" alt="" />
        </div>
        <h1>Fluxa</h1>
        <p>Administra ingresos, egresos, proyecciones, ahorros e inversiones con una vista mensual similar a tu hoja Flujo.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="segmented auth-segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Ingresar
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              Crear usuario
            </button>
            <button type="button" className={mode === "reset" ? "active" : ""} onClick={() => setMode("reset")}>
              Recuperar
            </button>
          </div>

          {mode === "register" && (
            <label>
              Nombre de usuario
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="david" required />
            </label>
          )}
          <label>
            Correo
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@dominio.cl" required />
          </label>
          {mode !== "reset" && (
            <label>
              Contraseña
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            </label>
          )}

          {message && <div className="inline-message">{message}</div>}

          <button className="primary-action" disabled={loading}>
            {loading ? "Procesando..." : mode === "reset" ? "Enviar recuperación" : mode === "register" ? "Crear cuenta" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
