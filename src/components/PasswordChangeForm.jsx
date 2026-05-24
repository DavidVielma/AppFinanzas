import { useState } from "react";
import { KeyRound } from "lucide-react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

export function PasswordChangeForm({ session, isRemote, showTitle = true }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!hasSupabaseConfig || !isRemote || !session?.user?.email) {
      setMessage("Debes iniciar sesión para modificar la contraseña.");
      return;
    }

    if (nextPassword.length < 6) {
      setMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nextPassword !== confirmation) {
      setMessage("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    if (currentPassword === nextPassword) {
      setMessage("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setLoading(true);
    const verification = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });

    if (verification.error) {
      setLoading(false);
      setMessage("La contraseña actual no es correcta.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    setLoading(false);

    if (error) {
      setMessage("No pudimos actualizar la contraseña. Inténtalo nuevamente.");
      return;
    }

    setCurrentPassword("");
    setNextPassword("");
    setConfirmation("");
    setMessage("Contraseña actualizada correctamente.");
  }

  return (
    <form className={`password-form ${showTitle ? "" : "password-form-compact"}`} onSubmit={handleSubmit}>
      <div className="password-form-title">
        <KeyRound size={18} />
        <strong>Cambiar contraseña</strong>
      </div>
      <label>
        Contraseña actual
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={!isRemote} />
      </label>
      <label>
        Nueva contraseña
        <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} minLength={6} required disabled={!isRemote} />
      </label>
      <label>
        Repetir nueva contraseña
        <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required disabled={!isRemote} />
      </label>
      {message && <div className="inline-message">{message}</div>}
      <button className="primary-action" disabled={loading || !isRemote}>
        {loading ? "Actualizando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
