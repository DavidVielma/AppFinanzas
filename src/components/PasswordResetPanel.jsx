import { useState } from "react";
import { KeyRound } from "lucide-react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

export function PasswordResetPanel({ session, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!hasSupabaseConfig) {
      setMessage("Supabase no esta configurado.");
      return;
    }

    if (!session) {
      setMessage("El enlace de recuperacion no genero una sesion valida. Solicita un nuevo correo.");
      return;
    }

    if (password.length < 6) {
      setMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setMessage("Las contraseñas nuevas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setConfirmation("");
    setMessage("Contraseña actualizada. Ya puedes iniciar sesion con la nueva contraseña.");
    window.setTimeout(() => onDone?.(), 1400);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <KeyRound size={28} />
        </div>
        <h1>Nueva contraseña</h1>
        <p>Ingresa y confirma tu nueva contraseña para recuperar el acceso a Fluxa.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nueva contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          </label>
          <label>
            Repetir nueva contraseña
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required />
          </label>
          {message && <div className="inline-message">{message}</div>}
          <button className="primary-action" disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
