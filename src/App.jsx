import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const STRIPE_URL = "https://buy.stripe.com/9B6cN56LE9590dG1YL2kw00";
const SUBSCRIPTION_WHITELIST = ["mauritsverweij2010@gmail.com"];
const inviteStorageKey = "wm_invite_token";
const inviteEmailStorageKey = "wm_invite_email";

function storageGet(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function storageSet(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }
function storageRemove(key) { try { localStorage.removeItem(key); } catch(e) {} }
function localToday() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

async function acceptInviteToken(token, userId) {
  if (!token || !userId) return;
  await supabase.from("team")
    .update({ accepted_user_id: userId, accepted_at: new Date().toISOString() })
    .eq("invite_token", token);
  storageRemove(inviteStorageKey);
  storageRemove(inviteEmailStorageKey);
}

async function logEmail(userId, to, subject, type, body, status) {
  try {
    await supabase.from("emails_log").insert({ user_id: userId, to_email: to, subject, type, body: body || "", status, sent_at: new Date().toISOString() });
  } catch(e) { console.warn("logEmail failed:", e); }
}

// ── Login scherm ──────────────────────────────────────────────
function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [isRegistreren, setIsRegistreren] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [bericht, setBericht] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite_token");
    const emailParam = params.get("email");
    if (token) {
      setInviteToken(token);
      setIsRegistreren(true);
      if (emailParam) {
        setEmail(emailParam);
        setInviteEmail(emailParam);
      }
      storageSet(inviteStorageKey, token);
      if (emailParam) storageSet(inviteEmailStorageKey, emailParam);
    }
  }, []);

  const handleInviteAcceptance = async (userObject) => {
    const token = inviteToken || storageGet(inviteStorageKey);
    if (!token || !userObject) return;
    await acceptInviteToken(token, userObject.id);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setBericht("");
    if (isRegistreren) {
      const { data, error } = await supabase.auth.signUp({ email, password: wachtwoord });
      if (error) {
        setBericht(error.message);
      } else {
        if (data?.user) await handleInviteAcceptance(data.user);
        if (data?.session) {
          onLogin(data.user);
        } else {
          setBericht("✅ Account aangemaakt! Controleer je e-mail om je account te bevestigen.");
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) {
        setBericht("❌ Email of wachtwoord klopt niet");
      } else {
        if (data?.user) await handleInviteAcceptance(data.user);
        onLogin(data.user);
      }
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
function AuthApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteReady, setInviteReady] = useState(true);

  // Capture invite token from URL as early as possible, before auth state resolves.
  // This handles the case where a logged-in user clicks an invite link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite_token");
    const emailParam = params.get("email");
    if (token) {
      storageSet(inviteStorageKey, token);
      if (emailParam) storageSet(inviteEmailStorageKey, emailParam);
    }
  }, []);

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

  useEffect(() => {
    if (!user) return;
    const token = storageGet(inviteStorageKey);
    if (!token) { setInviteReady(true); return; }
    setInviteReady(false);
    acceptInviteToken(token, user.id).then(() => setInviteReady(true));
  }, [user]);

  if (loading || !inviteReady) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, fontFamily:"sans-serif" }}>
      ⚡ Laden...
    </div>
  );

  if (!user) return <Auth onLogin={setUser} />;
  return <WerkMateApp user={user} onLogout={() => supabase.auth.signOut()} />;
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/portal/")) {
    const token = path.replace("/portal/", "").split(/[?#]/)[0];
    return <><style>{css}</style><PortalPage token={token}/></>;
  }
  if (path === "/admin") {
    return <><style>{css}</style><AdminPage/></>;
  }
  return <AuthApp/>;
}

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"dashboard",       icon:"⊞",  label:"Dashboard" },
  { id:"offertes",        icon:"📋", label:"Offertes" },
  { id:"prijslijst",      icon:"🏷️", label:"Prijslijst" },
  { id:"planning",        icon:"📅", label:"Planning" },
  { id:"crm",             icon:"👥", label:"Klanten" },
  { id:"profiel",         icon:"🏢", label:"Profiel" },
  { id:"facturen",        icon:"💶", label:"Financiën" },
  { id:"mail",            icon:"✉️", label:"Mail" },
  { id:"social",          icon:"📱", label:"Social Media" },
  
  { id:"werkregistratie", icon:"🔧", label:"Werkbonnen" },
  { id:"team",            icon:"👷", label:"Team" },
  { id:"ritten",          icon:"🚗", label:"Ritten" },
  { id:"instellingen",    icon:"⚙️", label:"Instellingen" },
];

const MOB_PRIMARY = ["dashboard","offertes","planning","crm","facturen"];
const MOB_NAV = [
  { id:"dashboard", icon:"⊞",  label:"Dashboard" },
  { id:"offertes",  icon:"📋", label:"Offertes"  },
  { id:"planning",  icon:"📅", label:"Planning"  },
  { id:"crm",       icon:"👥", label:"Klanten"   },
  { id:"facturen",  icon:"💶", label:"Financiën" },
  { id:"meer",      icon:"☰",  label:"Meer"      },
];
const MOB_MORE = NAV_ITEMS.filter(i => !MOB_PRIMARY.includes(i.id));

const DEFAULT_PRIJSLIJST = [
  { id:1, dienst:"Arbeid (uurloon)",          eenheid:"uur", prijs:85,  categorie:"Arbeid"      },
  { id:2, dienst:"Spoedtoeslag",              eenheid:"uur", prijs:115, categorie:"Arbeid"      },
  { id:3, dienst:"CV ketel onderhoud",        eenheid:"st",  prijs:149, categorie:"Onderhoud"   },
  { id:4, dienst:"Airco installatie (split)", eenheid:"st",  prijs:650, categorie:"Installatie" },
  { id:5, dienst:"Voorrijkosten",             eenheid:"rit", prijs:35,  categorie:"Overig"      },
  { id:6, dienst:"Materiaal (inkoop +20%)",   eenheid:"st",  prijs:0,   categorie:"Materiaal"   },
];

const SECTOR_PRIJSLIJST_TEMPLATES = {
  bouw: [
    { id:101, dienst:"Sloopwerk",                 eenheid:"m²", prijs:45,  categorie:"Bouw" },
    { id:102, dienst:"Fundering en betonwerk",    eenheid:"m²", prijs:85,  categorie:"Bouw" },
    { id:103, dienst:"Betonvloer storten",       eenheid:"m²", prijs:55,  categorie:"Bouw" },
    { id:104, dienst:"Wand- en plafondafwerking", eenheid:"m²", prijs:32,  categorie:"Bouw" },
    { id:105, dienst:"Kozijnen plaatsen",        eenheid:"st", prijs:220, categorie:"Bouw" },
    { id:106, dienst:"Verhoogde service uren",    eenheid:"uur", prijs:78,  categorie:"Bouw" },
  ],
  schoonmaak: [
    { id:201, dienst:"Kantoor schoonmaak",       eenheid:"uur", prijs:42,  categorie:"Schoonmaak" },
    { id:202, dienst:"Dieptereiniging vloer",     eenheid:"m²", prijs:3.2, categorie:"Schoonmaak" },
    { id:203, dienst:"Ramen wassen",             eenheid:"m²", prijs:4.5, categorie:"Schoonmaak" },
    { id:204, dienst:"Eindschoonmaak",           eenheid:"uur", prijs:48,  categorie:"Schoonmaak" },
    { id:205, dienst:"Oven- en keukenreiniging", eenheid:"st", prijs:65,  categorie:"Schoonmaak" },
  ],
  catering: [
    { id:301, dienst:"Bedrijfslunch per persoon", eenheid:"st", prijs:14, categorie:"Catering" },
    { id:302, dienst:"Buffet op locatie",         eenheid:"persoon", prijs:27, categorie:"Catering" },
    { id:303, dienst:"Koffie & thee service",     eenheid:"dag", prijs:95, categorie:"Catering" },
    { id:304, dienst:"Borrelplank verzorgen",     eenheid:"st", prijs:18, categorie:"Catering" },
    { id:305, dienst:"Chef op locatie",          eenheid:"uur", prijs:65, categorie:"Catering" },
  ],
  tuinieren: [
    { id:401, dienst:"Tuinonderhoud",            eenheid:"uur", prijs:55, categorie:"Tuinieren" },
    { id:402, dienst:"Grasmaaien",               eenheid:"m²", prijs:0.24, categorie:"Tuinieren" },
    { id:403, dienst:"Snoeiwerk",                eenheid:"uur", prijs:52, categorie:"Tuinieren" },
    { id:404, dienst:"Bestrating vernieuwen",    eenheid:"m²", prijs:35, categorie:"Tuinieren" },
    { id:405, dienst:"Beplanting leveren",       eenheid:"st", prijs:18, categorie:"Tuinieren" },
  ],
  beveiliging: [
    { id:501, dienst:"Alarm installatie",         eenheid:"st", prijs:495, categorie:"Beveiliging" },
    { id:502, dienst:"Camerabewaking",           eenheid:"st", prijs:225, categorie:"Beveiliging" },
    { id:503, dienst:"Sleutel- en toegangscontrole", eenheid:"st", prijs:32, categorie:"Beveiliging" },
    { id:504, dienst:"Beveiligingsscan",         eenheid:"uur", prijs:85, categorie:"Beveiliging" },
    { id:505, dienst:"Inspectie onderhoud",      eenheid:"uur", prijs:72, categorie:"Beveiliging" },
  ],
  transport: [
    { id:601, dienst:"Transport per km",         eenheid:"km", prijs:1.75, categorie:"Transport" },
    { id:602, dienst:"Los- en laadservice",       eenheid:"uur", prijs:58, categorie:"Transport" },
    { id:603, dienst:"Koerierdiensten",          eenheid:"st", prijs:45, categorie:"Transport" },
    { id:604, dienst:"Palletvervoer",            eenheid:"st", prijs:68, categorie:"Transport" },
    { id:605, dienst:"Uitzonderlijk transport",   eenheid:"uur", prijs:82, categorie:"Transport" },
  ],
  airco: [
    { id:701, dienst:"Airco onderhoud",           eenheid:"uur", prijs:72, categorie:"Airco" },
    { id:702, dienst:"Reiniging filters",         eenheid:"st", prijs:55, categorie:"Airco" },
    { id:703, dienst:"Installatie split unit",    eenheid:"st", prijs:725, categorie:"Airco" },
    { id:704, dienst:"Systeemcontrole",          eenheid:"uur", prijs:68, categorie:"Airco" },
    { id:705, dienst:"Monteur voor service",      eenheid:"uur", prijs:78, categorie:"Airco" },
  ],
  loodgieter: [
    { id:801, dienst:"Lekkage reparatie",         eenheid:"uur", prijs:65, categorie:"Loodgieter" },
    { id:802, dienst:"CV ketel installatie",      eenheid:"st", prijs:845, categorie:"Loodgieter" },
    { id:803, dienst:"Rioolontstopping",          eenheid:"uur", prijs:72, categorie:"Loodgieter" },
    { id:804, dienst:"Kraan vervangen",           eenheid:"st", prijs:95, categorie:"Loodgieter" },
    { id:805, dienst:"Watermeter inspectie",      eenheid:"st", prijs:38, categorie:"Loodgieter" },
  ],
  elektricien: [
    { id:901, dienst:"Verlichting installeren",   eenheid:"st", prijs:85, categorie:"Elektricien" },
    { id:902, dienst:"Groepenkast uitbreiding",   eenheid:"st", prijs:420, categorie:"Elektricien" },
    { id:903, dienst:"Stopcontact plaatsing",    eenheid:"st", prijs:62, categorie:"Elektricien" },
    { id:904, dienst:"Laadpaal aansluiting",      eenheid:"st", prijs:725, categorie:"Elektricien" },
    { id:905, dienst:"Storingsdienst",           eenheid:"uur", prijs:79, categorie:"Elektricien" },
  ],
  overig: [
    { id:1001, dienst:"Uurloon algemene dienst",  eenheid:"uur", prijs:65, categorie:"Overig" },
    { id:1002, dienst:"Materiaalafhandeling",     eenheid:"st", prijs:0,  categorie:"Overig" },
    { id:1003, dienst:"Voorrijkosten",           eenheid:"rit", prijs:35, categorie:"Overig" },
    { id:1004, dienst:"Consultatie",             eenheid:"uur", prijs:72, categorie:"Overig" },
    { id:1005, dienst:"Advies op locatie",        eenheid:"uur", prijs:85, categorie:"Overig" },
  ],
};

const getPrijslijstTemplate = (sector) => {
  return SECTOR_PRIJSLIJST_TEMPLATES[sector] || SECTOR_PRIJSLIJST_TEMPLATES.overig;
};

