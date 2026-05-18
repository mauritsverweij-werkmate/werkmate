import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// ── Login scherm ──────────────────────────────────────────────
function Auth({ onLogin }) {
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
      else setBericht("✅ Account aangemaakt! Je kunt nu inloggen.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) setBericht("❌ Email of wachtwoord klopt niet");
      else onLogin(data.user);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 56px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>⚡</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:"#0F0F14" }}>WerkMate</div>
          <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>{isRegistreren ? "Maak een gratis account aan" : "Log in op je account"}</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>E-mailadres</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="jouw@email.nl" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%", border:"1.5px solid #E5E7EB", borderRadius:9, padding:"10px 13px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>Wachtwoord</label>
          <input type="password" value={wachtwoord} onChange={e=>setWachtwoord(e.target.value)} placeholder="Minimaal 6 tekens" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%", border:"1.5px solid #E5E7EB", borderRadius:9, padding:"10px 13px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
        </div>
        {bericht && <div style={{ background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:8, padding:"10px 13px", fontSize:12.5, color:"#4338CA", marginBottom:14 }}>{bericht}</div>}
        <button onClick={handleSubmit} disabled={loading||!email||!wachtwoord}
          style={{ width:"100%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:(!email||!wachtwoord)?0.5:1 }}>
          {loading ? "Bezig..." : isRegistreren ? "Account aanmaken" : "Inloggen"}
        </button>
        <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#888" }}>
          {isRegistreren ? "Al een account? " : "Nog geen account? "}
          <span onClick={()=>{setIsRegistreren(!isRegistreren);setBericht("");}} style={{ color:"#6366F1", fontWeight:600, cursor:"pointer" }}>
            {isRegistreren ? "Inloggen" : "Registreren"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Hoofd App ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, fontFamily:"sans-serif" }}>
      ⚡ Laden...
    </div>
  );

  if (!user) return <Auth onLogin={setUser} />;
  return <WerkMateApp user={user} onLogout={() => supabase.auth.signOut()} />;
}

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"dashboard",       icon:"⊞",  label:"Dashboard" },
  { id:"offertes",        icon:"📋", label:"Offertes" },
  { id:"prijslijst",      icon:"🏷️", label:"Prijslijst" },
  { id:"planning",        icon:"📅", label:"Planning" },
  { id:"crm",             icon:"👥", label:"Klanten" },
  { id:"facturen",        icon:"💶", label:"Financiën" },
  { id:"mail",            icon:"✉️", label:"Mail" },
  { id:"social",          icon:"📱", label:"Social Media" },
  { id:"website",         icon:"🌐", label:"Website & SEO" },
  { id:"werkregistratie", icon:"🔧", label:"Werkbonnen" },
  { id:"team",            icon:"⚙️", label:"Team" },
];

const DEFAULT_PRIJSLIJST = [
  { id:1, dienst:"Arbeid (uurloon)",          eenheid:"uur", prijs:85,  categorie:"Arbeid"      },
  { id:2, dienst:"Spoedtoeslag",              eenheid:"uur", prijs:115, categorie:"Arbeid"      },
  { id:3, dienst:"CV ketel onderhoud",        eenheid:"st",  prijs:149, categorie:"Onderhoud"   },
  { id:4, dienst:"Airco installatie (split)", eenheid:"st",  prijs:650, categorie:"Installatie" },
  { id:5, dienst:"Voorrijkosten",             eenheid:"rit", prijs:35,  categorie:"Overig"      },
  { id:6, dienst:"Materiaal (inkoop +20%)",   eenheid:"st",  prijs:0,   categorie:"Materiaal"   },
];

