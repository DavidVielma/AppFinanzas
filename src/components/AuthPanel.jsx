import { useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

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
      setMessage("Configura .env con Supabase para ingresar.");
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    let data = null;
    let error = null;

    if (mode === "reset") {
      const response = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}${window.location.pathname}?reset-password=1`
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
          options: { data: { username: cleanUsername } }
        });
        data = response.data;
        error = response.error;

        if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          error = { message: "Ese correo ya esta registrado. Ingresa o recupera tu contraseña." };
        }
      }
    } else {
      const response = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      error = response.error;
    }

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      mode === "reset"
        ? "Te enviamos un correo para recuperar tu contraseña. Si al abrirlo ves localhost rechazado, revisa la URL pública configurada en Supabase."
        : mode === "register"
          ? "Usuario creado. Revisa la confirmacion si esta activa."
          : "Sesion iniciada."
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <img src="/fluxa-logo.svg" alt="" />
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
