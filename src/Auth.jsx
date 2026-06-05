import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [isRegistreren, setIsRegistreren] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bericht, setBericht] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setBericht("");
    if (isRegistreren) {
      const { error } = await supabase.auth.signUp({ email, password: wachtwoord });
      if (error) setBericht(error.message);
      else setBericht("Check je email om te bevestigen!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) setBericht("Email of wachtwoord klopt niet");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 400, boxShadow: "0 24px 56px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#0F0F14" }}>WerkMate</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>{isRegistreren ? "Maak een account aan" : "Log in op je account"}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>E-mailadres</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jouw@email.nl"
            style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Wachtwoord</label>
          <input type="password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)} placeholder="••••••••"
            style={{ width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "10px 13px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>

        {bericht && <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "10px 13px", fontSize: 12.5, color: "#4338CA", marginBottom: 14 }}>{bericht}</div>}

        <button onClick={handleSubmit} disabled={loading || !email || !wachtwoord}
          style={{ width: "100%", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (!email || !wachtwoord) ? 0.5 : 1 }}>
          {loading ? "Bezig..." : isRegistreren ? "Account aanmaken" : "Inloggen"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#888" }}>
          {isRegistreren ? "Al een account? " : "Nog geen account? "}
          <span onClick={() => setIsRegistreren(!isRegistreren)} style={{ color: "#6366F1", fontWeight: 600, cursor: "pointer" }}>
            {isRegistreren ? "Inloggen" : "Registreren"}
          </span>
        </div>
      </div>
    </div>
  );
}