const SC = {
  "In afwachting":{ bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Ondertekend":  { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Verstuurd":    { bg:"#DBEAFE", text:"#1E40AF", dot:"#3B82F6" },
  "Afgewezen":    { bg:"#FEE2E2", text:"#991B1B", dot:"#EF4444" },
  "Actief":       { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Lead":         { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Betaald":      { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Openstaand":   { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Herinnering":  { bg:"#FEE2E2", text:"#991B1B", dot:"#EF4444" },
  "Onderweg":     { bg:"#EDE9FE", text:"#5B21B6", dot:"#8B5CF6" },
  "Ingepland":    { bg:"#F1F5F9", text:"#475569", dot:"#94A3B8" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0F0F14}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
.shell{display:flex;height:100vh;background:#F4F4F6;font-family:'DM Sans',sans-serif;overflow:hidden}
.sidebar{width:220px;min-width:220px;background:#0F0F14;display:flex;flex-direction:column;overflow:hidden}
.sb-logo{padding:22px 20px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-mark{display:flex;align-items:center;gap:9px;margin-bottom:2px}
.sb-icon{width:30px;height:30px;background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px}
.sb-name{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#fff}
.sb-sub{font-size:9.5px;color:rgba(255,255,255,.28);letter-spacing:.5px;text-transform:uppercase;margin-left:39px}
.nav-wrap{flex:1;padding:12px 10px;overflow-y:auto}
.nb{width:100%;display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;margin-bottom:1px;text-align:left;transition:all .14s;background:transparent;color:rgba(255,255,255,.4);position:relative}
.nb:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.78)}
.nb.on{background:rgba(99,102,241,.18);color:#A5B4FC;font-weight:600}
.nb.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;background:#6366F1;border-radius:0 2px 2px 0}
.nb-ic{font-size:14px;width:18px;text-align:center}
.sb-user{margin:10px;padding:11px 13px;background:rgba(255,255,255,.05);border-radius:10px;border:1px solid rgba(255,255,255,.06)}
.su-role{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.26);margin-bottom:3px}
.su-name{font-size:13px;font-weight:700;color:#fff}
.su-plan{font-size:10.5px;color:rgba(255,255,255,.3);margin-top:1px}
.logout-btn{width:100%;margin-top:8px;background:rgba(255,255,255,.08);border:none;border-radius:7px;padding:7px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .14s}
.logout-btn:hover{background:rgba(255,255,255,.14);color:#fff}
.main{flex:1;overflow-y:auto;padding:28px 32px;background:#F4F4F6}
.pg-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#0F0F14;letter-spacing:-.4px;margin-bottom:2px}
.pg-sub{font-size:12.5px;color:#94A3B8}
.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.sec-ttl{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#0F0F14;margin-bottom:10px}
.btn{border:none;border-radius:9px;padding:9px 16px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .14s;white-space:nowrap}
.btn-dark{background:#0F0F14;color:#fff}
.btn-dark:hover{background:#1e1e2e;transform:translateY(-1px)}
.btn-ai{background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,.28)}
.btn-ai:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,.4)}
.btn-ghost{background:#F3F4F6;color:#555}
.btn-ghost:hover{background:#E5E7EB}
.btn-outline{background:transparent;border:1.5px solid #E5E7EB;color:#555}
.btn-outline:hover{border-color:#6366F1;color:#6366F1}
.btn-danger{background:#FEE2E2;color:#991B1B}
.btn-danger:hover{background:#FECACA}
.btn-sm{padding:5px 11px;font-size:12px;border-radius:7px}
.btn-full{width:100%;justify-content:center}
.card{background:#fff;border-radius:13px;border:1px solid #EAECF0;overflow:hidden}
.cp{padding:20px 22px}
.sg{display:grid;gap:12px;margin-bottom:20px}
.sc{background:#fff;border-radius:13px;padding:16px 18px;border:1px solid #EAECF0;transition:transform .14s}
.sc:hover{transform:translateY(-1px)}
.sl{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#94A3B8;margin-bottom:6px}
.sv{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F0F14}
.ss{font-size:11px;color:#94A3B8;margin-top:2px}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
thead tr{background:#FAFAFA;border-bottom:1px solid #F0F0F0}
th{padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#94A3B8}
tbody tr{border-top:1px solid #F5F5F5;transition:background .1s}
tbody tr:hover{background:#FAFBFC}
td{padding:12px 14px;font-size:13px;color:#374151}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.bdot{width:5px;height:5px;border-radius:50%}
.inp{width:100%;border:1.5px solid #E5E7EB;border-radius:9px;padding:9px 13px;font-family:'DM Sans',sans-serif;font-size:13px;color:#111;outline:none;transition:border-color .14s;background:#fff}
.inp:focus{border-color:#6366F1}
textarea.inp{min-height:100px;resize:vertical;line-height:1.55}
.ilbl{font-size:11.5px;font-weight:600;color:#555;display:block;margin-bottom:5px}
.ig{margin-bottom:14px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}
.modal{background:#fff;border-radius:18px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 56px rgba(0,0,0,.18)}
.modal-lg{max-width:720px}
.mh{padding:20px 24px;border-bottom:1px solid #F0F0F0;display:flex;justify-content:space-between;align-items:flex-start}
.mt{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#111}
.ms{font-size:11.5px;color:#888;margin-top:2px}
.mc{background:#F3F4F6;border:none;border-radius:50%;width:28px;height:28px;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#555}
.mc:hover{background:#E5E7EB}
.mb{padding:22px 24px}
.pc{background:#fff;border-radius:13px;border:1px solid #EAECF0;padding:14px 17px;display:flex;align-items:center;gap:13px;transition:all .14s}
.pc:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.06)}
.tp{background:#0F0F14;color:#fff;border-radius:7px;padding:6px 10px;font-family:'Syne',sans-serif;font-size:12.5px;font-weight:700;white-space:nowrap;min-width:54px;text-align:center}
.av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#fff;flex-shrink:0}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.fc{background:#fff;border-radius:11px;padding:16px;border:1px solid #EAECF0;transition:all .14s}
.fc:hover{transform:translateY(-1px);border-color:#C7D2FE}
.dash-banner{background:linear-gradient(135deg,#0F0F14 0%,#1e1e3a 100%);border-radius:15px;padding:24px 28px;margin-bottom:20px;color:#fff;position:relative;overflow:hidden}
.dash-banner::after{content:'';position:absolute;right:-30px;top:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(99,102,241,.2) 0%,transparent 70%);pointer-events:none}
.db-hi{font-size:11.5px;color:rgba(255,255,255,.4);margin-bottom:4px}
.db-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px}
.db-sub{font-size:12.5px;color:rgba(255,255,255,.44)}
.off-hdr{background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:11px;padding:16px 18px;margin-bottom:15px;color:#fff}
.off-dienst{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:4px}
.off-omschr{font-size:12px;opacity:.85;line-height:1.5}
.off-tbl{border:1px solid #F0F0F0;border-radius:9px;overflow:hidden;margin-bottom:12px}
.tot-box{text-align:right;font-size:12.5px;color:#555;line-height:2;padding:11px 14px;background:#FAFAFA;border-radius:9px;margin-bottom:12px}
.note-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:11px 13px;font-size:12px;color:#78350F;margin-bottom:14px;line-height:1.5}
.pl-row{display:flex;align-items:center;gap:9px;padding:11px 0;border-bottom:1px solid #F5F5F5}
.pl-inp{border:1.5px solid #E5E7EB;border-radius:7px;padding:6px 10px;font-family:'DM Sans',sans-serif;font-size:13px;color:#111;outline:none;transition:border-color .14s;background:#fff}
.pl-inp:focus{border-color:#6366F1}
.pl-cat{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#94A3B8;padding:3px 7px;background:#F3F4F6;border-radius:5px;white-space:nowrap}
.mail-tabs{display:flex;gap:6px;margin-bottom:18px}
.mail-tab{padding:7px 15px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;color:#555;transition:all .14s}
.mail-tab.on{background:#0F0F14;color:#fff;border-color:#0F0F14}
.soc-plat{display:flex;gap:8px;margin-bottom:16px}
.soc-btn{flex:1;padding:9px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;transition:all .14s;color:#555;text-align:center}
.soc-btn.on.insta{border-color:#E1306C;background:#FFF0F5;color:#E1306C}
.soc-btn.on.tik{border-color:#010101;background:#F3F3F3;color:#010101}
.soc-btn.on.both{border-color:#6366F1;background:#EEF2FF;color:#6366F1}
.post-card{background:#fff;border-radius:13px;border:1px solid #EAECF0;overflow:hidden;margin-bottom:13px}
.post-bar{padding:9px 15px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:7px}
.post-bar.insta{background:#FFF0F5;color:#E1306C;border-bottom:1px solid #FCE7F0}
.post-bar.tik{background:#F3F3F3;color:#010101;border-bottom:1px solid #E5E5E5}
.post-body{padding:15px 17px;font-size:13.5px;line-height:1.7;color:#222;white-space:pre-wrap}
.post-actions{padding:11px 17px;border-top:1px solid #F5F5F5;display:flex;gap:8px}
.step-bar{display:flex;gap:0;margin-bottom:24px}
.step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.step:not(:last-child)::after{content:'';position:absolute;top:16px;left:50%;width:100%;height:2px;background:#E5E7EB;z-index:0}
.step.done:not(:last-child)::after{background:#6366F1}
.step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;z-index:1;font-family:'Syne',sans-serif;transition:all .2s}
.step.todo .step-dot{background:#F3F4F6;color:#94A3B8;border:2px solid #E5E7EB}
.step.active .step-dot{background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;box-shadow:0 4px 12px rgba(99,102,241,.3)}
.step.done .step-dot{background:#10B981;color:#fff}
.step-lbl{font-size:10px;font-weight:600;color:#94A3B8;margin-top:5px;text-align:center}
.step.active .step-lbl{color:#6366F1}
.step.done .step-lbl{color:#10B981}
.onboard-card{border:2px solid #E5E7EB;border-radius:13px;padding:18px;cursor:pointer;transition:all .14s;text-align:center}
.onboard-card:hover{border-color:#6366F1;background:#EEF2FF}
.onboard-card.sel{border-color:#6366F1;background:#EEF2FF}
.leeg{text-align:center;padding:48px 24px;color:#94A3B8}
.leeg-icon{font-size:36px;margin-bottom:12px}
.leeg-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#555;margin-bottom:6px}
.leeg-sub{font-size:12.5px}
@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
.dot{display:inline-block;animation:blink 1s infinite}
.tip-row{font-size:12px;color:#6366F1;cursor:pointer;padding:3px 0}
.tip-row:hover{text-decoration:underline}
`;

function Badge({ status }) {
  const c = SC[status] || { bg:"#F3F4F6", text:"#374151", dot:"#9CA3AF" };
  return <span className="badge" style={{background:c.bg,color:c.text}}><span className="bdot" style={{background:c.dot}}/>{status}</span>;
}

async function aiCall(prompt) {
  const r = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
    method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer " + import.meta.env.VITE_SUPABASE_KEY},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] })
  });
  const d = await r.json();
  return d.content.map(i=>i.text||"").join("");
}

// ── Leeg scherm component ─────────────────────────────────────
function LeegScherm({ icon, titel, sub, actie, onActie }) {
  return (
    <div className="card cp leeg">
      <div className="leeg-icon">{icon}</div>
      <div className="leeg-title">{titel}</div>
      <div className="leeg-sub">{sub}</div>
      {actie && <button className="btn btn-dark" style={{marginTop:16}} onClick={onActie}>{actie}</button>}
    </div>
  );
}

// ── Onboarding Wizard ─────────────────────────────────────────
function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ bedrijfsnaam:"", sector:"", stad:"", telefoon:"", email:"", diensten:"" });
  const sectoren = [
    {id:"hovenier",icon:"🌿",label:"Hovenier"},{id:"loodgieter",icon:"🔧",label:"Loodgieter"},
    {id:"elektricien",icon:"⚡",label:"Elektricien"},{id:"schilder",icon:"🖌️",label:"Schilder"},
    {id:"schoonmaak",icon:"🧹",label:"Schoonmaak"},{id:"airco",icon:"❄️",label:"Airco/Klimaat"},
    {id:"timmerman",icon:"🪚",label:"Timmerman"},{id:"overig",icon:"🔨",label:"Overig"},
  ];
  const steps = ["Sector","Bedrijf","Diensten","Klaar"];
  return (
    <div className="overlay"><div className="modal modal-lg">
      <div className="mh"><div><div className="mt">👋 Welkom bij WerkMate</div><div className="ms">Even snel je bedrijf instellen — duurt minder dan 2 minuten</div></div></div>
      <div className="mb">
        <div className="step-bar">{steps.map((s,i)=><div key={s} className={`step ${i<step?"done":i===step?"active":"todo"}`}><div className="step-dot">{i<step?"✓":i+1}</div><div className="step-lbl">{s}</div></div>)}</div>
        {step===0&&<><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:"#111",marginBottom:18}}>Wat voor bedrijf heb je?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
            {sectoren.map(s=><div key={s.id} className={`onboard-card ${data.sector===s.id?"sel":""}`} onClick={()=>setData({...data,sector:s.id})}><div style={{fontSize:26,marginBottom:6}}>{s.icon}</div><div style={{fontSize:13,fontWeight:600,color:"#111"}}>{s.label}</div></div>)}
          </div>
          <button className="btn btn-dark btn-full" style={{marginTop:20,opacity:data.sector?1:.5}} onClick={()=>setStep(1)} disabled={!data.sector}>Volgende →</button>
        </>}
        {step===1&&<><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:"#111",marginBottom:16}}>Je bedrijfsgegevens</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="ig"><label className="ilbl">Bedrijfsnaam</label><input className="inp" value={data.bedrijfsnaam} onChange={e=>setData({...data,bedrijfsnaam:e.target.value})} placeholder="Bijv: Jansen Installatie"/></div>
            <div className="ig"><label className="ilbl">Stad</label><input className="inp" value={data.stad} onChange={e=>setData({...data,stad:e.target.value})} placeholder="Bijv: Rotterdam"/></div>
            <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={data.telefoon} onChange={e=>setData({...data,telefoon:e.target.value})} placeholder="06-12345678"/></div>
            <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={data.email} onChange={e=>setData({...data,email:e.target.value})} placeholder="info@bedrijf.nl"/></div>
          </div>
          <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setStep(0)}>← Terug</button><button className="btn btn-dark btn-full" onClick={()=>setStep(2)} disabled={!data.bedrijfsnaam||!data.stad}>Volgende →</button></div>
        </>}
        {step===2&&<><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:"#111",marginBottom:16}}>Welke diensten bied je aan?</div>
          <div className="ig"><label className="ilbl">Diensten (komma gescheiden)</label><input className="inp" value={data.diensten} onChange={e=>setData({...data,diensten:e.target.value})} placeholder="Bijv: CV ketel onderhoud, Airco installatie"/></div>
          <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setStep(1)}>← Terug</button><button className="btn btn-dark btn-full" onClick={()=>setStep(3)}>Volgende →</button></div>
        </>}
        {step===3&&<div style={{textAlign:"center",padding:"20px 0 10px"}}>
          <div style={{fontSize:48,marginBottom:12}}>🎉</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#111",marginBottom:8}}>{data.bedrijfsnaam||"Jouw bedrijf"} staat klaar!</div>
          <div style={{fontSize:13.5,color:"#888",marginBottom:24}}>WerkMate is ingesteld voor jouw bedrijf.</div>
          <button className="btn btn-ai btn-full" onClick={()=>onDone(data)} style={{fontSize:14,padding:"12px"}}>🚀 Start met WerkMate</button>
        </div>}
      </div>
    </div></div>
  );
}

// ── AI Offerte ─────────────────────────────────────────────────
function AIOfferte({ onClose, prijslijst, userId, onSaved }) {
  const [step,setStep]=useState(0);const [vraag,setVraag]=useState("");const [loading,setLoading]=useState(false);const [off,setOff]=useState(null);
  const px=prijslijst.map(p=>`${p.dienst}: €${p.prijs} per ${p.eenheid}`).join(", ");
  const gen=async()=>{if(!vraag.trim())return;setLoading(true);setStep(1);
    try{const txt=await aiCall(`Offerte-assistent voor vakman NL. Prijslijst: ${px}. Genereer voor: "${vraag}". ALLEEN JSON: {"dienst":"..","omschrijving":"2 zinnen","regels":[{"omschrijving":"..","aantal":1,"eenheid":"uur","prijs":85}],"subtotaal":285,"btw":59.85,"totaal":344.85,"geldigheid":"30 dagen","opmerkingen":"garantie"}`);
    setOff(JSON.parse(txt.replace(/```json|```/g,"").trim()));setStep(2);}catch{setOff({dienst:"Fout",omschrijving:"Mislukt.",regels:[],subtotaal:0,btw:0,totaal:0});setStep(2);}setLoading(false);};

  const opslaan = async () => {
    if (!off || !userId) return;
    const vandaag = new Date().toLocaleDateString("nl-NL", {day:"numeric", month:"short"});
    await supabase.from("offertes").insert({
      user_id: userId,
      klant: vraag,
      dienst: off.dienst,
      bedrag: `€ ${off.totaal}`,
      status: "In afwachting",
      datum: vandaag,
    });
    onSaved && onSaved();
    onClose();
  };

  return(<div className="overlay"><div className="modal">
    <div className="mh"><div><div className="mt">✨ AI Offerte Generator</div><div className="ms">Gebruikt jouw prijslijst</div></div><button className="mc" onClick={onClose}>✕</button></div>
    <div className="mb">
      {step===0&&<><div className="ig"><label className="ilbl">Beschrijf de klantvraag</label><textarea className="inp" value={vraag} onChange={e=>setVraag(e.target.value)} placeholder="Bijv: CV ketel onderhoud Utrecht, klant Jan Vermeer"/></div><button className="btn btn-ai btn-full" onClick={gen} disabled={!vraag.trim()} style={{opacity:vraag.trim()?1:.5}}>✨ Genereer</button></>}
      {step===1&&<div style={{textAlign:"center",padding:"44px 0"}}><div style={{fontSize:40,marginBottom:12}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Bezig<span className="dot">…</span></div></div>}
      {step===2&&off&&<><div className="off-hdr"><div className="off-dienst">{off.dienst}</div><div className="off-omschr">{off.omschrijving}</div></div>
        <div className="off-tbl"><table><thead><tr><th>Omschrijving</th><th style={{textAlign:"right"}}>Aantal</th><th style={{textAlign:"right"}}>Prijs</th><th style={{textAlign:"right"}}>Totaal</th></tr></thead>
        <tbody>{off.regels?.map((r,i)=><tr key={i}><td>{r.omschrijving}</td><td style={{textAlign:"right",color:"#888"}}>{r.aantal} {r.eenheid}</td><td style={{textAlign:"right",color:"#888"}}>€ {r.prijs}</td><td style={{textAlign:"right",fontWeight:700}}>€ {(r.aantal*r.prijs).toFixed(2)}</td></tr>)}</tbody></table></div>
        <div className="tot-box"><div>Subtotaal: <strong>€ {off.subtotaal}</strong></div><div>BTW: <strong>€ {off.btw}</strong></div><div style={{fontSize:15,fontWeight:800,marginTop:3}}>Totaal: € {off.totaal}</div></div>
        {off.opmerkingen&&<div className="note-box">📝 {off.opmerkingen}</div>}
        <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setStep(0);setOff(null);setVraag("");}}>Opnieuw</button><button className="btn btn-ai" style={{flex:1,justifyContent:"center"}} onClick={opslaan}>💾 Opslaan & Verstuur</button></div>
      </>}
    </div>
  </div></div>);
}

// ── Dashboard ─────────────────────────────────────────────────
function DashboardTab({ openTab, bedrijf, offertes, planning, facturen }) {
  const hr=new Date().getHours();
  const gr=hr<12?"Goedemorgen":hr<18?"Goedemiddag":"Goedenavond";
  const openOffertes = offertes.filter(o=>o.status==="In afwachting").length;
  const planningVandaag = planning.length;
  const openFacturen = facturen.filter(f=>f.status==="Openstaand"||f.status==="Herinnering");
  const openBedrag = openFacturen.reduce((sum,f)=>{const n=parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."));return sum+(isNaN(n)?0:n);},0);

  return(<div>
    <div className="dash-banner">
      <div className="db-hi">{gr}</div>
      <div className="db-name">{bedrijf?.bedrijfsnaam||"daar"} 👋</div>
      <div className="db-sub">
        {planningVandaag>0?`Je hebt ${planningVandaag} opdracht${planningVandaag!==1?"en":""} ingepland`:"Nog geen opdrachten ingepland vandaag"}
        {openOffertes>0?` · ${openOffertes} offerte${openOffertes!==1?"s":""} wacht${openOffertes===1?"":"en"} op antwoord`:""}
      </div>
    </div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
      {[
        {label:"Offertes open",val:openOffertes.toString(),sub:"wachten op antwoord",color:"#6366F1"},
        {label:"Openstaand",val:openBedrag>0?`€ ${openBedrag.toLocaleString("nl-NL")}`:"€ 0",sub:`${openFacturen.length} factuur${openFacturen.length!==1?"en":""}`,color:"#F59E0B"},
        {label:"Opdrachten",val:planningVandaag.toString(),sub:"ingepland",color:"#0F0F14"},
        {label:"Klanten",val:"-",sub:"zie CRM",color:"#10B981"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.val}</div><div className="ss">{s.sub}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div>
        <div className="sec-ttl">Planning vandaag</div>
        {planning.length===0
          ? <div className="card cp leeg"><div className="leeg-icon">📅</div><div className="leeg-title">Geen opdrachten</div><div className="leeg-sub">Voeg opdrachten toe via Planning</div></div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>{planning.slice(0,3).map((item,i)=><div className="pc" key={i}><div className="tp">{item.tijd}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:13.5}}>{item.klant}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{item.dienst}</div></div><Badge status={item.status}/></div>)}</div>
        }
      </div>
      <div><div className="sec-ttl">Snelle acties</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {[{icon:"✨",label:"AI Offerte",tab:"offertes",bg:"#EEF2FF",border:"#C7D2FE",col:"#6366F1"},{icon:"✉️",label:"Mail",tab:"mail",bg:"#F0FDF4",border:"#BBF7D0",col:"#16A34A"},{icon:"📱",label:"Social post",tab:"social",bg:"#FFF7ED",border:"#FED7AA",col:"#EA580C"},{icon:"🌐",label:"Website & SEO",tab:"website",bg:"#F8F0FF",border:"#E9D5FF",col:"#7C3AED"}]
          .map(a=><button key={a.tab} onClick={()=>openTab(a.tab)} style={{background:a.bg,border:`1.5px solid ${a.border}`,borderRadius:11,padding:"14px",cursor:"pointer",textAlign:"center",fontFamily:"'DM Sans',sans-serif",transition:"all .14s"}} onMouseOver={e=>e.currentTarget.style.transform="translateY(-1px)"} onMouseOut={e=>e.currentTarget.style.transform="none"}>
            <div style={{fontSize:22,marginBottom:5}}>{a.icon}</div><div style={{fontSize:12.5,fontWeight:700,color:a.col}}>{a.label}</div>
          </button>)}
      </div></div>
    </div>
  </div>);
}

// ── Offertes ──────────────────────────────────────────────────
function OfferteTab({ prijslijst, userId, offertes, refresh }) {
  const [showAI,setShowAI]=useState(false);
  const totaal = offertes.reduce((s,o)=>{const n=parseFloat((o.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."));return s+(isNaN(n)?0:n);},0);

  return(<div>
    {showAI&&<AIOfferte onClose={()=>setShowAI(false)} prijslijst={prijslijst} userId={userId} onSaved={refresh}/>}
    <div className="ph"><div><div className="pg-title">Offertes</div><div className="pg-sub">{offertes.length} offertes</div></div><button className="btn btn-ai" onClick={()=>setShowAI(true)}>✨ AI Offerte</button></div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
      {[
        {label:"In afwachting",val:offertes.filter(o=>o.status==="In afwachting").length,color:"#F59E0B"},
        {label:"Ondertekend",val:offertes.filter(o=>o.status==="Ondertekend").length,color:"#10B981"},
        {label:"Verstuurd",val:offertes.filter(o=>o.status==="Verstuurd").length,color:"#3B82F6"},
        {label:"Totaal",val:`€ ${totaal.toLocaleString("nl-NL")}`,color:"#0F0F14"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color,fontSize:19}}>{s.val}</div></div>)}
    </div>
    {offertes.length===0
      ? <LeegScherm icon="📋" titel="Nog geen offertes" sub="Maak je eerste offerte met de AI generator" actie="✨ AI Offerte maken" onActie={()=>setShowAI(true)}/>
      : <div className="card"><div className="tw"><table><thead><tr>{["Klant","Dienst","Bedrag","Status","Datum",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{offertes.map(o=><tr key={o.id}><td style={{fontWeight:700,color:"#111"}}>{o.klant}</td><td>{o.dienst}</td><td style={{fontWeight:700,color:"#111"}}>{o.bedrag}</td><td><Badge status={o.status}/></td><td style={{color:"#888"}}>{o.datum}</td>
            <td><select value={o.status} onChange={async(e)=>{await supabase.from("offertes").update({status:e.target.value}).eq("id",o.id);refresh();}} style={{border:"1.5px solid #E5E7EB",borderRadius:7,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
              {["In afwachting","Verstuurd","Ondertekend","Afgewezen"].map(s=><option key={s}>{s}</option>)}
            </select></td>
          </tr>)}</tbody>
        </table></div></div>
    }
  </div>);
}

// ── Prijslijst ────────────────────────────────────────────────
function PrijslijstTab() {
  const [items,setItems]=useState(DEFAULT_PRIJSLIJST);const [saved,setSaved]=useState(false);const [showAdd,setShowAdd]=useState(false);const [nieuw,setNieuw]=useState({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});
  const upd=(id,f,v)=>setItems(p=>p.map(x=>x.id===id?{...x,[f]:v}:x));
  const del=(id)=>setItems(p=>p.filter(x=>x.id!==id));
  const save=()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const add=()=>{if(!nieuw.dienst||!nieuw.prijs)return;setItems(p=>[...p,{...nieuw,id:Date.now(),prijs:parseFloat(nieuw.prijs)}]);setNieuw({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});setShowAdd(false);};
  const cats=[...new Set(items.map(i=>i.categorie))];
  return(<div>
    <div className="ph"><div><div className="pg-title">Prijslijst</div><div className="pg-sub">Jouw tarieven — AI gebruikt deze bij offertes</div></div><div style={{display:"flex",gap:8}}><button className="btn btn-outline" onClick={()=>setShowAdd(true)}>+ Dienst</button><button className="btn btn-dark" onClick={save}>{saved?"✓ Opgeslagen!":"Opslaan"}</button></div></div>
    <div className="card cp">
      <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:9,padding:"10px 13px",marginBottom:18,fontSize:12.5,color:"#4338CA"}}>💡 De AI-offerte generator gebruikt jouw tarieven automatisch als basis.</div>
      {cats.map(cat=><div key={cat} style={{marginBottom:20}}>
        <div style={{fontSize:10.5,fontWeight:700,letterSpacing:".7px",textTransform:"uppercase",color:"#94A3B8",marginBottom:8}}>{cat}</div>
        {items.filter(i=>i.categorie===cat).map(item=><div key={item.id} className="pl-row">
          <input className="pl-inp" style={{flex:2}} value={item.dienst} onChange={e=>upd(item.id,"dienst",e.target.value)}/>
          <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:14,color:"#555",fontWeight:600}}>€</span><input className="pl-inp" style={{width:86,textAlign:"right"}} type="number" value={item.prijs} onChange={e=>upd(item.id,"prijs",parseFloat(e.target.value))}/></div>
          <span style={{fontSize:12,color:"#94A3B8"}}>per</span>
          <select className="pl-inp" style={{width:76}} value={item.eenheid} onChange={e=>upd(item.id,"eenheid",e.target.value)}>{["uur","st","m²","m","rit","dag"].map(u=><option key={u}>{u}</option>)}</select>
          <span className="pl-cat">{item.categorie}</span>
          <button className="btn btn-danger btn-sm" onClick={()=>del(item.id)}>✕</button>
        </div>)}
      </div>)}
    </div>
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Dienst toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Dienst omschrijving</label><input className="inp" value={nieuw.dienst} onChange={e=>setNieuw({...nieuw,dienst:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Prijs (€)</label><input className="inp" type="number" value={nieuw.prijs} onChange={e=>setNieuw({...nieuw,prijs:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Eenheid</label><select className="inp" value={nieuw.eenheid} onChange={e=>setNieuw({...nieuw,eenheid:e.target.value})}>{["uur","st","m²","m","rit","dag"].map(u=><option key={u}>{u}</option>)}</select></div>
        <div className="ig"><label className="ilbl">Categorie</label><select className="inp" value={nieuw.categorie} onChange={e=>setNieuw({...nieuw,categorie:e.target.value})}>{["Arbeid","Onderhoud","Installatie","Materiaal","Overig"].map(c=><option key={c}>{c}</option>)}</select></div>
      </div>
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add}>Toevoegen</button></div>
    </div></div></div>}
  </div>);
}

// ── Planning ──────────────────────────────────────────────────
function PlanningTab({ userId, planning, refresh }) {
  const [showAdd,setShowAdd]=useState(false);
  const [nieuw,setNieuw]=useState({tijd:"08:00",klant:"",adres:"",dienst:"",status:"Ingepland"});
  const vd=new Date().toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"});

  const add = async () => {
    if(!nieuw.klant||!nieuw.dienst) return;
    await supabase.from("planning").insert({...nieuw, user_id:userId});
    setNieuw({tijd:"08:00",klant:"",adres:"",dienst:"",status:"Ingepland"});
    setShowAdd(false);
    refresh();
  };

  const verwijder = async (id) => {
    await supabase.from("planning").delete().eq("id",id);
    refresh();
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Planning</div><div className="pg-sub" style={{textTransform:"capitalize"}}>{vd}</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Opdracht</button></div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>
      {[{label:"Opdrachten",val:planning.length.toString()},{label:"Onderweg",val:planning.filter(p=>p.status==="Onderweg").length.toString()},{label:"Ingepland",val:planning.filter(p=>p.status==="Ingepland").length.toString()}]
        .map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv">{s.val}</div></div>)}
    </div>
    {planning.length===0
      ? <LeegScherm icon="📅" titel="Geen opdrachten" sub="Voeg je eerste opdracht toe" actie="+ Opdracht toevoegen" onActie={()=>setShowAdd(true)}/>
      : <div style={{display:"flex",flexDirection:"column",gap:10}}>{planning.map((item)=><div className="pc" key={item.id}><div className="tp">{item.tijd}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:15}}>{item.klant}</div><div style={{fontSize:13,color:"#555",marginTop:2}}>{item.dienst}</div>{item.adres&&<div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>📍 {item.adres}</div>}</div><Badge status={item.status}/><button className="btn btn-danger btn-sm" onClick={()=>verwijder(item.id)}>✕</button></div>)}</div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Opdracht toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Tijd</label><input className="inp" type="time" value={nieuw.tijd} onChange={e=>setNieuw({...nieuw,tijd:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Ingepland","Onderweg","Klaar"].map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="ig"><label className="ilbl">Klant</label><input className="inp" value={nieuw.klant} onChange={e=>setNieuw({...nieuw,klant:e.target.value})} placeholder="Naam klant"/></div>
      <div className="ig"><label className="ilbl">Dienst</label><input className="inp" value={nieuw.dienst} onChange={e=>setNieuw({...nieuw,dienst:e.target.value})} placeholder="Wat ga je doen?"/></div>
      <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={nieuw.adres} onChange={e=>setNieuw({...nieuw,adres:e.target.value})} placeholder="Straat, Stad"/></div>
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.klant||!nieuw.dienst}>Toevoegen</button></div>
    </div></div></div>}
  </div>);
}

// ── CRM ───────────────────────────────────────────────────────
function CRMTab({ userId, klanten, refresh }) {
  const [q,setQ]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [nieuw,setNieuw]=useState({naam:"",tel:"",email:"",status:"Actief"});
  const list=klanten.filter(k=>k.naam.toLowerCase().includes(q.toLowerCase()));

  const add = async () => {
    if(!nieuw.naam) return;
    await supabase.from("klanten").insert({...nieuw, user_id:userId});
    setNieuw({naam:"",tel:"",email:"",status:"Actief"});
    setShowAdd(false);
    refresh();
  };

  const verwijder = async (id) => {
    await supabase.from("klanten").delete().eq("id",id);
    refresh();
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Klantenbeheer</div><div className="pg-sub">{klanten.length} klanten</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Klant</button></div>
    <input className="inp" style={{marginBottom:14}} placeholder="🔍  Zoek klant…" value={q} onChange={e=>setQ(e.target.value)}/>
    {klanten.length===0
      ? <LeegScherm icon="👥" titel="Nog geen klanten" sub="Voeg je eerste klant toe" actie="+ Klant toevoegen" onActie={()=>setShowAdd(true)}/>
      : <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {list.map(k=><div className="pc" key={k.id}><div className="av">{k.naam[0]}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:15}}>{k.naam}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{k.tel}{k.tel&&k.email?" · ":""}{k.email}</div></div><Badge status={k.status}/><button className="btn btn-danger btn-sm" onClick={()=>verwijder(k.id)}>✕</button></div>)}
        </div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Klant toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Naam</label><input className="inp" value={nieuw.naam} onChange={e=>setNieuw({...nieuw,naam:e.target.value})} placeholder="Bedrijf of naam"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={nieuw.tel} onChange={e=>setNieuw({...nieuw,tel:e.target.value})} placeholder="06-12345678"/></div>
        <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={nieuw.email} onChange={e=>setNieuw({...nieuw,email:e.target.value})} placeholder="klant@email.nl"/></div>
      </div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Actief","Lead"].map(s=><option key={s}>{s}</option>)}</select></div>
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.naam}>Toevoegen</button></div>
    </div></div></div>}
  </div>);
}

// ── Financiën ─────────────────────────────────────────────────
function FinancienTab({ userId, facturen, refresh }) {
  const [showAdd,setShowAdd]=useState(false);
  const [nieuw,setNieuw]=useState({klant:"",bedrag:"",status:"Openstaand",datum:""});

  const betaald = facturen.filter(f=>f.status==="Betaald").reduce((s,f)=>{const n=parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."));return s+(isNaN(n)?0:n);},0);
  const openstaand = facturen.filter(f=>f.status==="Openstaand"||f.status==="Herinnering").reduce((s,f)=>{const n=parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."));return s+(isNaN(n)?0:n);},0);

  const add = async () => {
    if(!nieuw.klant||!nieuw.bedrag) return;
    const vandaag = new Date().toLocaleDateString("nl-NL",{day:"numeric",month:"short"});
    await supabase.from("facturen").insert({...nieuw, user_id:userId, datum:nieuw.datum||vandaag, bedrag:`€ ${nieuw.bedrag}`});
    setNieuw({klant:"",bedrag:"",status:"Openstaand",datum:""});
    setShowAdd(false);
    refresh();
  };

  const updateStatus = async (id, status) => {
    await supabase.from("facturen").update({status}).eq("id",id);
    refresh();
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Financiën</div><div className="pg-sub">Facturen & omzet</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Factuur</button></div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>
      {[
        {label:"Betaald",val:`€ ${betaald.toLocaleString("nl-NL")}`,sub:"ontvangen",color:"#10B981"},
        {label:"Openstaand",val:`€ ${openstaand.toLocaleString("nl-NL")}`,sub:`${facturen.filter(f=>f.status==="Openstaand"||f.status==="Herinnering").length} facturen`,color:"#F59E0B"},
        {label:"Totaal facturen",val:facturen.length.toString(),sub:"aangemaakt",color:"#6366F1"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.val}</div><div className="ss">{s.sub}</div></div>)}
    </div>
    {facturen.length===0
      ? <LeegScherm icon="💶" titel="Nog geen facturen" sub="Maak je eerste factuur aan" actie="+ Factuur toevoegen" onActie={()=>setShowAdd(true)}/>
      : <div className="card"><div className="tw"><table><thead><tr>{["Klant","Bedrag","Status","Datum",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{facturen.map(f=><tr key={f.id}><td style={{fontWeight:700,color:"#111"}}>{f.klant}</td><td style={{fontWeight:700,color:"#111"}}>{f.bedrag}</td><td><Badge status={f.status}/></td><td style={{color:"#888"}}>{f.datum}</td>
            <td><select value={f.status} onChange={e=>updateStatus(f.id,e.target.value)} style={{border:"1.5px solid #E5E7EB",borderRadius:7,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
              {["Openstaand","Verstuurd","Herinnering","Betaald"].map(s=><option key={s}>{s}</option>)}
            </select></td>
          </tr>)}</tbody>
        </table></div></div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Factuur toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Klant</label><input className="inp" value={nieuw.klant} onChange={e=>setNieuw({...nieuw,klant:e.target.value})} placeholder="Naam klant"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Bedrag (€)</label><input className="inp" type="number" value={nieuw.bedrag} onChange={e=>setNieuw({...nieuw,bedrag:e.target.value})} placeholder="0.00"/></div>
        <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Openstaand","Verstuurd","Betaald"].map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.klant||!nieuw.bedrag}>Toevoegen</button></div>
    </div></div></div>}
  </div>);
}

// ── Mail ──────────────────────────────────────────────────────
function MailTab() {
  const [mode,setMode]=useState("zelf");const [aan,setAan]=useState("");const [onderwerp,setOnderwerp]=useState("");const [body,setBody]=useState("");const [aiP,setAiP]=useState("");const [aiL,setAiL]=useState(false);const [sent,setSent]=useState(false);
  const gen=async()=>{if(!aiP.trim())return;setAiL(true);try{const t=await aiCall(`Professionele NL zakelijke e-mail voor vakman. Situatie: ${aiP}. ALLEEN mailtekst, begin met aanhef.`);setBody(t);}catch{setBody("Fout.");}setAiL(false);};
  const send=()=>{setSent(true);setTimeout(()=>setSent(false),2500);setAan("");setOnderwerp("");setBody("");setAiP("");};
  return(<div><div className="ph"><div><div className="pg-title">Mail</div><div className="pg-sub">Schrijf zelf of laat AI schrijven</div></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div><div className="sec-ttl">✉️ Nieuwe mail</div><div className="card cp">
        <div className="mail-tabs"><button className={`mail-tab ${mode==="zelf"?"on":""}`} onClick={()=>setMode("zelf")}>✍️ Zelf</button><button className={`mail-tab ${mode==="ai"?"on":""}`} onClick={()=>setMode("ai")}>✨ AI schrijft</button></div>
        {mode==="ai"&&<div className="ig"><label className="ilbl">Wat moet de mail zeggen?</label><textarea className="inp" value={aiP} onChange={e=>setAiP(e.target.value)} style={{minHeight:75}} placeholder="Bijv: Herinnering factuur voor Jan Vermeer"/><button className="btn btn-ai btn-full" style={{marginTop:9,opacity:aiP.trim()?1:.5}} onClick={gen} disabled={!aiP.trim()||aiL}>{aiL?<>✨<span className="dot">…</span></>:"✨ Genereer"}</button></div>}
        <div className="ig"><label className="ilbl">Aan</label><input className="inp" value={aan} onChange={e=>setAan(e.target.value)} placeholder="klant@bedrijf.nl"/></div>
        <div className="ig"><label className="ilbl">Onderwerp</label><input className="inp" value={onderwerp} onChange={e=>setOnderwerp(e.target.value)} placeholder="Onderwerp…"/></div>
        <div className="ig"><label className="ilbl">Bericht</label><textarea className="inp" value={body} onChange={e=>setBody(e.target.value)} style={{minHeight:130}} placeholder="Schrijf je bericht…"/></div>
        <button className="btn btn-dark btn-full" onClick={send} disabled={!aan||!body}>{sent?"✓ Verstuurd!":"📨 Verstuur"}</button>
      </div></div>
      <div><div className="sec-ttl">📥 Inbox</div>
        <LeegScherm icon="📬" titel="Inbox nog leeg" sub="Koppel je e-mail via instellingen"/>
      </div>
    </div>
  </div>);
}

// ── Social ────────────────────────────────────────────────────
function SocialTab() {
  const [plat,setPlat]=useState("beide");const [ond,setOnd]=useState("");const [stijl,setStijl]=useState("professioneel");const [loading,setLoading]=useState(false);const [posts,setPosts]=useState(null);
  const gen=async()=>{if(!ond.trim())return;setLoading(true);setPosts(null);
    try{const p=plat==="beide"?"Instagram EN TikTok":plat==="insta"?"Instagram":"TikTok";const iK=plat!=="tiktok"?`"instagram":"NL post met hashtags"`:"";const tK=plat!=="insta"?`"tiktok":"NL TikTok caption (max 300t)"`:""  ;const sep=plat==="beide"?",":"";
    const t=await aiCall(`Social media voor vakman. Stijl:${stijl}. Platform:${p}. Onderwerp:${ond}. ALLEEN JSON: {${iK}${sep}${tK}}`);
    setPosts(JSON.parse(t.replace(/```json|```/g,"").trim()));}catch{setPosts({instagram:"Fout.",tiktok:"Fout."});}setLoading(false);};
  const copy=(t)=>{try{navigator.clipboard.writeText(t);}catch{}};
  return(<div><div className="ph"><div><div className="pg-title">Social Media</div><div className="pg-sub">AI schrijft posts voor Instagram & TikTok</div></div></div>
    <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
      <div><div className="sec-ttl">⚙️ Instellingen</div><div className="card cp">
        <div className="ig"><label className="ilbl">Platform</label><div className="soc-plat">
          <button className={`soc-btn ${plat==="insta"?"on insta":""}`} onClick={()=>setPlat("insta")}>📸 Insta</button>
          <button className={`soc-btn ${plat==="tiktok"?"on tik":""}`} onClick={()=>setPlat("tiktok")}>🎵 TikTok</button>
          <button className={`soc-btn ${plat==="beide"?"on both":""}`} onClick={()=>setPlat("beide")}>✨ Beide</button>
        </div></div>
        <div className="ig"><label className="ilbl">Stijl</label><select className="inp" value={stijl} onChange={e=>setStijl(e.target.value)}>{["professioneel","stoer","informeel","grappig","motiverend"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></div>
        <div className="ig"><label className="ilbl">Onderwerp</label><textarea className="inp" value={ond} onChange={e=>setOnd(e.target.value)} style={{minHeight:85}} placeholder="Bijv: Airco bij bakkerij Rotterdam geïnstalleerd"/></div>
        <div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:8,padding:"10px 13px",marginBottom:14}}>
          {["Afgerond project (voor & na)","Team aan het werk","Handige tip","5-sterren review","Dag uit het leven"].map((t,i)=><div key={i} className="tip-row" onClick={()=>setOnd(t)} style={{borderBottom:i<4?"1px solid #F0F0F0":"none"}}>→ {t}</div>)}
        </div>
        <button className="btn btn-ai btn-full" onClick={gen} disabled={!ond.trim()||loading} style={{opacity:ond.trim()?1:.5}}>{loading?<>✨<span className="dot">…</span></>:"✨ Genereer posts"}</button>
      </div></div>
      <div><div className="sec-ttl">📲 Posts</div>
        {!posts&&!loading&&<div style={{background:"#fff",border:"1px dashed #D1D5DB",borderRadius:13,padding:"48px 24px",textAlign:"center",color:"#94A3B8"}}><div style={{fontSize:32,marginBottom:10}}>📱</div><div style={{fontSize:14,fontWeight:600,color:"#555",marginBottom:5}}>Nog geen posts</div><div style={{fontSize:12.5}}>Vul links in en klik genereer</div></div>}
        {loading&&<div style={{background:"#fff",border:"1px solid #EAECF0",borderRadius:13,padding:"48px 24px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>Bezig<span className="dot">…</span></div></div>}
        {posts&&<>
          {posts.instagram&&(plat==="insta"||plat==="beide")&&<div className="post-card"><div className="post-bar insta">📸 Instagram</div><div className="post-body">{posts.instagram}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.instagram)}>📋 Kopiëren</button><button className="btn btn-outline btn-sm" onClick={gen}>🔄</button></div></div>}
          {posts.tiktok&&(plat==="tiktok"||plat==="beide")&&<div className="post-card"><div className="post-bar tik">🎵 TikTok</div><div className="post-body">{posts.tiktok}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.tiktok)}>📋 Kopiëren</button><button className="btn btn-outline btn-sm" onClick={gen}>🔄</button></div></div>}
        </>}
      </div>
    </div>
  </div>);
}

function Placeholder({label,items}){return(<div><div className="ph"><div><div className="pg-title">{label}</div><div className="pg-sub">Functionaliteiten in dit onderdeel</div></div></div><div className="fg">{items.map((item,i)=><div className="fc" key={i}><div style={{fontSize:20,marginBottom:8}}>{item.icon}</div><div style={{fontWeight:700,color:"#111",fontSize:13}}>{item.label}</div><div style={{fontSize:11.5,color:"#94A3B8",lineHeight:1.4,marginTop:3}}>{item.desc}</div></div>)}</div></div>);}
const PH={website:{label:"Website & SEO",items:[{icon:"🏗️",label:"Website bouwen",desc:"Eigen professionele bedrijfswebsite"},{icon:"📬",label:"Contactformulier",desc:"Aanvragen direct in de app"},{icon:"⭐",label:"Reviews",desc:"Google & eigen platform"},{icon:"🔍",label:"SEO",desc:"Beter vindbaar in Google"}]},werkregistratie:{label:"Werkbonnen",items:[{icon:"📸",label:"Foto's uploaden",desc:"Voor & na per opdracht"},{icon:"⏱️",label:"Uren bijhouden",desc:"Per klant of project"},{icon:"🔩",label:"Materialen",desc:"Verbruik per werkbon"},{icon:"✍️",label:"Werkbonnen",desc:"Digitaal invullen & ondertekenen"}]},team:{label:"Team & Instellingen",items:[{icon:"👤",label:"Medewerkers",desc:"Monteurs en admins"},{icon:"🔐",label:"Rollen",desc:"Baas, monteur of admin"},{icon:"💳",label:"Abonnement",desc:"Plan upgraden"},{icon:"🔗",label:"Koppelingen",desc:"Exact, Moneybird, Snelstart"}]}};

// ── WerkMate App ──────────────────────────────────────────────
function WerkMateApp({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [bedrijf, setBedrijf] = useState(null);
  const [prijslijst] = useState(DEFAULT_PRIJSLIJST);
  const [showOnboard, setShowOnboard] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Data state
  const [offertes, setOffertes] = useState([]);
  const [klanten, setKlanten] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [facturen, setFacturen] = useState([]);

  // Laad bedrijfsprofiel
  useEffect(() => {
    const laadData = async () => {
      const { data: profiel } = await supabase.from("bedrijfsprofiel").select("*").eq("user_id", user.id).single();
      if (profiel) {
        setBedrijf(profiel);
        setShowOnboard(false);
      } else {
        setShowOnboard(true);
      }
      await refreshAlles();
      setLoadingData(false);
    };
    laadData();
  }, [user.id]);

  const refreshAlles = async () => {
    const [o, k, p, f] = await Promise.all([
      supabase.from("offertes").select("*").eq("user_id", user.id).order("created_at", {ascending:false}),
      supabase.from("klanten").select("*").eq("user_id", user.id).order("created_at", {ascending:false}),
      supabase.from("planning").select("*").eq("user_id", user.id).order("tijd", {ascending:true}),
      supabase.from("facturen").select("*").eq("user_id", user.id).order("created_at", {ascending:false}),
    ]);
    setOffertes(o.data || []);
    setKlanten(k.data || []);
    setPlanning(p.data || []);
    setFacturen(f.data || []);
  };

  const onDone = async (data) => {
    await supabase.from("bedrijfsprofiel").insert({ ...data, user_id: user.id });
    setBedrijf(data);
    setShowOnboard(false);
  };

  if (loadingData) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, fontFamily:"sans-serif" }}>
      ⚡ Laden...
    </div>
  );

  const render = () => {
    switch(tab) {
      case "dashboard":  return <DashboardTab openTab={setTab} bedrijf={bedrijf} offertes={offertes} planning={planning} facturen={facturen}/>;
      case "offertes":   return <OfferteTab prijslijst={prijslijst} userId={user.id} offertes={offertes} refresh={refreshAlles}/>;
      case "prijslijst": return <PrijslijstTab/>;
      case "planning":   return <PlanningTab userId={user.id} planning={planning} refresh={refreshAlles}/>;
      case "crm":        return <CRMTab userId={user.id} klanten={klanten} refresh={refreshAlles}/>;
      case "facturen":   return <FinancienTab userId={user.id} facturen={facturen} refresh={refreshAlles}/>;
      case "mail":       return <MailTab/>;
      case "social":     return <SocialTab/>;
      default: return PH[tab]?<Placeholder {...PH[tab]}/>:null;
    }
  };

  return (
    <>
      <style>{css}</style>
      {showOnboard && <OnboardingWizard onDone={onDone}/>}
      <div className="shell">
        <div className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark"><div className="sb-icon">⚡</div><div className="sb-name">WerkMate</div></div>
            <div className="sb-sub">Bedrijfsbeheer platform</div>
          </div>
          <div className="nav-wrap">
            {NAV_ITEMS.map(item=>(
              <button key={item.id} className={`nb ${tab===item.id?"on":""}`} onClick={()=>setTab(item.id)}>
                <span className="nb-ic">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
          <div className="sb-user">
            <div className="su-role">Ingelogd als</div>
            <div className="su-name">{bedrijf?.bedrijfsnaam||user?.email||"Gebruiker"}</div>
            <div className="su-plan">Pro plan</div>
            <button className="logout-btn" onClick={onLogout}>Uitloggen</button>
          </div>
        </div>
        <div className="main">{!showOnboard&&render()}</div>
      </div>
    </>
  );
}