const SC = {
  "In afwachting":    { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Ondertekend":      { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Verstuurd":        { bg:"#DBEAFE", text:"#1E40AF", dot:"#3B82F6" },
  "Afgewezen":        { bg:"#FEE2E2", text:"#991B1B", dot:"#EF4444" },
  "Actief":           { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Lead":             { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Potentiële klant": { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Prospect":         { bg:"#DBEAFE", text:"#1E40AF", dot:"#3B82F6" },
  "Geïnteresseerd":   { bg:"#DBEAFE", text:"#1E40AF", dot:"#3B82F6" },
  "Betaald":          { bg:"#D1FAE5", text:"#065F46", dot:"#10B981" },
  "Openstaand":       { bg:"#FFF3CD", text:"#92620A", dot:"#F59E0B" },
  "Herinnering":      { bg:"#FEE2E2", text:"#991B1B", dot:"#EF4444" },
  "Onderweg":         { bg:"#EDE9FE", text:"#5B21B6", dot:"#8B5CF6" },
  "Ingepland":        { bg:"#F1F5F9", text:"#475569", dot:"#94A3B8" },
  "Concept":          { bg:"#F3F4F6", text:"#6B7280", dot:"#9CA3AF" },
  "Verlopen":         { bg:"#FEE2E2", text:"#991B1B", dot:"#EF4444" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden}
body{background:#0F0F14}
.mob-card-list{display:flex;flex-direction:column;gap:8px}
.mob-card{background:#fff;border-radius:16px;border:1px solid #EAECF0;padding:16px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .12s;position:relative}
.mob-card:active{background:#F8FAFF;transform:scale(0.99)}
.mob-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px}
.mob-card-name{font-size:16px;font-weight:700;color:#0F0F14;line-height:1.3}
.mob-card-amount{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0F0F14;margin:6px 0 2px}
.mob-card-sub{font-size:13px;color:#64748B;margin-top:3px;line-height:1.4}
.mob-card-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.mob-card-chevron{position:absolute;right:16px;top:50%;transform:translateY(-50%);color:#CBD5E1;font-size:16px;font-weight:700}
.mob-plan-date{font-size:11.5px;font-weight:700;color:#6366F1;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px}
.mob-screen{position:fixed;inset:0;background:#F8FAFC;z-index:150;display:flex;flex-direction:column;overflow:hidden;animation:slideIn .26s cubic-bezier(.25,.46,.45,.94)}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.mob-screen-hdr{background:#fff;border-bottom:1px solid #EAECF0;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.mob-back{background:none;border:none;color:#6366F1;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:3px;padding:6px 0;-webkit-tap-highlight-color:transparent;white-space:nowrap}
.mob-screen-ttl{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#0F0F14;flex:1}
.mob-screen-scroll{flex:1;overflow-y:auto;padding:16px;padding-bottom:calc(80px + env(safe-area-inset-bottom))}
.mob-det-section{background:#fff;border-radius:16px;border:1px solid #EAECF0;padding:18px;margin-bottom:10px}
.mob-det-amount{font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:#0F0F14;margin-bottom:4px}
.mob-det-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #F3F4F6}
.mob-det-row:last-child{border-bottom:none}
.mob-det-lbl{font-size:13px;color:#64748B}
.mob-det-val{font-size:13.5px;font-weight:600;color:#0F0F14;text-align:right;flex:1;margin-left:10px}
.mob-det-action-btn{display:flex;align-items:center;gap:14px;width:100%;padding:15px 16px;background:#fff;border-radius:14px;border:1px solid #EAECF0;margin-bottom:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;color:#0F0F14;-webkit-tap-highlight-color:transparent;min-height:52px;text-align:left;transition:background .1s}
.mob-det-action-btn:active{background:#F8FAFF}
.mob-det-action-btn.danger{color:#EF4444;border-color:#FECACA;background:#FEF2F2}
.mob-det-action-ic{font-size:20px;width:28px;text-align:center;flex-shrink:0}
.mob-day-wrap{background:#fff;border-radius:16px;border:1px solid #EAECF0;overflow:hidden}
.mob-day-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #F0F0F0}
.mob-day-nav-btn{background:#F3F4F6;border:none;border-radius:10px;width:38px;height:38px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#555;-webkit-tap-highlight-color:transparent;flex-shrink:0}
.mob-day-center{text-align:center;flex:1}
.mob-day-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#0F0F14}
.mob-day-sub{font-size:10px;font-weight:700;color:#6366F1;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.mob-day-hours{overflow-y:auto}
.mob-day-row{display:flex;border-bottom:1px solid #F5F7FA;min-height:58px}
.mob-day-row:last-child{border-bottom:none}
.mob-day-timecol{width:54px;flex-shrink:0;padding:10px 10px 0;font-size:11px;font-weight:700;color:#94A3B8;text-align:right;border-right:1px solid #F0F0F0}
.mob-day-slotcol{flex:1;padding:5px 10px;display:flex;flex-direction:column;gap:4px}
.mob-day-ev{border-radius:10px;padding:8px 11px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity .12s}
.mob-day-ev:active{opacity:.8}
.mob-day-ev-time{font-size:10px;font-weight:700;margin-bottom:2px}
.mob-day-ev-name{font-size:13px;font-weight:700;line-height:1.2;color:#0F0F14}
.mob-day-ev-dienst{font-size:11.5px;color:#64748B;margin-top:1px}
.mob-day-ev.klaar{opacity:.5}
.mob-day-empty{padding:28px 16px;text-align:center;color:#94A3B8;font-size:13.5px}
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
.off-tbl{border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:12px}
.off-tbl-grid{display:grid;grid-template-columns:3fr 68px 86px 92px 76px 36px;align-items:center;gap:0}
.off-tbl-hdr{background:#F8FAFC;border-bottom:1px solid #E5E7EB}
.off-tbl-hdr .off-cell{padding:9px 10px;color:#475569;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.off-tbl-row{border-bottom:1px solid #F0F0F0}
.off-tbl-row:last-child{border-bottom:none}
.off-tbl-row:hover{background:#FAFBFF}
.off-cell{padding:7px 8px;display:flex;align-items:center}
.off-cell.right{justify-content:flex-end}
.off-cell.center{justify-content:center}
.off-cell.del{justify-content:center}
.off-cell-totaal{font-size:13px;font-weight:700;color:#111;text-align:right;justify-content:flex-end}
.off-inp{height:36px;width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:7px;padding:0 9px;font-family:'DM Sans',sans-serif;font-size:13px;color:#111;outline:none;background:#fff;transition:border-color .14s}
.off-inp-ta{height:auto;min-height:36px;padding:8px 9px;resize:none;overflow:hidden;line-height:1.5;vertical-align:top}
.off-inp:focus{border-color:#6366F1}
.off-inp.right{text-align:right}
.off-inp.center{text-align:center}
.off-inp::-webkit-outer-spin-button,.off-inp::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.off-inp{-moz-appearance:textfield}
.tot-box{text-align:right;font-size:12.5px;color:#555;line-height:2;padding:11px 14px;background:#FAFAFA;border-radius:9px;margin-bottom:12px}
.note-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:11px 13px;font-size:12px;color:#78350F;margin-bottom:14px;line-height:1.5}
.pl-row{display:flex;align-items:center;gap:9px;padding:11px 0;border-bottom:1px solid #F5F5F5}
.pl-inp{border:1.5px solid #E5E7EB;border-radius:7px;padding:6px 10px;font-family:'DM Sans',sans-serif;font-size:13px;color:#111;outline:none;transition:border-color .14s;background:#fff}
.pl-inp:focus{border-color:#6366F1}
.pl-inp.no-spinner::-webkit-outer-spin-button,
.pl-inp.no-spinner::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
.pl-inp.no-spinner{ -moz-appearance:textfield; }
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
.cal-wrap{background:#fff;border-radius:13px;border:1px solid #EAECF0;overflow:hidden;margin-bottom:20px}
.cal-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #F0F0F0}
.cal-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#0F0F14}
.cal-nav-btn{background:#F3F4F6;border:none;border-radius:7px;width:30px;height:30px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#555;line-height:1;transition:all .14s}
.cal-nav-btn:hover{background:#E5E7EB}
.cal-view-toggle{display:flex;background:#F3F4F6;border-radius:9px;padding:3px;gap:2px}
.cal-vt-btn{background:transparent;border:none;border-radius:7px;padding:5px 14px;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;cursor:pointer;color:#666;transition:all .14s}
.cal-vt-btn.on{background:#fff;color:#0F0F14;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);background:#F8FAFC;border-bottom:1px solid #E5E7EB}
.cal-dow-cell{padding:8px 4px;text-align:center;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-day{min-height:82px;padding:6px 7px;border-right:1px solid #F0F0F0;border-bottom:1px solid #F0F0F0;cursor:pointer;transition:background .1s;box-sizing:border-box}
.cal-day:nth-child(7n){border-right:none}
.cal-day:hover{background:#F9FAFB}
.cal-day.empty{background:#FAFAFA;cursor:default;pointer-events:none}
.cal-day.today .cal-dn{background:#6366F1;color:#fff;border-radius:50%}
.cal-dn{width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#374151;margin-bottom:3px}
.cal-task{border-radius:4px;padding:2px 5px;font-size:10.5px;font-weight:600;margin-bottom:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:#EEF2FF;color:#4338CA}
.cal-task.onderweg{background:#FEF3C7;color:#92400E}
.cal-task.klaar{background:#F3F4F6;color:#9CA3AF;text-decoration:line-through}
.cal-more{font-size:9.5px;color:#94A3B8;padding-left:2px}
.cal-day.feestdag{background:#FFFBEB}
.cal-feestdag{font-size:9px;color:#92400E;font-weight:600;margin-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cal-week-hdr.feestdag{background:#FFFBEB}
.cal-week-feestdag{font-size:9px;color:#92400E;font-weight:600;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cal-week-hdr{text-align:center;padding:10px 6px 8px;border-bottom:1px solid #E5E7EB;cursor:pointer;transition:background .1s;box-sizing:border-box}
.cal-week-hdr:hover{background:#F9FAFB}
.cal-week-day{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.cal-week-dn{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#0F0F14}
.cal-week-hdr.today .cal-week-dn{color:#6366F1}
.cal-week-hdr.today .cal-week-day{color:#6366F1}
.cal-wg-outer{overflow:hidden}
.cal-wg-hdr-row{display:flex;border-bottom:1px solid #E5E7EB}
.cal-wg-hdr-spc{width:44px;flex-shrink:0;border-right:1px solid #F0F0F0;box-sizing:border-box}
.cal-wg-hdr-cell{flex:1;min-width:0;border-right:1px solid #F0F0F0;box-sizing:border-box}
.cal-wg-hdr-cell:last-child{border-right:none}
.cal-wg-body-row{display:flex;overflow-y:auto;max-height:560px}
.cal-wg-tc{width:44px;flex-shrink:0;border-right:1px solid #F0F0F0;box-sizing:border-box}
.cal-wg-tl{height:40px;display:flex;align-items:flex-start;justify-content:flex-end;padding-right:6px;padding-top:2px;box-sizing:border-box}
.cal-wg-dc{flex:1;min-width:0;border-right:1px solid #F0F0F0;box-sizing:border-box;position:relative}
.cal-wg-dc:last-child{border-right:none}
.cal-wg-slot{position:absolute;left:0;right:0;height:0;pointer-events:none}
.cal-task-blk{position:absolute;left:2px;right:2px;border-radius:6px;padding:4px 6px;overflow:hidden;background:#EEF2FF;color:#4338CA;cursor:pointer;box-sizing:border-box;font-size:10.5px;line-height:1.3;transition:opacity .1s}
.cal-task-blk:hover{opacity:.85}
.cal-task-blk.onderweg{background:#FEF3C7;color:#92400E}
.cal-task-blk.klaar{opacity:.45}
.cal-task-blk .cal-tbk-time{font-size:9.5px;font-weight:700;opacity:.8;white-space:nowrap}
.cal-task-blk .cal-tbk-name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-task-blk .cal-tbk-name.done{text-decoration:line-through}
.cal-task-blk .cal-tbk-dienst{font-size:10px;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-task-blk .cal-tbk-actions{display:flex;gap:3px;margin-top:4px}
.cal-task-wk{border-radius:7px;padding:6px 8px;background:#EEF2FF;color:#4338CA}
.cal-task-wk.onderweg{background:#FEF3C7;color:#92400E}
.cal-task-wk.klaar{opacity:.55}
.cal-task-wk.klaar .cal-task-name{text-decoration:line-through}
.cal-task-time{font-size:10px;font-weight:700;margin-bottom:2px;opacity:.8}
.cal-task-name{font-size:12px;font-weight:700}
.cal-task-dienst{font-size:10.5px;opacity:.75;margin-top:1px}
.cal-done-btn{background:none;border:1.5px solid currentColor;border-radius:50%;width:18px;height:18px;min-width:18px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;opacity:.45;transition:all .14s;flex-shrink:0}
.cal-done-btn:hover{opacity:1}
.cal-herhaal-tag{font-size:9px;opacity:.65;margin-top:1px}
.cal-filter-bar{display:flex;gap:6px;padding:9px 18px;border-bottom:1px solid #F0F0F0;flex-wrap:wrap;align-items:center}
.cal-filter-lbl{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
.cal-fp{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid #E5E7EB;background:#fff;font-size:11.5px;font-weight:600;cursor:pointer;color:#555;transition:all .14s;white-space:nowrap;font-family:'DM Sans',sans-serif}
.cal-fp:hover{border-color:#6366F1;color:#6366F1}
.cal-fp.on{background:#0F0F14;color:#fff;border-color:#0F0F14}
.cal-fp-av{width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7.5px;font-weight:700;color:#fff;flex-shrink:0}
.cal-task-av{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;font-size:7.5px;font-weight:700;color:#fff;flex-shrink:0}
.cat-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F5F5F5}
.cat-row:last-child{border-bottom:none}
.cat-swatch{width:26px;height:26px;border-radius:7px;flex-shrink:0;border:2px solid rgba(0,0,0,.08)}
.cat-inp-color{width:38px;height:38px;border:1.5px solid #E5E7EB;border-radius:9px;cursor:pointer;padding:2px;flex-shrink:0;background:#fff}
.mob-nav{display:none}
@media(max-width:768px){
  .sidebar{display:none}
  .mob-nav{display:flex;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #E5E7EB;z-index:200;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -1px 12px rgba(0,0,0,.06)}
  .mob-nb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 2px 8px;gap:3px;border:none;background:transparent;color:#9CA3AF;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .mob-nb.mob-nb-on{color:#6366F1}
  .mob-nb-ic{font-size:22px;line-height:1}
  .main{padding-bottom:calc(70px + env(safe-area-inset-bottom));padding-left:16px;padding-right:16px;padding-top:0}
  .ph{position:sticky;top:0;z-index:10;background:#F8FAFC;padding:16px 0 14px;margin-bottom:16px;border-bottom:1px solid #EAECF0}
  .ph .pg-title{font-size:20px}
  .mb [style*="1fr"]{grid-template-columns:1fr !important}
  .inp{font-size:16px;padding:12px 14px}
  .btn{min-height:44px}
  .btn-sm{min-height:40px}
  .mob-hide{display:none}
  .modal{border-radius:20px 20px 0 0;max-height:92dvh;position:fixed;bottom:0;left:0;right:0;max-width:100%;margin:0;overflow:hidden;display:flex;flex-direction:column}
  .modal .mh{flex-shrink:0}
  .modal .mb{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(22px + env(safe-area-inset-bottom))}
  .overlay{align-items:flex-end;padding:0}
  .sg{grid-template-columns:1fr 1fr !important}
  .sc{padding:14px;border-radius:12px}
  .sv{font-size:20px}
  .dash-banner{padding:18px 20px;margin-bottom:14px}
  .db-name{font-size:18px}
}
`;

function useMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
}

function SignatureCanvas({ onSave, label = "Teken hier uw handtekening" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  };
  const startDraw = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e); };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#0F0F14"; ctx.lineWidth = 2.5;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); };
  const save = () => {
    const c = canvasRef.current;
    if (!c.getContext("2d").getImageData(0,0,c.width,c.height).data.some(v=>v!==0)) return;
    onSave(c.toDataURL("image/png"));
  };

  return (
    <div>
      <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>{label}</div>
      <canvas ref={canvasRef} width={600} height={160}
        style={{border:"1.5px solid #E5E7EB",borderRadius:12,background:"#FAFAFA",width:"100%",touchAction:"none",cursor:"crosshair",display:"block"}}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button type="button" className="btn btn-ghost" onClick={clear}>Wissen</button>
        <button type="button" className="btn btn-dark btn-full" onClick={save}>✍️ Handtekening plaatsen</button>
      </div>
    </div>
  );
}

function MobDetailScreen({ title, onBack, children }) {
  return (
    <div className="mob-screen">
      <div className="mob-screen-hdr">
        <button className="mob-back" onClick={onBack}>‹ Terug</button>
        <div className="mob-screen-ttl">{title}</div>
      </div>
      <div className="mob-screen-scroll">{children}</div>
    </div>
  );
}

function Badge({ status }) {
  const c = SC[status] || { bg:"#F3F4F6", text:"#374151", dot:"#9CA3AF" };
  return <span className="badge" style={{background:c.bg,color:c.text}}><span className="bdot" style={{background:c.dot}}/>{status}</span>;
}

async function aiCall(prompt) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_KEY;
  const r = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
    body: JSON.stringify({ prompt })
  });
  const d = await r.json();
  return (d.content||[]).map(i=>i.text||"").join("");
}

const formatMoney = (value) => {
  const num = typeof value === "string"
    ? parseFloat(value.toString().replace(/[€\s]/g, "").replace(/,/g, "."))
    : Number(value);
  return isNaN(num) ? "0,00" : num.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseOfferRules = (offer) => {
  if (!offer) return [];
  if (Array.isArray(offer.regels)) return offer.regels;
  if (typeof offer.regels === "string") {
    try { return JSON.parse(offer.regels); } catch { }
  }
  if (offer.regels && typeof offer.regels === "object") return [offer.regels];
  const prijs = parseFloat((offer.bedrag||"0").toString().replace(/[€\s]/g, "").replace(/,/g, "."));
  return [{ omschrijving: offer.dienst || "Offerte", aantal: 1, eenheid: "", prijs: isNaN(prijs) ? 0 : prijs }];
};

const createOfferPdfDocument = (offer, bedrijf) => {
  const company = {
    bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate Bedrijf",
    telefoon: bedrijf?.telefoon || "",
    email: bedrijf?.email || "",
    adres: bedrijf?.adres || "",
  };
  const regels = parseOfferRules(offer);
  const subtotal = offer.subtotaal != null ? Number(offer.subtotaal) : regels.reduce((sum, r) => sum + ((Number(r.aantal) || 0) * (Number(r.prijs) || 0)), 0);
  const btw = offer.btw != null ? Number(offer.btw) : Math.round(subtotal * 0.21 * 100) / 100;
  const total = offer.totaal != null ? Number(offer.totaal) : subtotal + btw;
  const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(company.bedrijfsnaam, 20, 25);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Datum: ${today}`, 20, 34);
  doc.text(`Offerte voor: ${offer.klant || "klant"}`, 20, 42);
  doc.text(`Geachte ${offer.klant || "heer/mevrouw"},`, 20, 52);
  doc.text(`Hierbij ontvangt u onze offerte voor ${offer.dienst || "uw aanvraag"}.`, 20, 58);

  const startY = 70;
  const rowX = [20, 85, 115, 145, 175];
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Omschrijving", rowX[0], startY);
  doc.text("Aantal", rowX[1], startY);
  doc.text("Eenheid", rowX[2], startY);
  doc.text("Prijs", rowX[3], startY);
  doc.text("Totaal", rowX[4], startY);
  doc.setDrawColor(200);
  doc.line(20, startY + 2, 190, startY + 2);

  let y = startY + 10;
  doc.setFont("helvetica", "normal");
  const descriptionWidth = rowX[1] - rowX[0] - 2;
  const lineHeight = 5.5;
  regels.forEach((regel) => {
    const regelTotaal = (Number(regel.aantal) || 0) * (Number(regel.prijs) || 0);
    const omschrijving = String(regel.omschrijving || "");
    const beschrijvingLines = doc.splitTextToSize(omschrijving, descriptionWidth);
    const rowHeight = Math.max(beschrijvingLines.length * lineHeight, 8);

    if (y + rowHeight > 250) {
      doc.addPage();
      y = 20;
    }

    doc.text(beschrijvingLines, rowX[0], y);
    doc.text(String(regel.aantal || ""), rowX[1], y, { align: "right" });
    doc.text(String(regel.eenheid || ""), rowX[2], y, { align: "right" });
    doc.text(`€ ${formatMoney(regel.prijs)}`, rowX[3], y, { align: "right" });
    doc.text(`€ ${formatMoney(regelTotaal)}`, rowX[4], y, { align: "right" });
    y += rowHeight + 3;
  });

  const summaryY = y + 12;
  doc.setFont("helvetica", "bold");
  doc.text(`Subtotaal:`, 140, summaryY);
  doc.text(`€ ${formatMoney(subtotal)}`, 190, summaryY, { align: "right" });
  doc.text(`BTW (21%):`, 140, summaryY + 8);
  doc.text(`€ ${formatMoney(btw)}`, 190, summaryY + 8, { align: "right" });
  doc.setFontSize(13);
  doc.text(`Totaal:`, 140, summaryY + 18);
  doc.text(`€ ${formatMoney(total)}`, 190, summaryY + 18, { align: "right" });

  let notesHeight = 0;
  if (offer.opmerkingen) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Opmerkingen / garantie:", 20, summaryY + 30);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(String(offer.opmerkingen), 170);
    doc.text(noteLines, 20, summaryY + 37);
    notesHeight = noteLines.length * 5 + 18;
  }

  const footerY = summaryY + 34 + notesHeight;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Contact", 20, footerY);
  doc.text(`Telefoon: ${company.telefoon}`, 20, footerY + 6);
  doc.text(`Email: ${company.email}`, 20, footerY + 12);
  doc.text(`Adres: ${company.adres}`, 20, footerY + 18);

  return doc;
};

const createOfferPdfBase64 = (offer, bedrijf) => createOfferPdfDocument(offer, bedrijf).output("datauristring").split(",")[1];

const createFactuurPdf = (factuur, bedrijf) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const company = bedrijf || {};
  const margin = 20;
  const pageW = 210;

  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(company.bedrijfsnaam || "Bedrijf", margin, 24);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("FACTUUR", pageW - margin, 24, { align: "right" });

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  let y = 50;
  doc.setFont("helvetica", "bold"); doc.text("Factuurnummer:", margin, y);
  doc.setFont("helvetica", "normal"); doc.text(factuur.nummer || "-", 72, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Factuurdatum:", margin, y);
  doc.setFont("helvetica", "normal"); doc.text(factuur.datum || "-", 72, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.text("Vervaldatum:", margin, y);
  doc.setFont("helvetica", "normal"); doc.text(factuur.vervaldatum || "-", 72, y);

  let cy = 50;
  doc.setFont("helvetica", "bold"); doc.text("Aan:", pageW / 2, cy);
  doc.setFont("helvetica", "normal"); cy += 7;
  doc.text(factuur.klant || "-", pageW / 2, cy);
  if (factuur.klant_email) { cy += 7; doc.text(factuur.klant_email, pageW / 2, cy); }

  y = 90;
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 6, pageW - 2 * margin, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text("Omschrijving", margin + 2, y);
  doc.text("Aantal", 120, y, { align: "right" });
  doc.text("Eenheid", 142, y, { align: "right" });
  doc.text("Prijs", 164, y, { align: "right" });
  doc.text("Totaal", pageW - margin - 2, y, { align: "right" });
  y += 8;

  const regels = Array.isArray(factuur.regels) ? factuur.regels : [];
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
  regels.forEach((r, i) => {
    if (i % 2 === 1) { doc.setFillColor(249, 250, 251); doc.rect(margin, y - 5, pageW - 2 * margin, 8, "F"); }
    const qty = Number(r.aantal) || 0, price = Number(r.prijs) || 0, tot = qty * price;
    doc.text(r.omschrijving || "-", margin + 2, y);
    doc.text(String(qty), 120, y, { align: "right" });
    doc.text(r.eenheid || "stuk", 142, y, { align: "right" });
    doc.text(`€ ${price.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, 164, y, { align: "right" });
    doc.text(`€ ${tot.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, pageW - margin - 2, y, { align: "right" });
    y += 9;
  });

  y += 5;
  doc.setDrawColor(229, 231, 235); doc.line(pageW / 2, y, pageW - margin, y); y += 8;
  const sub = regels.reduce((s, r) => s + (Number(r.aantal) || 0) * (Number(r.prijs) || 0), 0);
  const btwAmt = sub * 0.21, tot = sub + btwAmt;

  doc.setFontSize(9.5); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text("Subtotaal:", pageW / 2 + 5, y);
  doc.text(`€ ${sub.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, pageW - margin - 2, y, { align: "right" }); y += 7;
  doc.text("BTW 21%:", pageW / 2 + 5, y);
  doc.text(`€ ${btwAmt.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, pageW - margin - 2, y, { align: "right" }); y += 4;
  doc.setDrawColor(100, 100, 100); doc.line(pageW / 2, y, pageW - margin, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17, 24, 39);
  doc.text("Totaal:", pageW / 2 + 5, y);
  doc.text(`€ ${tot.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`, pageW - margin - 2, y, { align: "right" });

  const footerY = 270;
  doc.setDrawColor(229, 231, 235); doc.line(margin, footerY - 5, pageW - margin, footerY - 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
  doc.text(`${company.bedrijfsnaam || ""}  |  ${company.email || ""}  |  ${company.telefoon || ""}`, margin, footerY);
  if (company.adres) doc.text(company.adres, margin, footerY + 6);
  doc.text("Gelieve het bedrag over te maken binnen 14 dagen na factuurdatum.", margin, footerY + 12);

  return doc;
};

const createFactuurPdfBase64 = (factuur, bedrijf) => createFactuurPdf(factuur, bedrijf).output("datauristring").split(",")[1];

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
  const [data, setData] = useState({ bedrijfsnaam:"", sector:"", stad:"", adres:"", telefoon:"", email:"", diensten:"", logo:"" });
  const sectoren = [
    {id:"bouw",icon:"🔨",label:"Bouw"},{id:"schoonmaak",icon:"🧹",label:"Schoonmaak"},
    {id:"catering",icon:"🍽️",label:"Catering"},{id:"tuinieren",icon:"🌿",label:"Tuinieren"},
    {id:"beveiliging",icon:"🛡️",label:"Beveiliging"},{id:"transport",icon:"🚚",label:"Transport"},
    {id:"airco",icon:"❄️",label:"Airco/Klimaat"},{id:"loodgieter",icon:"🔧",label:"Loodgieter"},
    {id:"elektricien",icon:"⚡",label:"Elektricien"},{id:"overig",icon:"🔨",label:"Overig"},
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
            <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={data.adres} onChange={e=>setData({...data,adres:e.target.value})} placeholder="Straat 12, 1011AB Amsterdam"/></div>
            <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={data.telefoon} onChange={e=>setData({...data,telefoon:e.target.value})} placeholder="06-12345678"/></div>
            <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={data.email} onChange={e=>setData({...data,email:e.target.value})} placeholder="info@bedrijf.nl"/></div>
            <div className="ig"><label className="ilbl">Logo upload</label><input className="inp" type="file" accept="image/*" onChange={async(e)=>{
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setData({...data,logo: reader.result?.toString() || data.logo});
                reader.readAsDataURL(file);
              }} /></div>
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

function ProfielTab({ userId, bedrijf, certificaten, onSaved }) {
  const [profile, setProfile] = useState({
    bedrijfsnaam: bedrijf?.bedrijfsnaam || "",
    sector: bedrijf?.sector || "",
    stad: bedrijf?.stad || "",
    adres: bedrijf?.adres || "",
    telefoon: bedrijf?.telefoon || "",
    email: bedrijf?.email || "",
    diensten: bedrijf?.diensten || "",
    logo: bedrijf?.logo || "",
    kvk_nummer: bedrijf?.kvk_nummer || "",
    btw_nummer: bedrijf?.btw_nummer || "",
    website: bedrijf?.website || "",
    iban: bedrijf?.iban || "",
    km_vergoeding: bedrijf?.km_vergoeding ?? 0.23,
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });
  const [logoLightbox, setLogoLightbox] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [nieuwCert, setNieuwCert] = useState({naam:"",type:"",vervaldatum:"",notitie:""});
  const [savingCert, setSavingCert] = useState(false);
  useEffect(() => {
    setProfile({
      bedrijfsnaam: bedrijf?.bedrijfsnaam || "",
      sector: bedrijf?.sector || "",
      stad: bedrijf?.stad || "",
      adres: bedrijf?.adres || "",
      telefoon: bedrijf?.telefoon || "",
      email: bedrijf?.email || "",
      diensten: bedrijf?.diensten || "",
      logo: bedrijf?.logo || "",
      kvk_nummer: bedrijf?.kvk_nummer || "",
      btw_nummer: bedrijf?.btw_nummer || "",
      website: bedrijf?.website || "",
      iban: bedrijf?.iban || "",
      km_vergoeding: bedrijf?.km_vergoeding ?? 0.23,
    });
  }, [bedrijf]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg({ type: "", text: "" });
    const payload = { ...profile, user_id: userId };
    const allowedColumns = ["user_id", "bedrijfsnaam", "sector", "stad", "adres", "telefoon", "email", "diensten", "logo", "kvk_nummer", "btw_nummer", "website", "iban", "km_vergoeding"];
    const filteredPayload = Object.fromEntries(Object.entries(payload).filter(([key]) => allowedColumns.includes(key)));
    console.log("[saveProfile] payload", filteredPayload);
    console.log("[saveProfile] bedrijf", bedrijf);

    try {
      let result;
      if (bedrijf?.id) {
        result = await supabase.from("bedrijfsprofiel").update(filteredPayload).eq("id", bedrijf.id).select();
      } else if (bedrijf?.user_id) {
        result = await supabase.from("bedrijfsprofiel").update(filteredPayload).eq("user_id", bedrijf.user_id).select();
      } else {
        result = await supabase.from("bedrijfsprofiel").upsert(filteredPayload, { onConflict: "user_id" }).select();
      }
      console.log("[saveProfile] result", result);

      if (result.error) {
        console.error("[saveProfile] fout", result.error);
        setSaveMsg({ type: "error", text: `Opslaan mislukt: ${result.error.message}` });
        return;
      }

      if (!result.data || result.data.length === 0) {
        console.warn("[saveProfile] geen rijen bijgewerkt — mogelijk RLS-blokkering of verkeerde id");
        setSaveMsg({ type: "error", text: "Opslaan mislukt: geen rijen bijgewerkt. Controleer of je ingelogd bent als eigenaar." });
        return;
      }

      const updatedProfile = result.data[0];
      console.log("[saveProfile] opgeslagen", updatedProfile);
      setSaveMsg({ type: "ok", text: "Profiel opgeslagen." });
      onSaved && onSaved(updatedProfile);
    } catch (error) {
      console.error("[saveProfile] onverwachte fout", error);
      setSaveMsg({ type: "error", text: `Onverwachte fout: ${error?.message || error}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="ph"><div><div className="pg-title">Bedrijfsprofiel</div><div className="pg-sub">Bewerk je bedrijfsgegevens en logo</div></div></div>
      <div className="card cp">
        {profile.logo && (
          <div style={{marginBottom:18,textAlign:"center"}}>
            <img
              src={profile.logo}
              alt="Bedrijfslogo"
              style={{maxWidth:"100%",maxHeight:140,objectFit:"contain",borderRadius:10,cursor:"pointer",border:"1px solid #E5E7EB"}}
              onClick={() => setLogoLightbox(true)}
              title="Klik om te vergroten"
            />
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Bedrijfsnaam</label><input className="inp" value={profile.bedrijfsnaam} onChange={e=>setProfile({...profile,bedrijfsnaam:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Sector</label><input className="inp" value={profile.sector} onChange={e=>setProfile({...profile,sector:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Stad</label><input className="inp" value={profile.stad} onChange={e=>setProfile({...profile,stad:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={profile.adres} onChange={e=>setProfile({...profile,adres:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={profile.telefoon} onChange={e=>setProfile({...profile,telefoon:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">KvK nummer</label><input className="inp" value={profile.kvk_nummer} onChange={e=>setProfile({...profile,kvk_nummer:e.target.value})} placeholder="12345678"/></div>
          <div className="ig"><label className="ilbl">BTW nummer</label><input className="inp" value={profile.btw_nummer} onChange={e=>setProfile({...profile,btw_nummer:e.target.value})} placeholder="NL123456789B01"/></div>
          <div className="ig"><label className="ilbl">Website</label><input className="inp" value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})} placeholder="https://jouwbedrijf.nl"/></div>
          <div className="ig"><label className="ilbl">IBAN</label><input className="inp" value={profile.iban} onChange={e=>setProfile({...profile,iban:e.target.value})} placeholder="NL00 BANK 0000 0000 00"/></div>
          <div className="ig"><label className="ilbl">Diensten</label><input className="inp" value={profile.diensten} onChange={e=>setProfile({...profile,diensten:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">KM-vergoeding (€/km)</label><input className="inp" type="number" step="0.01" min="0" max="10" value={profile.km_vergoeding} onChange={e=>setProfile({...profile,km_vergoeding:parseFloat(e.target.value)||0.23})} placeholder="0.23"/></div>
          <div className="ig"><label className="ilbl">Logo upload</label><input className="inp" type="file" accept="image/*" onChange={async(e)=>{
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setProfile({...profile,logo: reader.result?.toString() || profile.logo});
            reader.readAsDataURL(file);
          }} /></div>
        </div>
      </div>
      {saveMsg.text && (
        <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:saveMsg.type==="ok"?"#DCFCE7":"#FEE2E2",color:saveMsg.type==="ok"?"#15803D":"#B91C1C"}}>
          {saveMsg.text}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button className="btn btn-dark" onClick={saveProfile} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</button></div>

      <div className="sec-ttl" style={{marginTop:28}}>💳 Abonnement</div>
      <div className="card cp" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>WerkMate Pro — €99/maand</div>
          <div style={{fontSize:13,color:"#64748B",lineHeight:1.5}}>14 dagen gratis uitproberen. Inclusief offertes, facturen, planning, CRM, AI assistent en meer.</div>
        </div>
        <a href={STRIPE_URL} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-block",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",borderRadius:10,padding:"11px 22px",fontSize:13.5,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",flexShrink:0}}>
          🚀 Start 14 dagen gratis
        </a>
      </div>

      {logoLightbox && (
        <div
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.9)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={() => setLogoLightbox(false)}
        >
          <img
            src={profile.logo}
            alt="Logo"
            style={{maxWidth:"90vw",maxHeight:"90vh",objectFit:"contain",borderRadius:12}}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLogoLightbox(false)}
            style={{position:"fixed",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:36,cursor:"pointer",lineHeight:1}}
          >✕</button>
        </div>
      )}

      <div className="sec-ttl" style={{marginTop:28}}>📜 Documenten & Certificaten</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,color:"#64748B"}}>{(certificaten||[]).length} certificaten — {(certificaten||[]).filter(c=>{if(!c.vervaldatum)return false;const d=new Date(c.vervaldatum);const now=new Date();const days=(d-now)/86400000;return days>=0&&days<=30;}).length} verlopen binnenkort</div>
        <button className="btn btn-outline" onClick={()=>{setNieuwCert({naam:"",type:"",vervaldatum:"",notitie:""});setShowAddCert(true);}}>+ Certificaat</button>
      </div>
      {(certificaten||[]).length===0
        ?<div className="card cp" style={{textAlign:"center",color:"#94A3B8",padding:32,fontSize:14}}>Nog geen certificaten. Voeg je eerste VCA, NEN of diploma toe.</div>
        :<div className="mob-card-list">{(certificaten||[]).map(c=>{
          const nu=new Date();
          const verval=c.vervaldatum?new Date(c.vervaldatum):null;
          const daysLeft=verval?Math.round((verval-nu)/86400000):null;
          const expired=daysLeft!==null&&daysLeft<0;
          const soonExpires=daysLeft!==null&&daysLeft>=0&&daysLeft<=30;
          return(
            <div className="mob-card" key={c.id} style={{borderLeft:`4px solid ${expired?"#EF4444":soonExpires?"#F59E0B":"#10B981"}`}}>
              <div className="mob-card-top">
                <div className="mob-card-name">{c.naam}</div>
                {expired&&<span style={{background:"#FEE2E2",color:"#B91C1C",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>Verlopen</span>}
                {soonExpires&&<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{daysLeft}d</span>}
                {!expired&&!soonExpires&&daysLeft!==null&&<span style={{background:"#DCFCE7",color:"#15803D",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>Geldig</span>}
              </div>
              <div className="mob-card-sub">{c.type}{c.vervaldatum?` · Vervalt ${new Date(c.vervaldatum).toLocaleDateString("nl-NL")}`:""}</div>
              {c.notitie&&<div className="mob-card-sub" style={{color:"#888"}}>{c.notitie}</div>}
              <button onClick={()=>{if(window.confirm("Certificaat verwijderen?"))supabase.from("certificaten").delete().eq("id",c.id).then(()=>onSaved&&onSaved(bedrijf));}} style={{position:"absolute",top:12,right:16,background:"none",border:"none",color:"#9CA3AF",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
          );
        })}</div>
      }
      {showAddCert&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Certificaat toevoegen</div></div><button className="mc" onClick={()=>setShowAddCert(false)}>✕</button></div><div className="mb">
        <div className="ig"><label className="ilbl">Naam certificaat *</label><input className="inp" value={nieuwCert.naam} onChange={e=>setNieuwCert({...nieuwCert,naam:e.target.value})} placeholder="Bijv. VCA Basis, NEN 1010..."/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Type</label>
            <select className="inp" value={nieuwCert.type} onChange={e=>setNieuwCert({...nieuwCert,type:e.target.value})}>
              <option value="">-- Kies type --</option>
              {["VCA","NEN","BRL","ISO","SSVV","Diploma","Rijbewijs","Overig"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="ig"><label className="ilbl">Vervaldatum</label><input className="inp" type="date" value={nieuwCert.vervaldatum} onChange={e=>setNieuwCert({...nieuwCert,vervaldatum:e.target.value})}/></div>
        </div>
        <div className="ig"><label className="ilbl">Notitie</label><input className="inp" value={nieuwCert.notitie} onChange={e=>setNieuwCert({...nieuwCert,notitie:e.target.value})} placeholder="Optioneel"/></div>
        <div style={{display:"flex",gap:9}}>
          <button className="btn btn-ghost" onClick={()=>setShowAddCert(false)}>Annuleren</button>
          <button className="btn btn-dark btn-full" disabled={savingCert||!nieuwCert.naam} onClick={async()=>{
            setSavingCert(true);
            await supabase.from("certificaten").insert({user_id:userId,naam:nieuwCert.naam,type:nieuwCert.type||"Overig",vervaldatum:nieuwCert.vervaldatum||null,notitie:nieuwCert.notitie||null});
            setSavingCert(false); setShowAddCert(false);
            onSaved&&onSaved(bedrijf);
          }}>{savingCert?"Opslaan…":"Opslaan"}</button>
        </div>
      </div></div></div>}
    </div>
  );
}

// ── AI Offerte ─────────────────────────────────────────────────
function AIOfferte({ onClose, prijslijst, userId, onSaved, klanten, bedrijf }) {
  const [step,setStep]=useState(0);const [vraag,setVraag]=useState("");const [loading,setLoading]=useState(false);const [off,setOff]=useState(null);const [selectedKlantId,setSelectedKlantId]=useState("");const [newKlantEmail,setNewKlantEmail]=useState("");
  const selectedKlant = klanten?.find(k=>k.id?.toString()===selectedKlantId);
  useEffect(()=>{if(!selectedKlantId && klanten?.length){setSelectedKlantId(klanten[0].id?.toString()||"");} },[klanten, selectedKlantId]);
  const px=prijslijst.map(p=>`${p.dienst}: €${p.prijs} per ${p.eenheid}`).join(", ");

  const recalcTotals = (offer) => {
    if (!offer?.regels) return offer;
    const subtotaal = offer.regels.reduce((sum,r) => {
      const aantal = parseFloat(r.aantal) || 0;
      const prijs = parseFloat(r.prijs) || 0;
      return sum + aantal * prijs;
    }, 0);
    const btw = parseFloat((subtotaal * 0.21).toFixed(2));
    const totaal = parseFloat((subtotaal + btw).toFixed(2));
    return { ...offer, subtotaal, btw, totaal };
  };

  const updateOff = (patch) => setOff((prev) => prev ? recalcTotals({ ...prev, ...patch }) : prev);
  const updateRule = (index, field, value) => setOff((prev) => {
    if (!prev) return prev;
    const regels = (prev.regels || []).map((regel, i) => i === index ? { ...regel, [field]: field === "aantal" || field === "prijs" ? Number(value) : value } : regel);
    return recalcTotals({ ...prev, regels });
  });
  const addRule = () => setOff((prev) => {
    const regels = [...(prev?.regels || []), { omschrijving: "", aantal: 1, eenheid: "stuk", prijs: 0 }];
    return recalcTotals({ ...(prev || {}), regels });
  });
  const removeRule = (index) => setOff((prev) => {
    if (!prev) return prev;
    const regels = (prev.regels || []).filter((_, i) => i !== index);
    return recalcTotals({ ...prev, regels });
  });
  const gen=async()=>{if(!vraag.trim())return;setLoading(true);setStep(1);
    try{const txt=await aiCall(`Offerte-assistent voor vakman NL. Prijslijst: ${px}. Gebruik exact de prijzen uit deze prijslijst wanneer de dienst overeenkomt met een bestaande dienst. Genereer alleen nieuwe prijzen voor diensten die niet in de prijslijst staan. Nooit afwijken van de prijslijst prijzen. Kies eenheid per regel: gebruik "uur" voor arbeid/installatie/montage, "stuk" voor producten/apparaten/materialen per stuk, "m²" voor oppervlaktewerk, "m" voor leidingen/kabels, "dag" voor dagtarieven. Genereer voor: "${vraag}". ALLEEN JSON: {"dienst":"..","omschrijving":"2 zinnen","regels":[{"omschrijving":"Arbeid installatie","aantal":3,"eenheid":"uur","prijs":85},{"omschrijving":"Materiaal/product","aantal":1,"eenheid":"stuk","prijs":250}],"subtotaal":505,"btw":106.05,"totaal":611.05,"geldigheid":"30 dagen","opmerkingen":"garantie"}`);
    setOff(recalcTotals(JSON.parse(txt.replace(/```json|```/g,"").trim())));setStep(2);}catch{setOff({dienst:"Fout",omschrijving:"Mislukt.",regels:[],subtotaal:0,btw:0,totaal:0});setStep(2);}setLoading(false);};

  const sendOfferEmail = async (email, name, dienst, regels, subtotaal, btw, totaal, portalToken) => {
    const portal_url = portalToken ? `https://app.werkmate.tech/portal/${portalToken}` : undefined;
    const payload = {
      action: "send-offer-email",
      customer_email: email,
      customer_name: name,
      company_name: bedrijf?.bedrijfsnaam,
      dienst,
      regels,
      subtotaal,
      btw,
      totaal,
      portal_url,
      attachments: [
        {
          type: "application/pdf",
          filename: `offerte-${name.replace(/\s+/g, "_")}.pdf`,
          content: createOfferPdfBase64({ klant: name, dienst, regels, subtotaal, btw, totaal }, bedrijf),
        }
      ]
    };
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token || import.meta.env.VITE_SUPABASE_KEY;
    const response = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    await logEmail(userId, email, `Offerte voor ${name}`, "offerte", `Offerte — ${dienst}`, response.ok ? "verzonden" : "mislukt");
    return data;
  };

  const opslaan = async () => {
    if (!off || !userId) return;
    const updatedOff = recalcTotals(off);
    setOff(updatedOff);
    const klant = selectedKlant?.naam || vraag;
    const klantEmail = selectedKlant?.email || newKlantEmail.trim();
    const vandaag = new Date().toLocaleDateString("nl-NL", {day:"numeric", month:"short"});
    console.log("AIOfferte opslaan: klant", klant, "klantEmail", klantEmail, "offerte", updatedOff);
    const insertPayload = {
      user_id: userId,
      klant,
      dienst: updatedOff.dienst,
      bedrag: `€ ${updatedOff.totaal}`,
      status: "In afwachting",
      datum: vandaag,
      regels: updatedOff.regels || [],
      subtotaal: updatedOff.subtotaal || 0,
      btw: updatedOff.btw || 0,
      totaal: updatedOff.totaal || 0,
      opmerkingen: updatedOff.opmerkingen || null,
    };
    console.log("offerte insert payload:", JSON.stringify(insertPayload, null, 2));
    const insertResult = await supabase.from("offertes").insert(insertPayload).select("portal_token").single();
    console.log("AIOfferte opslaan: supabase insert result", insertResult);
    const portalToken = insertResult.data?.portal_token;
    if (klantEmail) {
      try {
        await sendOfferEmail(klantEmail, klant, off.dienst, off.regels || [], off.subtotaal, off.btw, off.totaal, portalToken);
      } catch (error) {
        console.error("Kan offerte e-mail niet verzenden", error);
      }
    } else {
      console.log("AIOfferte opslaan: klantEmail is empty, skipping sendOfferEmail", { selectedKlant, newKlantEmail });
    }
    onSaved && onSaved();
    onClose();
  };

  return(<div className="overlay"><div className="modal">
    <div className="mh"><div><div className="mt">✨ Slimme offerte generator</div><div className="ms">Gebruikt jouw prijslijst</div></div><button className="mc" onClick={onClose}>✕</button></div>
    <div className="mb">
      {step===0&&<><div className="ig"><label className="ilbl">Kies klant</label><select className="inp" value={selectedKlantId} onChange={e=>setSelectedKlantId(e.target.value)}>
          <option value="">Nieuwe klant...</option>
          {klanten?.map(k=> <option key={k.id} value={k.id?.toString()}>{k.naam}</option>)}
        </select></div>
        {!selectedKlant && <div className="ig"><label className="ilbl">Klant e-mail</label><input className="inp" value={newKlantEmail} onChange={e=>setNewKlantEmail(e.target.value)} placeholder="klant@email.nl"/></div>}
        {selectedKlant && selectedKlant.email && <div className="ig"><label className="ilbl">Klant e-mail</label><input className="inp" value={selectedKlant.email} disabled /></div>}
        <div className="ig"><label className="ilbl">Beschrijf de klantvraag</label><textarea className="inp" value={vraag} onChange={e=>setVraag(e.target.value)} placeholder="Bijv: CV ketel onderhoud Utrecht, klant Jan Vermeer"/></div><div style={{position:"sticky",bottom:0,background:"#fff",padding:"12px 0 0",marginTop:4}}><button className="btn btn-ai btn-full" onClick={gen} disabled={!vraag.trim()} style={{opacity:vraag.trim()?1:.5}}>✨ Maak offerte</button></div></>}
      {step===1&&<div style={{textAlign:"center",padding:"44px 0"}}><div style={{fontSize:40,marginBottom:12}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Bezig<span className="dot">…</span></div></div>}
      {step===2&&off&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div className="ig"><label className="ilbl">Dienst</label><input className="inp" value={off.dienst} onChange={e=>updateOff({dienst:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Offerte omschrijving</label><textarea className="inp" value={off.omschrijving} onChange={e=>updateOff({omschrijving:e.target.value})} rows={3} /></div>
        </div>
        <div className="off-tbl">
          <div className="off-tbl-grid off-tbl-hdr">
            <div className="off-cell">Omschrijving</div>
            <div className="off-cell right">Aantal</div>
            <div className="off-cell center">Eenheid</div>
            <div className="off-cell right">Prijs</div>
            <div className="off-cell right">Totaal</div>
            <div className="off-cell del"></div>
          </div>
          {off.regels?.map((r,i)=><div key={i} className="off-tbl-grid off-tbl-row" style={{alignItems:"flex-start"}}>
            <div className="off-cell" style={{paddingTop:8}}><textarea className="off-inp off-inp-ta" rows={1} value={r.omschrijving} ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}} onChange={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";updateRule(i,"omschrijving",e.target.value);}}/></div>
            <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.1" value={r.aantal} onChange={e=>updateRule(i,"aantal",e.target.value)} /></div>
            <div className="off-cell center" style={{paddingTop:8}}><select className="off-inp center" value={r.eenheid} onChange={e=>updateRule(i,"eenheid",e.target.value)}>{["uur","stuk","st","m²","m","rit","dag","persoon","km"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
            <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.01" value={r.prijs} onChange={e=>updateRule(i,"prijs",e.target.value)} /></div>
            <div className="off-cell off-cell-totaal" style={{paddingTop:12}}>€{((Number(r.aantal)||0)*(Number(r.prijs)||0)).toFixed(2)}</div>
            <div className="off-cell del" style={{paddingTop:8}}><button className="btn btn-danger btn-sm" onClick={()=>removeRule(i)}>✕</button></div>
          </div>)}
        </div>
        <button className="btn btn-outline" style={{marginBottom:12}} onClick={addRule}>+ Regel toevoegen</button>
        <div className="tot-box"><div>Subtotaal: <strong>€ {off.subtotaal}</strong></div><div>BTW: <strong>€ {off.btw}</strong></div><div style={{fontSize:15,fontWeight:800,marginTop:3}}>Totaal: € {off.totaal}</div></div>
        <div className="ig"><label className="ilbl">Opmerkingen / garantietekst (optioneel)</label><textarea className="inp" rows={3} value={off.opmerkingen||""} onChange={e=>updateOff({opmerkingen:e.target.value})} placeholder="Bijv. 2 jaar garantie op installatie. Onderdelen inclusief. Geldigheid offerte: 30 dagen."/></div>
        <div style={{display:"flex",gap:9,position:"sticky",bottom:0,background:"#fff",padding:"12px 0 0",marginTop:4}}><button className="btn btn-ghost" onClick={()=>{setStep(0);setOff(null);setVraag("");}}>Opnieuw</button><button className="btn btn-ai" style={{flex:1,justifyContent:"center"}} onClick={opslaan}>💾 Opslaan & Verstuur</button></div>
      </>}
    </div>
  </div></div>);
}

// ── Dashboard ─────────────────────────────────────────────────
function DashboardTab({ openTab, bedrijf, offertes, planning, facturen, klanten }) {
  const hr=new Date().getHours();
  const gr=hr<12?"Goedemorgen":hr<18?"Goedemiddag":"Goedenavond";
  const openOffertes = offertes.filter(o=>o.status==="In afwachting").length;
  const td=new Date();const todayStr=`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
  const planningVandaag = planning.filter(p=>p.datum===todayStr).length;
  const openFacturen = facturen.filter(f=>f.status==="Openstaand"||f.status==="Herinnering"||f.status==="Verstuurd");
  const openBedrag = openFacturen.reduce((sum,f)=>{const t=f.totaal!=null?Number(f.totaal):parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."))||0;return sum+t;},0);

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
        {label:"Klanten",val:(klanten||[]).length.toString(),sub:"zie Klanten",color:"#10B981"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.val}</div><div className="ss">{s.sub}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div>
        <div className="sec-ttl">Planning vandaag</div>
        {planning.filter(p=>p.datum===todayStr).length===0
          ? <div className="card cp leeg"><div className="leeg-icon">📅</div><div className="leeg-title">Geen opdrachten vandaag</div><div className="leeg-sub">Voeg opdrachten toe via Planning</div></div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>{planning.filter(p=>p.datum===todayStr).slice(0,3).map((item,i)=><div className="pc" key={i}><div className="tp">{item.tijd}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:13.5}}>{item.klant}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{item.dienst}</div></div><Badge status={item.status}/></div>)}</div>
        }
      </div>
      <div><div className="sec-ttl">Snelle acties</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {[{icon:"✨",label:"Slimme offerte",tab:"offertes",bg:"#EEF2FF",border:"#C7D2FE",col:"#6366F1"},{icon:"✉️",label:"Mail",tab:"mail",bg:"#F0FDF4",border:"#BBF7D0",col:"#16A34A"},{icon:"📱",label:"Social post",tab:"social",bg:"#FFF7ED",border:"#FED7AA",col:"#EA580C"}]
          .map(a=><button key={a.tab} onClick={()=>openTab(a.tab)} style={{background:a.bg,border:`1.5px solid ${a.border}`,borderRadius:11,padding:"14px",cursor:"pointer",textAlign:"center",fontFamily:"'DM Sans',sans-serif",transition:"all .14s"}} onMouseOver={e=>e.currentTarget.style.transform="translateY(-1px)"} onMouseOut={e=>e.currentTarget.style.transform="none"}>
            <div style={{fontSize:22,marginBottom:5}}>{a.icon}</div><div style={{fontSize:12.5,fontWeight:700,color:a.col}}>{a.label}</div>
          </button>)}
      </div></div>
    </div>
  </div>);
}

// ── Offertes ──────────────────────────────────────────────────
function fmtWaPhone(tel) {
  if (!tel) return "";
  let n = tel.replace(/[\s\-().]/g, "");
  if (n.startsWith("+31")) return n;
  if (n.startsWith("0031")) return "+31" + n.slice(4);
  if (n.startsWith("0")) return "+31" + n.slice(1);
  return n;
}

function waOfferte(o, klanten, bedrijf) {
  const url = `https://app.werkmate.tech/portal/${o.portal_token}`;
  const cn  = bedrijf?.bedrijfsnaam || "WerkMate";
  const msg = `Beste ${o.klant}, hierbij uw offerte. Bekijk en onderteken via: ${url}. Met vriendelijke groet, ${cn}`;
  const tel = fmtWaPhone((klanten||[]).find(k => k.naam === o.klant)?.tel || "");
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
}

function OfferteTab({ prijslijst, userId, offertes, refresh, klanten, bedrijf }) {
  const mob = useMobile();
  const [showAI,setShowAI]=useState(false);
  const [mobDetail,setMobDetail]=useState(null);
  const totaal = offertes.reduce((s,o)=>{
    const bedrag = (o.bedrag||"0").replace(/[€\s]/g, "");
    const clean = bedrag.includes(",") ? bedrag.replace(/\./g, "").replace(",", ".") : bedrag;
    const n = parseFloat(clean);
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  const formatMoney = (value) => {
    const num = typeof value === "string"
      ? parseFloat(value.toString().replace(/[€\s]/g, "").replace(/,/g, "."))
      : Number(value);
    return isNaN(num)
      ? "0,00"
      : num.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseOfferRules = (offer) => {
    if (!offer) return [];
    if (Array.isArray(offer.regels)) return offer.regels;
    if (typeof offer.regels === "string") {
      try { return JSON.parse(offer.regels); } catch { }
    }
    if (offer.regels && typeof offer.regels === "object") return [offer.regels];
    const prijs = parseFloat((offer.bedrag||"0").replace(/[€\s]/g, "").replace(/,/g, "."));
    return [{ omschrijving: offer.dienst || "Offerte", aantal: 1, eenheid: "", prijs: isNaN(prijs) ? 0 : prijs }];
  };

  const exportOfferPdf = (offer) => {
    const company = {
      bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate Bedrijf",
      telefoon: bedrijf?.telefoon || "",
      email: bedrijf?.email || "",
      adres: bedrijf?.adres || "",
    };
    const regels = parseOfferRules(offer);
    const subtotal = offer.subtotaal != null ? Number(offer.subtotaal) : regels.reduce((sum, r) => sum + ((Number(r.aantal) || 0) * (Number(r.prijs) || 0)), 0);
    const btw = offer.btw != null ? Number(offer.btw) : Math.round(subtotal * 0.21 * 100) / 100;
    const totaalValue = offer.totaal != null ? Number(offer.totaal) : subtotal + btw;
    const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(company.bedrijfsnaam, 20, 25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Datum: ${today}`, 20, 34);
    doc.text(`Offerte voor: ${offer.klant || "klant"}`, 20, 42);
    doc.text(`Geachte ${offer.klant || "heer/mevrouw"},`, 20, 52);
    doc.text(`Hierbij ontvangt u onze offerte voor ${offer.dienst || "uw aanvraag"}.`, 20, 58);

    const startY = 70;
    const rowX = [20, 85, 115, 145, 175];
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Omschrijving", rowX[0], startY);
    doc.text("Aantal", rowX[1], startY);
    doc.text("Eenheid", rowX[2], startY);
    doc.text("Prijs", rowX[3], startY);
    doc.text("Totaal", rowX[4], startY);
    doc.setDrawColor(200);
    doc.line(20, startY + 2, 190, startY + 2);

    let y = startY + 10;
    doc.setFont("helvetica", "normal");
    regels.forEach((regel) => {
      const regelTotaal = (Number(regel.aantal) || 0) * (Number(regel.prijs) || 0);
      doc.text(String(regel.omschrijving || ""), rowX[0], y);
      doc.text(String(regel.aantal || ""), rowX[1], y, { align: "right" });
      doc.text(String(regel.eenheid || ""), rowX[2], y, { align: "right" });
      doc.text(`€ ${formatMoney(regel.prijs)}`, rowX[3], y, { align: "right" });
      doc.text(`€ ${formatMoney(regelTotaal)}`, rowX[4], y, { align: "right" });
      y += 8;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    });

    const summaryY = y + 12;
    doc.setFont("helvetica", "bold");
    doc.text(`Subtotaal:`, 140, summaryY);
    doc.text(`€ ${formatMoney(subtotal)}`, 190, summaryY, { align: "right" });
    doc.text(`BTW (21%):`, 140, summaryY + 8);
    doc.text(`€ ${formatMoney(btw)}`, 190, summaryY + 8, { align: "right" });
    doc.setFontSize(13);
    doc.text(`Totaal:`, 140, summaryY + 18);
    doc.text(`€ ${formatMoney(totaalValue)}`, 190, summaryY + 18, { align: "right" });

    let notesHeight = 0;
    if (offer.opmerkingen) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Opmerkingen / garantie:", 20, summaryY + 30);
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(String(offer.opmerkingen), 170);
      doc.text(noteLines, 20, summaryY + 37);
      notesHeight = noteLines.length * 5 + 18;
    }

    const footerY = summaryY + 34 + notesHeight;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Contact", 20, footerY);
    doc.text(`Telefoon: ${company.telefoon}`, 20, footerY + 6);
    doc.text(`Email: ${company.email}`, 20, footerY + 12);
    doc.text(`Adres: ${company.adres}`, 20, footerY + 18);

    doc.save(`${(offer.klant || "offerte").replace(/\s+/g, "_")}_offerte.pdf`);
  };

  return(<div>
    {showAI&&<AIOfferte onClose={()=>setShowAI(false)} prijslijst={prijslijst} userId={userId} klanten={klanten} onSaved={refresh} bedrijf={bedrijf}/>}
    {mob && mobDetail && (
      <MobDetailScreen title={mobDetail.klant} onBack={()=>setMobDetail(null)}>
        <div className="mob-det-section">
          <div className="mob-card-amount" style={{fontSize:32,margin:"0 0 8px"}}>{mobDetail.bedrag}</div>
          <Badge status={mobDetail.status}/>
          <div className="mob-det-row"><span className="mob-det-lbl">Dienst</span><span className="mob-det-val">{mobDetail.dienst||"—"}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Datum</span><span className="mob-det-val">{mobDetail.datum||"—"}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Klant</span><span className="mob-det-val">{mobDetail.klant}</span></div>
        </div>
        <button className="mob-det-action-btn" onClick={()=>exportOfferPdf(mobDetail)}><span className="mob-det-action-ic">📄</span>PDF downloaden</button>
        {mobDetail.portal_token && (<>
          <button className="mob-det-action-btn" onClick={async()=>{
            const url=`https://app.werkmate.tech/portal/${mobDetail.portal_token}`;
            const k=(klanten||[]).find(x=>x.naam===mobDetail.klant);
            const email=k?.email||"";
            if(!email){alert("Geen e-mailadres bekend voor deze klant");return;}
            const {data:{session:s}}=await supabase.auth.getSession();
            await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${s?.access_token}`},body:JSON.stringify({action:"send-portal-link",klant_email:email,klant_naam:mobDetail.klant,portal_url:url,company_name:bedrijf?.bedrijfsnaam||"WerkMate",bedrag:mobDetail.bedrag})});
            await supabase.from("offertes").update({status:"Verstuurd"}).eq("id",mobDetail.id);
            refresh(); setMobDetail({...mobDetail,status:"Verstuurd"});
            alert("Offerte verstuurd naar "+email);
          }}><span className="mob-det-action-ic">📤</span>Stuur naar klant</button>
          <button className="mob-det-action-btn" onClick={()=>waOfferte(mobDetail,klanten,bedrijf)}><span className="mob-det-action-ic">📱</span>Stuur via WhatsApp</button>
        </>)}
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #EAECF0",padding:"14px 16px",marginBottom:8}}>
          <div style={{fontSize:13,color:"#64748B",marginBottom:8,fontWeight:600}}>Status wijzigen</div>
          <select value={mobDetail.status} onChange={async(e)=>{await supabase.from("offertes").update({status:e.target.value}).eq("id",mobDetail.id);refresh();setMobDetail({...mobDetail,status:e.target.value});}} style={{width:"100%",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px 14px",fontSize:16,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none",background:"#fff",color:"#111"}}>
            {["In afwachting","Verstuurd","Ondertekend","Afgewezen"].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Offerte verwijderen?")) { supabase.from("offertes").delete().eq("id",mobDetail.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic">🗑</span>Verwijderen</button>
      </MobDetailScreen>
    )}
    <div className="ph"><div><div className="pg-title">Offertes</div><div className="pg-sub">{offertes.length} offertes</div></div><button className="btn btn-ai" onClick={()=>setShowAI(true)}>✨ Slimme offerte</button></div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
      {[
        {label:"In afwachting",val:offertes.filter(o=>o.status==="In afwachting").length,color:"#F59E0B"},
        {label:"Ondertekend",val:offertes.filter(o=>o.status==="Ondertekend").length,color:"#10B981"},
        {label:"Verstuurd",val:offertes.filter(o=>o.status==="Verstuurd").length,color:"#3B82F6"},
        {label:"Totaal",val:`€ ${totaal.toLocaleString("nl-NL", {minimumFractionDigits:2, maximumFractionDigits:2})}` ,color:"#0F0F14"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color,fontSize:19}}>{s.val}</div></div>)}
    </div>
    {offertes.length===0
      ? <LeegScherm icon="📋" titel="Nog geen offertes" sub="Maak je eerste offerte met de slimme generator" actie="✨ Slimme offerte maken" onActie={()=>setShowAI(true)}/>
      : mob
        ? <div className="mob-card-list">{offertes.map(o=>(
            <div className="mob-card" key={o.id} onClick={()=>setMobDetail(o)}>
              <div className="mob-card-top">
                <div className="mob-card-name">{o.klant}</div>
                <Badge status={o.status}/>
              </div>
              <div className="mob-card-amount">{o.bedrag}</div>
              <div className="mob-card-sub">{o.dienst} · {o.datum}</div>
              <span className="mob-card-chevron">›</span>
            </div>
          ))}</div>
        : <div className="card"><div className="tw"><table><thead><tr>{["Klant","Dienst","Bedrag","Status","Datum","Acties"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{offertes.map(o=><tr key={o.id}><td style={{fontWeight:700,color:"#111"}}>{o.klant}</td><td>{o.dienst}</td><td style={{fontWeight:700,color:"#111"}}>{o.bedrag}</td><td><Badge status={o.status}/></td><td style={{color:"#888"}}>{o.datum}</td>
              <td style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><button className="btn btn-ghost btn-sm" onClick={()=>exportOfferPdf(o)}>PDF</button>
              {o.portal_token&&<button className="btn btn-ghost btn-sm" title="Stuur portaallink naar klant" onClick={async()=>{
                const url=`https://app.werkmate.tech/portal/${o.portal_token}`;
                const k=(klanten||[]).find(x=>x.naam===o.klant);
                const email=k?.email||"";
                if(!email){alert("Geen e-mailadres bekend");return;}
                const {data:{session:s}}=await supabase.auth.getSession();
                await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${s?.access_token}`},body:JSON.stringify({action:"send-portal-link",klant_email:email,klant_naam:o.klant,portal_url:url,company_name:bedrijf?.bedrijfsnaam||"WerkMate",bedrag:o.bedrag})});
                await supabase.from("offertes").update({status:"Verstuurd"}).eq("id",o.id); refresh();
                alert("Verstuurd naar "+email);
              }}>📤</button>}
              {o.portal_token&&<button className="btn btn-ghost btn-sm" title="WhatsApp" onClick={()=>waOfferte(o,klanten,bedrijf)}>📱</button>}
              <select value={o.status} onChange={async(e)=>{await supabase.from("offertes").update({status:e.target.value}).eq("id",o.id);refresh();}} style={{border:"1.5px solid #E5E7EB",borderRadius:7,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
                {["In afwachting","Verstuurd","Ondertekend","Afgewezen"].map(s=><option key={s}>{s}</option>)}
              </select><button className="btn btn-danger btn-sm" onClick={()=>{ if(window.confirm("Offerte verwijderen?")) { supabase.from("offertes").delete().eq("id",o.id).then(()=>refresh()); } }}>✕</button></td>
            </tr>)}</tbody>
          </table></div></div>
    }
  </div>);
}

// ── Prijslijst ────────────────────────────────────────────────
function PrijslijstTab({ initialItems, onSaveItems }) {
  const [items,setItems]=useState(initialItems || []);
  const [saved,setSaved]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [nieuw,setNieuw]=useState({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});
  const fileInputRef = useRef(null);

  useEffect(() => {
    setItems(initialItems || []);
  }, [initialItems]);
  const upd=(id,f,v)=>setItems(p=>p.map(x=>x.id===id?{...x,[f]:v}:x));
  const del=(id)=>setItems(p=>p.filter(x=>x.id!==id));
  const save=()=>{
    onSaveItems?.(items);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };
  const add=()=>{if(!nieuw.dienst||!nieuw.prijs)return;setItems(p=>[...p,{...nieuw,id:Date.now(),prijs:parseFloat(nieuw.prijs)}]);setNieuw({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});setShowAdd(false);};
  const cats=[...new Set(items.map(i=>i.categorie))];

  const parsePrice = (value) => {
    const parsed = parseFloat(String(value || "").toString().replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const imported = rows.map((row, index) => {
      const dienst = String(row.dienst || row.Dienst || row.service || row.Service || "").trim();
      if (!dienst) return null;
      return {
        id: Date.now() + index,
        dienst,
        prijs: parsePrice(row.prijs || row.Prijs || row.price || row.Price),
        eenheid: String(row.eenheid || row.Eenheid || row.unit || row.Unit || "uur").trim() || "uur",
        categorie: "Overig",
      };
    }).filter(Boolean);
    if (imported.length > 0) {
      setItems((current) => [...current, ...imported]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    event.target.value = "";
  };
  return(<div>
    <div className="ph"><div><div className="pg-title">Prijslijst</div><div className="pg-sub">Jouw tarieven — de slimme generator gebruikt deze als basis</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><button className="btn btn-outline" onClick={()=>setShowAdd(true)}>+ Dienst</button><button className="btn btn-outline" onClick={()=>fileInputRef.current?.click()}>Excel importeren</button><button className="btn btn-dark" onClick={save}>{saved?"✓ Opgeslagen!":"Opslaan"}</button><input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{display:"none"}} onChange={importFile} /></div></div>
    <div className="card cp">
      <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:9,padding:"10px 13px",marginBottom:18,fontSize:12.5,color:"#4338CA"}}>💡 De slimme offerte generator gebruikt jouw tarieven automatisch als basis.</div>
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
function PlanningTab({ userId, planning, refresh, klanten, teamMembers, planningCats }) {
  const mob = useMobile();
  const td=new Date();
  const todayStr=`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
  const [view,setView]=useState("month");
  const [mobDayCursor,setMobDayCursor]=useState(new Date());
  const [cursor,setCursor]=useState(new Date());
  const [showAdd,setShowAdd]=useState(false);
  const [showCats,setShowCats]=useState(false);
  const [saveErr,setSaveErr]=useState("");
  const [filterMedewerker,setFilterMedewerker]=useState(null);
  const [nieuw,setNieuw]=useState({datum:todayStr,tijd:"08:00",eindtijd:"",klant:"",adres:"",dienst:"",status:"Ingepland",herhaal:"",categorie:"",medewerker:""});
  const [newCat,setNewCat]=useState({naam:"",kleur:"#6366F1"});
  const DAYS=["Ma","Di","Wo","Do","Vr","Za","Zo"];
  const MONTHS=["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];
  const MC=["#6366F1","#8B5CF6","#EC4899","#14B8A6","#F59E0B","#10B981","#3B82F6","#EF4444"];
  const fmtDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const memberColor=email=>MC[email.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%MC.length];
  const initials=email=>email.split("@")[0].slice(0,2).toUpperCase();
  const catColor=t=>planningCats.find(c=>c.naam===t.categorie)?.kleur||null;
  const tasksFor=ds=>planning.filter(p=>p.datum===ds&&(!filterMedewerker||p.medewerker===filterMedewerker)).sort((a,b)=>a.tijd>b.tijd?1:-1);
  const WG_SLOT_H=40,WG_START=7,WG_END=20,WG_SLOTS=(WG_END-WG_START)*2,WG_TOTAL_H=WG_SLOTS*WG_SLOT_H;
  const wgTop=tijd=>{const[h,m]=(tijd||"07:00").split(":").map(Number);return Math.max(0,Math.min(WG_TOTAL_H-WG_SLOT_H,((h-WG_START)*60+m)/30*WG_SLOT_H));};
  const wgH=(s,e)=>{if(!e)return WG_SLOT_H*2;const[sh,sm]=(s||"07:00").split(":").map(Number);const[eh,em]=(e||"08:00").split(":").map(Number);return Math.max(WG_SLOT_H,((eh*60+em)-(sh*60+sm))/30*WG_SLOT_H);};
  const openAdd=ds=>{setSaveErr("");setNieuw({datum:ds,tijd:"08:00",eindtijd:"",klant:"",adres:"",dienst:"",status:"Ingepland",herhaal:"",categorie:"",medewerker:""});setShowAdd(true);};

  // Dutch public holidays via Meeus/Jones/Butcher Easter algorithm
  const easterDate=yr=>{
    const a=yr%19,b=Math.floor(yr/100),c=yr%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),dy=((h+l-7*m+114)%31)+1;
    return new Date(yr,mo-1,dy);
  };
  const getHolidays=yr=>{
    const e=easterDate(yr);const ad=(d,n)=>{const r=new Date(d);r.setDate(d.getDate()+n);return r;};
    const kd=new Date(yr,3,27).getDay()===0?new Date(yr,3,26):new Date(yr,3,27);
    const h={};[[new Date(yr,0,1),"Nieuwjaarsdag"],[ad(e,-2),"Goede Vrijdag"],[e,"1e Paasdag"],[ad(e,1),"2e Paasdag"],[kd,"Koningsdag"],[new Date(yr,4,5),"Bevrijdingsdag"],[ad(e,39),"Hemelvaartsdag"],[ad(e,49),"1e Pinksterdag"],[ad(e,50),"2e Pinksterdag"],[new Date(yr,11,25),"1e Kerstdag"],[new Date(yr,11,26),"2e Kerstdag"]].forEach(([d,n])=>h[fmtDate(d)]=n);
    return h;
  };

  const add=async()=>{
    if(!nieuw.klant||!nieuw.dienst)return;
    setSaveErr("");
    const base=new Date(nieuw.datum+"T00:00:00");
    const count=nieuw.herhaal==="daily"?365:nieuw.herhaal==="weekly"?52:nieuw.herhaal==="biweekly"?26:nieuw.herhaal==="monthly"?12:1;
    const rows=Array.from({length:count},(_,i)=>{
      const d=new Date(base);
      if(nieuw.herhaal==="daily")d.setDate(base.getDate()+i);
      else if(nieuw.herhaal==="weekly")d.setDate(base.getDate()+i*7);
      else if(nieuw.herhaal==="biweekly")d.setDate(base.getDate()+i*14);
      else if(nieuw.herhaal==="monthly")d.setMonth(base.getMonth()+i);
      return{datum:fmtDate(d),tijd:nieuw.tijd,eindtijd:nieuw.eindtijd||null,klant:nieuw.klant,adres:nieuw.adres,dienst:nieuw.dienst,status:nieuw.status,herhaal:nieuw.herhaal||null,categorie:nieuw.categorie||null,medewerker:nieuw.medewerker||null,user_id:userId};
    });
    const{error}=await supabase.from("planning").insert(rows);
    if(error){setSaveErr(error.message);return;}
    setNieuw({datum:todayStr,tijd:"08:00",eindtijd:"",klant:"",adres:"",dienst:"",status:"Ingepland",herhaal:"",categorie:"",medewerker:""});
    setShowAdd(false);refresh();
  };

  const addCat=async()=>{
    if(!newCat.naam.trim())return;
    const {error}=await supabase.from("planning_categorieen").insert({naam:newCat.naam.trim(),kleur:newCat.kleur,user_id:userId});
    if(!error){setNewCat({naam:"",kleur:"#6366F1"});refresh();}
  };
  const deleteCat=async id=>{
    if(!window.confirm("Categorie verwijderen?"))return;
    const {error}=await supabase.from("planning_categorieen").delete().eq("id",id);
    if(!error)refresh();
  };

  const markDone=async(e,id,cur)=>{
    e.stopPropagation();
    await supabase.from("planning").update({status:cur==="Klaar"?"Ingepland":"Klaar"}).eq("id",id);
    refresh();
  };
  const verwijder=async id=>{await supabase.from("planning").delete().eq("id",id);refresh();};
  const verwijderHerhaling=async t=>{
    if(!t.herhaal)return;
    if(!window.confirm(`Alle herhalingen van "${t.dienst}" (${t.klant}) verwijderen?`))return;
    await supabase.from("planning").delete().eq("user_id",userId).eq("klant",t.klant).eq("dienst",t.dienst).eq("tijd",t.tijd).eq("herhaal",t.herhaal);
    refresh();
  };

  const prev=()=>view==="month"?setCursor(c=>new Date(c.getFullYear(),c.getMonth()-1,1)):setCursor(c=>{const n=new Date(c);n.setDate(c.getDate()-7);return n;});
  const next=()=>view==="month"?setCursor(c=>new Date(c.getFullYear(),c.getMonth()+1,1)):setCursor(c=>{const n=new Date(c);n.setDate(c.getDate()+7);return n;});
  const yr=cursor.getFullYear(),mo=cursor.getMonth();
  const mon=new Date(cursor);mon.setDate(cursor.getDate()-(cursor.getDay()+6)%7);
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const navTitle=view==="month"?`${MONTHS[mo]} ${yr}`:`${mon.getDate()} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
  const holidays=Object.assign({},getHolidays(yr),mo===0?getHolidays(yr-1):{},mo===11?getHolidays(yr+1):{});
  const tc=s=>`cal-task${s==="Onderweg"?" onderweg":s==="Klaar"?" klaar":""}`;
  const offset=(new Date(yr,mo,1).getDay()+6)%7;
  const cells=[...Array(offset).fill(null),...Array.from({length:new Date(yr,mo+1,0).getDate()},(_,i)=>i+1)];
  while(cells.length%7)cells.push(null);

  const mobDayStr = `${mobDayCursor.getFullYear()}-${String(mobDayCursor.getMonth()+1).padStart(2,'0')}-${String(mobDayCursor.getDate()).padStart(2,'0')}`;
  const mobDayTasks = planning.filter(p=>p.datum===mobDayStr).sort((a,b)=>a.tijd>b.tijd?1:-1);
  const mobPrevDay = () => { const d=new Date(mobDayCursor); d.setDate(d.getDate()-1); setMobDayCursor(d); };
  const mobNextDay = () => { const d=new Date(mobDayCursor); d.setDate(d.getDate()+1); setMobDayCursor(d); };
  const mobDayLabel = mobDayCursor.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"});
  const mobIsToday = mobDayStr === todayStr;
  const HOURS = Array.from({length:14},(_,i)=>i+7); // 7:00–20:00

  return(<div>
    <div className="ph">
      <div><div className="pg-title">Planning</div><div className="pg-sub">{planning.length} opdrachten totaal</div></div>
      <div style={{display:"flex",gap:8}}>
        {!mob&&<div className="cal-view-toggle">
          <button className={`cal-vt-btn${view==="month"?" on":""}`} onClick={()=>setView("month")}>Maand</button>
          <button className={`cal-vt-btn${view==="week"?" on":""}`} onClick={()=>setView("week")}>Week</button>
        </div>}
        {!mob&&<button className="btn btn-ghost" onClick={()=>setShowCats(true)} title="Categorieën beheren">🏷️</button>}
        <button className="btn btn-dark" onClick={()=>openAdd(mob?mobDayStr:todayStr)}>+ Opdracht</button>
      </div>
    </div>
    {mob
      ? <>
          <div className="mob-day-wrap" style={{marginBottom:12}}>
            <div className="mob-day-hdr">
              <button className="mob-day-nav-btn" onClick={mobPrevDay}>‹</button>
              <div className="mob-day-center">
                <div className="mob-day-title" style={{textTransform:"capitalize"}}>{mobDayLabel}</div>
                {mobIsToday&&<div style={{fontSize:10,fontWeight:700,color:"#6366F1",textTransform:"uppercase",letterSpacing:".4px",marginTop:2}}>Vandaag</div>}
              </div>
              <button className="mob-day-nav-btn" onClick={mobNextDay}>›</button>
            </div>
            <div className="mob-day-hours">
              {HOURS.map(h=>{
                const hStr=`${String(h).padStart(2,'0')}:`;
                const slotTasks=mobDayTasks.filter(t=>t.tijd&&t.tijd.startsWith(hStr));
                return(
                  <div key={h} className="mob-day-row">
                    <div className="mob-day-timecol">{h}:00</div>
                    <div className="mob-day-slotcol">
                      {slotTasks.map(t=>{
                        const cc=planningCats.find(c=>c.naam===t.categorie)?.kleur;
                        const bg=t.status==="Klaar"?"#F3F4F6":t.status==="Onderweg"?"#FEF3C7":cc?(cc+"22"):"#EEF2FF";
                        const tc=t.status==="Klaar"?"#9CA3AF":t.status==="Onderweg"?"#92400E":cc||"#4338CA";
                        return(
                          <div key={t.id} className={`mob-day-ev${t.status==="Klaar"?" klaar":""}`} style={{background:bg}}>
                            <div className="mob-day-ev-time" style={{color:tc}}>{t.tijd}{t.eindtijd?`–${t.eindtijd}`:""}</div>
                            <div className="mob-day-ev-name">{t.klant}</div>
                            <div className="mob-day-ev-dienst">{t.dienst}</div>
                            {t.adres&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.adres)}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:3,marginTop:4,fontSize:11.5,fontWeight:600,color:"#6366F1",textDecoration:"none"}}>📍 Navigeer</a>}
                            <div style={{display:"flex",gap:6,marginTop:8}}>
                              <button className="btn btn-outline btn-sm" style={{flex:1,fontSize:12}} onClick={e=>markDone(e,t.id,t.status)}>{t.status==="Klaar"?"↩ Open":"✓ Klaar"}</button>
                              <button className="btn btn-danger btn-sm" style={{fontSize:12}} onClick={e=>{e.stopPropagation();if(window.confirm("Verwijderen?"))verwijder(t.id);}}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {mobDayTasks.length===0&&<div className="mob-day-empty">Geen opdrachten · tik <strong>+ Opdracht</strong> om toe te voegen</div>}
            </div>
          </div>
        </>
      : <div className="cal-wrap">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prev}>‹</button>
        <span className="cal-title">{navTitle}</span>
        <button className="cal-nav-btn" onClick={next}>›</button>
      </div>
      {teamMembers.length>0&&<div className="cal-filter-bar">
        <span className="cal-filter-lbl">Team</span>
        <button className={`cal-fp${!filterMedewerker?" on":""}`} onClick={()=>setFilterMedewerker(null)}>Iedereen</button>
        {teamMembers.map(m=><button key={m.id} className={`cal-fp${filterMedewerker===m.email?" on":""}`} onClick={()=>setFilterMedewerker(filterMedewerker===m.email?null:m.email)}>
          <span className="cal-fp-av" style={{background:memberColor(m.email)}}>{initials(m.email)}</span>
          {m.email.split("@")[0]}
        </button>)}
      </div>}
      {view==="month"?(<>
        <div className="cal-dow">{DAYS.map(d=><div key={d} className="cal-dow-cell">{d}</div>)}</div>
        <div className="cal-grid">{cells.map((day,i)=>{
          if(!day)return<div key={i} className="cal-day empty"/>;
          const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const tasks=tasksFor(ds);const holiday=holidays[ds];
          return<div key={i} className={`cal-day${ds===todayStr?" today":""}${holiday?" feestdag":""}`} onClick={()=>openAdd(ds)}>
            <div className="cal-dn">{day}</div>
            {holiday&&<div className="cal-feestdag">{holiday}</div>}
            {tasks.slice(0,2).map(t=>{
              const cc=catColor(t);
              return<div key={t.id} className={tc(t.status)} style={{...(cc&&t.status!=="Klaar"?{background:cc+"22",color:cc}:{}),display:"flex",alignItems:"center",justifyContent:"space-between",gap:2}} onClick={e=>markDone(e,t.id,t.status)}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.status==="Klaar"?"✓ ":"· "}{t.tijd} {t.klant}</span>
                {t.adres&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.adres)}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{flexShrink:0,fontSize:10,textDecoration:"none"}} title={t.adres}>📍</a>}
              </div>;
            })}
            {tasks.length>2&&<div className="cal-more">+{tasks.length-2} meer</div>}
          </div>;
        })}</div>
      </>):(<div className="cal-wg-outer">
        <div className="cal-wg-hdr-row">
          <div className="cal-wg-hdr-spc"/>
          {Array.from({length:7},(_,i)=>{
            const d=new Date(mon);d.setDate(mon.getDate()+i);
            const ds=fmtDate(d);const isToday=ds===todayStr;const holiday=holidays[ds];
            return<div key={i} className={`cal-week-hdr cal-wg-hdr-cell${isToday?" today":""}${holiday?" feestdag":""}`} onClick={()=>openAdd(ds)}>
              <div className="cal-week-day">{DAYS[i]}</div>
              <div className="cal-week-dn">{d.getDate()}</div>
              {holiday&&<div className="cal-week-feestdag">{holiday}</div>}
            </div>;
          })}
        </div>
        <div className="cal-wg-body-row">
          <div className="cal-wg-tc">
            {Array.from({length:WG_SLOTS},(_,i)=>{
              const isHour=i%2===0;const h=WG_START+Math.floor(i/2);
              return<div key={i} className="cal-wg-tl">{isHour&&<span style={{fontSize:9,fontWeight:700,color:"#94A3B8",lineHeight:1}}>{String(h).padStart(2,"0")}:00</span>}</div>;
            })}
          </div>
          {Array.from({length:7},(_,i)=>{
            const d=new Date(mon);d.setDate(mon.getDate()+i);
            const ds=fmtDate(d);const tasks=tasksFor(ds);
            return<div key={i} className="cal-wg-dc">
              <div style={{position:"relative",height:WG_TOTAL_H}}>
                {Array.from({length:WG_SLOTS},(_,j)=>(
                  <div key={j} className="cal-wg-slot" style={{top:j*WG_SLOT_H,borderTop:j%2===0?"1px solid #E5E7EB":"1px dashed #F3F4F6"}}/>
                ))}
                {tasks.map(t=>{
                  const top=wgTop(t.tijd);const height=wgH(t.tijd,t.eindtijd);
                  const cc=catColor(t);
                  const blkStyle=cc&&t.status!=="Klaar"?{background:cc+"22",color:cc,borderLeft:`3px solid ${cc}`}:{};
                  return<div key={t.id} className={`cal-task-blk${t.status==="Onderweg"?" onderweg":t.status==="Klaar"?" klaar":""}`} style={{top,height,...blkStyle}}>
                    <div className="cal-tbk-time">{t.eindtijd?`${t.tijd}–${t.eindtijd}`:t.tijd}</div>
                    <div className={`cal-tbk-name${t.status==="Klaar"?" done":""}`}>{t.klant}</div>
                    {height>55&&<div className="cal-tbk-dienst">{t.dienst}</div>}
                    <div className="cal-tbk-actions">
                      <button style={{background:"none",border:"1px solid currentColor",borderRadius:3,padding:"1px 4px",fontSize:9,cursor:"pointer",color:"currentColor",fontFamily:"'DM Sans',sans-serif",lineHeight:1.4}} onClick={e=>markDone(e,t.id,t.status)}>{t.status==="Klaar"?"↩":"✓"}</button>
                      <button style={{background:"none",border:"1px solid currentColor",borderRadius:3,padding:"1px 4px",fontSize:9,cursor:"pointer",color:"currentColor",fontFamily:"'DM Sans',sans-serif",lineHeight:1.4}} onClick={e=>{e.stopPropagation();if(window.confirm("Verwijderen?"))verwijder(t.id);}}>&#x2715;</button>
                    </div>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>)}
    </div>}

    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Opdracht toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Starttijd</label><input className="inp" type="time" value={nieuw.tijd} onChange={e=>setNieuw({...nieuw,tijd:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Eindtijd</label><input className="inp" type="time" value={nieuw.eindtijd||""} onChange={e=>setNieuw({...nieuw,eindtijd:e.target.value})}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Ingepland","Onderweg","Klaar"].map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="ig"><label className="ilbl">Herhaling</label><select className="inp" value={nieuw.herhaal} onChange={e=>setNieuw({...nieuw,herhaal:e.target.value})}><option value="">Geen herhaling</option><option value="daily">Dagelijks (365×)</option><option value="weekly">Wekelijks (52×)</option><option value="biweekly">Elke 2 weken (26×)</option><option value="monthly">Maandelijks (12×)</option></select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig">
          <label className="ilbl">Categorie</label>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            {nieuw.categorie&&<span style={{width:14,height:14,borderRadius:"50%",background:catColor({categorie:nieuw.categorie})||"#E5E7EB",flexShrink:0,display:"inline-block"}}/>}
            <select className="inp" style={{flex:1}} value={nieuw.categorie} onChange={e=>setNieuw({...nieuw,categorie:e.target.value})}><option value="">Geen categorie</option>{planningCats.map(c=><option key={c.id} value={c.naam}>{c.naam}</option>)}</select>
          </div>
        </div>
        <div className="ig"><label className="ilbl">Medewerker</label><select className="inp" value={nieuw.medewerker} onChange={e=>setNieuw({...nieuw,medewerker:e.target.value})}><option value="">Niet toegewezen</option>{teamMembers.map(m=><option key={m.id} value={m.email}>{m.email.split("@")[0]}</option>)}</select></div>
      </div>
      <div className="ig"><label className="ilbl">Klant</label><select className="inp" value={nieuw.klant} onChange={e=>{const k=klanten.find(k=>k.naam===e.target.value);setNieuw({...nieuw,klant:e.target.value,adres:k?.adres||nieuw.adres})}}><option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
      <div className="ig"><label className="ilbl">Dienst</label><input className="inp" value={nieuw.dienst} onChange={e=>setNieuw({...nieuw,dienst:e.target.value})} placeholder="Wat ga je doen?"/></div>
      <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={nieuw.adres} onChange={e=>setNieuw({...nieuw,adres:e.target.value})} placeholder="Straat, Stad"/></div>
      {saveErr&&<div style={{color:"#991B1B",background:"#FEE2E2",borderRadius:7,padding:"8px 12px",fontSize:12,marginBottom:12}}>{saveErr}</div>}
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.klant||!nieuw.dienst}>{nieuw.herhaal?"Herhaling aanmaken":"Toevoegen"}</button></div>
    </div></div></div>}

    {showCats&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Categorieën</div><div className="ms">Kleurcodering voor taken in de kalender</div></div><button className="mc" onClick={()=>setShowCats(false)}>✕</button></div><div className="mb">
      {planningCats.length===0&&<div style={{color:"#94A3B8",fontSize:13,textAlign:"center",padding:"8px 0 16px"}}>Nog geen categorieën — voeg er hieronder een toe</div>}
      {planningCats.map(c=><div key={c.id} className="cat-row">
        <span className="cat-swatch" style={{background:c.kleur}}/>
        <span style={{flex:1,fontSize:13.5,fontWeight:600,color:"#111"}}>{c.naam}</span>
        <button className="btn btn-danger btn-sm" onClick={()=>deleteCat(c.id)}>✕</button>
      </div>)}
      <div style={{display:"flex",gap:8,marginTop:16,alignItems:"center"}}>
        <input type="color" value={newCat.kleur} onChange={e=>setNewCat({...newCat,kleur:e.target.value})} className="cat-inp-color" title="Kies kleur"/>
        <input className="inp" style={{flex:1}} value={newCat.naam} onChange={e=>setNewCat({...newCat,naam:e.target.value})} placeholder="Naam (bijv. Installatie, Onderhoud…)" onKeyDown={e=>e.key==="Enter"&&addCat()}/>
        <button className="btn btn-dark" onClick={addCat} disabled={!newCat.naam.trim()}>+ Toevoegen</button>
      </div>
    </div></div></div>}
  </div>);
}

// ── CRM ───────────────────────────────────────────────────────
function CRMTab({ userId, klanten, refresh }) {
  const mob = useMobile();
  const [mobDetail,setMobDetail]=useState(null);
  const [q,setQ]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [nieuw,setNieuw]=useState({naam:"",tel:"",email:"",adres:"",status:"Actief"});
  const [bewerkt,setBewerkt]=useState({naam:"",tel:"",email:"",adres:"",status:"Actief"});
  const [crmErr,setCrmErr]=useState("");
  const list=klanten.filter(k=>{const lq=q.toLowerCase();return(k.naam||"").toLowerCase().includes(lq)||(k.tel||"").toLowerCase().includes(lq)||(k.email||"").toLowerCase().includes(lq)||(k.adres||"").toLowerCase().includes(lq)||(k.status||"").toLowerCase().includes(lq);});

  const add = async () => {
    if(!nieuw.naam) return;
    setCrmErr("");
    const {error}=await supabase.from("klanten").insert({...nieuw, user_id:userId});
    if(error){setCrmErr(error.message||"Opslaan mislukt");return;}
    setNieuw({naam:"",tel:"",email:"",adres:"",status:"Actief"});
    setShowAdd(false);
    refresh();
  };

  const startEdit = (klant) => {
    setBewerkt({
      naam: klant.naam || "",
      tel: klant.tel || "",
      email: klant.email || "",
      adres: klant.adres || "",
      status: klant.status || "Actief",
    });
    setEditingId(klant.id);
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if(!bewerkt.naam || editingId == null) return;
    setCrmErr("");
    const {error}=await supabase.from("klanten").update({
      naam: bewerkt.naam,
      tel: bewerkt.tel,
      email: bewerkt.email,
      adres: bewerkt.adres,
      status: bewerkt.status,
    }).eq("id", editingId);
    if(error){setCrmErr(error.message||"Opslaan mislukt");return;}
    setShowEdit(false);
    setEditingId(null);
    refresh();
  };

  const verwijder = async (id) => {
    const {error}=await supabase.from("klanten").delete().eq("id",id);
    if(!error)refresh();
  };

  return(<div>
    {mob && mobDetail && (
      <MobDetailScreen title={mobDetail.naam} onBack={()=>setMobDetail(null)}>
        <div className="mob-det-section">
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
            <div className="av" style={{width:56,height:56,fontSize:22,flexShrink:0}}>{mobDetail.naam[0]}</div>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:"#0F0F14",fontFamily:"'Syne',sans-serif"}}>{mobDetail.naam}</div>
              <div style={{marginTop:4}}><Badge status={mobDetail.status}/></div>
            </div>
          </div>
          {mobDetail.tel&&<div className="mob-det-row"><span className="mob-det-lbl">Telefoon</span><a href={`tel:${mobDetail.tel}`} style={{color:"#6366F1",fontWeight:600,fontSize:13.5,textDecoration:"none"}}>{mobDetail.tel}</a></div>}
          {mobDetail.email&&<div className="mob-det-row"><span className="mob-det-lbl">E-mail</span><a href={`mailto:${mobDetail.email}`} style={{color:"#6366F1",fontWeight:600,fontSize:13.5,textDecoration:"none"}}>{mobDetail.email}</a></div>}
          {mobDetail.adres&&<div className="mob-det-row"><span className="mob-det-lbl">Adres</span><span className="mob-det-val">{mobDetail.adres}</span></div>}
        </div>
        {mobDetail.tel&&<a href={`tel:${mobDetail.tel}`} className="mob-det-action-btn" style={{textDecoration:"none"}}><span className="mob-det-action-ic">📞</span>Bellen</a>}
        {mobDetail.email&&<a href={`mailto:${mobDetail.email}`} className="mob-det-action-btn" style={{textDecoration:"none"}}><span className="mob-det-action-ic">✉️</span>E-mailen</a>}
        <button className="mob-det-action-btn" onClick={()=>{setMobDetail(null);startEdit(mobDetail);}}><span className="mob-det-action-ic">✎</span>Bewerken</button>
        <button className="mob-det-action-btn danger" onClick={()=>{if(window.confirm("Klant verwijderen?")){verwijder(mobDetail.id);setMobDetail(null);}}}><span className="mob-det-action-ic">🗑</span>Verwijderen</button>
      </MobDetailScreen>
    )}
    <div className="ph"><div><div className="pg-title">Klantenbeheer</div><div className="pg-sub">{klanten.length} klanten</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Klant</button></div>
    <input className="inp" style={{marginBottom:14}} placeholder="🔍  Zoek op naam, telefoon, e-mail, adres…" value={q} onChange={e=>setQ(e.target.value)}/>
    {klanten.length===0
      ? <LeegScherm icon="👥" titel="Nog geen klanten" sub="Voeg je eerste klant toe" actie="+ Klant toevoegen" onActie={()=>setShowAdd(true)}/>
      : mob
        ? <div className="mob-card-list">{list.map(k=>(
            <div className="mob-card" key={k.id} onClick={()=>setMobDetail(k)}>
              <div className="mob-card-top">
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div className="av" style={{width:36,height:36,fontSize:14,flexShrink:0}}>{k.naam[0]}</div>
                  <div className="mob-card-name">{k.naam}</div>
                </div>
                <Badge status={k.status}/>
              </div>
              {(k.tel||k.email)&&<div className="mob-card-sub" style={{marginTop:6}}>{k.tel}{k.tel&&k.email?" · ":""}{k.email}</div>}
              <span className="mob-card-chevron">›</span>
            </div>
          ))}</div>
        : <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {list.map(k=><div className="pc" key={k.id}><div className="av">{k.naam[0]}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:15}}>{k.naam}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{k.tel}{k.tel&&k.email?" · ":""}{k.email}</div></div><Badge status={k.status}/><button className="btn btn-outline btn-sm" onClick={()=>startEdit(k)}>✎</button><button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Klant verwijderen?"))verwijder(k.id);}}>✕</button></div>)}
          </div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Klant toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Naam</label><input className="inp" value={nieuw.naam} onChange={e=>setNieuw({...nieuw,naam:e.target.value})} placeholder="Bedrijf of naam"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={nieuw.tel} onChange={e=>setNieuw({...nieuw,tel:e.target.value})} placeholder="06-12345678"/></div>
        <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={nieuw.email} onChange={e=>setNieuw({...nieuw,email:e.target.value})} placeholder="klant@email.nl"/></div><div className="ig"><label className="ilbl">Adres</label><input className="inp" value={nieuw.adres} onChange={e=>setNieuw({...nieuw,adres:e.target.value})} placeholder="Straat 1, Amsterdam"/></div>
      </div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Actief","Potentiële klant","Geïnteresseerd","Offerte verstuurd","Vaste klant","Inactief","Verloren"].map(s=><option key={s}>{s}</option>)}</select></div>
      {crmErr&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8,padding:"8px 12px",background:"#FEE2E2",borderRadius:6}}>{crmErr}</div>}
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setCrmErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.naam}>Toevoegen</button></div>
    </div></div></div>}
    {showEdit&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Klant bewerken</div></div><button className="mc" onClick={()=>setShowEdit(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Naam</label><input className="inp" value={bewerkt.naam} onChange={e=>setBewerkt({...bewerkt,naam:e.target.value})} placeholder="Bedrijf of naam"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={bewerkt.tel} onChange={e=>setBewerkt({...bewerkt,tel:e.target.value})} placeholder="06-12345678"/></div>
        <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={bewerkt.email} onChange={e=>setBewerkt({...bewerkt,email:e.target.value})} placeholder="klant@email.nl"/></div><div className="ig"><label className="ilbl">Adres</label><input className="inp" value={bewerkt.adres} onChange={e=>setBewerkt({...bewerkt,adres:e.target.value})} placeholder="Straat 1, Amsterdam"/></div>
      </div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={bewerkt.status} onChange={e=>setBewerkt({...bewerkt,status:e.target.value})}>{["Actief","Potentiële klant","Geïnteresseerd","Offerte verstuurd","Vaste klant","Inactief","Verloren"].map(s=><option key={s}>{s}</option>)}</select></div>
      {crmErr&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8,padding:"8px 12px",background:"#FEE2E2",borderRadius:6}}>{crmErr}</div>}
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowEdit(false);setCrmErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={saveEdit} disabled={!bewerkt.naam}>Opslaan</button></div>
    </div></div></div>}
  </div>);
}

function WerkbonnenTab({ userId, klanten, werkbonnen, refresh, bedrijf, emailSettings }) {
  const mob = useMobile();
  const [mobDetail,setMobDetail]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [lightboxFoto,setLightboxFoto]=useState(null);
  const originalStatusRef = useRef("Nieuw");
  const [nieuw,setNieuw]=useState({klant:"",datum:localToday(),omschrijving:"",foto:"",uren:"",materialen:"",status:"Nieuw",handtekening:""});
  const [bewerkt,setBewerkt]=useState({klant:"",datum:localToday(),omschrijving:"",foto:"",uren:"",materialen:"",status:"Nieuw",handtekening:""});
  const [fotoPreview,setFotoPreview]=useState("");
  const [editFotoPreview,setEditFotoPreview]=useState("");
  const [saving,setSaving]=useState(false);
  const [editSaving,setEditSaving]=useState(false);
  const [error,setError]=useState("");
  const [editError,setEditError]=useState("");

  const handleFotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setNieuw(prev=>({ ...prev, foto: dataUrl }));
      setFotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleEditFotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setBewerkt(prev=>({ ...prev, foto: dataUrl }));
      setEditFotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const add = async () => {
    if (!nieuw.klant || !nieuw.datum) {
      setError("Klant en datum zijn verplicht.");
      return;
    }
    setSaving(true);
    setError("");
    const { error } = await supabase.from("werkbonnen").insert({
      user_id: userId,
      klant: nieuw.klant,
      datum: nieuw.datum,
      omschrijving: nieuw.omschrijving || "",
      foto: nieuw.foto || "",
      uren: nieuw.uren ? parseFloat(nieuw.uren) : 0,
      materialen: nieuw.materialen || "",
      status: nieuw.status,
      handtekening: nieuw.handtekening || null,
    }).select();
    if (error) {
      console.error("Werkbon toevoegen mislukt", error);
      setError(error.message || "Opslaan mislukt");
      setSaving(false);
      return;
    }
    setNieuw({klant:"",datum:localToday(),omschrijving:"",foto:"",uren:"",materialen:"",status:"Nieuw",handtekening:""});
    setFotoPreview("");
    setShowAdd(false);
    if (typeof refresh === "function") await refresh();
    setSaving(false);
  };

  const startEdit = (werkbon) => {
    setEditingId(werkbon.id);
    originalStatusRef.current = werkbon.status || "Nieuw";
    setBewerkt({
      klant: werkbon.klant || "",
      datum: werkbon.datum ? werkbon.datum.slice(0,10) : localToday(),
      omschrijving: werkbon.omschrijving || "",
      foto: werkbon.foto || "",
      uren: werkbon.uren != null ? String(werkbon.uren) : "",
      materialen: werkbon.materialen || "",
      status: werkbon.status || "Nieuw",
      handtekening: werkbon.handtekening || "",
    });
    setEditFotoPreview(werkbon.foto || "");
    setEditError("");
    setShowEdit(true);
  };

  const sendReviewRequestEmail = async (clientEmail, serviceDescription) => {
    if (!clientEmail) {
      console.warn("sendReviewRequestEmail: no client email available");
      return null;
    }
    const payload = {
      action: "send-review-request-email",
      customer_email: clientEmail,
      company_name: bedrijf?.bedrijfsnaam || "WerkMate",
      service_description: serviceDescription || "jouw opdracht",
      ...(bedrijf?.email ? { reply_to: bedrijf.email } : {}),
    };
    const { data: { session: reviewSess } } = await supabase.auth.getSession();
    const reviewToken = reviewSess?.access_token || import.meta.env.VITE_SUPABASE_KEY;
    const response = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${reviewToken}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    await logEmail(userId, clientEmail, `Review verzoek — ${serviceDescription || "opdracht"}`, "review", `Review verzoek voor ${serviceDescription || "opdracht"}`, response.ok ? "verzonden" : "mislukt");
    return { status: response.status, data };
  };

  const saveEdit = async () => {
    if (!bewerkt.klant || !bewerkt.datum) {
      setEditError("Klant en datum zijn verplicht.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    const oldStatus = String(originalStatusRef.current || "").trim();
    const newStatus = String(bewerkt.status || "").trim();
    const shouldSendReview = oldStatus !== "Afgerond" && newStatus === "Afgerond";
    const znaleClient = klanten?.find(k => k.naam.toLowerCase() === (bewerkt.klant||"").toLowerCase());
    const clientEmail = znaleClient?.email || "";
    const { error } = await supabase.from("werkbonnen").update({
      klant: bewerkt.klant,
      datum: bewerkt.datum,
      omschrijving: bewerkt.omschrijving,
      foto: bewerkt.foto,
      uren: bewerkt.uren ? parseFloat(bewerkt.uren) : 0,
      materialen: bewerkt.materialen,
      status: bewerkt.status,
      handtekening: bewerkt.handtekening || null,
    }).eq("id", editingId);
    if (error) {
      console.error("Werkbon update mislukt", error);
      setEditError(error.message || "Opslaan mislukt");
      setEditSaving(false);
      return;
    }
    if (shouldSendReview) {
      if (!clientEmail) {
        setEditError("Werkbon afgerond, maar er is geen e-mailadres bekend voor deze klant — review e-mail niet verzonden.");
      } else if (emailSettings?.auto_review_email === false) {
        // automatic review email disabled in Instellingen
      } else {
        await sendReviewRequestEmail(clientEmail, bewerkt.omschrijving);
      }
    }
    setShowEdit(false);
    setEditingId(null);
    setEditFotoPreview("");
    if (typeof refresh === "function") await refresh();
    setEditSaving(false);
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Werkbonnen</div><div className="pg-sub">Maak werkbonnen voor klant, uren, materialen en foto</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Werkbon</button></div>
    {mob && mobDetail && (
      <MobDetailScreen title={mobDetail.klant} onBack={()=>setMobDetail(null)}>
        <div className="mob-det-section">
          <div style={{marginBottom:10}}><Badge status={mobDetail.status||"Nieuw"}/></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Klant</span><span className="mob-det-val">{mobDetail.klant}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Datum</span><span className="mob-det-val">{mobDetail.datum||"—"}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Uren</span><span className="mob-det-val">{mobDetail.uren||"—"}</span></div>
          {mobDetail.omschrijving&&<div className="mob-det-row"><span className="mob-det-lbl">Omschrijving</span><span className="mob-det-val">{mobDetail.omschrijving}</span></div>}
          {mobDetail.materialen&&<div className="mob-det-row"><span className="mob-det-lbl">Materialen</span><span className="mob-det-val">{mobDetail.materialen}</span></div>}
        </div>
        {mobDetail.foto&&<div className="mob-det-section" style={{padding:0,overflow:"hidden"}}>
          <img src={mobDetail.foto} alt="Werkbon foto" style={{width:"100%",maxHeight:240,objectFit:"cover"}}/>
        </div>}
        {mobDetail.handtekening&&<div className="mob-det-section">
          <div style={{fontSize:13,color:"#64748B",fontWeight:600,marginBottom:8}}>Handtekening klant</div>
          <img src={mobDetail.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB"}}/>
        </div>}
        <button className="mob-det-action-btn" onClick={()=>{setMobDetail(null);startEdit(mobDetail);}}><span className="mob-det-action-ic">✎</span>Werkbon bewerken</button>
        <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Werkbon verwijderen?")) { supabase.from("werkbonnen").delete().eq("id",mobDetail.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic">🗑</span>Verwijderen</button>
      </MobDetailScreen>
    )}
    {werkbonnen.length===0
      ? <LeegScherm icon="🔧" titel="Nog geen werkbonnen" sub="Maak je eerste werkbon aan" actie="+ Werkbon toevoegen" onActie={()=>setShowAdd(true)}/>
      : mob
        ? <div className="mob-card-list">{werkbonnen.map(b=>(
            <div className="mob-card" key={b.id} onClick={()=>setMobDetail(b)}>
              <div className="mob-card-top">
                <div className="mob-card-name">{b.klant}</div>
                <Badge status={b.status||"Nieuw"}/>
              </div>
              <div className="mob-card-sub">{b.datum} {b.uren ? `· ${b.uren} uur` : ""}</div>
              {b.omschrijving&&<div className="mob-card-sub" style={{marginTop:2,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.omschrijving}</div>}
              <span className="mob-card-chevron">›</span>
            </div>
          ))}</div>
        : <div className="card"><div className="tw"><table><thead><tr>{["Klant","Datum","Uren","Status","Materialen","Foto","Acties"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{werkbonnen.map(b=><tr key={b.id}><td style={{fontWeight:700,color:"#111"}}>{b.klant}<div style={{fontSize:13,color:"#555",marginTop:4}}>{b.omschrijving}</div></td><td style={{color:"#888"}}>{b.datum}</td><td style={{fontWeight:700,color:"#111"}}>{b.uren||"-"}</td><td><Badge status={b.status||"Nieuw"}/></td><td style={{color:"#555"}}>{b.materialen||"-"}</td><td>{b.foto ? <img src={b.foto} alt="Werkbon foto" style={{width:80,height:60,objectFit:"cover",borderRadius:10,cursor:"pointer"}} onClick={()=>setLightboxFoto(b.foto)}/> : "-"}</td><td style={{display:"flex",gap:6,alignItems:"center"}}><button type="button" className="btn btn-outline btn-sm" onClick={()=>startEdit(b)}>✎</button><button type="button" className="btn btn-danger btn-sm" onClick={()=>{ if(window.confirm("Werkbon verwijderen?")) { supabase.from("werkbonnen").delete().eq("id",b.id).then(()=>refresh()); } }}>✕</button></td></tr>)}</tbody>
          </table></div></div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Werkbon toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Klant</label><select className="inp" value={nieuw.klant} onChange={e=>setNieuw({...nieuw,klant:e.target.value})}><option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})} /></div>
        <div className="ig"><label className="ilbl">Uren</label><input className="inp" type="number" value={nieuw.uren} onChange={e=>setNieuw({...nieuw,uren:e.target.value})} placeholder="0"/></div>
      </div>
      <div className="ig"><label className="ilbl">Omschrijving</label><textarea className="inp" style={{minHeight:100}} value={nieuw.omschrijving} onChange={e=>setNieuw({...nieuw,omschrijving:e.target.value})} placeholder="Wat is er gedaan?"/></div>
      <div className="ig"><label className="ilbl">Materialen</label><textarea className="inp" style={{minHeight:60}} value={nieuw.materialen} onChange={e=>setNieuw({...nieuw,materialen:e.target.value})} placeholder="Gewerkte materialen"/></div>
      <div className="ig"><label className="ilbl">Foto</label><input className="inp" type="file" accept="image/*" capture="environment" onChange={handleFotoChange}/>{fotoPreview&&<img src={fotoPreview} alt="Voorbeeld" style={{marginTop:10,width:120,height:90,objectFit:"cover",borderRadius:10}}/>}</div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Nieuw","Bezig","Klaar","Ondertekend","Afgerond"].map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="ig"><label className="ilbl">Handtekening klant (optioneel)</label>
        {nieuw.handtekening?<div><img src={nieuw.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB",marginBottom:8}}/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setNieuw({...nieuw,handtekening:""})}>Wissen</button></div>:<SignatureCanvas onSave={sig=>setNieuw({...nieuw,handtekening:sig})}/>}
      </div>
      {error && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",gap:9}}><button type="button" className="btn btn-ghost" onClick={()=>{setShowAdd(false);setError("");}}>Annuleren</button><button type="button" className="btn btn-dark btn-full" onClick={add} disabled={saving||!nieuw.klant||!nieuw.datum}>{saving?"Opslaan…":"Opslaan"}</button></div>
    </div></div></div>}
    {showEdit&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Werkbon bewerken</div></div><button className="mc" onClick={()=>setShowEdit(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">Klant</label><select className="inp" value={bewerkt.klant} onChange={e=>setBewerkt({...bewerkt,klant:e.target.value})}><option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={bewerkt.datum} onChange={e=>setBewerkt({...bewerkt,datum:e.target.value})} /></div>
        <div className="ig"><label className="ilbl">Uren</label><input className="inp" type="number" value={bewerkt.uren} onChange={e=>setBewerkt({...bewerkt,uren:e.target.value})} placeholder="0"/></div>
      </div>
      <div className="ig"><label className="ilbl">Omschrijving</label><textarea className="inp" style={{minHeight:100}} value={bewerkt.omschrijving} onChange={e=>setBewerkt({...bewerkt,omschrijving:e.target.value})} placeholder="Wat is er gedaan?"/></div>
      <div className="ig"><label className="ilbl">Materialen</label><textarea className="inp" style={{minHeight:60}} value={bewerkt.materialen} onChange={e=>setBewerkt({...bewerkt,materialen:e.target.value})} placeholder="Gewerkte materialen"/></div>
      <div className="ig"><label className="ilbl">Foto</label><input className="inp" type="file" accept="image/*" capture="environment" onChange={handleEditFotoChange}/>{editFotoPreview&&<img src={editFotoPreview} alt="Voorbeeld" style={{marginTop:10,width:120,height:90,objectFit:"cover",borderRadius:10}}/>}</div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={bewerkt.status} onChange={e=>setBewerkt({...bewerkt,status:e.target.value})}>{["Nieuw","Bezig","Klaar","Ondertekend","Afgerond"].map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="ig"><label className="ilbl">Handtekening klant</label>
        {bewerkt.handtekening?<div><img src={bewerkt.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB",marginBottom:8}}/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setBewerkt({...bewerkt,handtekening:""})}>Wissen</button></div>:<SignatureCanvas onSave={sig=>setBewerkt({...bewerkt,handtekening:sig})}/>}
      </div>
      {editError && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{editError}</div>}
      <div style={{display:"flex",gap:9}}><button type="button" className="btn btn-ghost" onClick={()=>{setShowEdit(false);setEditError("");}}>Annuleren</button><button type="button" className="btn btn-dark btn-full" onClick={saveEdit} disabled={editSaving||!bewerkt.klant||!bewerkt.datum}>{editSaving?"Opslaan…":"Opslaan"}</button></div>
    </div></div></div>}
    {lightboxFoto&&<div onClick={()=>setLightboxFoto(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
      <img src={lightboxFoto} alt="Foto" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:14,boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}}/>
      <button onClick={()=>setLightboxFoto(null)} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:"50%",width:44,height:44}}>✕</button>
    </div>}
  </div>);
}

// ── Financiën ─────────────────────────────────────────────────
function FinancienTab({ userId, facturen, uitgaven, refresh, klanten, offertes, bedrijf, emailSettings }) {
  const mob = useMobile();
  const [mobDetail,setMobDetail]=useState(null);
  const getTotal = (f) => f.totaal != null ? Number(f.totaal) : parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."))||0;

  const [subTab, setSubTab] = useState("facturen");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [showCreate, setShowCreate] = useState(false);
  const [showEmail, setShowEmail] = useState(null);
  const [showReminder, setShowReminder] = useState(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [importOfferte, setImportOfferte] = useState("");
  const [nieuw, setNieuw] = useState({klant:"",klant_email:"",datum:"",vervaldatum:"",regels:[],status:"Concept"});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [showAddUitgave, setShowAddUitgave] = useState(false);
  const [nieuweUitgave, setNieuweUitgave] = useState({datum:localToday(),categorie:"",omschrijving:"",bedrag:"",btw_percentage:21,foto:""});
  const [savingUitgave, setSavingUitgave] = useState(false);
  const [uitgaveErr, setUitgaveErr] = useState("");
  const [uitgaveFotoPreview, setUitgaveFotoPreview] = useState("");
  const autoReminderSentRef = useRef(false);
  const [autoReminderCount, setAutoReminderCount] = useState(0);

  useEffect(() => {
    if (autoReminderSentRef.current) return;
    if (!facturen.length || !emailSettings?.id) return;
    if (!emailSettings.auto_reminder_email && !emailSettings.auto_invoice_reminder) return;
    autoReminderSentRef.current = true;
    const today = new Date();
    const reminderDays = Number(emailSettings.reminder_days_before ?? 3);
    const invoiceDays  = Number(emailSettings.invoice_reminder_days ?? 7);
    const candidates = facturen.filter(f => {
      if (f.status !== "Verstuurd" || !f.klant_email) return false;
      const nearDue   = emailSettings.auto_reminder_email  && f.vervaldatum && ((new Date(f.vervaldatum) - today) / 86400000) >= 0 && ((new Date(f.vervaldatum) - today) / 86400000) <= reminderDays;
      const oldUnpaid = emailSettings.auto_invoice_reminder && f.datum      && ((today - new Date(f.datum)) / 86400000) >= invoiceDays;
      return nearDue || oldUnpaid;
    });
    if (!candidates.length) return;
    (async () => {
      let sent = 0;
      for (const f of candidates) {
        try {
          await supabase.functions.invoke("ai-proxy", { body: { action:"send-reminder-email", customer_email:f.klant_email, customer_name:f.klant, factuur_nummer:f.nummer, totaal:f.totaal, company_name:bedrijf?.bedrijfsnaam } });
          await supabase.from("facturen").update({ status:"Herinnering" }).eq("id", f.id);
          await logEmail(userId, f.klant_email, `Herinnering factuur ${f.nummer||""}`, "herinnering", `Automatische herinnering factuur ${f.nummer||""} voor ${f.klant}`, "verzonden");
          sent++;
        } catch(e) { console.warn("Auto reminder failed", f.nummer, e); }
      }
      if (sent > 0) { setAutoReminderCount(sent); refresh(); }
    })();
  }, [facturen, emailSettings]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const thisQ = Math.floor(now.getMonth()/3);
  const qStart = new Date(now.getFullYear(), thisQ*3, 1);

  const isOverdue = (f) => {
    if (f.status==="Betaald"||f.status==="Concept") return false;
    if (!f.vervaldatum) return false;
    return new Date(f.vervaldatum) < now;
  };
  const dispStatus = (f) => isOverdue(f) ? "Verlopen" : (f.status||"Concept");

  const monthRevenue = facturen.filter(f=>f.status==="Betaald"&&(f.datum||"").startsWith(thisMonth)).reduce((s,f)=>s+getTotal(f),0);
  const openFacturen2 = facturen.filter(f=>{const s=dispStatus(f);return s!=="Betaald"&&s!=="Concept";});
  const openAmount = openFacturen2.reduce((s,f)=>s+getTotal(f),0);
  const yearRevenue = facturen.filter(f=>f.status==="Betaald"&&(f.datum||"").startsWith(String(now.getFullYear()))).reduce((s,f)=>s+getTotal(f),0);
  const btwKwartaal = facturen.filter(f=>f.status==="Betaald"&&f.datum&&new Date(f.datum)>=qStart&&new Date(f.datum)<=now).reduce((s,f)=>s+(getTotal(f)/1.21*0.21),0);

  const nextNummer = () => {
    const yr = now.getFullYear();
    const nums = facturen.map(f=>f.nummer).filter(n=>n&&n.startsWith(`${yr}-`)).map(n=>parseInt(n.split("-")[1])||0);
    return `${yr}-${String(nums.length?Math.max(...nums)+1:1).padStart(3,"0")}`;
  };

  const calcTotals = (regels) => {
    const sub = regels.reduce((s,r)=>s+(Number(r.aantal)||0)*(Number(r.prijs)||0),0);
    return {subtotaal:sub, btw:sub*0.21, totaal:sub*1.21};
  };

  const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

  const openCreate = () => {
    setImportOfferte("");
    const datum=todayStr(), d=new Date(now); d.setDate(d.getDate()+30);
    const vervaldatum=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    setNieuw({klant:"",klant_email:"",datum,vervaldatum,regels:[{omschrijving:"",aantal:1,eenheid:"stuk",prijs:""}],status:"Concept"});
    setSaveErr(""); setShowCreate(true);
  };

  const importFromOfferte = (offerteId) => {
    const o=(offertes||[]).find(x=>String(x.id)===String(offerteId));
    if(!o) return;
    const k=(klanten||[]).find(x=>x.naam===o.klant);
    const prijs = parseFloat(String(o.bedrag).replace(/[€\s]/g, '')) || 0;
    const regels=[{omschrijving:o.dienst||"",aantal:1,eenheid:"stuk",prijs}];
    setNieuw(prev=>({...prev,klant:o.klant||"",klant_email:k?.email||"",regels}));
  };

  const addRegel = () => setNieuw(prev=>({...prev,regels:[...prev.regels,{omschrijving:"",aantal:1,eenheid:"stuk",prijs:""}]}));
  const removeRegel = (i) => setNieuw(prev=>({...prev,regels:prev.regels.filter((_,idx)=>idx!==i)}));
  const setRegel = (i,field,val) => setNieuw(prev=>({...prev,regels:prev.regels.map((r,idx)=>idx===i?{...r,[field]:val}:r)}));

  const saveFactuur = async () => {
    if(!nieuw.klant){setSaveErr("Vul een klant in.");return;}
    if(!nieuw.regels.length){setSaveErr("Voeg minimaal één regel toe.");return;}
    setSaving(true); setSaveErr("");
    const {btw,totaal}=calcTotals(nieuw.regels);
    const {error}=await supabase.from("facturen").insert({user_id:userId,nummer:nextNummer(),klant:nieuw.klant,klant_email:nieuw.klant_email,datum:nieuw.datum,vervaldatum:nieuw.vervaldatum,regels:nieuw.regels,btw,totaal,status:nieuw.status});
    setSaving(false);
    if(error){setSaveErr(error.message);return;}
    setShowCreate(false); refresh();
  };

  const updateStatus = async (id, status) => { const {error}=await supabase.from("facturen").update({status}).eq("id",id); if(!error)refresh(); };

  const sendInvoiceEmail = async () => {
    if(!emailAddr) return;
    setEmailSending(true); setEmailMsg("");
    try {
      const pdfB64=createFactuurPdfBase64(showEmail, bedrijf);
      const {error}=await supabase.functions.invoke("ai-proxy",{body:{action:"send-invoice-email",customer_email:emailAddr,customer_name:showEmail.klant,factuur_nummer:showEmail.nummer,company_name:bedrijf?.bedrijfsnaam,attachments:[{filename:`Factuur-${showEmail.nummer||"factuur"}.pdf`,content:pdfB64}]}});
      if(error) throw new Error(error.message);
      await supabase.from("facturen").update({status:"Verstuurd"}).eq("id",showEmail.id);
      await logEmail(userId, emailAddr, `Factuur ${showEmail.nummer||""}`, "factuur", `Factuur ${showEmail.nummer||""} voor ${showEmail.klant}`, "verzonden");
      setEmailMsg("Factuur verstuurd!"); refresh();
      setTimeout(()=>{setShowEmail(null);setEmailMsg("");setEmailAddr("");},1600);
    } catch(e){setEmailMsg("Fout: "+e.message);}
    setEmailSending(false);
  };

  const sendReminder = async () => {
    if(!emailAddr) return;
    setEmailSending(true); setEmailMsg("");
    try {
      const pdfB64=createFactuurPdfBase64(showReminder, bedrijf);
      await supabase.functions.invoke("ai-proxy",{body:{action:"send-reminder-email",customer_email:emailAddr,customer_name:showReminder.klant,factuur_nummer:showReminder.nummer,totaal:getTotal(showReminder),company_name:bedrijf?.bedrijfsnaam,attachments:[{filename:`Herinnering-${showReminder.nummer||"factuur"}.pdf`,content:pdfB64}]}});
      await supabase.from("facturen").update({status:"Herinnering"}).eq("id",showReminder.id);
      await logEmail(userId, emailAddr, `Herinnering factuur ${showReminder.nummer||""}`, "herinnering", `Betalingsherinnering factuur ${showReminder.nummer||""} voor ${showReminder.klant}`, "verzonden");
      setEmailMsg("Herinnering verstuurd!"); refresh();
      setTimeout(()=>{setShowReminder(null);setEmailMsg("");setEmailAddr("");},1600);
    } catch(e){setEmailMsg("Fout: "+e.message);}
    setEmailSending(false);
  };

  const askAi = async () => {
    if(!aiInput.trim()) return;
    setAiLoading(true); setAiAnswer("");
    const ctx=facturen.map(f=>`[${f.nummer||"?"} | ${f.klant} | ${dispStatus(f)} | €${getTotal(f).toFixed(2)} | ${f.datum||""}]`).join("\n");
    try { const ans=await aiCall(`Je bent een boekhouding assistent voor een Nederlandse vakman. Facturen:\n${ctx}\n\nVraag: ${aiInput}\n\nGeef een duidelijk, beknopt antwoord in het Nederlands.`); setAiAnswer(ans); }
    catch(e){ setAiAnswer("Fout bij ophalen antwoord."); }
    setAiLoading(false);
  };

  const filtered = facturen.filter(f=>{
    if(filterStatus==="Alle") return true;
    if(filterStatus==="Verlopen") return isOverdue(f);
    return dispStatus(f)===filterStatus;
  });

  const {subtotaal:cSub,btw:cBtw,totaal:cTot}=calcTotals(nieuw.regels);
  const fmtEur=(n)=>`€ ${Number(n).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtDate=(s)=>s?new Date(s).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"}):"-";

  return (<div>
    {autoReminderCount > 0 && (
      <div style={{margin:"0 0 12px",padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:"#DCFCE7",color:"#15803D",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        ✅ {autoReminderCount} automatische herinnering{autoReminderCount > 1 ? "en" : ""} verstuurd
        <button onClick={()=>setAutoReminderCount(0)} style={{background:"none",border:"none",cursor:"pointer",color:"#15803D",fontSize:18,lineHeight:1,padding:0}}>×</button>
      </div>
    )}
    {mob && mobDetail && (()=>{
      const f=mobDetail, st=dispStatus(f), od=isOverdue(f);
      return(
        <MobDetailScreen title={`Factuur ${f.nummer||""}`} onBack={()=>setMobDetail(null)}>
          <div className="mob-det-section">
            <div className="mob-det-amount" style={{color:od?"#EF4444":"#0F0F14"}}>{fmtEur(getTotal(f))}</div>
            <Badge status={st}/>
            <div className="mob-det-row"><span className="mob-det-lbl">Klant</span><span className="mob-det-val">{f.klant}</span></div>
            <div className="mob-det-row"><span className="mob-det-lbl">Nummer</span><span className="mob-det-val">{f.nummer||"—"}</span></div>
            <div className="mob-det-row"><span className="mob-det-lbl">Datum</span><span className="mob-det-val">{fmtDate(f.datum)}</span></div>
            <div className="mob-det-row"><span className="mob-det-lbl">Vervaldatum</span><span className="mob-det-val" style={{color:od?"#EF4444":"#0F0F14"}}>{fmtDate(f.vervaldatum)}{od?" ⚠️":""}</span></div>
          </div>
          <div className="mob-det-section" style={{marginBottom:8}}>
            <div style={{fontSize:13,color:"#64748B",marginBottom:8,fontWeight:600}}>Status wijzigen</div>
            <select value={f.status||"Concept"} onChange={async e=>{await updateStatus(f.id,e.target.value);setMobDetail({...f,status:e.target.value});}} style={{width:"100%",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px 14px",fontSize:16,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none",background:"#fff",color:"#111"}}>
              {["Concept","Verstuurd","Herinnering","Betaald"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="mob-det-action-btn" onClick={()=>createFactuurPdf(f,bedrijf).save(`Factuur-${f.nummer||f.id}.pdf`)}><span className="mob-det-action-ic">📄</span>PDF downloaden</button>
          <button className="mob-det-action-btn" onClick={()=>{setShowEmail(f);setEmailAddr(f.klant_email||"");}}><span className="mob-det-action-ic">📧</span>Factuur e-mailen</button>
          {st!=="Betaald"&&st!=="Concept"&&<button className="mob-det-action-btn" onClick={()=>{setShowReminder(f);setEmailAddr(f.klant_email||"");}}><span className="mob-det-action-ic">🔔</span>Herinnering sturen</button>}
          <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Factuur verwijderen?")) { supabase.from("facturen").delete().eq("id",f.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic">🗑</span>Verwijderen</button>
        </MobDetailScreen>
      );
    })()}
    <div className="ph"><div><div className="pg-title">Financiën</div><div className="pg-sub">Facturen & boekhouding</div></div><button className="btn btn-dark" onClick={openCreate}>+ Nieuwe factuur</button></div>
    <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
      {[
        {label:"Omzet deze maand",val:fmtEur(monthRevenue),sub:"betaald",color:"#10B981"},
        {label:"Openstaand",val:fmtEur(openAmount),sub:`${openFacturen2.length} factuur${openFacturen2.length!==1?"en":""}`,color:"#F59E0B"},
        {label:"Omzet dit jaar",val:fmtEur(yearRevenue),sub:"betaald",color:"#6366F1"},
        {label:"BTW dit kwartaal",val:fmtEur(btwKwartaal),sub:"afdragen",color:"#EF4444"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.val}</div><div className="ss">{s.sub}</div></div>)}
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {[["facturen","📄 Facturen"],["uitgaven","🧾 Uitgaven"],["ai","✨ Assistent"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 18px",borderRadius:20,border:"1.5px solid",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:subTab===id?"#0F0F14":"#fff",color:subTab===id?"#fff":"#555",borderColor:subTab===id?"#0F0F14":"#E5E7EB"}}>{lbl}</button>
      ))}
    </div>

    {subTab==="facturen"&&(<>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",overflowX:"hidden"}}>
        {["Alle","Concept","Verstuurd","Herinnering","Betaald","Verlopen"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:filterStatus===s?"#0F0F14":"#fff",color:filterStatus===s?"#fff":"#555",borderColor:filterStatus===s?"#0F0F14":"#E5E7EB"}}>{s}</button>
        ))}
      </div>
      {filtered.length===0
        ?<LeegScherm icon="💶" titel="Geen facturen" sub="Maak je eerste factuur aan" actie="+ Factuur aanmaken" onActie={openCreate}/>
        : mob
          ? <div className="mob-card-list">{filtered.map(f=>{
              const st=dispStatus(f), od=isOverdue(f);
              return(
                <div className="mob-card" key={f.id} onClick={()=>setMobDetail(f)}>
                  <div className="mob-card-top">
                    <div className="mob-card-name">{f.klant}</div>
                    <Badge status={st}/>
                  </div>
                  <div className="mob-card-amount" style={{color:od?"#EF4444":"#0F0F14"}}>{fmtEur(getTotal(f))}</div>
                  <div className="mob-card-sub">{f.nummer||"-"} · {fmtDate(f.datum)}{od?" · Vervallen":""}</div>
                  <span className="mob-card-chevron">›</span>
                </div>
              );
            })}</div>
          : <div className="card"><div className="tw"><table><thead><tr>{["Nummer","Klant","Datum","Vervaldatum","Totaal","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>{filtered.map(f=>{
                const st=dispStatus(f), od=isOverdue(f);
                return(<tr key={f.id}>
                  <td style={{fontWeight:700,color:"#6366F1",fontSize:13}}>{f.nummer||"-"}</td>
                  <td style={{fontWeight:600,color:"#111"}}>{f.klant}</td>
                  <td style={{color:"#888",fontSize:13}}>{fmtDate(f.datum)}</td>
                  <td style={{color:od?"#EF4444":"#888",fontSize:13,fontWeight:od?700:400}}>{fmtDate(f.vervaldatum)}</td>
                  <td style={{fontWeight:700,color:"#111"}}>{fmtEur(getTotal(f))}</td>
                  <td><Badge status={st}/></td>
                  <td><div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <button className="btn btn-ghost btn-sm" title="PDF downloaden" onClick={()=>createFactuurPdf(f,bedrijf).save(`Factuur-${f.nummer||f.id}.pdf`)}>PDF</button>
                    {st!=="Betaald"&&st!=="Concept"&&<button className="btn btn-ghost btn-sm" title="Herinnering" onClick={()=>{setShowReminder(f);setEmailAddr(f.klant_email||"");}}>🔔</button>}
                    <button className="btn btn-ghost btn-sm" title="E-mailen" onClick={()=>{setShowEmail(f);setEmailAddr(f.klant_email||"");}}>📧</button>
                    <select value={f.status||"Concept"} onChange={e=>updateStatus(f.id,e.target.value)} style={{border:"1.5px solid #E5E7EB",borderRadius:7,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none"}}>
                      {["Concept","Verstuurd","Herinnering","Betaald"].map(s=><option key={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-danger btn-sm" onClick={()=>{ if(window.confirm("Factuur verwijderen?")) { supabase.from("facturen").delete().eq("id",f.id).then(()=>refresh()); } }}>✕</button>
                  </div></td>
                </tr>);
              })}</tbody></table></div></div>
      }
    </>)}

    {subTab==="uitgaven"&&(<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:"#111"}}>Totaal uitgaven: {fmtEur((uitgaven||[]).reduce((s,u)=>s+Number(u.bedrag||0),0))}</div>
          <div style={{fontSize:13,color:"#64748B"}}>BTW terugvragen: {fmtEur((uitgaven||[]).reduce((s,u)=>s+Number(u.bedrag||0)*Number(u.btw_percentage||0)/100/(1+Number(u.btw_percentage||0)/100),0))}</div>
        </div>
        <button className="btn btn-dark" onClick={()=>{setNieuweUitgave({datum:localToday(),categorie:"",omschrijving:"",bedrag:"",btw_percentage:21,foto:""});setUitgaveFotoPreview("");setUitgaveErr("");setShowAddUitgave(true);}}>+ Uitgave</button>
      </div>
      {(uitgaven||[]).length===0
        ?<LeegScherm icon="🧾" titel="Geen uitgaven" sub="Registreer je eerste zakelijke uitgave" actie="+ Uitgave toevoegen" onActie={()=>setShowAddUitgave(true)}/>
        :<div className="card"><div className="tw"><table><thead><tr>{["Datum","Categorie","Omschrijving","Bedrag","BTW %","Acties"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{(uitgaven||[]).map(u=><tr key={u.id}>
            <td style={{color:"#888",fontSize:13}}>{u.datum}</td>
            <td><span style={{background:"#F1F5F9",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600}}>{u.categorie}</span></td>
            <td style={{fontWeight:600,color:"#111"}}>{u.omschrijving}{u.foto&&<img src={u.foto} alt="Bon" style={{width:36,height:28,objectFit:"cover",borderRadius:6,marginLeft:8,verticalAlign:"middle",cursor:"pointer"}} onClick={()=>window.open(u.foto)}/>}</td>
            <td style={{fontWeight:700,color:"#111"}}>{fmtEur(u.bedrag)}</td>
            <td style={{color:"#888"}}>{u.btw_percentage}%</td>
            <td><button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Uitgave verwijderen?"))supabase.from("uitgaven").delete().eq("id",u.id).then(()=>refresh());}}>✕</button></td>
          </tr>)}</tbody></table></div></div>
      }
      {showAddUitgave&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Uitgave toevoegen</div></div><button className="mc" onClick={()=>setShowAddUitgave(false)}>✕</button></div><div className="mb">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuweUitgave.datum} onChange={e=>setNieuweUitgave({...nieuweUitgave,datum:e.target.value})}/></div>
          <div className="ig"><label className="ilbl">Categorie</label>
            <select className="inp" value={nieuweUitgave.categorie} onChange={e=>setNieuweUitgave({...nieuweUitgave,categorie:e.target.value})}>
              <option value="">-- Kies --</option>
              {["Materiaal","Gereedschap","Brandstof","Verzekering","Telefoon","Software","Opleiding","Kantoor","Overig"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="ig"><label className="ilbl">Omschrijving</label><input className="inp" value={nieuweUitgave.omschrijving} onChange={e=>setNieuweUitgave({...nieuweUitgave,omschrijving:e.target.value})} placeholder="Wat is er gekocht?"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Bedrag (incl. BTW)</label><input className="inp" type="number" step="0.01" value={nieuweUitgave.bedrag} onChange={e=>setNieuweUitgave({...nieuweUitgave,bedrag:e.target.value})} placeholder="0.00"/></div>
          <div className="ig"><label className="ilbl">BTW %</label>
            <select className="inp" value={nieuweUitgave.btw_percentage} onChange={e=>setNieuweUitgave({...nieuweUitgave,btw_percentage:Number(e.target.value)})}>
              {[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
        </div>
        <div className="ig"><label className="ilbl">Bonnetje (foto)</label>
          <input className="inp" type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{setNieuweUitgave(prev=>({...prev,foto:r.result}));setUitgaveFotoPreview(r.result)};r.readAsDataURL(f);}}/>
          {uitgaveFotoPreview&&<img src={uitgaveFotoPreview} alt="Bon" style={{marginTop:10,width:120,height:90,objectFit:"cover",borderRadius:10}}/>}
        </div>
        {uitgaveErr&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:12}}>{uitgaveErr}</div>}
        <div style={{display:"flex",gap:9}}>
          <button className="btn btn-ghost" onClick={()=>setShowAddUitgave(false)}>Annuleren</button>
          <button className="btn btn-dark btn-full" disabled={savingUitgave} onClick={async()=>{
            if(!nieuweUitgave.categorie||!nieuweUitgave.omschrijving||!nieuweUitgave.bedrag){setUitgaveErr("Vul alle verplichte velden in.");return;}
            setSavingUitgave(true);
            const {error}=await supabase.from("uitgaven").insert({user_id:userId,datum:nieuweUitgave.datum,categorie:nieuweUitgave.categorie,omschrijving:nieuweUitgave.omschrijving,bedrag:Number(nieuweUitgave.bedrag),btw_percentage:nieuweUitgave.btw_percentage,foto:nieuweUitgave.foto||null});
            setSavingUitgave(false);
            if(error){setUitgaveErr(error.message);return;}
            setShowAddUitgave(false); refresh();
          }}>{savingUitgave?"Opslaan…":"Opslaan"}</button>
        </div>
      </div></div></div>}
    </>)}

    {subTab==="ai"&&(
      <div className="card cp" style={{maxWidth:620}}>
        <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>✨ Slimme assistent</div>
        <div style={{fontSize:13,color:"#94A3B8",marginBottom:16}}>Stel vragen over je omzet, facturen en BTW</div>
        {["Hoeveel heb ik deze maand verdiend?","Welke facturen staan nog open?","Hoeveel BTW moet ik afdragen dit kwartaal?","Wat is mijn omzet dit jaar?"].map(q=>(
          <div key={q} className="tip-row" onClick={()=>setAiInput(q)} style={{fontSize:13,color:"#4338CA",cursor:"pointer",padding:"7px 0",borderBottom:"1px solid #F0F0F0"}}>→ {q}</div>
        ))}
        <div className="ig" style={{marginTop:14}}>
          <label className="ilbl">Vraag</label>
          <textarea className="inp" value={aiInput} onChange={e=>setAiInput(e.target.value)} style={{minHeight:72}} placeholder="Bijv: Hoeveel heb ik vorige maand verdiend?"/>
        </div>
        <button className="btn btn-ai btn-full" onClick={askAi} disabled={!aiInput.trim()||aiLoading} style={{opacity:aiInput.trim()?1:.5}}>{aiLoading?<>✨<span className="dot">…</span></>:"✨ Vraag het"}</button>
        {aiAnswer&&<div style={{marginTop:14,background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:10,padding:"14px 16px",fontSize:14,color:"#1e293b",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{aiAnswer}</div>}
      </div>
    )}

    {showCreate&&<div className="overlay"><div className="modal" style={{maxWidth:700,width:"95vw"}}>
      <div className="mh"><div><div className="mt">Nieuwe factuur</div></div><button className="mc" onClick={()=>setShowCreate(false)}>✕</button></div>
      <div className="mb">
        {(offertes||[]).length>0&&<div className="ig"><label className="ilbl">Importeer van offerte (optioneel)</label>
          <select className="inp" value={importOfferte} onChange={e=>{setImportOfferte(e.target.value);importFromOfferte(e.target.value);}}>
            <option value="">-- Kies offerte --</option>
            {(offertes||[]).map(o=><option key={o.id} value={o.id}>{o.klant} — {o.dienst||"offerte"}</option>)}
          </select></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Klant *</label>
            <select className="inp" value={nieuw.klant} onChange={e=>{const k=(klanten||[]).find(x=>x.naam===e.target.value);setNieuw({...nieuw,klant:e.target.value,klant_email:k?.email||nieuw.klant_email});}}>
              <option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}
            </select></div>
          <div className="ig"><label className="ilbl">E-mailadres klant</label><input className="inp" type="email" value={nieuw.klant_email} onChange={e=>setNieuw({...nieuw,klant_email:e.target.value})} placeholder="klant@email.nl"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Factuurdatum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})}/></div>
          <div className="ig"><label className="ilbl">Vervaldatum</label><input className="inp" type="date" value={nieuw.vervaldatum} onChange={e=>setNieuw({...nieuw,vervaldatum:e.target.value})}/></div>
          <div className="ig"><label className="ilbl">Status</label>
            <select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Concept","Verstuurd","Betaald"].map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div style={{marginTop:8}}>
          <div className="off-tbl-grid" style={{borderBottom:"2px solid #E5E7EB",paddingBottom:6,marginBottom:4}}>
            {["Omschrijving","Aantal","Eenheid","Prijs","Totaal",""].map((h,i)=><div key={i} className="off-cell" style={{fontWeight:700,fontSize:12,color:"#94A3B8",justifyContent:i>=3&&i<5?"flex-end":i===1?"center":"flex-start"}}>{h}</div>)}
          </div>
          {nieuw.regels.map((r,i)=>(
            <div key={i} className="off-tbl-grid" style={{borderBottom:"1px solid #F3F4F6"}}>
              <div className="off-cell"><input className="off-inp" value={r.omschrijving} onChange={e=>setRegel(i,"omschrijving",e.target.value)} placeholder="Omschrijving"/></div>
              <div className="off-cell"><input className="off-inp" type="number" value={r.aantal} onChange={e=>setRegel(i,"aantal",e.target.value)} style={{textAlign:"center"}}/></div>
              <div className="off-cell"><select className="off-inp" value={r.eenheid} onChange={e=>setRegel(i,"eenheid",e.target.value)} style={{minWidth:80}}>{["stuk","uur","dag","m²","m","kg","l"].map(u=><option key={u}>{u}</option>)}</select></div>
              <div className="off-cell"><input className="off-inp" type="number" value={r.prijs} onChange={e=>setRegel(i,"prijs",e.target.value)} style={{textAlign:"right"}}/></div>
              <div className="off-cell off-cell-totaal">{fmtEur((Number(r.aantal)||0)*(Number(r.prijs)||0))}</div>
              <div className="off-cell"><button onClick={()=>removeRegel(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16}}>×</button></div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addRegel} style={{marginTop:8}}>+ Regel</button>
        </div>
        <div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:10,padding:"12px 16px",marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>Subtotaal</span><span>{fmtEur(cSub)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:6}}><span>BTW 21%</span><span>{fmtEur(cBtw)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:"#111"}}><span>Totaal</span><span>{fmtEur(cTot)}</span></div>
        </div>
        {saveErr&&<div style={{color:"#EF4444",fontSize:12.5,marginTop:8}}>{saveErr}</div>}
        <div style={{display:"flex",gap:9,marginTop:12}}>
          <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Annuleren</button>
          <button className="btn btn-dark btn-full" onClick={saveFactuur} disabled={saving||!nieuw.klant}>{saving?"Opslaan…":"Factuur aanmaken"}</button>
        </div>
      </div>
    </div></div>}

    {showEmail&&<div className="overlay"><div className="modal" style={{maxWidth:440}}>
      <div className="mh"><div><div className="mt">Factuur e-mailen</div><div style={{fontSize:12.5,color:"#94A3B8",marginTop:2}}>{showEmail.nummer} — {showEmail.klant}</div></div><button className="mc" onClick={()=>{setShowEmail(null);setEmailMsg("");}}>✕</button></div>
      <div className="mb">
        <div className="ig"><label className="ilbl">E-mailadres</label><input className="inp" type="email" value={emailAddr} onChange={e=>setEmailAddr(e.target.value)} placeholder="klant@email.nl"/></div>
        {emailMsg&&<div style={{color:emailMsg.startsWith("Fout")?"#EF4444":"#10B981",fontSize:13,marginBottom:8}}>{emailMsg}</div>}
        <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowEmail(null);setEmailMsg("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={sendInvoiceEmail} disabled={!emailAddr||emailSending}>{emailSending?"Versturen…":"📧 Verstuur factuur"}</button></div>
      </div>
    </div></div>}

    {showReminder&&<div className="overlay"><div className="modal" style={{maxWidth:440}}>
      <div className="mh"><div><div className="mt">Betalingsherinnering</div><div style={{fontSize:12.5,color:"#94A3B8",marginTop:2}}>{showReminder.nummer} — {showReminder.klant} — {fmtEur(getTotal(showReminder))}</div></div><button className="mc" onClick={()=>{setShowReminder(null);setEmailMsg("");}}>✕</button></div>
      <div className="mb">
        <div className="ig"><label className="ilbl">E-mailadres</label><input className="inp" type="email" value={emailAddr} onChange={e=>setEmailAddr(e.target.value)} placeholder="klant@email.nl"/></div>
        {emailMsg&&<div style={{color:emailMsg.startsWith("Fout")?"#EF4444":"#10B981",fontSize:13,marginBottom:8}}>{emailMsg}</div>}
        <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowReminder(null);setEmailMsg("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={sendReminder} disabled={!emailAddr||emailSending}>{emailSending?"Versturen…":"🔔 Stuur herinnering"}</button></div>
      </div>
    </div></div>}
  </div>);
}

// ── Team ──────────────────────────────────────────────────────
function TeamTab({ ownerId, teamMembers, refresh, bedrijf }) {
  const [showInvite,setShowInvite]=useState(false);
  const [invite,setInvite]=useState({email:"",role:"Monteur"});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const inviteMember = async () => {
    const email = String(invite.email || "").trim().toLowerCase();
    if (!email || !invite.role) { setError("E-mail en rol zijn verplicht."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Ongeldig e-mailadres."); return; }
    setSaving(true);
    setError("");
    const token = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Math.random().toString(36).slice(2)}${Date.now()}`;

    try {
      const insertRes = await supabase.from("team").insert({
        user_id: ownerId,
        email,
        role: invite.role,
        invite_token: token,
        invited_at: new Date().toISOString(),
      }).select();
      if (insertRes.error) {
        setError(insertRes.error.message || "Opslaan mislukt");
        setSaving(false);
        return;
      }

      try {
        const { data: { session: invSess } } = await supabase.auth.getSession();
        const invToken = invSess?.access_token || import.meta.env.VITE_SUPABASE_KEY;
        const response = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${invToken}` },
          body: JSON.stringify({
            action: "send-invite-email",
            invite_email: email,
            inviter_email: (await supabase.auth.getUser()).data?.user?.email || "",
            invite_token: token,
            appUrl: window.location.origin,
            company_name: bedrijf?.bedrijfsnaam,
            reply_to: bedrijf?.email || "",
          }),
        });
        const fnRes = await response.json().catch(() => null);
        if (!response.ok) {
          setError(`Uitnodigingsmail kon niet verzonden worden: ${fnRes?.error?.message || response.statusText}`);
        } else if (fnRes?.error) {
          setError("Uitnodigingsmail kon niet verzonden worden.");
        } else {
          await logEmail(ownerId, email, "Uitnodiging WerkMate", "team", `Uitnodiging verstuurd naar ${email}`, "verzonden");
        }
      } catch (fnErr) {
        setError("Uitnodigingsmail kon niet verzonden worden.");
      }

      setInvite({email:"",role:"Monteur"});
      setShowInvite(false);
      if (typeof refresh === "function") await refresh();
    } catch (e) {
      setError("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (id) => {
    if(!window.confirm("Teamlid verwijderen?"))return;
    const {error}=await supabase.from("team").delete().eq("id", id);
    if(!error && typeof refresh === "function") await refresh();
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Team</div><div className="pg-sub">Nodig teamleden uit en beheer rollen</div></div><button className="btn btn-dark" onClick={()=>setShowInvite(true)}>+ Teamlid uitnodigen</button></div>
    {teamMembers.length===0
      ? <LeegScherm icon="👥" titel="Nog geen teamleden" sub="Nodig iemand uit om samen te werken" actie="+ Uitnodigen" onActie={()=>setShowInvite(true)}/>
      : <div className="card"><div className="tw"><table><thead><tr>{["E-mail","Rol","Uitgenodigd","Acties"].map(h=><th key={h} className={h==="Uitgenodigd"?"mob-hide":undefined}>{h}</th>)}</tr></thead>
          <tbody>{teamMembers.map(member=><tr key={member.id}><td style={{fontWeight:700,color:"#111"}}>{member.email}</td><td style={{color:"#555"}}>{member.role}</td><td className="mob-hide" style={{color:"#888"}}>{member.invited_at?new Date(member.invited_at).toLocaleDateString("nl-NL"):"-"}</td><td><button className="btn btn-danger btn-sm" onClick={()=>removeMember(member.id)}>Verwijderen</button></td></tr>)}</tbody>
        </table></div></div>
    }
    {showInvite&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Teamlid uitnodigen</div></div><button className="mc" onClick={()=>setShowInvite(false)}>✕</button></div><div className="mb">
      <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} placeholder="voorbeeld@bedrijf.nl"/></div>
      <div className="ig"><label className="ilbl">Rol</label><select className="inp" value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value})}>{["Baas","Beheerder","Monteur","Stagiair","Verkoper","Boekhouder","Chauffeur","Magazijnmedewerker","Projectleider","Uitvoerder"].map(r=><option key={r}>{r}</option>)}</select></div>
      {error && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",gap:9}}>
        <button type="button" className="btn btn-ghost" onClick={()=>{setShowInvite(false);setError("");}}>Annuleren</button>
        <button type="button" className="btn btn-dark btn-full" onClick={inviteMember} disabled={saving||!invite.email||!invite.role}>{saving?"Uitnodigen…":"Uitnodigen"}</button>
      </div>
    </div></div></div>}
  </div>);
}

// ── Mail ──────────────────────────────────────────────────────
const TYPE_LABELS = { offerte:"Offerte", factuur:"Factuur", herinnering:"Herinnering", review:"Review", team:"Team" };
const TYPE_COLORS = {
  offerte:    { bg:"#EEF2FF", text:"#4338CA" },
  factuur:    { bg:"#ECFDF5", text:"#065F46" },
  herinnering:{ bg:"#FEF3C7", text:"#92400E" },
  review:     { bg:"#F0FDF4", text:"#166534" },
  team:       { bg:"#F5F3FF", text:"#6D28D9" },
};

function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] || { bg:"#F3F4F6", text:"#374151" };
  const lbl = TYPE_LABELS[type] || type;
  return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11.5,fontWeight:700,background:c.bg,color:c.text}}>{lbl}</span>;
}

function MailTab({ userId, emailsLog = [], refresh }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Alle");
  const [detail, setDetail] = useState(null);

  const filtered = emailsLog.filter(e => {
    const matchType = filterType === "Alle" || e.type === filterType.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q || e.to_email?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const fmtDate = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    return d.toLocaleDateString("nl-NL", { day:"numeric", month:"short", year:"numeric" }) + " " + d.toLocaleTimeString("nl-NL", { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div>
      <div className="ph">
        <div><div className="pg-title">Mail</div><div className="pg-sub">Overzicht verzonden e-mails</div></div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input
          className="inp"
          style={{maxWidth:260,margin:0}}
          placeholder="Zoeken op ontvanger of onderwerp…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Alle","Offerte","Factuur","Herinnering","Review","Team"].map(t=>(
            <button key={t} onClick={()=>setFilterType(t)} style={{padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:filterType===t?"#0F0F14":"#fff",color:filterType===t?"#fff":"#555",borderColor:filterType===t?"#0F0F14":"#E5E7EB"}}>{t}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <LeegScherm icon="📭" titel="Geen e-mails gevonden" sub={emailsLog.length === 0 ? "Verstuurde e-mails verschijnen hier automatisch" : "Geen e-mails die overeenkomen met je zoekopdracht"}/>
        : <div className="card"><div className="tw"><table>
            <thead><tr>{["Datum","Ontvanger","Onderwerp","Type","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id} onClick={()=>setDetail(e)} style={{cursor:"pointer"}}>
                  <td style={{color:"#888",fontSize:13,whiteSpace:"nowrap"}}>{fmtDate(e.sent_at)}</td>
                  <td style={{fontWeight:600,color:"#111"}}>{e.to_email}</td>
                  <td style={{color:"#374151",fontSize:13}}>{e.subject}</td>
                  <td><TypeBadge type={e.type}/></td>
                  <td>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12.5,fontWeight:600,color:e.status==="verzonden"?"#065F46":"#991B1B"}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:e.status==="verzonden"?"#10B981":"#EF4444",display:"inline-block"}}/>
                      {e.status==="verzonden"?"Verzonden":"Mislukt"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
      }

      {detail && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",borderRadius:18,padding:"28px 28px 22px",width:"100%",maxWidth:520,boxShadow:"0 24px 60px rgba(0,0,0,0.22)",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#0F0F14",marginBottom:4}}>{detail.subject}</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <TypeBadge type={detail.type}/>
                  <span style={{fontSize:12.5,color:detail.status==="verzonden"?"#065F46":"#991B1B",fontWeight:600}}>{detail.status==="verzonden"?"✓ Verzonden":"✗ Mislukt"}</span>
                </div>
              </div>
              <button onClick={()=>setDetail(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#94A3B8",lineHeight:1}}>×</button>
            </div>
            <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:12,color:"#94A3B8",marginBottom:2}}>Aan</div>
              <div style={{fontSize:13.5,fontWeight:600,color:"#111"}}>{detail.to_email}</div>
            </div>
            <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:12,color:"#94A3B8",marginBottom:2}}>Datum</div>
              <div style={{fontSize:13.5,color:"#374151"}}>{fmtDate(detail.sent_at)}</div>
            </div>
            {detail.body && (
              <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
                <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>Inhoud</div>
                <div style={{fontSize:13.5,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{detail.body}</div>
              </div>
            )}
            <button className="btn btn-ghost btn-full" onClick={()=>setDetail(null)}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Social ────────────────────────────────────────────────────
function SocialTab() {
  const [plat,setPlat]=useState("beide");const [ond,setOnd]=useState("");const [stijl,setStijl]=useState("professioneel");const [loading,setLoading]=useState(false);const [posts,setPosts]=useState(null);const [copyMsg,setCopyMsg]=useState("");
  const gen=async()=>{if(!ond.trim())return;setLoading(true);setPosts(null);
    try{
      const platNames={insta:"Instagram",tiktok:"TikTok",facebook:"Facebook",beide:"Instagram EN TikTok",alle:"Instagram, TikTok EN Facebook"};
      const p=platNames[plat]||"Instagram en TikTok";
      const iK=(plat==="insta"||plat==="beide"||plat==="alle")?`"instagram":"NL post met hashtags"`:"";
      const tK=(plat==="tiktok"||plat==="beide"||plat==="alle")?`"tiktok":"NL TikTok caption (max 300t)"`:""  ;
      const fK=(plat==="facebook"||plat==="alle")?`"facebook":"NL Facebook post (vriendelijk en informatief)"`:""  ;
      const parts=[iK,tK,fK].filter(Boolean).join(",");
      const t=await aiCall(`Social media voor vakman. Stijl:${stijl}. Platform:${p}. Onderwerp:${ond}. ALLEEN JSON: {${parts}}`);
      setPosts(JSON.parse(t.replace(/```json|```/g,"").trim()));}catch{setPosts({instagram:"Fout.",tiktok:"Fout.",facebook:"Fout."});}setLoading(false);};
  const copy=(t)=>{try{navigator.clipboard.writeText(t);setCopyMsg("✓ Gekopieerd!");setTimeout(()=>setCopyMsg(""),2000);}catch{}};
  return(<div>
    <div className="ph"><div><div className="pg-title">Social Media</div><div className="pg-sub">Slimme posts voor Instagram, TikTok & Facebook</div></div></div>
    {copyMsg&&<div style={{position:"fixed",bottom:24,right:24,background:"#0F0F14",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.25)"}}>{copyMsg}</div>}
    <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
      <div><div className="sec-ttl">⚙️ Instellingen</div><div className="card cp">
        <div className="ig"><label className="ilbl">Platform</label><div className="soc-plat" style={{flexWrap:"wrap"}}>
          <button className={`soc-btn ${plat==="insta"?"on insta":""}`} onClick={()=>setPlat("insta")}>📸 Insta</button>
          <button className={`soc-btn ${plat==="tiktok"?"on tik":""}`} onClick={()=>setPlat("tiktok")}>🎵 TikTok</button>
          <button className={`soc-btn ${plat==="facebook"?"on fb":""}`} onClick={()=>setPlat("facebook")} style={plat==="facebook"?{borderColor:"#1877F2",background:"#EBF5FB",color:"#1877F2"}:{}}>📘 Facebook</button>
          <button className={`soc-btn ${plat==="beide"?"on both":""}`} onClick={()=>setPlat("beide")}>✨ Beide</button>
          <button className={`soc-btn ${plat==="alle"?"on both":""}`} onClick={()=>setPlat("alle")}>🌐 Alle</button>
        </div></div>
        <div className="ig"><label className="ilbl">Stijl</label><select className="inp" value={stijl} onChange={e=>setStijl(e.target.value)}>{["professioneel","stoer","informeel","grappig","motiverend"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></div>
        <div className="ig"><label className="ilbl">Onderwerp</label><textarea className="inp" value={ond} onChange={e=>setOnd(e.target.value)} style={{minHeight:85}} placeholder="Bijv: Airco bij bakkerij Rotterdam geïnstalleerd"/></div>
        <div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:8,padding:"10px 13px",marginBottom:14}}>
          {["Afgerond project (voor & na)","Team aan het werk","Handige tip","5-sterren review","Dag uit het leven"].map((t,i)=><div key={i} className="tip-row" onClick={()=>setOnd(t)} style={{borderBottom:i<4?"1px solid #F0F0F0":"none"}}>→ {t}</div>)}
        </div>
        <button className="btn btn-ai btn-full" onClick={gen} disabled={!ond.trim()||loading} style={{opacity:ond.trim()?1:.5}}>{loading?<>✨<span className="dot">…</span></>:"✨ Maak posts"}</button>
      </div></div>
      <div><div className="sec-ttl">📲 Posts</div>
        {!posts&&!loading&&<div style={{background:"#fff",border:"1px dashed #D1D5DB",borderRadius:13,padding:"48px 24px",textAlign:"center",color:"#94A3B8"}}><div style={{fontSize:32,marginBottom:10}}>📱</div><div style={{fontSize:14,fontWeight:600,color:"#555",marginBottom:5}}>Nog geen posts</div><div style={{fontSize:12.5}}>Vul links in en klik op maak posts</div></div>}
        {loading&&<div style={{background:"#fff",border:"1px solid #EAECF0",borderRadius:13,padding:"48px 24px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>Bezig<span className="dot">…</span></div></div>}
        {posts&&<>
          {posts.instagram&&(plat==="insta"||plat==="beide"||plat==="alle")&&<div className="post-card"><div className="post-bar insta">📸 Instagram</div><div className="post-body">{posts.instagram}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.instagram)}>📋 Kopiëren</button><button className="btn btn-outline btn-sm" onClick={gen}>🔄</button></div></div>}
          {posts.tiktok&&(plat==="tiktok"||plat==="beide"||plat==="alle")&&<div className="post-card"><div className="post-bar tik">🎵 TikTok</div><div className="post-body">{posts.tiktok}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.tiktok)}>📋 Kopiëren</button><button className="btn btn-outline btn-sm" onClick={gen}>🔄</button></div></div>}
          {posts.facebook&&(plat==="facebook"||plat==="alle")&&<div className="post-card"><div className="post-bar" style={{background:"#EBF5FB",color:"#1877F2",borderBottom:"1px solid #C9E6F8"}}>📘 Facebook</div><div className="post-body">{posts.facebook}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.facebook)}>📋 Kopiëren</button><button className="btn btn-outline btn-sm" onClick={gen}>🔄</button></div></div>}
        </>}
      </div>
    </div>
  </div>);
}

function Placeholder({label,items}){return(<div><div className="ph"><div><div className="pg-title">{label}</div><div className="pg-sub">Functionaliteiten in dit onderdeel</div></div></div><div className="fg">{items.map((item,i)=><div className="fc" key={i}><div style={{fontSize:20,marginBottom:8}}>{item.icon}</div><div style={{fontWeight:700,color:"#111",fontSize:13}}>{item.label}</div><div style={{fontSize:11.5,color:"#94A3B8",lineHeight:1.4,marginTop:3}}>{item.desc}</div></div>)}</div></div>);}
const PH={website:{label:"Website & SEO",items:[{icon:"🏗️",label:"Website bouwen",desc:"Eigen professionele bedrijfswebsite"},{icon:"📬",label:"Contactformulier",desc:"Aanvragen direct in de app"},{icon:"⭐",label:"Reviews",desc:"Google & eigen platform"},{icon:"🔍",label:"SEO",desc:"Beter vindbaar in Google"}]},werkregistratie:{label:"Werkbonnen",items:[{icon:"📸",label:"Foto's uploaden",desc:"Voor & na per opdracht"},{icon:"⏱️",label:"Uren bijhouden",desc:"Per klant of project"},{icon:"🔩",label:"Materialen",desc:"Verbruik per werkbon"},{icon:"✍️",label:"Werkbonnen",desc:"Digitaal invullen & ondertekenen"}]},team:{label:"Team & Instellingen",items:[{icon:"👤",label:"Medewerkers",desc:"Monteurs en admins"},{icon:"🔐",label:"Rollen",desc:"Baas, monteur of admin"},{icon:"💳",label:"Abonnement",desc:"Plan upgraden"},{icon:"🔗",label:"Koppelingen",desc:"Exact, Moneybird, Snelstart"}]}};

// ── Subscriptie scherm ────────────────────────────────────────
function SubscriptieScherm({ bedrijfsnaam, onSkip, blocked, onLogout }) {
  const features = [
    { icon:"📄", label:"Offertes & facturen", desc:"Professionele PDF's, verstuur per e-mail" },
    { icon:"📅", label:"Planning kalender", desc:"Maand- en weekoverzicht, terugkerende taken" },
    { icon:"👥", label:"CRM & klantenbeheer", desc:"Alle klanten en contacten op één plek" },
    { icon:"🤖", label:"AI assistent", desc:"Offertes, mails en social posts in seconden" },
    { icon:"🔧", label:"Werkbonnen", desc:"Digitaal invullen en ondertekenen" },
    { icon:"👷", label:"Teambeheer", desc:"Medewerkers uitnodigen en taken toewijzen" },
  ];
  return (
    <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:"24px",boxSizing:"border-box"}}>
      <div style={{background:"#fff",borderRadius:24,padding:"40px 36px",width:"100%",maxWidth:520,boxShadow:"0 32px 80px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:10}}>⚡</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#0F0F14",marginBottom:6}}>
            {blocked ? "Proefperiode verlopen" : `Welkom${bedrijfsnaam ? `, ${bedrijfsnaam}` : ""}!`}
          </div>
          <div style={{fontSize:14,color:"#64748B",lineHeight:1.5}}>
            {blocked ? "Kies een abonnement om WerkMate te blijven gebruiken." : "Start vandaag gratis. Geen creditcard nodig voor de proefperiode."}
          </div>
        </div>

        <div style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",borderRadius:16,padding:"20px 22px",marginBottom:22,color:"#fff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>WerkMate Pro</div>
              <div style={{fontSize:12.5,opacity:.85,marginTop:2}}>14 dagen gratis uitproberen</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,fontSize:22}}>€99</div>
              <div style={{fontSize:11,opacity:.8}}>/maand daarna</div>
            </div>
          </div>
          <div style={{fontSize:12,opacity:.8,borderTop:"1px solid rgba(255,255,255,.2)",paddingTop:10,marginTop:4}}>
            Na 14 dagen automatisch €99/maand. Altijd opzegbaar.
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
          {features.map(f=>(
            <div key={f.label} style={{display:"flex",gap:9,alignItems:"flex-start",padding:"10px 12px",background:"#F8FAFC",borderRadius:12,border:"1px solid #F1F5F9"}}>
              <span style={{fontSize:18,lineHeight:1}}>{f.icon}</span>
              <div>
                <div style={{fontSize:12.5,fontWeight:700,color:"#111",marginBottom:1}}>{f.label}</div>
                <div style={{fontSize:11,color:"#94A3B8",lineHeight:1.3}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <a href={STRIPE_URL} target="_blank" rel="noopener noreferrer"
          style={{display:"block",width:"100%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center",textDecoration:"none",boxSizing:"border-box",marginBottom:10}}>
          {blocked ? "Abonnement kiezen" : "🚀 Start 14 dagen gratis"}
        </a>
        {!blocked && onSkip && (
          <button onClick={onSkip}
            style={{display:"block",width:"100%",background:"none",border:"none",color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>
            Misschien later
          </button>
        )}
        {blocked && onLogout && (
          <button onClick={onLogout}
            style={{display:"block",width:"100%",background:"none",border:"none",color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>
            Uitloggen
          </button>
        )}
      </div>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────
function Toggle({ label, desc, value, onChange }) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:14,color:"#111",marginBottom:3}}>{label}</div>
        {desc && <div style={{fontSize:12.5,color:"#64748B",lineHeight:1.4}}>{desc}</div>}
      </div>
      <button type="button" onClick={()=>onChange(!value)}
        style={{flexShrink:0,width:44,height:24,borderRadius:12,border:"none",background:value?"#6366F1":"#E5E7EB",cursor:"pointer",position:"relative",padding:0,transition:"background .2s"}}>
        <span style={{position:"absolute",top:2,left:value?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.2)",transition:"left .2s",display:"block"}}/>
      </button>
    </div>
  );
}

// ── Instellingen ───────────────────────────────────────────────
function InstellingenTab({ userId, refresh, bedrijf, subscription, onBedrijfUpdate, openTab }) {
  const [settings, setSettings] = useState({
    auto_review_email: true,
    auto_reminder_email: true,
    reminder_days_before: 3,
    auto_invoice_reminder: false,
    invoice_reminder_days: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [kmRate, setKmRate] = useState(Number(bedrijf?.km_vergoeding ?? 0.23));
  const [kmSaving, setKmSaving] = useState(false);
  const [kmMsg, setKmMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    supabase.from("email_settings").select("*").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data) setSettings({
        auto_review_email: data.auto_review_email ?? true,
        auto_reminder_email: data.auto_reminder_email ?? true,
        reminder_days_before: data.reminder_days_before ?? 3,
        auto_invoice_reminder: data.auto_invoice_reminder ?? false,
        invoice_reminder_days: data.invoice_reminder_days ?? 7,
      });
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => { setKmRate(Number(bedrijf?.km_vergoeding ?? 0.23)); }, [bedrijf?.km_vergoeding]);

  const save = async () => {
    setSaving(true);
    setMsg({ type: "", text: "" });
    const { error } = await supabase.from("email_settings").upsert(
      { ...settings, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) { setMsg({ type: "error", text: `Opslaan mislukt: ${error.message}` }); return; }
    setMsg({ type: "ok", text: "Instellingen opgeslagen." });
    if (refresh) refresh();
  };

  const saveKmRate = async () => {
    setKmSaving(true);
    setKmMsg({ type: "", text: "" });
    const { error } = await supabase.from("bedrijfsprofiel").update({ km_vergoeding: kmRate }).eq("user_id", userId);
    setKmSaving(false);
    if (error) { setKmMsg({ type: "error", text: `Opslaan mislukt: ${error.message}` }); return; }
    setKmMsg({ type: "ok", text: "KM-vergoeding opgeslagen." });
    if (onBedrijfUpdate) onBedrijfUpdate({ ...bedrijf, km_vergoeding: kmRate });
  };

  const subBadge = () => {
    if (!subscription) return { label: "Geen abonnement", color: "#64748B", bg: "#F1F5F9" };
    if (subscription.status === "active") return { label: "Actief", color: "#15803D", bg: "#DCFCE7" };
    if (subscription.status === "trialing") {
      const days = subscription.trial_ends_at ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / 86400000)) : 0;
      return { label: `Proefperiode — ${days} dag${days===1?"":"en"} resterend`, color: "#92400E", bg: "#FEF3C7" };
    }
    if (subscription.status === "canceled") return { label: "Opgezegd", color: "#B91C1C", bg: "#FEE2E2" };
    return { label: subscription.status, color: "#64748B", bg: "#F1F5F9" };
  };
  const sb = subBadge();
  const showUpgradeBtn = !subscription || subscription.status === "canceled" || subscription.status === "trialing";

  if (loading) return <div style={{padding:24,color:"#888"}}>Laden...</div>;

  return (
    <div>
      <div className="ph"><div><div className="pg-title">Instellingen</div><div className="pg-sub">Automatisering, reiskosten en abonnement</div></div></div>

      <div className="sec-ttl" style={{marginBottom:12}}>📧 E-mail automatisering</div>
      <div className="card cp" style={{display:"flex",flexDirection:"column",gap:20}}>
        <Toggle label="Automatische review e-mail" desc="Stuur automatisch een review-verzoek als een werkbon op 'Afgerond' wordt gezet" value={settings.auto_review_email} onChange={v=>setSettings({...settings,auto_review_email:v})}/>
        <div style={{borderTop:"1px solid #F1F5F9"}}/>
        <Toggle label="Automatische betalingsherinnering" desc="Stuur een herinnering voor openstaande facturen vóór de vervaldatum" value={settings.auto_reminder_email} onChange={v=>setSettings({...settings,auto_reminder_email:v})}/>
        {settings.auto_reminder_email && (
          <div className="ig" style={{maxWidth:240}}>
            <label className="ilbl">Dagen voor vervaldatum</label>
            <input className="inp" type="number" min="1" max="30" value={settings.reminder_days_before} onChange={e=>setSettings({...settings,reminder_days_before:Math.max(1,parseInt(e.target.value)||3)})}/>
          </div>
        )}
        <div style={{borderTop:"1px solid #F1F5F9"}}/>
        <Toggle label="Automatische factuurherinnering" desc="Stuur een herinnering nadat een factuur verstuurd is en nog onbetaald is" value={settings.auto_invoice_reminder} onChange={v=>setSettings({...settings,auto_invoice_reminder:v})}/>
        {settings.auto_invoice_reminder && (
          <div className="ig" style={{maxWidth:240}}>
            <label className="ilbl">Dagen na factuurdatum</label>
            <input className="inp" type="number" min="1" max="90" value={settings.invoice_reminder_days} onChange={e=>setSettings({...settings,invoice_reminder_days:Math.max(1,parseInt(e.target.value)||7)})}/>
          </div>
        )}
      </div>
      {msg.text && <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:msg.type==="ok"?"#DCFCE7":"#FEE2E2",color:msg.type==="ok"?"#15803D":"#B91C1C"}}>{msg.text}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,marginBottom:28}}>
        <button className="btn btn-dark" onClick={save} disabled={saving}>{saving?"Opslaan…":"Opslaan"}</button>
      </div>

      <div className="sec-ttl" style={{marginBottom:12}}>🚗 Reiskosten</div>
      <div className="card cp">
        <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
          <div className="ig" style={{maxWidth:200,marginBottom:0}}>
            <label className="ilbl">KM-vergoeding (€/km)</label>
            <input className="inp" type="number" step="0.01" min="0" max="10" value={kmRate} onChange={e=>setKmRate(parseFloat(e.target.value)||0.23)} placeholder="0.23"/>
          </div>
          <button className="btn btn-dark" onClick={saveKmRate} disabled={kmSaving}>{kmSaving?"Opslaan…":"Opslaan"}</button>
        </div>
        {kmMsg.text && <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:kmMsg.type==="ok"?"#DCFCE7":"#FEE2E2",color:kmMsg.type==="ok"?"#15803D":"#B91C1C"}}>{kmMsg.text}</div>}
        <div style={{marginTop:10,fontSize:13,color:"#64748B"}}>De wettelijke standaard is €0,23/km. Pas aan naar je eigen tarief.</div>
      </div>

      <div className="sec-ttl" style={{marginTop:28,marginBottom:12}}>💳 Abonnement</div>
      <div className="card cp">
        <span style={{background:sb.bg,color:sb.color,borderRadius:8,padding:"4px 12px",fontSize:13,fontWeight:700,display:"inline-block",marginBottom:12}}>{sb.label}</span>
        {subscription?.status==="trialing" && <div style={{fontSize:13,color:"#64748B",marginBottom:12}}>Upgrade naar Pro om alle functies te behouden na de proefperiode.</div>}
        {subscription?.status==="active" && <div style={{fontSize:13,color:"#64748B",marginBottom:4}}>Je abonnement is actief. Beheer via je Stripe-portal.</div>}
        {showUpgradeBtn && (
          <a href={STRIPE_URL} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,textDecoration:"none"}}>⚡ Upgraden naar Pro</a>
        )}
      </div>

      {bedrijf && (
        <>
          <div className="sec-ttl" style={{marginTop:28,marginBottom:12}}>🏢 Bedrijfsprofiel</div>
          <div className="card cp">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,fontSize:13,marginBottom:16}}>
              {bedrijf.bedrijfsnaam&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>Bedrijfsnaam</div><div style={{fontWeight:600,color:"#111"}}>{bedrijf.bedrijfsnaam}</div></div>}
              {bedrijf.sector&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>Sector</div><div style={{color:"#374151"}}>{bedrijf.sector}</div></div>}
              {bedrijf.email&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>E-mail</div><div style={{color:"#374151"}}>{bedrijf.email}</div></div>}
              {bedrijf.telefoon&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>Telefoon</div><div style={{color:"#374151"}}>{bedrijf.telefoon}</div></div>}
              {bedrijf.website&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>Website</div><a href={bedrijf.website} target="_blank" rel="noopener noreferrer" style={{color:"#6366F1",fontWeight:600,textDecoration:"none"}}>{bedrijf.website}</a></div>}
              {bedrijf.kvk_nummer&&<div><div style={{color:"#94A3B8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>KVK</div><div style={{color:"#374151"}}>{bedrijf.kvk_nummer}</div></div>}
            </div>
            <button className="btn btn-outline" onClick={()=>openTab&&openTab("profiel")}>✎ Bedrijfsprofiel bewerken</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── WerkMate App ──────────────────────────────────────────────
function WerkMateApp({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [bedrijf, setBedrijf] = useState(null);
  const [prijslijst, setPrijslijst] = useState([]);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [mustSubscribe, setMustSubscribe] = useState(false);
  const [mobMore, setMobMore] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [emailSettings, setEmailSettings] = useState({
    auto_review_email: true,
    auto_reminder_email: true,
    reminder_days_before: 3,
    auto_invoice_reminder: false,
    invoice_reminder_days: 7,
  });
  const [subscription, setSubscription] = useState(null);
  const [orgOwnerId, setOrgOwnerId] = useState(user.id);
  const [isOrgInitialized, setIsOrgInitialized] = useState(false);

  // Data state
  const [offertes, setOffertes] = useState([]);
  const [klanten, setKlanten] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [facturen, setFacturen] = useState([]);
  const [werkbonnen, setWerkbonnen] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [planningCats, setPlanningCats] = useState([]);
  const [emailsLog, setEmailsLog] = useState([]);
  const [ritten, setRitten] = useState([]);
  const [uitgaven, setUitgaven] = useState([]);
  const [certificaten, setCertificaten] = useState([]);

  useEffect(() => {
    const initOrg = async () => {
      let ownerId = user.id;
      const { data: acceptedRecords } = await supabase.from("team").select("*").eq("accepted_user_id", user.id).limit(1);
      if (acceptedRecords?.length) {
        ownerId = acceptedRecords[0].user_id;
      } else {
        const { data: pendingRecords } = await supabase.from("team").select("*").eq("email", user.email).limit(1);
        if (pendingRecords?.length) {
          const pendingInvite = pendingRecords[0];
          ownerId = pendingInvite.user_id;
          if (!pendingInvite.accepted_user_id) {
            await supabase.from("team").update({ accepted_user_id: user.id, accepted_at: new Date().toISOString() }).eq("id", pendingInvite.id);
          }
        }
      }
      setOrgOwnerId(ownerId);
      setIsOrgInitialized(true);
    };
    initOrg();
  }, [user.id, user.email]);

  useEffect(() => {
    if (!isOrgInitialized) return;
    const laadData = async () => {
      const { data: profiel } = await supabase.from("bedrijfsprofiel").select("*").eq("user_id", orgOwnerId).single();
      if (profiel) { setBedrijf(profiel); setShowOnboard(false); }
      else { setShowOnboard(true); }

      if (!SUBSCRIPTION_WHITELIST.includes(user.email)) {
        const { data: sub } = await supabase.from("subscriptions").select("status,trial_ends_at").eq("user_id", orgOwnerId).maybeSingle();
        if (sub) {
          setSubscription(sub);
          const isActive = sub.status === "active";
          const inTrial = sub.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
          if (!isActive && !inTrial) {
            setMustSubscribe(true);
            setLoadingData(false);
            return;
          }
        }
      }

      await refreshAlles();
      setLoadingData(false);
    };
    laadData();
  }, [isOrgInitialized, orgOwnerId]);

  const refreshAlles = async () => {
      const ownerId = orgOwnerId || user.id;
      const [o, k, p, f, w, t, pc, el, ri, ui, ce] = await Promise.all([
        supabase.from("offertes").select("*").eq("user_id", ownerId).order("created_at", {ascending:false}),
        supabase.from("klanten").select("*").eq("user_id", ownerId).order("created_at", {ascending:false}),
        supabase.from("planning").select("*").eq("user_id", ownerId).order("datum",{ascending:true}).order("tijd",{ascending:true}),
        supabase.from("facturen").select("*").eq("user_id", ownerId).order("created_at", {ascending:false}),
        supabase.from("werkbonnen").select("*").eq("user_id", ownerId).order("created_at", {ascending:false}),
        supabase.from("team").select("*").eq("user_id", ownerId).order("created_at", {ascending:false}),
        supabase.from("planning_categorieen").select("*").eq("user_id", ownerId).order("naam", {ascending:true}),
        supabase.from("emails_log").select("*").eq("user_id", ownerId).order("sent_at", {ascending:false}),
        supabase.from("ritten").select("*").eq("user_id", ownerId).order("datum", {ascending:false}),
        supabase.from("uitgaven").select("*").eq("user_id", ownerId).order("datum", {ascending:false}),
        supabase.from("certificaten").select("*").eq("user_id", ownerId).order("vervaldatum", {ascending:true}),
      ]);
      setOffertes(o.data || []);
      setKlanten(k.data || []);
      setPlanning(p.data || []);
      setFacturen(f.data || []);
      setWerkbonnen(w.data || []);
      setTeamMembers(t.data || []);
      setPlanningCats(pc.data || []);
      setEmailsLog(el.data || []);
      setRitten(ri.data || []);
      setUitgaven(ui.data || []);
      setCertificaten(ce.data || []);
      const { data: esData } = await supabase.from("email_settings").select("*").eq("user_id", ownerId).maybeSingle();
      if (esData) setEmailSettings(esData);
    };

  const onDone = async (data) => {
    const {error}=await supabase.from("bedrijfsprofiel").insert({ ...data, user_id: orgOwnerId });
    if(error){console.error("Bedrijfsprofiel opslaan mislukt:",error);return;}
    setBedrijf(data);
    setPrijslijst(getPrijslijstTemplate(data.sector));
    setShowOnboard(false);
    setShowSubscription(true);
  };

  if (loadingData) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, fontFamily:"sans-serif" }}>
      ⚡ Laden...
    </div>
  );

  const render = () => {
    switch(tab) {
      case "dashboard":  return <DashboardTab openTab={setTab} bedrijf={bedrijf} offertes={offertes} planning={planning} facturen={facturen} klanten={klanten}/>;
      case "offertes":   return <OfferteTab prijslijst={prijslijst} userId={orgOwnerId} offertes={offertes} klanten={klanten} refresh={refreshAlles} bedrijf={bedrijf}/>;
      case "prijslijst": return <PrijslijstTab initialItems={prijslijst} onSaveItems={setPrijslijst}/>;
      case "planning":   return <PlanningTab userId={orgOwnerId} planning={planning} refresh={refreshAlles} klanten={klanten||[]} teamMembers={teamMembers||[]} planningCats={planningCats||[]}/>;
      case "crm":        return <CRMTab userId={orgOwnerId} klanten={klanten} refresh={refreshAlles}/>;
      case "profiel":     return <ProfielTab userId={orgOwnerId} bedrijf={bedrijf} certificaten={certificaten} onSaved={async (updated)=>{setBedrijf(updated); await refreshAlles();}} />;
      case "facturen":   return <FinancienTab userId={orgOwnerId} facturen={facturen} uitgaven={uitgaven} refresh={refreshAlles} klanten={klanten} offertes={offertes} bedrijf={bedrijf} emailSettings={emailSettings}/>;
      case "team":       return <TeamTab ownerId={orgOwnerId} teamMembers={teamMembers} refresh={refreshAlles} bedrijf={bedrijf} />;
      case "werkregistratie": return <WerkbonnenTab userId={orgOwnerId} klanten={klanten} werkbonnen={werkbonnen} refresh={refreshAlles} bedrijf={bedrijf} emailSettings={emailSettings}/>;
      case "mail":       return <MailTab userId={orgOwnerId} emailsLog={emailsLog} refresh={refreshAlles}/>;
      case "social":     return <SocialTab/>;
      case "ritten":     return <RittenTab userId={orgOwnerId} ritten={ritten} refresh={refreshAlles} klanten={klanten} bedrijf={bedrijf}/>;
      case "instellingen": return <InstellingenTab userId={orgOwnerId} refresh={refreshAlles} bedrijf={bedrijf} subscription={subscription} onBedrijfUpdate={(b)=>setBedrijf(b)} openTab={setTab}/>;
      default: return PH[tab]?<Placeholder {...PH[tab]}/>:null;
    }
  };

  if (mustSubscribe) return (
    <>
      <style>{css}</style>
      <SubscriptieScherm bedrijfsnaam={bedrijf?.bedrijfsnaam} blocked={true} onLogout={() => supabase.auth.signOut()}/>
    </>
  );

  if (showSubscription) return (
    <>
      <style>{css}</style>
      <SubscriptieScherm bedrijfsnaam={bedrijf?.bedrijfsnaam} onSkip={()=>setShowSubscription(false)}/>
    </>
  );

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
        {/* bottom nav – mobile only (hidden via CSS on desktop) */}
        <nav className="mob-nav">
          {MOB_NAV.map(item => item.id === "meer"
            ? <button key="meer" className={`mob-nb${mobMore ? " mob-nb-on" : ""}`} onClick={() => setMobMore(m => !m)}>
                <span className="mob-nb-ic">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            : <button key={item.id} className={`mob-nb${tab === item.id && !mobMore ? " mob-nb-on" : ""}`} onClick={() => { setTab(item.id); setMobMore(false); }}>
                <span className="mob-nb-ic">{item.icon}</span>
                <span>{item.label}</span>
              </button>
          )}
        </nav>
        {/* Meer panel – mobile only */}
        {mobMore && (
          <div style={{position:"fixed",bottom:"calc(70px + env(safe-area-inset-bottom))",left:0,right:0,background:"#fff",zIndex:199,borderTop:"1px solid #E5E7EB",padding:"12px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,boxShadow:"0 -4px 20px rgba(0,0,0,.08)"}}>
            {MOB_MORE.map(item => (
              <button key={item.id} onClick={() => { setTab(item.id); setMobMore(false); }} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:tab===item.id?"#EEF2FF":"#F8FAFC",border:`1.5px solid ${tab===item.id?"#C7D2FE":"#E5E7EB"}`,borderRadius:12,color:tab===item.id?"#6366F1":"#374151",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                <span style={{fontSize:18}}>{item.icon}</span>{item.label}
              </button>
            ))}
            <button onClick={() => { setMobMore(false); onLogout(); }} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,color:"#EF4444",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",gridColumn:"1/-1"}}>
              <span style={{fontSize:18}}>🚪</span>Uitloggen
            </button>
          </div>
        )}
        {mobMore && <div onClick={() => setMobMore(false)} style={{position:"fixed",inset:0,zIndex:198}} />}
      </div>
    </>
  );
}

// ── Portal Page ───────────────────────────────────────────────
function PortalPage({ token }) {
  const [offerte, setOfferte] = useState(null);
  const [bedrijf, setBedrijf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("view"); // view | sign | done
  const [signing, setSigning] = useState(false);
  const [klantEmail, setKlantEmail] = useState("");
  const [signErr, setSignErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.from("offertes").select("*").eq("portal_token", token).single();
      if (e || !data) { setError("Offerte niet gevonden. Controleer de link."); setLoading(false); return; }
      setOfferte(data);
      if (data.status === "Geaccepteerd") setStep("done");
      const { data: bp } = await supabase.from("bedrijfsprofiel").select("bedrijfsnaam,logo,adres,email,telefoon,website").eq("user_id", data.user_id).single();
      setBedrijf(bp);
      setLoading(false);
    })();
  }, [token]);

  const handleSign = async (sig) => {
    setSigning(true); setSignErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_KEY}` },
        body: JSON.stringify({ action: "portal-sign", portal_token: token, handtekening: sig, klant_email: klantEmail }),
      });
      if (!r.ok) throw new Error("Ondertekenen mislukt");
      setStep("done");
    } catch(e) { setSignErr("Er ging iets mis. Probeer opnieuw."); }
    setSigning(false);
  };

  const fmtEur = (n) => `€ ${Number(n||0).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const regels = parseOfferRules(offerte);
  const subtotaal = offerte?.subtotaal ?? regels.reduce((s,r)=>s+(Number(r.aantal)||0)*(Number(r.prijs)||0),0);
  const btw = offerte?.btw ?? subtotaal * 0.21;
  const totaal = offerte?.totaal ?? subtotaal + btw;

  const portalStyle = {fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#F8FAFC",color:"#111"};
  const headStyle = {background:"#0F0F14",padding:"20px 24px",display:"flex",alignItems:"center",gap:16};

  if (loading) return <div style={{...portalStyle,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>⚡</div><div style={{color:"#64748B"}}>Laden…</div></div></div>;
  if (error) return <div style={{...portalStyle,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",maxWidth:400,padding:32}}><div style={{fontSize:40,marginBottom:16}}>⚠️</div><div style={{fontWeight:700,fontSize:18,color:"#111",marginBottom:8}}>Offerte niet gevonden</div><div style={{color:"#64748B"}}>{error}</div></div></div>;

  return (
    <div style={portalStyle}>
      <div style={headStyle}>
        {bedrijf?.logo && <img src={bedrijf.logo} alt="Logo" style={{height:40,width:40,objectFit:"contain",borderRadius:8,background:"#fff"}}/>}
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#fff"}}>{bedrijf?.bedrijfsnaam||"WerkMate"}</div>
          {bedrijf?.adres && <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{bedrijf.adres}</div>}
        </div>
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:"24px 16px"}}>
        {step === "done" ? (
          <div style={{textAlign:"center",padding:"48px 24px",background:"#fff",borderRadius:20,border:"1px solid #EAECF0"}}>
            <div style={{fontSize:56,marginBottom:16}}>✅</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:"#0F0F14",marginBottom:8}}>Offerte geaccepteerd!</div>
            <div style={{color:"#64748B",fontSize:15,lineHeight:1.6}}>Bedankt voor het ondertekenen. Er is automatisch een factuur aangemaakt. U ontvangt een bevestiging per e-mail.</div>
          </div>
        ) : (
          <>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #EAECF0",padding:"22px 24px",marginBottom:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#0F0F14",marginBottom:4}}>Offerte</div>
              <div style={{fontSize:13,color:"#64748B",marginBottom:16}}>Opgesteld voor: <strong style={{color:"#111"}}>{offerte.klant}</strong></div>
              {offerte.dienst && <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px 18px",border:"1px solid #E5E7EB",marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:14,color:"#111"}}>{offerte.dienst}</div>
                {offerte.omschrijving && <div style={{fontSize:13,color:"#64748B",marginTop:6,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{offerte.omschrijving}</div>}
              </div>}
              <div style={{overflowX:"auto",marginBottom:12}}>
              <table style={{width:"100%",minWidth:480,borderCollapse:"collapse",tableLayout:"fixed"}}>
                <colgroup>
                  <col style={{width:"44%"}}/>
                  <col style={{width:"10%"}}/>
                  <col style={{width:"12%"}}/>
                  <col style={{width:"17%"}}/>
                  <col style={{width:"17%"}}/>
                </colgroup>
                <thead><tr style={{background:"#F8FAFC",borderBottom:"1px solid #E5E7EB"}}>
                  <th style={{padding:"9px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>Omschrijving</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>Aantal</th>
                  <th style={{padding:"9px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>Eenheid</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>Prijs</th>
                  <th style={{padding:"9px 10px",textAlign:"right",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>Totaal</th>
                </tr></thead>
                <tbody>{regels.map((r,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #F5F5F5"}}>
                    <td style={{padding:"10px",fontSize:13,color:"#111",wordBreak:"break-word",whiteSpace:"pre-wrap"}}>{r.omschrijving}</td>
                    <td style={{padding:"10px",fontSize:13,textAlign:"right",whiteSpace:"nowrap"}}>{r.aantal}</td>
                    <td style={{padding:"10px",fontSize:13,color:"#64748B",whiteSpace:"nowrap"}}>{r.eenheid}</td>
                    <td style={{padding:"10px",fontSize:13,textAlign:"right",whiteSpace:"nowrap"}}>{fmtEur(r.prijs)}</td>
                    <td style={{padding:"10px",fontSize:13,fontWeight:700,textAlign:"right",whiteSpace:"nowrap"}}>{fmtEur((Number(r.aantal)||0)*(Number(r.prijs)||0))}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
              <div style={{textAlign:"right",fontSize:13,color:"#555",lineHeight:2,background:"#F8FAFC",borderRadius:10,padding:"12px 16px"}}>
                <div>Subtotaal: <strong>{fmtEur(subtotaal)}</strong></div>
                <div>BTW (21%): <strong>{fmtEur(btw)}</strong></div>
                <div style={{fontSize:18,fontWeight:800,color:"#0F0F14",marginTop:4}}>Totaal: {fmtEur(totaal)}</div>
              </div>
            </div>

            {offerte.opmerkingen && (
              <div style={{background:"#fff",borderRadius:16,border:"1px solid #EAECF0",padding:"18px 24px",marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Opmerkingen / garantie</div>
                <div style={{fontSize:14,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{offerte.opmerkingen}</div>
              </div>
            )}

            {step === "view" && (
              <div style={{background:"#fff",borderRadius:16,border:"1px solid #EAECF0",padding:"22px 24px",marginBottom:16}}>
                <div style={{fontSize:14,color:"#374151",marginBottom:16,lineHeight:1.6}}>
                  Gaat u akkoord met deze offerte? Vul uw e-mailadres in en zet uw digitale handtekening.
                </div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#6B7280",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>E-mailadres</label>
                <input value={klantEmail} onChange={e=>{setKlantEmail(e.target.value);setSignErr("");}} placeholder="uw@email.nl" style={{width:"100%",border:`1.5px solid ${signErr?"#EF4444":"#E5E7EB"}`,borderRadius:9,padding:"11px 13px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",marginBottom:signErr?6:14,boxSizing:"border-box",color:"#111"}}/>
                {signErr&&<div style={{color:"#EF4444",fontSize:12,marginBottom:14}}>{signErr}</div>}
                <button onClick={()=>{if(!klantEmail||!klantEmail.includes("@")){setSignErr("Vul een geldig e-mailadres in.");return;}setStep("sign");}} style={{background:"#0F0F14",color:"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                  Offerte ondertekenen
                </button>
                <div style={{marginTop:12,fontSize:12,color:"#94A3B8",lineHeight:1.5}}>Door te ondertekenen accepteert u de offerte en de daarin vermelde bedragen.</div>
              </div>
            )}

            {step === "sign" && (
              <div style={{background:"#fff",borderRadius:16,border:"1px solid #EAECF0",padding:"22px 24px"}}>
                <div style={{fontWeight:700,fontSize:15,color:"#0F0F14",marginBottom:4}}>Handtekening</div>
                <div style={{fontSize:13,color:"#64748B",marginBottom:16}}>Teken hieronder met uw vinger of muis om de offerte te accepteren.</div>
                <SignatureCanvas onSave={handleSign} label="Teken hier"/>
                {signing && <div style={{textAlign:"center",marginTop:12,color:"#6366F1",fontWeight:600}}>Verwerken…</div>}
                {signErr && <div style={{color:"#EF4444",marginTop:12,fontSize:13}}>{signErr}</div>}
                <button onClick={()=>setStep("view")} style={{marginTop:14,background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:0}}>← Terug</button>
              </div>
            )}
          </>
        )}
        <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"#94A3B8"}}>Beveiligd door <strong>WerkMate</strong></div>
      </div>
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────
function AdminPage() {
  const ADMIN_EMAIL = "mauritsverweij2010@gmail.com";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || session.user.email !== ADMIN_EMAIL) { setLoading(false); return; }
      setUser(session.user);
      loadStats();
    });
  }, []);

  const loadStats = async () => {
    const { data: profielen } = await supabase.from("bedrijfsprofiel").select("*").order("created_at",{ascending:false});
    const { data: subs } = await supabase.from("subscriptions").select("*");
    const activeCount = (subs||[]).filter(s=>s.status==="active").length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const newThisWeek = (profielen||[]).filter(p=>new Date(p.created_at)>weekAgo).length;
    setStats({ total:(profielen||[]).length, active:activeCount, newThisWeek });
    setUsers(profielen||[]);
    setLoading(false);
  };

  if (loading) return <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"sans-serif"}}>⚡ Laden…</div>;
  if (!user) return <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"sans-serif",textAlign:"center"}}><div><div style={{fontSize:40,marginBottom:16}}>🔒</div><div>Toegang geweigerd</div></div></div>;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#F4F4F6"}}>
      <div style={{background:"#0F0F14",padding:"20px 32px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#fff"}}>⚡ WerkMate Admin</div>
        <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,.4)"}}>{user.email}</span>
      </div>
      <div style={{maxWidth:1000,margin:"0 auto",padding:"28px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:28}}>
          {[{label:"Totaal gebruikers",val:stats?.total||0,color:"#6366F1"},{label:"Actieve abonnementen",val:stats?.active||0,color:"#10B981"},{label:"Nieuw deze week",val:stats?.newThisWeek||0,color:"#F59E0B"}].map(s=>(
            <div key={s.label} style={{background:"#fff",borderRadius:13,border:"1px solid #EAECF0",padding:"18px 20px"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:".7px",textTransform:"uppercase",color:"#94A3B8",marginBottom:6}}>{s.label}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:13,border:"1px solid #EAECF0",overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #F0F0F0",fontWeight:700,fontSize:14}}>Alle gebruikers</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#FAFAFA"}}>
                {["Bedrijf","Sector","Stad","Email","Aangemeld"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"}}>{h}</th>)}
              </tr></thead>
              <tbody>{users.map(u=>(
                <tr key={u.id} style={{borderTop:"1px solid #F5F5F5"}}>
                  <td style={{padding:"12px 14px",fontWeight:700,fontSize:13,color:"#111"}}>{u.bedrijfsnaam||"—"}</td>
                  <td style={{padding:"12px 14px",fontSize:13,color:"#555"}}>{u.sector||"—"}</td>
                  <td style={{padding:"12px 14px",fontSize:13,color:"#555"}}>{u.stad||"—"}</td>
                  <td style={{padding:"12px 14px",fontSize:13,color:"#6366F1"}}>{u.email||"—"}</td>
                  <td style={{padding:"12px 14px",fontSize:12,color:"#888"}}>{u.created_at?new Date(u.created_at).toLocaleDateString("nl-NL"):"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ritten Tab ────────────────────────────────────────────────
function RittenTab({ userId, ritten, refresh, klanten, bedrijf }) {
  const mob = useMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [filterDoel, setFilterDoel] = useState("Alle");
  const [filterMaand, setFilterMaand] = useState("");
  const todayStr = localToday();
  const [nieuw, setNieuw] = useState({datum:todayStr, vertrek:"", bestemming:"", km:"", doel:"zakelijk", klant:""});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [kmLoading, setKmLoading] = useState(false);

  const kmRate = Number(bedrijf?.km_vergoeding ?? 0.23);

  const calcKm = async (vertrek, bestemming) => {
    if (!vertrek.trim() || !bestemming.trim()) return;
    setKmLoading(true);
    try {
      const geocode = async (addr) => {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=nl,be,de`, {headers:{"User-Agent":"WerkMate/1.0"}});
        const d = await r.json();
        return d.length ? {lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)} : null;
      };
      const [from, to] = await Promise.all([geocode(vertrek), geocode(bestemming)]);
      if (!from || !to) { setKmLoading(false); return; }
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);
      const d = await r.json();
      if (d.code === "Ok" && d.routes?.length) {
        const km = Math.round(d.routes[0].distance / 100) / 10;
        setNieuw(prev => ({...prev, km: km.toString()}));
      }
    } catch(e) { console.warn("km calc:", e); }
    setKmLoading(false);
  };

  const filtered = ritten.filter(r => {
    if (filterDoel !== "Alle" && r.doel !== filterDoel) return false;
    if (filterMaand && !(r.datum||"").startsWith(filterMaand)) return false;
    return true;
  });

  const zakelijkKm  = ritten.filter(r=>r.doel==="zakelijk").reduce((s,r)=>s+Number(r.km||0),0);
  const priveKm     = ritten.filter(r=>r.doel==="privé").reduce((s,r)=>s+Number(r.km||0),0);
  const aftrekbaar  = zakelijkKm * kmRate;

  const add = async () => {
    if (!nieuw.vertrek || !nieuw.bestemming || !nieuw.km) return;
    setSaving(true);
    setSaveErr("");
    const { error } = await supabase.from("ritten").insert({
      datum: nieuw.datum,
      vertrek: nieuw.vertrek,
      bestemming: nieuw.bestemming,
      km: Number(nieuw.km),
      doel: nieuw.doel,
      klant: nieuw.klant || null,
      user_id: userId,
    });
    setSaving(false);
    if (error) { setSaveErr(error.message); return; }
    setShowAdd(false);
    setNieuw({datum:todayStr,vertrek:"",bestemming:"",km:"",doel:"zakelijk",klant:""});
    refresh();
  };

  const del = async (id) => { if(window.confirm("Rit verwijderen?")) { await supabase.from("ritten").delete().eq("id",id); refresh(); } };

  const exportXlsx = () => {
    const rows = filtered.map(r => ({
      Datum: r.datum, Vertrek: r.vertrek, Bestemming: r.bestemming,
      "KM": Number(r.km), "Doel": r.doel, "Klant": r.klant||"",
      "Vergoeding (€)": r.doel==="zakelijk" ? (Number(r.km)*kmRate).toFixed(2) : "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ritten");
    XLSX.writeFile(wb, `ritten-${filterMaand||"export"}.xlsx`);
  };

  const maanden = [...new Set(ritten.map(r=>(r.datum||"").slice(0,7)))].sort().reverse();
  const doelStyle = (d) => ({padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:filterDoel===d?"#0F0F14":"#fff",color:filterDoel===d?"#fff":"#555",borderColor:filterDoel===d?"#0F0F14":"#E5E7EB"});

  return (<div>
    <div className="ph">
      <div><div className="pg-title">Rittenregistratie</div><div className="pg-sub">{ritten.length} ritten geregistreerd · €{kmRate.toFixed(2)}/km</div></div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-ghost" onClick={exportXlsx}>📊 Export</button>
        <button className="btn btn-dark" onClick={()=>setShowAdd(true)}>+ Rit</button>
      </div>
    </div>

    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>
      <div className="sc"><div className="sl">Zakelijke KM</div><div className="sv" style={{color:"#6366F1"}}>{zakelijkKm.toFixed(0)} km</div></div>
      <div className="sc"><div className="sl">Privé KM</div><div className="sv" style={{color:"#64748B"}}>{priveKm.toFixed(0)} km</div></div>
      <div className="sc"><div className="sl">Aftrekbaar zakelijk</div><div className="sv" style={{color:"#10B981"}}>€ {aftrekbaar.toFixed(2)}</div></div>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {["Alle","zakelijk","privé"].map(d=><button key={d} onClick={()=>setFilterDoel(d)} style={doelStyle(d)}>{d==="Alle"?"Alle":d.charAt(0).toUpperCase()+d.slice(1)}</button>)}
      <select value={filterMaand} onChange={e=>setFilterMaand(e.target.value)} style={{border:"1.5px solid #E5E7EB",borderRadius:20,padding:"4px 14px",fontSize:12.5,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",outline:"none",background:"#fff",color:"#555"}}>
        <option value="">Alle maanden</option>
        {maanden.map(m=><option key={m} value={m}>{new Date(m+"-01").toLocaleDateString("nl-NL",{month:"long",year:"numeric"})}</option>)}
      </select>
    </div>

    {filtered.length === 0
      ? <LeegScherm icon="🚗" titel="Geen ritten" sub="Voeg je eerste rit toe" actie="+ Rit toevoegen" onActie={()=>setShowAdd(true)}/>
      : mob
        ? <div className="mob-card-list">{filtered.map(r=>(
            <div className="mob-card" key={r.id}>
              <div className="mob-card-top">
                <div className="mob-card-name">{r.vertrek} → {r.bestemming}</div>
                <span style={{background:r.doel==="zakelijk"?"#EEF2FF":"#F3F4F6",color:r.doel==="zakelijk"?"#6366F1":"#6B7280",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{r.doel}</span>
              </div>
              <div className="mob-card-amount" style={{fontSize:20}}>{r.km} km</div>
              <div className="mob-card-sub">{r.datum}{r.doel==="zakelijk"?` · €${(Number(r.km)*kmRate).toFixed(2)}`:" · Privé"}{r.klant?` · ${r.klant}`:""}</div>
              <div className="mob-card-actions"><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>✕</button></div>
            </div>
          ))}</div>
        : <div className="card"><div className="tw"><table><thead><tr>{["Datum","Vertrek","Bestemming","KM","Doel","Klant","Vergoeding",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(r=>(
              <tr key={r.id}>
                <td style={{color:"#888",fontSize:12}}>{r.datum}</td>
                <td style={{fontWeight:600}}>{r.vertrek}</td>
                <td style={{fontWeight:600}}>{r.bestemming}</td>
                <td style={{fontWeight:700}}>{r.km} km</td>
                <td><span style={{background:r.doel==="zakelijk"?"#EEF2FF":"#F3F4F6",color:r.doel==="zakelijk"?"#6366F1":"#6B7280",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{r.doel}</span></td>
                <td style={{color:"#555"}}>{r.klant||"—"}</td>
                <td style={{fontWeight:700,color:r.doel==="zakelijk"?"#10B981":"#9CA3AF"}}>{r.doel==="zakelijk"?`€${(Number(r.km)*kmRate).toFixed(2)}`:"—"}</td>
                <td><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>✕</button></td>
              </tr>
            ))}</tbody>
          </table></div></div>
    }

    {showAdd && <div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Rit toevoegen</div></div><button className="mc" onClick={()=>{setShowAdd(false);setSaveErr("");}}>✕</button></div>
      <div className="mb">
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Vertrekpunt</label><input className="inp" value={nieuw.vertrek} onChange={e=>setNieuw({...nieuw,vertrek:e.target.value})} onBlur={e=>nieuw.bestemming&&calcKm(e.target.value,nieuw.bestemming)} placeholder="Straat 1, Amsterdam"/></div>
        <div className="ig"><label className="ilbl">Bestemming</label><input className="inp" value={nieuw.bestemming} onChange={e=>setNieuw({...nieuw,bestemming:e.target.value})} onBlur={e=>nieuw.vertrek&&calcKm(nieuw.vertrek,e.target.value)} placeholder="Straat 2, Rotterdam"/></div>
        <div className="ig"><label className="ilbl">Afstand (km){kmLoading&&<span style={{marginLeft:6,fontSize:11,color:"#6366F1",fontWeight:600}}>Berekenen…</span>}</label><input className="inp" type="number" value={nieuw.km} onChange={e=>setNieuw({...nieuw,km:e.target.value})} placeholder="Wordt automatisch berekend"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig">
            <label className="ilbl">Doel</label>
            <div style={{display:"flex",borderRadius:9,overflow:"hidden",border:"1.5px solid #E5E7EB"}}>
              {["zakelijk","privé"].map(d=>(
                <button key={d} type="button" onClick={()=>setNieuw({...nieuw,doel:d})} style={{flex:1,padding:"10px 0",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,background:nieuw.doel===d?"#0F0F14":"#fff",color:nieuw.doel===d?"#fff":"#555",transition:"background .15s",borderRight:d==="zakelijk"?"1px solid #E5E7EB":"none"}}>
                  {d.charAt(0).toUpperCase()+d.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="ig"><label className="ilbl">Klant (optioneel)</label><select className="inp" value={nieuw.klant} onChange={e=>setNieuw({...nieuw,klant:e.target.value})}><option value="">—</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
        </div>
        {nieuw.km && nieuw.doel==="zakelijk" && <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:9,padding:"10px 13px",fontSize:13,color:"#15803D",marginBottom:12}}>Vergoeding: <strong>€{(Number(nieuw.km)*kmRate).toFixed(2)}</strong> ({kmRate.toFixed(2)}/km)</div>}
        {nieuw.km && nieuw.doel==="privé" && <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:9,padding:"10px 13px",fontSize:13,color:"#64748B",marginBottom:12}}>Privérit — geen zakelijke vergoeding</div>}
        {saveErr && <div style={{marginBottom:10,padding:"9px 13px",borderRadius:8,fontSize:13,fontWeight:500,background:"#FEE2E2",color:"#B91C1C"}}>{saveErr}</div>}
        <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setSaveErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={saving||!nieuw.vertrek||!nieuw.bestemming||!nieuw.km}>{saving?"Opslaan…":"Opslaan"}</button></div>
      </div>
    </div></div>}
  </div>);
}
