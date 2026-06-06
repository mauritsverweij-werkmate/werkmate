import { useState, useEffect, useRef, Component, Fragment } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import {
  LayoutDashboard, FileText, Tag, Calendar, Users, Building2,
  CreditCard, Mail, Share2, ClipboardList, Users2, Car, Settings,
  MoreHorizontal, X, Pencil, FileDown, Send, MessageCircle, Trash2,
  Phone, Camera, Image, Bell, Check, Sparkles, LogOut, Zap,
  AlertTriangle, Info, Link, Plus, ChevronDown, Star, RefreshCw,
  Eye, Download, Wrench, BarChart2, ScanLine, Tag as TagIcon, Save,
} from "lucide-react";

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

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||"").trim());
// Accepts 06-XXXXXXXX, 0XX-XXXXXXX, +316XXXXXXXXX, 0031... — strips spaces/dashes/dots first
const isValidDutchPhone = (v) => {
  const s = String(v||"").replace(/[\s\-\.\(\)]/g,"");
  return /^(\+31[1-9][0-9]{8}|0031[1-9][0-9]{8}|0[1-9][0-9]{8})$/.test(s);
};

async function acceptInviteToken(token, userId) {
  if (!token || !userId) return;
  await supabase.from("team")
    .update({ accepted_user_id: userId, accepted_at: new Date().toISOString() })
    .eq("invite_token", token);
  storageRemove(inviteStorageKey);
  storageRemove(inviteEmailStorageKey);
}

async function logEmail(userId, to, subject, type, body, status, htmlBody = null) {
  try {
    const row = { user_id: userId, to_email: to, subject, type, body: body || "", status, sent_at: new Date().toISOString() };
    if (htmlBody) row.html_body = htmlBody;
    await supabase.from("emails_log").insert(row);
  } catch(e) { console.warn("logEmail failed:", e); }
}

const fillVars = (text, vars) =>
  text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

const TEMPLATE_DEFAULTS = {
  offerte:    { subject: "Offerte van {bedrijfsnaam}", body: "Geachte {klantnaam},\n\nHierbij ontvangt u de offerte in de bijlage.\n\nBij vragen kunt u altijd contact met ons opnemen." },
  factuur:    { subject: "Factuur {nummer} van {bedrijfsnaam}", body: "Geachte {klantnaam},\n\nHierbij ontvangt u factuur {nummer} in de bijlage.\n\nBij vragen kunt u altijd contact met ons opnemen." },
  herinnering:{ subject: "Factuur {nummer} - nog openstaand ({bedrijfsnaam})", body: "Geachte {klantnaam},\n\nWij willen u vriendelijk herinneren aan openstaande factuur {nummer} van {bedrag}.\n\nGelieve het bedrag zo spoedig mogelijk over te maken." },
  review:     { subject: "Hoe was uw ervaring met {bedrijfsnaam}?", body: "Hallo {klantnaam},\n\nBedankt voor het vertrouwen in {bedrijfsnaam}! We hopen dat u tevreden bent over {dienst}.\n\nZou u een review willen achterlaten? Dat helpt ons enorm." },
};

// ── Login scherm ──────────────────────────────────────────────
function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [isRegistreren, setIsRegistreren] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [bericht, setBericht] = useState("");

  const handleReset = async () => {
    if (!email) { setBericht("❌ Vul je e-mailadres in."); return; }
    setLoading(true); setBericht("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setBericht(error ? "❌ " + error.message : "✅ Reset link verstuurd! Controleer je inbox.");
    setLoading(false);
  };

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

  const inputStyle = { width:"100%", border:"1.5px solid #E5E7EB", borderRadius:9, padding:"10px 13px", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", color:"#111", background:"#fff" };
  const berichtStyle = { background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:8, padding:"10px 13px", fontSize:12.5, color:"#4338CA", marginBottom:14 };

  return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 56px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>⚡</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:"#0F0F14" }}>WerkMate</div>
          <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>
            {showReset ? "Wachtwoord herstellen" : isRegistreren ? "Maak een gratis account aan" : "Log in op je account"}
          </div>
        </div>

        {showReset ? (
          <>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>E-mailadres</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="jouw@email.nl" onKeyDown={e=>e.key==="Enter"&&handleReset()} style={inputStyle}/>
            </div>
            {bericht && <div style={berichtStyle}>{bericht}</div>}
            <button onClick={handleReset} disabled={loading||!email}
              style={{ width:"100%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:!email?0.5:1, marginBottom:12 }}>
              {loading ? "Versturen…" : "Verstuur reset link"}
            </button>
            <div style={{ textAlign:"center", fontSize:13, color:"#888" }}>
              <span onClick={()=>{setShowReset(false);setBericht("");}} style={{ color:"#6366F1", fontWeight:600, cursor:"pointer" }}>← Terug naar inloggen</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>E-mailadres</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="jouw@email.nl" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={inputStyle}/>
            </div>
            <div style={{ marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#555", display:"block", marginBottom:5 }}>Wachtwoord</label>
              <input type="password" value={wachtwoord} onChange={e=>setWachtwoord(e.target.value)} placeholder="Minimaal 6 tekens" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={inputStyle}/>
            </div>
            {!isRegistreren && (
              <div style={{ textAlign:"right", marginBottom:16 }}>
                <span onClick={()=>{setShowReset(true);setBericht("");}} style={{ fontSize:12, color:"#6366F1", cursor:"pointer", fontWeight:500 }}>Wachtwoord vergeten?</span>
              </div>
            )}
            {bericht && <div style={berichtStyle}>{bericht}</div>}
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
          </>
        )}
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("WerkMate fout:", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F8FAFC", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          <div style={{ background:"#fff", border:"1.5px solid #E8EEF6", borderRadius:20, padding:"48px 40px", maxWidth:480, textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,.06)" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:"#0F172A", marginBottom:10 }}>Er ging iets mis</div>
            <div style={{ fontSize:14, color:"#64748B", lineHeight:1.65, marginBottom:28 }}>
              Er is een onverwachte fout opgetreden. Je gegevens zijn veilig — ververs de pagina om opnieuw te beginnen.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background:"linear-gradient(135deg,#6366F1,#8B5CF6)", color:"#fff", border:"none", borderRadius:12, padding:"13px 28px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
            >
              Pagina verversen
            </button>
            {this.state.error && (
              <details style={{ marginTop:20, textAlign:"left" }}>
                <summary style={{ fontSize:12, color:"#94A3B8", cursor:"pointer" }}>Technische details</summary>
                <pre style={{ fontSize:11, color:"#64748B", marginTop:8, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/portal/")) {
    const token = path.replace("/portal/", "").split(/[?#]/)[0];
    return <ErrorBoundary><style>{css}</style><PortalPage token={token}/></ErrorBoundary>;
  }
  if (path === "/admin") {
    return <ErrorBoundary><style>{css}</style><AdminPage/></ErrorBoundary>;
  }
  return <ErrorBoundary><AuthApp/></ErrorBoundary>;
}

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"dashboard",       icon:"⊞",  label:"Dashboard",    color:"#64748B" },
  { id:"offertes",        icon:"📋", label:"Offertes",     color:"#8B5CF6" },
  { id:"crm",             icon:"👥", label:"Klanten",      color:"#14B8A6" },
  { id:"planning",        icon:"📅", label:"Planning",     color:"#3B82F6" },
  { id:"werkregistratie", icon:"🔧", label:"Werkbonnen",   color:"#F97316" },
  { id:"facturen",        icon:"💶", label:"Financiën",    color:"#22C55E" },
  { id:"team",            icon:"👷", label:"Team",         color:"#6366F1" },
  { id:"mail",            icon:"✉️", label:"Mail",         color:"#3B82F6" },
];

const MOB_PRIMARY = ["dashboard","offertes","planning","crm","facturen"];
const MOB_NAV = [
  { id:"dashboard", icon:"⊞",  label:"Dashboard",  color:"#64748B" },
  { id:"offertes",  icon:"📋", label:"Offertes",   color:"#8B5CF6" },
  { id:"planning",  icon:"📅", label:"Planning",   color:"#3B82F6" },
  { id:"crm",       icon:"👥", label:"Klanten",    color:"#14B8A6" },
  { id:"facturen",  icon:"💶", label:"Financiën",  color:"#22C55E" },
  { id:"meer",      icon:"☰",  label:"Meer",       color:"#9CA3AF" },
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
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
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
.mob-back{background:none;border:none;color:#6366F1;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;display:flex;align-items:center;gap:3px;padding:6px 0;-webkit-tap-highlight-color:transparent;white-space:nowrap}
.mob-screen-ttl{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#0F0F14;flex:1}
.mob-screen-scroll{flex:1;overflow-y:auto;padding:16px;padding-bottom:calc(80px + env(safe-area-inset-bottom))}
.mob-det-section{background:#fff;border-radius:16px;border:1px solid #EAECF0;padding:18px;margin-bottom:10px}
.mob-det-amount{font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:#0F0F14;margin-bottom:4px}
.mob-det-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #F3F4F6}
.mob-det-row:last-child{border-bottom:none}
.mob-det-lbl{font-size:13px;color:#64748B}
.mob-det-val{font-size:13.5px;font-weight:600;color:#0F0F14;text-align:right;flex:1;margin-left:10px}
.mob-det-action-btn{display:flex;align-items:center;gap:14px;width:100%;padding:15px 16px;background:#fff;border-radius:14px;border:1px solid #EAECF0;margin-bottom:8px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:600;color:#0F0F14;-webkit-tap-highlight-color:transparent;min-height:52px;text-align:left;transition:background .1s}
.mob-det-action-btn:active{background:#F8FAFF}
.mob-det-action-btn.danger{color:#EF4444;border-color:#FECACA;background:#FEF2F2}
.mob-det-action-ic{display:flex;align-items:center;justify-content:center;width:28px;flex-shrink:0}
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
.shell{display:flex;height:100vh;background:#F1F5F9;font-family:'Plus Jakarta Sans',sans-serif;overflow:hidden}
.sidebar{width:220px;min-width:220px;background:#0F0F14;display:flex;flex-direction:column;overflow:hidden}
.sb-logo{padding:22px 20px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-mark{display:flex;align-items:center;gap:9px;margin-bottom:2px}
.sb-icon{width:30px;height:30px;background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px}
.sb-name{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#fff}
.sb-sub{font-size:9.5px;color:rgba(255,255,255,.28);letter-spacing:.5px;text-transform:uppercase;margin-left:39px}
.nav-wrap{flex:1;padding:12px 10px;overflow-y:auto}
.nb{width:100%;display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:8px;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:500;margin-bottom:1px;text-align:left;transition:all .14s;background:transparent;color:rgba(255,255,255,.45);position:relative}
.nb:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.8)}
.nb.on{background:rgba(255,255,255,.1);color:#fff;font-weight:600}
.nb.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;background:#fff;border-radius:0 2px 2px 0;opacity:.5}
.nb-ic{font-size:15px;width:18px;text-align:center;flex-shrink:0;line-height:1}
.sb-user{margin:10px;padding:11px 13px;background:rgba(255,255,255,.05);border-radius:10px;border:1px solid rgba(255,255,255,.06)}
.su-role{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.26);margin-bottom:3px}
.su-name{font-size:13px;font-weight:700;color:#fff}
.su-plan{font-size:10.5px;color:rgba(255,255,255,.3);margin-top:1px}
.logout-btn{width:100%;margin-top:8px;background:rgba(255,255,255,.08);border:none;border-radius:7px;padding:7px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .14s}
.logout-btn:hover{background:rgba(255,255,255,.14);color:#fff}
.sb-acct{margin:10px;position:relative}
.sb-acct-btn{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;cursor:pointer;transition:background .14s}
.sb-acct-btn:hover{background:rgba(255,255,255,.11)}
.sb-acct-av{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0}
.sb-acct-name{font-size:12.5px;font-weight:700;color:#fff;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
.sb-acct-sub{font-size:10px;color:rgba(255,255,255,.35);text-align:left}
.sb-acct-chevron{margin-left:auto;font-size:10px;color:rgba(255,255,255,.35);flex-shrink:0}
.sb-acct-dd{position:absolute;bottom:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.14);padding:6px;z-index:200;min-width:180px}
.sb-dd-item{width:100%;display:flex;align-items:center;gap:9px;padding:9px 12px;background:none;border:none;border-radius:8px;font-size:13px;font-weight:600;color:#374151;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;text-align:left;transition:background .1s}
.sb-dd-item:hover{background:#F3F4F6}
.sb-dd-sep{border:none;border-top:1px solid #F1F5F9;margin:4px 0}
.main{flex:1;overflow-y:auto;padding:28px 32px;background:#F1F5F9}
.pg-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#0F0F14;letter-spacing:-0.02em;margin-bottom:2px}
.pg-sub{font-size:0.95rem;color:#6b7280}
.ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.sec-ttl{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#0F0F14;margin-bottom:10px}
.btn{border:none;border-radius:10px;padding:9px 17px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .14s;white-space:nowrap;letter-spacing:.1px}
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
.btn-blue{background:#EFF6FF;color:#1D4ED8;border:1.5px solid #BFDBFE}
.btn-blue:hover{background:#DBEAFE;border-color:#60A5FA}
.btn-green{background:#F0FDF4;color:#15803D;border:1.5px solid #BBF7D0}
.btn-green:hover{background:#DCFCE7;border-color:#4ADE80}
.btn-amber{background:#FFFBEB;color:#92400E;border:1.5px solid #FDE68A}
.btn-amber:hover{background:#FEF3C7;border-color:#FCD34D}
.btn-indigo{background:#EEF2FF;color:#4338CA;border:1.5px solid #C7D2FE}
.btn-indigo:hover{background:#E0E7FF;border-color:#818CF8}
.btn-primary{background:#6366F1;color:#fff}
.btn-primary:hover{background:#4F46E5;transform:translateY(-1px)}
.card{background:#fff;border-radius:14px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.cp{padding:20px 22px}
.sg{display:grid;gap:12px;margin-bottom:20px}
.sc{background:#fff;border-radius:14px;padding:16px 20px;border:1px solid #E2E8F0;transition:transform .14s,box-shadow .14s;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.sc:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
.sl{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#94A3B8;margin-bottom:6px}
.sv{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F0F14}
.ss{font-size:11px;color:#94A3B8;margin-top:2px}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse}
thead tr{background:#FAFAFA;border-bottom:1px solid #F0F0F0}
th{padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#94A3B8}
tbody tr{border-top:1px solid #F5F5F5;transition:background .1s}
tbody tr:hover{background:#FAFBFC}
td{padding:12px 14px;font-size:13px;color:#374151}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.bdot{width:5px;height:5px;border-radius:50%}
.inp{width:100%;border:1.5px solid #E2E8F0;border-radius:12px;padding:11px 16px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#0F172A;outline:none;transition:border-color .18s,box-shadow .2s;background:#fff;font-weight:400}
.inp:hover{border-color:#CBD5E1}
.inp:focus{border-color:#6366F1;box-shadow:0 0 0 3.5px rgba(99,102,241,.13)}
.inp::placeholder{color:#CBD5E1}
select.inp{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1.5l6 6 6-6' stroke='%236366F1' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:42px;cursor:pointer}
select.inp:focus{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1.5l6 6 6-6' stroke='%234F46E5' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
textarea.inp{min-height:100px;resize:vertical;line-height:1.65}
.ilbl{font-size:11.5px;font-weight:600;color:#64748B;display:block;margin-bottom:6px;letter-spacing:.25px;text-transform:uppercase}
.ig{margin-bottom:16px}
.sel{appearance:none;-webkit-appearance:none;border:1.5px solid #E2E8F0;border-radius:9px;padding:6px 30px 6px 11px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#0F172A;outline:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236366F1' stroke-width='1.7' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 9px center;cursor:pointer;transition:border-color .16s,box-shadow .18s;font-weight:400}
.sel:hover{border-color:#CBD5E1}
.sel:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}
.modal{background:#fff;border-radius:20px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 32px 64px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.04)}
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
.off-tbl-grid{display:grid;grid-template-columns:1fr 60px 90px 84px 75px 68px 36px;align-items:center;gap:0}
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
.off-inp{height:36px;width:100%;box-sizing:border-box;border:1.5px solid #E2E8F0;border-radius:9px;padding:0 10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#0F172A;outline:none;background:#fff;transition:border-color .16s,box-shadow .18s;font-weight:400}
.off-inp-ta{height:auto;min-height:36px;padding:8px 10px;resize:none;overflow:hidden;line-height:1.5;vertical-align:top}
.off-inp:hover{border-color:#CBD5E1}
.off-inp:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.11)}
.off-inp.right{text-align:right}
.off-inp.center{text-align:center}
.off-inp::-webkit-outer-spin-button,.off-inp::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.off-inp{-moz-appearance:textfield}
select.off-inp{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%236366F1' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:26px;cursor:pointer}
.tot-box{text-align:right;font-size:12.5px;color:#555;line-height:2;padding:11px 14px;background:#FAFAFA;border-radius:9px;margin-bottom:12px}
.modal-act{position:sticky;bottom:0;background:#fff;padding:12px 0 0;margin-top:4px;display:flex;gap:9px}
.note-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:11px 13px;font-size:12px;color:#78350F;margin-bottom:14px;line-height:1.5}
.pl-row{display:flex;align-items:center;gap:9px;padding:11px 0;border-bottom:1px solid #F5F5F5}
.pl-inp{border:1.5px solid #E2E8F0;border-radius:9px;padding:7px 11px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#0F172A;outline:none;transition:border-color .16s,box-shadow .18s;background:#fff;font-weight:400}
.pl-inp:hover{border-color:#CBD5E1}
.pl-inp:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.11)}
select.pl-inp{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%236366F1' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:26px;cursor:pointer}
.pl-inp.no-spinner::-webkit-outer-spin-button,
.pl-inp.no-spinner::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
.pl-inp.no-spinner{ -moz-appearance:textfield; }
.pl-cat{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#94A3B8;padding:3px 7px;background:#F3F4F6;border-radius:5px;white-space:nowrap}
.f-nr{font-weight:700;color:#6366F1;font-size:13px;white-space:nowrap}
.f-klant{font-weight:600;color:#0F0F14;max-width:180px}
.f-date{color:#64748B;font-size:13px;white-space:nowrap}
.f-overdue{color:#DC2626;font-weight:700}
.f-amt{font-weight:700;color:#0F0F14;white-space:nowrap}
.f-actions{display:flex;gap:5px;align-items:center;flex-wrap:nowrap}
.f-btn{display:inline-flex;align-items:center;gap:4px;border:1.5px solid #E2E8F0;background:#fff;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;color:#374151;transition:all .15s;white-space:nowrap;line-height:1}
.f-btn:hover{border-color:#6366F1;color:#6366F1;background:#F5F3FF}
.f-btn-remind{border-color:#FDE68A;color:#92400E;background:#FFFBEB}
.f-btn-remind:hover{border-color:#F59E0B;background:#FEF3C7;color:#78350F}
.f-btn-del{border-color:#FECACA;color:#EF4444;background:#FFF5F5;padding:5px 8px;font-size:13px;line-height:1}
.f-btn-del:hover{background:#FEE2E2;border-color:#EF4444}
.f-btn-mail{border-color:#BFDBFE;color:#1D4ED8;background:#EFF6FF}
.f-btn-mail:hover{background:#DBEAFE;border-color:#60A5FA}
.f-btn-pdf{border-color:#E2E8F0;color:#374151;background:#fff}
.f-btn-pdf:hover{border-color:#9CA3AF;background:#F9FAFB}
.f-status-sel{appearance:none;-webkit-appearance:none;border:1.5px solid #E2E8F0;border-radius:8px;padding:5px 26px 5px 10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#374151;outline:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236366F1' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center;cursor:pointer;transition:border-color .15s,background-color .15s;font-weight:500;min-width:118px}
.f-status-sel:hover{border-color:#CBD5E1}
.f-status-sel:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.11)}
.f-status-concept{border-color:#E2E8F0;color:#6B7280;background-color:#F9FAFB}
.f-status-verstuurd{border-color:#C7D2FE;color:#3730A3;background-color:#EEF2FF}
.f-status-herinnering{border-color:#FDE68A;color:#92400E;background-color:#FFFBEB}
.f-status-betaald{border-color:#A7F3D0;color:#065F46;background-color:#ECFDF5}
.f-status-verlopen{border-color:#FECACA;color:#B91C1C;background-color:#FEF2F2}
.mail-tabs{display:flex;gap:6px;margin-bottom:18px}
.mail-tab{padding:7px 15px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;color:#555;transition:all .14s}
.mail-tab.on{background:#0F0F14;color:#fff;border-color:#0F0F14}
.soc-plat{display:flex;gap:8px;margin-bottom:16px}
.soc-btn{flex:1;padding:9px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:12.5px;font-weight:600;transition:all .14s;color:#555;text-align:center}
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
.sg-3{display:grid;gap:12px;margin-bottom:20px;grid-template-columns:repeat(3,1fr)}
.btw-row-mob{display:none}
.leeg{text-align:center;padding:48px 24px;color:#94A3B8}
.leeg-icon{font-size:36px;margin-bottom:12px}
.leeg-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#555;margin-bottom:6px}
.leeg-sub{font-size:12.5px}
@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
.dot{display:inline-block;animation:blink 1s infinite}
@keyframes voicePulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
.voice-btn-idle{width:34px;height:34px;border-radius:50%;background:#F1F5F9;border:1.5px solid #E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:background .15s}
.voice-btn-idle:hover{background:#E0E7FF;border-color:#A5B4FC}
.voice-btn-rec{width:34px;height:34px;border-radius:50%;background:#EF4444;border:2px solid #EF4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;animation:voicePulse 1.2s infinite;color:#fff}
.tip-row{font-size:12px;color:#6366F1;cursor:pointer;padding:3px 0}
.tip-row:hover{text-decoration:underline}
.cal-wrap{background:#fff;border-radius:14px;border:1px solid #E2E8F0;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.cal-nav{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #F0F3F8;background:#FAFBFD}
.cal-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#0F0F14}
.cal-nav-btn{background:#F1F5F9;border:none;border-radius:8px;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#475569;line-height:1;transition:all .14s}
.cal-nav-btn:hover{background:#E2E8F0;color:#0F172A}
.cal-view-toggle{display:flex;background:#F3F4F6;border-radius:9px;padding:3px;gap:2px}
.cal-vt-btn{background:transparent;border:none;border-radius:7px;padding:5px 14px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12.5px;font-weight:500;cursor:pointer;color:#666;transition:all .14s}
.cal-vt-btn.on{background:#fff;color:#0F0F14;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);background:#F8FAFC;border-bottom:1px solid #E5E7EB}
.cal-dow-cell{padding:8px 4px;text-align:center;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-day{min-height:96px;padding:7px 8px;border-right:1px solid #F0F3F8;border-bottom:1px solid #F0F3F8;cursor:pointer;transition:background .1s;box-sizing:border-box}
.cal-day:nth-child(7n){border-right:none}
.cal-day:hover{background:#F8FAFB}
.cal-day.empty{background:#FAFBFD;cursor:default;pointer-events:none}
.cal-day.today .cal-dn{background:#6366F1;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center}
.cal-dn{width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#374151;margin-bottom:3px}
.cal-task{border-radius:5px;padding:3px 6px;font-size:10.5px;font-weight:600;margin-bottom:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:#EEF2FF;color:#4338CA;border-left:2.5px solid #6366F1}
.cal-task.onderweg{background:#FEF3C7;color:#92400E;border-left-color:#F59E0B}
.cal-task.klaar{background:#F3F4F6;color:#9CA3AF;text-decoration:line-through;border-left-color:#D1D5DB}
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
.cal-wg-hdr-row{display:flex;border-bottom:1px solid #E2E8F0;background:#FAFBFD}
.cal-wg-hdr-spc{width:52px;flex-shrink:0;border-right:1px solid #F0F3F8;box-sizing:border-box}
.cal-wg-hdr-cell{flex:1;min-width:0;border-right:1px solid #F0F3F8;box-sizing:border-box}
.cal-wg-hdr-cell:last-child{border-right:none}
.cal-wg-dc.today-col{background:rgba(99,102,241,.018)}
.cal-wg-body-row{display:flex;overflow-y:auto;max-height:620px}
.cal-wg-tc{width:52px;flex-shrink:0;border-right:1px solid #F0F3F8;box-sizing:border-box;background:#FAFBFD}
.cal-wg-tl{height:40px;display:flex;align-items:flex-start;justify-content:flex-end;padding-right:8px;padding-top:3px;box-sizing:border-box;font-size:10.5px;font-weight:700;color:#94A3B8;letter-spacing:.2px}
.cal-wg-dc{flex:1;min-width:0;border-right:1px solid #F0F3F8;box-sizing:border-box;position:relative}
.cal-wg-dc:last-child{border-right:none}
.cal-wg-slot{position:absolute;left:0;right:0;height:0;border-top:1px dashed #F0F3F8;pointer-events:none}
.cal-task-blk{position:absolute;left:3px;right:3px;border-radius:7px;padding:5px 7px;overflow:hidden;background:#EEF2FF;color:#4338CA;cursor:pointer;box-sizing:border-box;font-size:10.5px;line-height:1.35;transition:opacity .1s,transform .1s;border-left:3px solid #6366F1}
.cal-task-blk:hover{opacity:.9;transform:scale(1.01)}
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
.cal-fp{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid #E5E7EB;background:#fff;font-size:11.5px;font-weight:600;cursor:pointer;color:#555;transition:all .14s;white-space:nowrap;font-family:'Plus Jakarta Sans',sans-serif}
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
  .mob-nb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:70px;gap:4px;padding:0 2px;border:none;background:transparent;color:#9CA3AF;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .15s}
  .mob-nb.mob-nb-on{color:#6366F1}
  .mob-nb-ic{display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1}
  .main{padding-bottom:calc(70px + env(safe-area-inset-bottom));padding-left:16px;padding-right:16px;padding-top:0}
  .ph{position:sticky;top:0;z-index:10;background:#F8FAFC;padding:16px 0 14px;margin-bottom:16px;border-bottom:1px solid #EAECF0}
  .ph .pg-title{font-size:20px}
  .mb [style*="1fr"]{grid-template-columns:1fr !important}
  .inp{font-size:16px;padding:13px 16px}
  .off-inp,.off-inp-ta{font-size:16px}
  .off-tbl{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px}
  .off-tbl-grid{min-width:520px}
  .btn{min-height:44px}
  .btn-sm{min-height:40px}
  .mob-hide{display:none}
  .modal{border-radius:20px 20px 0 0;max-height:calc(92dvh - 70px - env(safe-area-inset-bottom));position:fixed;bottom:calc(70px + env(safe-area-inset-bottom));left:0;right:0;max-width:100%;margin:0;overflow:hidden;display:flex;flex-direction:column}
  .modal .mh{flex-shrink:0}
  .modal .mb{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:22px}
  .overlay{align-items:flex-end;padding:0}
  .sg{grid-template-columns:1fr 1fr !important}
  .sc{padding:14px;border-radius:12px}
  .sv{font-size:20px}
  .dash-banner{padding:18px 20px;margin-bottom:14px}
  .db-name{font-size:18px}
  .modal-act{padding-bottom:max(10px,env(safe-area-inset-bottom))}
  .tab-scroll{overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;padding-bottom:2px;scrollbar-width:none}
  .tab-scroll::-webkit-scrollbar{display:none}
  .sg-3{grid-template-columns:1fr 1fr!important}
  .ph-wrap{flex-wrap:wrap;gap:10px}
  .btw-hdr-cols{display:none}
  .btw-row-desktop{display:none}
  .btw-row-mob{display:block}
  .pl-row{flex-wrap:wrap;gap:8px 6px}
  .pl-cat{display:none}
  .pl-inp{font-size:16px;min-height:40px}
  .off-tbl-act{flex-wrap:wrap;gap:8px}
  .cp [style*="1fr"]{grid-template-columns:1fr !important}
  .ph>div:first-child{flex:1;min-width:0}
  .ph-btns{flex-wrap:wrap;justify-content:flex-end}
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
        <button type="button" className="btn btn-dark btn-full" onClick={save}><Pencil size={14} strokeWidth={1.8}/> Handtekening plaatsen</button>
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

const fmtDatum = d => d ? new Date(d).toLocaleDateString("nl-NL", {day:"numeric",month:"long",year:"numeric"}) : d;

const formatMoney = (value) => {
  const num = typeof value === "string"
    ? parseFloat(value.toString().replace(/[€\s]/g, "").replace(/,/g, "."))
    : Number(value);
  return isNaN(num) ? "0,00" : num.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseOfferRules = (offer) => {
  if (!offer) return [];
  if (Array.isArray(offer.regels) && offer.regels.length > 0) return offer.regels;
  if (typeof offer.regels === "string") {
    try {
      const parsed = JSON.parse(offer.regels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { }
  }
  if (offer.regels && typeof offer.regels === "object" && !Array.isArray(offer.regels)) return [offer.regels];
  // Fallback: use subtotaal (ex-BTW). bedrag is inc-BTW and must NOT be used directly.
  const exBtw = offer.subtotaal != null && Number(offer.subtotaal) > 0
    ? Number(offer.subtotaal)
    : parseFloat((offer.bedrag||"0").toString().replace(/[^\d,.]/g,"").replace(/,/g,".")) / 1.21;
  return [{ omschrijving: offer.dienst || "Offerte", aantal: 1, eenheid: "stuk", prijs: isNaN(exBtw) ? 0 : parseFloat(exBtw.toFixed(2)), btw_pct: 21 }];
};

const companyEmailFields = bedrijf => ({
  company_name: bedrijf?.bedrijfsnaam || "",
  reply_to: bedrijf?.email || undefined,
  company_phone: bedrijf?.telefoon || undefined,
  company_email: bedrijf?.email || undefined,
  company_iban: bedrijf?.iban || undefined,
  company_website: bedrijf?.website || undefined,
});

const createOfferPdfDocument = (offer, bedrijf) => {
  const company = {
    bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate Bedrijf",
    telefoon: bedrijf?.telefoon || "",
    email: bedrijf?.email || "",
    adres: bedrijf?.adres || "",
    iban: bedrijf?.iban || "",
    kvk_nummer: bedrijf?.kvk_nummer || "",
    btw_nummer: bedrijf?.btw_nummer || "",
  };
  const regels = parseOfferRules(offer);
  const subtotal = offer.subtotaal != null ? Number(offer.subtotaal) : regels.reduce((sum, r) => sum + ((Number(r.aantal) || 0) * (Number(r.prijs) || 0)), 0);
  const btw = offer.btw != null ? Number(offer.btw) : Math.round(subtotal * 0.21 * 100) / 100;
  const total = offer.totaal != null ? Number(offer.totaal) : subtotal + btw;
  const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(String(company.bedrijfsnaam || "Bedrijf"), 20, 25);
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
  const regels4btw = regels;
  const btw9amt = regels4btw.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===9?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.09:s;},0);
  const btw21amt = regels4btw.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===21?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.21:s;},0);
  let sy = summaryY;
  doc.setFont("helvetica", "bold");
  doc.text(`Subtotaal:`, 140, sy);
  doc.text(`€ ${formatMoney(subtotal)}`, 190, sy, { align: "right" }); sy += 8;
  if (btw9amt > 0) {
    doc.text(`BTW 9%:`, 140, sy);
    doc.text(`€ ${formatMoney(btw9amt)}`, 190, sy, { align: "right" }); sy += 8;
  }
  if (btw21amt > 0) {
    doc.text(`BTW 21%:`, 140, sy);
    doc.text(`€ ${formatMoney(btw21amt)}`, 190, sy, { align: "right" }); sy += 8;
  }
  if (btw9amt === 0 && btw21amt === 0 && btw > 0) {
    doc.text(`BTW:`, 140, sy);
    doc.text(`€ ${formatMoney(btw)}`, 190, sy, { align: "right" }); sy += 8;
  }
  sy += 2;
  doc.setFontSize(13);
  doc.text(`Totaal:`, 140, sy);
  doc.text(`€ ${formatMoney(total)}`, 190, sy, { align: "right" });
  const offRateNote = btwRateLabel(regels);
  if (offRateNote) { sy += 7; doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130); doc.text(offRateNote, 190, sy, { align: "right" }); }

  let notesHeight = 0;
  if (offer.opmerkingen) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Opmerkingen / garantie:", 20, sy + 12);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(String(offer.opmerkingen), 170);
    doc.text(noteLines, 20, sy + 19);
    notesHeight = noteLines.length * 5 + 18;
  }

  const footerY = sy + 16 + notesHeight;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  let fy = footerY;
  doc.setFont("helvetica", "bold");
  doc.text("Contact", 20, fy);
  doc.setFont("helvetica", "normal");
  if (company.telefoon) { fy += 6; doc.text(`Telefoon: ${company.telefoon}`, 20, fy); }
  if (company.email)    { fy += 6; doc.text(`Email: ${company.email}`, 20, fy); }
  if (company.adres)    { fy += 6; doc.text(`Adres: ${company.adres}`, 20, fy); }
  if (company.kvk_nummer) { fy += 6; doc.text(`KVK: ${company.kvk_nummer}`, 20, fy); }
  if (company.btw_nummer) { fy += 6; doc.text(`BTW-nr: ${company.btw_nummer}`, 20, fy); }
  if (company.iban) {
    doc.setFont("helvetica", "bold");
    doc.text(`IBAN: ${company.iban}`, 110, footerY + 6);
    doc.setFont("helvetica", "normal");
  }
  doc.setTextColor(0, 0, 0);

  return doc;
};

const createOfferPdfBase64 = (offer, bedrijf) => {
  const dataUri = createOfferPdfDocument(offer, bedrijf).output("datauristring");
  const idx = dataUri.indexOf(",");
  return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
};

const btwRateLabel = (regels = []) => {
  const has9  = regels.some(r => Number(r.btw_pct ?? 21) === 9  && (Number(r.aantal)||0)*(Number(r.prijs)||0) > 0);
  const has21 = regels.some(r => Number(r.btw_pct ?? 21) === 21 && (Number(r.aantal)||0)*(Number(r.prijs)||0) > 0);
  if (has9 && has21) return "Inclusief BTW (9% en 21%)";
  if (has9)  return "Inclusief 9% BTW";
  if (has21) return "Inclusief 21% BTW";
  return "";
};

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
  const btw9f = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===9?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.09:s;},0);
  const btw21f = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===21?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.21:s;},0);
  const btwAmt = btw9f+btw21f, tot = sub + btwAmt;
  const nlFmt = n => n.toLocaleString("nl-NL", { minimumFractionDigits: 2 });

  doc.setFontSize(9.5); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text("Subtotaal (excl. BTW):", pageW / 2 + 5, y);
  doc.text(`€ ${nlFmt(sub)}`, pageW - margin - 2, y, { align: "right" }); y += 7;
  if (btw9f > 0) {
    doc.text("BTW 9%:", pageW / 2 + 5, y);
    doc.text(`€ ${nlFmt(btw9f)}`, pageW - margin - 2, y, { align: "right" }); y += 7;
  }
  if (btw21f > 0) {
    doc.text("BTW 21%:", pageW / 2 + 5, y);
    doc.text(`€ ${nlFmt(btw21f)}`, pageW - margin - 2, y, { align: "right" }); y += 7;
  }
  if (btw9f === 0 && btw21f === 0 && btwAmt > 0) {
    doc.text("BTW:", pageW / 2 + 5, y);
    doc.text(`€ ${nlFmt(btwAmt)}`, pageW - margin - 2, y, { align: "right" }); y += 7;
  }
  doc.setDrawColor(100, 100, 100); doc.line(pageW / 2, y, pageW - margin, y); y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17, 24, 39);
  doc.text("Totaal:", pageW / 2 + 5, y);
  doc.text(`€ ${nlFmt(tot)}`, pageW - margin - 2, y, { align: "right" });
  const fRateNote = btwRateLabel(regels);
  if (fRateNote) { y += 6; doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130); doc.text(fRateNote, pageW - margin - 2, y, { align: "right" }); }

  if (company.iban) {
    const ibanY = y + 16;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, ibanY - 5, pageW - 2 * margin, 14, "F");
    doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.4);
    doc.rect(margin, ibanY - 5, pageW - 2 * margin, 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Bankrekening:", margin + 3, ibanY + 2);
    doc.setFont("helvetica", "normal");
    doc.text(company.iban, margin + 36, ibanY + 2);
    if (company.bedrijfsnaam) doc.text(`t.n.v. ${company.bedrijfsnaam}`, pageW - margin - 3, ibanY + 2, { align: "right" });
  }

  const footerY = 270;
  doc.setDrawColor(229, 231, 235); doc.line(margin, footerY - 5, pageW - margin, footerY - 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
  const footerParts = [company.bedrijfsnaam, company.email, company.telefoon].filter(Boolean).join("  |  ");
  doc.text(footerParts, margin, footerY);
  let ffy = footerY + 6;
  if (company.adres) { doc.text(company.adres, margin, ffy); ffy += 6; }
  const regNrs = [company.kvk_nummer ? `KVK: ${company.kvk_nummer}` : null, company.btw_nummer ? `BTW-nr: ${company.btw_nummer}` : null].filter(Boolean).join("  |  ");
  if (regNrs) { doc.text(regNrs, margin, ffy); ffy += 6; }
  doc.text("Gelieve het bedrag over te maken binnen 14 dagen na factuurdatum.", margin, ffy);

  return doc;
};

const createFactuurPdfBase64 = (factuur, bedrijf) => createFactuurPdf(factuur, bedrijf).output("datauristring").split(",")[1];

// ── Email confirm modal ───────────────────────────────────────
function EmailConfirmModal({ toEmail, toName, onConfirm, onCancel, sending, sent, error }) {
  return (
    <div className="overlay"><div className="modal" style={{maxWidth:400}}>
      <div className="mh"><div><div className="mt">Email versturen</div></div><button className="mc" onClick={onCancel}><X size={16}/></button></div>
      <div className="mb">
        {sent
          ? <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>✓</div>
              <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>Email verstuurd</div>
              <div style={{color:"#64748B",fontSize:13}}>Naar {toEmail}</div>
            </div>
          : <>
              <p style={{fontSize:14,color:"#374151",marginBottom:16,lineHeight:1.6}}>
                Wil je een email sturen naar <strong>{toName || toEmail}</strong>?<br/>
                <span style={{color:"#64748B",fontSize:13}}>{toEmail}</span>
              </p>
              {error && <div style={{color:"#EF4444",fontSize:13,marginBottom:10}}>{error}</div>}
              <div className="modal-act">
                <button className="btn btn-ghost" onClick={onCancel}>Annuleren</button>
                <button className="btn btn-dark btn-full" onClick={onConfirm} disabled={sending}>{sending?"Versturen…":<><Mail size={14} strokeWidth={1.8}/> Verstuur</>}</button>
              </div>
            </>
        }
      </div>
    </div></div>
  );
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
function OnboardingWizard({ userId, onDone }) {
  const mob = useMobile();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState({ bedrijfsnaam:"", sector:"", telefoon:"", email:"", adres:"", logo:"", google_review_url:"" });
  const [logoPreview, setLogoPreview] = useState("");

  const sectoren = [
    {id:"elektricien",icon:"⚡",label:"Elektricien"},{id:"loodgieter",icon:"🔧",label:"Loodgieter"},
    {id:"bouw",icon:"🏗️",label:"Bouw"},{id:"schoonmaak",icon:"🧹",label:"Schoonmaak"},
    {id:"airco",icon:"❄️",label:"Airco/Klimaat"},{id:"tuinieren",icon:"🌿",label:"Tuinieren"},
    {id:"transport",icon:"🚚",label:"Transport"},{id:"beveiliging",icon:"🛡️",label:"Beveiliging"},
    {id:"catering",icon:"🍽️",label:"Catering"},{id:"overig",icon:"🔩",label:"Overig"},
  ];
  const STEPS = ["Bedrijf","Logo","Prijslijst","Reviews","Klaar"];

  const saveProfiel = async (fields) => {
    const { error } = await supabase.from("bedrijfsprofiel").upsert(
      { user_id: userId, ...fields },
      { onConflict: "user_id" }
    );
    return error;
  };

  const next = async (fields) => {
    if (fields) {
      if (fields.bedrijfsnaam && fields.bedrijfsnaam.length > 100) { setErr("Bedrijfsnaam mag maximaal 100 tekens zijn."); return; }
      if (fields.email && !isValidEmail(fields.email)) { setErr("Voer een geldig e-mailadres in."); return; }
      if (fields.telefoon && !isValidDutchPhone(fields.telefoon)) { setErr("Voer een geldig Nederlands telefoonnummer in (bijv. 06-12345678)."); return; }
      setSaving(true); setErr("");
      const error = await saveProfiel(fields);
      setSaving(false);
      if (error) { setErr("Opslaan mislukt. Probeer het opnieuw."); return; }
    }
    setStep(s => s + 1);
  };

  const skip = () => setStep(s => s + 1);

  const prijs = getPrijslijstTemplate(data.sector);
  const cardStyle = {background:"#fff",borderRadius:24,padding:mob?"28px 20px 24px":"44px 44px 36px",width:"100%",maxWidth:560,boxShadow:"0 24px 64px rgba(99,102,241,0.12)"};
  const h2 = {fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:"#111",marginBottom:4};
  const sub = {fontSize:13,color:"#888",marginBottom:16};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#F0F4FF 0%,#FAF5FF 100%)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 20px 48px",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={cardStyle}>
        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:6}}>⚡</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#0F0F14"}}>WerkMate instellen</div>
          <div style={{fontSize:13,color:"#94A3B8",marginTop:3}}>Duurt minder dan 2 minuten</div>
        </div>
        {/* Progress */}
        <div className="step-bar" style={{marginBottom:28}}>
          {STEPS.map((s,i)=>(
            <div key={s} className={`step ${i<step?"done":i===step?"active":"todo"}`}>
              <div className="step-dot">{i<step?"✓":i+1}</div>
              <div className="step-lbl">{s}</div>
            </div>
          ))}
        </div>

        {/* ── Stap 1: Bedrijfsgegevens ── */}
        {step===0&&<>
          <div style={h2}>Wat voor bedrijf heb je?</div>
          <div style={{...sub,marginBottom:14}}>Kies je sector — we stellen WerkMate dan voor jou in.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
            {sectoren.map(s=>(
              <div key={s.id} className={`onboard-card${data.sector===s.id?" sel":""}`} onClick={()=>setData({...data,sector:s.id})} style={{padding:"10px 4px"}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:"#111",lineHeight:1.3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:"#111",marginBottom:12}}>Jouw bedrijfsgegevens</div>
          <div className="ig"><label className="ilbl">Bedrijfsnaam *</label><input className="inp" maxLength={100} value={data.bedrijfsnaam} onChange={e=>setData({...data,bedrijfsnaam:e.target.value})} placeholder="Bijv. Jansen Installatie BV"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" type="tel" value={data.telefoon} onChange={e=>setData({...data,telefoon:e.target.value})} placeholder="06-12345678"/></div>
            <div className="ig"><label className="ilbl">E-mailadres</label><input className="inp" type="email" value={data.email} onChange={e=>setData({...data,email:e.target.value})} placeholder="info@bedrijf.nl"/></div>
          </div>
          <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={data.adres} onChange={e=>setData({...data,adres:e.target.value})} placeholder="Straat 12, 1234AB Amsterdam"/></div>
          {err&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:10}}>{err}</div>}
          <button className="btn btn-dark btn-full" style={{marginTop:4,opacity:(!data.sector||!data.bedrijfsnaam)?0.5:1}} disabled={saving||!data.sector||!data.bedrijfsnaam}
            onClick={()=>next({bedrijfsnaam:data.bedrijfsnaam,sector:data.sector,telefoon:data.telefoon,email:data.email,adres:data.adres,stad:""})}>
            {saving?"Opslaan…":"Volgende →"}
          </button>
        </>}

        {/* ── Stap 2: Logo ── */}
        {step===1&&<>
          <div style={h2}>Logo uploaden</div>
          <div style={sub}>Optioneel — je kunt dit ook later toevoegen via je profiel.</div>
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,border:"2px dashed #E2E8F0",borderRadius:16,padding:"36px 20px",cursor:"pointer",background:"#FAFAFA",marginBottom:14}}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={{maxWidth:180,maxHeight:110,objectFit:"contain",borderRadius:10}}/>
              : <>
                  <div style={{fontSize:44}}>🖼️</div>
                  <div style={{fontWeight:600,fontSize:14,color:"#374151"}}>Klik om je logo te kiezen</div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>PNG, JPG of SVG</div>
                </>}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
              const file=e.target.files?.[0]; if(!file)return;
              const r=new FileReader();
              r.onload=()=>{const s=r.result?.toString()||"";setData(d=>({...d,logo:s}));setLogoPreview(s);};
              r.readAsDataURL(file);
            }}/>
          </label>
          {logoPreview&&<button type="button" className="btn btn-ghost btn-sm" style={{marginBottom:14}} onClick={()=>{setLogoPreview("");setData(d=>({...d,logo:""}));}}><X size={14}/> Verwijderen</button>}
          {err&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:9}}>
            <button className="btn btn-ghost" onClick={skip}>Overslaan</button>
            <button className="btn btn-dark btn-full" disabled={saving} onClick={()=>logoPreview?next({logo:data.logo}):skip()}>{saving?"Opslaan…":"Volgende →"}</button>
          </div>
        </>}

        {/* ── Stap 3: Prijslijst ── */}
        {step===2&&<>
          <div style={h2}>Jouw startprijslijst</div>
          <div style={sub}>We hebben een standaardprijslijst klaargemaakt voor jouw sector. Je kunt dit later aanpassen onder <strong>Prijslijst</strong>.</div>
          <div style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:14,padding:"4px 16px",marginBottom:20}}>
            {prijs.slice(0,5).map((item,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<Math.min(4,prijs.length-1)?"1px solid #F1F5F9":"none"}}>
                <span style={{fontSize:13,color:"#374151"}}>{item.dienst}</span>
                <span style={{fontSize:13,fontWeight:600,color:"#111",whiteSpace:"nowrap",marginLeft:12}}>€ {item.prijs} / {item.eenheid}</span>
              </div>
            ))}
            {prijs.length>5&&<div style={{fontSize:12,color:"#94A3B8",padding:"8px 0"}}>+ {prijs.length-5} meer diensten</div>}
          </div>
          <div style={{display:"flex",gap:9}}>
            <button className="btn btn-ghost" onClick={skip}>Overslaan</button>
            <button className="btn btn-dark btn-full" onClick={skip}>Gebruik deze lijst →</button>
          </div>
        </>}

        {/* ── Stap 4: Google reviews ── */}
        {step===3&&<>
          <div style={h2}>Google reviews</div>
          <div style={sub}>Vraag klanten automatisch om een review na een klus. Optioneel — je kunt dit ook later instellen.</div>
          <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:14,padding:"14px 18px",marginBottom:18}}>
            <div style={{fontWeight:700,color:"#3730A3",fontSize:13,marginBottom:10}}>📍 Zo vind je jouw Google review link:</div>
            <div style={{fontSize:13,color:"#4338CA",lineHeight:2}}>
              <div>1. Ga naar <strong>Google Maps</strong></div>
              <div>2. Zoek je <strong>bedrijfsnaam</strong></div>
              <div>3. Klik op het tabblad <strong>"Reviews"</strong></div>
              <div>4. <strong>Kopieer de link</strong> uit de adresbalk</div>
            </div>
          </div>
          <div className="ig"><label className="ilbl">Review link (optioneel)</label><input className="inp" value={data.google_review_url} onChange={e=>setData({...data,google_review_url:e.target.value})} placeholder="https://g.page/r/..."/></div>
          {err&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:10}}>{err}</div>}
          <div style={{display:"flex",gap:9}}>
            <button className="btn btn-ghost" onClick={skip}>Overslaan</button>
            <button className="btn btn-dark btn-full" disabled={saving} onClick={()=>data.google_review_url?next({google_review_url:data.google_review_url}):skip()}>{saving?"Opslaan…":"Volgende →"}</button>
          </div>
        </>}

        {/* ── Stap 5: Klaar! ── */}
        {step===4&&(
          <div style={{textAlign:"center",padding:"8px 0 4px"}}>
            <div style={{fontSize:60,marginBottom:14}}>🎉</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#0F0F14",marginBottom:10}}>
              {data.bedrijfsnaam||"Je bedrijf"} staat klaar!
            </div>
            <div style={{fontSize:14,color:"#64748B",lineHeight:1.8,marginBottom:24}}>
              WerkMate is ingesteld voor jouw bedrijf.<br/>
              Maak je eerste offerte, klant of werkbon aan.
            </div>
            <button className="btn btn-ai btn-full" style={{fontSize:15,padding:"14px",justifyContent:"center"}} onClick={()=>onDone(data)}>
              🚀 Start met WerkMate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfielTab({ userId, bedrijf, certificaten, onSaved, certOnly=false }) {
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
    google_review_url: bedrijf?.google_review_url || "",
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
      google_review_url: bedrijf?.google_review_url || "",
    });
  }, [bedrijf]);

  const saveProfile = async () => {
    if (profile.bedrijfsnaam && profile.bedrijfsnaam.length > 100) { setSaveMsg({ type: "error", text: "Bedrijfsnaam mag maximaal 100 tekens zijn." }); return; }
    if (profile.email && !isValidEmail(profile.email)) { setSaveMsg({ type: "error", text: "Voer een geldig e-mailadres in." }); return; }
    if (profile.telefoon && !isValidDutchPhone(profile.telefoon)) { setSaveMsg({ type: "error", text: "Voer een geldig Nederlands telefoonnummer in (bijv. 06-12345678)." }); return; }
    setSaving(true);
    setSaveMsg({ type: "", text: "" });
    const payload = { ...profile, user_id: userId };
    const allowedColumns = ["user_id", "bedrijfsnaam", "sector", "stad", "adres", "telefoon", "email", "diensten", "logo", "kvk_nummer", "btw_nummer", "website", "iban", "km_vergoeding", "google_review_url"];
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
      {certOnly
        ? <div className="ph"><div><div className="pg-title">Certificaten</div><div className="pg-sub">Jouw VCA, NEN diploma's en andere certificaten</div></div></div>
        : <div className="ph"><div><div className="pg-title">Bedrijfsprofiel</div><div className="pg-sub">Bewerk je bedrijfsgegevens en logo</div></div></div>
      }
      {!certOnly&&<><div className="card cp">
        {profile.logo && (
          <div style={{marginBottom:18,textAlign:"center"}}>
            <img
              src={profile.logo}
              alt="Bedrijfslogo"
              style={{maxWidth:"100%",maxHeight:140,objectFit:"contain",borderRadius:10,cursor:"pointer",border:"1px solid #E5E7EB"}}
              onClick={() => setLogoLightbox(true)}
              title="Klik om te vergroten"
            />
            <div style={{marginTop:8}}>
              <button type="button" className="btn btn-ghost btn-sm" style={{color:"#EF4444",fontSize:13}} onClick={()=>setProfile({...profile,logo:""})}><X size={14}/> Logo verwijderen</button>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig"><label className="ilbl">Bedrijfsnaam</label><input className="inp" maxLength={100} value={profile.bedrijfsnaam} onChange={e=>setProfile({...profile,bedrijfsnaam:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Sector</label><input className="inp" value={profile.sector} onChange={e=>setProfile({...profile,sector:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Stad</label><input className="inp" value={profile.stad} onChange={e=>setProfile({...profile,stad:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Adres</label><input className="inp" value={profile.adres} onChange={e=>setProfile({...profile,adres:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={profile.telefoon} onChange={e=>setProfile({...profile,telefoon:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">KvK nummer</label><input className="inp" value={profile.kvk_nummer} onChange={e=>setProfile({...profile,kvk_nummer:e.target.value})} placeholder="12345678"/></div>
          <div className="ig"><label className="ilbl">BTW nummer</label><input className="inp" value={profile.btw_nummer} onChange={e=>setProfile({...profile,btw_nummer:e.target.value})} placeholder="NL123456789B01"/></div>
          <div className="ig"><label className="ilbl">Website</label><input className="inp" value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})} placeholder="https://jouwbedrijf.nl"/></div>
          <div className="ig"><label className="ilbl">IBAN</label><input className="inp" value={profile.iban} onChange={e=>setProfile({...profile,iban:e.target.value})} placeholder="NL00 BANK 0000 0000 00"/></div>
          <div className="ig"><label className="ilbl">Google review link</label><input className="inp" value={profile.google_review_url} onChange={e=>setProfile({...profile,google_review_url:e.target.value})} placeholder="https://g.page/r/..."/></div>
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
          ><X size={14}/></button>
        </div>
      )}
      </>}

      <div className="sec-ttl" style={{marginTop:28}}>📜 Documenten & Certificaten</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,color:"#64748B"}}>{(certificaten||[]).length} certificaten — {(certificaten||[]).filter(c=>{if(!c.vervaldatum)return false;const d=new Date(c.vervaldatum);const now=new Date();const days=(d-now)/86400000;return days>=0&&days<=30;}).length} verlopen binnenkort</div>
        <button className="btn btn-outline" onClick={()=>{setNieuwCert({naam:"",type:"",vervaldatum:"",notitie:""});setShowAddCert(true);}}><Plus size={14} strokeWidth={2}/> Certificaat</button>
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
              <button onClick={()=>{if(window.confirm("Certificaat verwijderen?"))supabase.from("certificaten").delete().eq("id",c.id).then(()=>onSaved&&onSaved(bedrijf));}} style={{position:"absolute",top:12,right:16,background:"none",border:"none",color:"#9CA3AF",fontSize:18,cursor:"pointer"}}><X size={14}/></button>
            </div>
          );
        })}</div>
      }
      {showAddCert&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Certificaat toevoegen</div></div><button className="mc" onClick={()=>setShowAddCert(false)}><X size={16}/></button></div><div className="mb">
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
          }}><Save size={14} strokeWidth={1.8}/>{savingCert?"Opslaan…":"Opslaan"}</button>
        </div>
      </div></div></div>}
    </div>
  );
}

// ── AI Offerte ─────────────────────────────────────────────────
function AIOfferte({ onClose, prijslijst, userId, onSaved, klanten, bedrijf, emailTemplates = {} }) {
  const [step,setStep]=useState(0);const [vraag,setVraag]=useState("");const [loading,setLoading]=useState(false);const [off,setOff]=useState(null);const [selectedKlantId,setSelectedKlantId]=useState("");const [newKlantEmail,setNewKlantEmail]=useState("");
  const [isRecording,setIsRecording]=useState(false);
  const recognitionRef=useRef(null);

  const startVoice=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Spraakherkenning is niet beschikbaar in jouw browser. Gebruik Chrome, Edge of Safari.");return;}
    if(isRecording){recognitionRef.current?.stop();return;}
    const rec=new SR();
    rec.lang="nl-NL";rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
    let final="";
    rec.onstart=()=>setIsRecording(true);
    rec.onresult=e=>{
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal)final+=t; else interim=t;
      }
      setVraag(final+interim);
    };
    rec.onend=()=>{setIsRecording(false);if(final)setVraag(final);};
    rec.onerror=e=>{setIsRecording(false);if(e.error!=="no-speech"&&e.error!=="aborted")alert("Spraakherkenning mislukt: "+e.error);};
    recognitionRef.current=rec;
    rec.start();
  };
  const selectedKlant = klanten?.find(k=>k.id?.toString()===selectedKlantId);
  useEffect(()=>{if(!selectedKlantId && klanten?.length){setSelectedKlantId(klanten[0].id?.toString()||"");} },[klanten, selectedKlantId]);
  const px=prijslijst.map(p=>`${p.dienst}: €${p.prijs} per ${p.eenheid}`).join(", ");

  const recalcTotals = (offer) => {
    if (!offer?.regels) return offer;
    const subtotaal = offer.regels.reduce((sum,r) => sum + (parseFloat(r.aantal)||0)*(parseFloat(r.prijs)||0), 0);
    const btw9  = parseFloat(offer.regels.reduce((s,r) => { const pct=Number(r.btw_pct??21); return pct===9  ? s+(parseFloat(r.aantal)||0)*(parseFloat(r.prijs)||0)*0.09 : s; }, 0).toFixed(2));
    const btw21 = parseFloat(offer.regels.reduce((s,r) => { const pct=Number(r.btw_pct??21); return pct===21 ? s+(parseFloat(r.aantal)||0)*(parseFloat(r.prijs)||0)*0.21 : s; }, 0).toFixed(2));
    const btw = parseFloat((btw9+btw21).toFixed(2));
    const totaal = parseFloat((subtotaal+btw).toFixed(2));
    return { ...offer, subtotaal, btw9, btw21, btw, totaal };
  };

  const updateOff = (patch) => setOff((prev) => prev ? recalcTotals({ ...prev, ...patch }) : prev);
  const updateRule = (index, field, value) => setOff((prev) => {
    if (!prev) return prev;
    const regels = (prev.regels || []).map((regel, i) => i === index ? { ...regel, [field]: field === "aantal" || field === "prijs" ? Number(value) : value } : regel);
    return recalcTotals({ ...prev, regels });
  });
  const addRule = () => setOff((prev) => {
    const regels = [...(prev?.regels || []), { omschrijving: "", aantal: 1, eenheid: "stuk", prijs: 0, btw_pct: 21 }];
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
    const tpl = emailTemplates?.offerte;
    const vars = { klantnaam: name, bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate", nummer: "" };
    const payload = {
      action: "send-offer-email",
      customer_email: email,
      customer_name: name,
      ...companyEmailFields(bedrijf),
      dienst,
      regels,
      subtotaal,
      btw,
      totaal,
      portal_url,
      ...(tpl?.subject ? { custom_subject: fillVars(tpl.subject, vars) } : {}),
      ...(tpl?.body    ? { custom_body:    fillVars(tpl.body,    vars) } : {}),
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
    const subjectLogged = tpl?.subject ? fillVars(tpl.subject, vars) : `Offerte voor ${name}`;
    await logEmail(userId, email, subjectLogged, "offerte", `Offerte — ${dienst}`, response.ok ? "verzonden" : "mislukt", response.ok ? data?.html : null);
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
        alert(`Offerte opgeslagen, maar de e-mail kon niet worden verzonden:\n${error?.message || error}\n\nProbeer het later opnieuw via de offertelijst.`);
      }
    }
    onSaved && onSaved();
    onClose();
  };

  return(<div className="overlay"><div className="modal modal-lg">
    <div className="mh"><div><div className="mt"><Sparkles size={14} strokeWidth={1.8}/> Slimme offerte generator</div><div className="ms">Gebruikt jouw prijslijst</div></div><button className="mc" onClick={onClose}><X size={16}/></button></div>
    <div className="mb">
      {step===0&&<><div className="ig"><label className="ilbl">Kies klant</label><select className="inp" value={selectedKlantId} onChange={e=>setSelectedKlantId(e.target.value)}>
          <option value="">Nieuwe klant...</option>
          {klanten?.map(k=> <option key={k.id} value={k.id?.toString()}>{k.naam}</option>)}
        </select></div>
        {!selectedKlant && <div className="ig"><label className="ilbl">Klant e-mail</label><input className="inp" value={newKlantEmail} onChange={e=>setNewKlantEmail(e.target.value)} placeholder="klant@email.nl"/></div>}
        {selectedKlant && selectedKlant.email && <div className="ig"><label className="ilbl">Klant e-mail</label><input className="inp" value={selectedKlant.email} disabled /></div>}
        <div className="ig">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <label className="ilbl" style={{marginBottom:0}}>Beschrijf de klantvraag</label>
            {isRecording&&<span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#EF4444",fontWeight:600}}><span style={{width:7,height:7,borderRadius:"50%",background:"#EF4444",display:"inline-block",animation:"blink .8s infinite"}}/> Luistert…</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <textarea className="inp" style={{flex:1,minHeight:72,resize:"vertical"}} value={vraag} onChange={e=>setVraag(e.target.value)} placeholder="Bijv: CV ketel onderhoud Utrecht, klant Jan Vermeer"/>
            <button type="button" className={isRecording?"voice-btn-rec":"voice-btn-idle"} onClick={startVoice} title={isRecording?"Stop opname":"Spreek in (nl)"}>
              {isRecording?"⏹":"🎤"}
            </button>
          </div>
        </div><div className="modal-act"><button className="btn btn-ai btn-full" onClick={gen} disabled={!vraag.trim()} style={{opacity:vraag.trim()?1:.5}}><Sparkles size={14} strokeWidth={1.8}/> Maak offerte</button></div></>}
      {step===1&&<div style={{textAlign:"center",padding:"44px 0"}}><div style={{fontSize:40,marginBottom:12}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Bezig<span className="dot">…</span></div></div>}
      {step===2&&off&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div className="ig"><label className="ilbl">Dienst</label><input className="inp" value={off.dienst} onChange={e=>updateOff({dienst:e.target.value})} /></div>
          <div className="ig"><label className="ilbl">Offerte omschrijving</label><textarea className="inp" value={off.omschrijving} onChange={e=>updateOff({omschrijving:e.target.value})} rows={3} /></div>
        </div>
        <div className="off-tbl">
          <div className="off-tbl-grid off-tbl-hdr mob-hide">
            <div className="off-cell">Omschrijving</div>
            <div className="off-cell right">Aantal</div>
            <div className="off-cell center">Eenheid</div>
            <div className="off-cell right">Prijs</div>
            <div className="off-cell center">BTW</div>
            <div className="off-cell right">Totaal</div>
            <div className="off-cell del"></div>
          </div>
          {off.regels?.map((r,i)=><Fragment key={i}>
            <div className="off-tbl-grid off-tbl-row mob-hide" style={{alignItems:"flex-start"}}>
              <div className="off-cell" style={{paddingTop:8}}><textarea className="off-inp off-inp-ta" rows={1} value={r.omschrijving} ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}} onChange={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";updateRule(i,"omschrijving",e.target.value);}}/></div>
              <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.1" value={r.aantal} onChange={e=>updateRule(i,"aantal",e.target.value)} /></div>
              <div className="off-cell center" style={{paddingTop:8}}><select className="off-inp center" value={r.eenheid} onChange={e=>updateRule(i,"eenheid",e.target.value)}>{["uur","stuk","st","m²","m","rit","dag","persoon","km"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
              <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.01" value={r.prijs} onChange={e=>updateRule(i,"prijs",e.target.value)} /></div>
              <div className="off-cell center" style={{paddingTop:8}}><select className="off-inp center" value={r.btw_pct??21} onChange={e=>updateRule(i,"btw_pct",Number(e.target.value))}>{[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}</select></div>
              <div className="off-cell off-cell-totaal" style={{paddingTop:12}}>€{((Number(r.aantal)||0)*(Number(r.prijs)||0)).toFixed(2)}</div>
              <div className="off-cell del" style={{paddingTop:8}}><button className="btn btn-danger btn-sm" onClick={()=>removeRule(i)}><X size={14}/></button></div>
            </div>
            <div className="btw-row-mob" style={{border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px",margin:"0 0 8px"}}>
              <div className="ig" style={{marginBottom:8}}><label className="ilbl">Omschrijving</label><textarea className="off-inp off-inp-ta" rows={2} value={r.omschrijving} onChange={e=>updateRule(i,"omschrijving",e.target.value)}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div className="ig" style={{marginBottom:0}}><label className="ilbl">Aantal</label><input className="off-inp" type="number" value={r.aantal} onChange={e=>updateRule(i,"aantal",e.target.value)} style={{textAlign:"center"}}/></div>
                <div className="ig" style={{marginBottom:0}}><label className="ilbl">Eenheid</label><select className="off-inp" value={r.eenheid} onChange={e=>updateRule(i,"eenheid",e.target.value)}>{["uur","stuk","st","m²","m","rit","dag","persoon","km"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div className="ig" style={{marginBottom:0}}><label className="ilbl">Prijs (€)</label><input className="off-inp" type="number" value={r.prijs} onChange={e=>updateRule(i,"prijs",e.target.value)} style={{textAlign:"right"}}/></div>
                <div className="ig" style={{marginBottom:0}}><label className="ilbl">BTW</label><select className="off-inp center" value={r.btw_pct??21} onChange={e=>updateRule(i,"btw_pct",Number(e.target.value))}>{[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}</select></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                <span style={{fontSize:13,fontWeight:700}}>= €{((Number(r.aantal)||0)*(Number(r.prijs)||0)).toFixed(2)}</span>
                <button className="btn btn-danger btn-sm" onClick={()=>removeRule(i)}>Verwijderen</button>
              </div>
            </div>
          </Fragment>)}
        </div>
        <button className="btn btn-outline" style={{marginBottom:12}} onClick={addRule}>+ Regel toevoegen</button>
        <div className="tot-box">
          <div>Subtotaal: <strong>€ {Number(off.subtotaal||0).toFixed(2)}</strong></div>
          {off.btw9>0&&<div>BTW 9%: <strong>€ {Number(off.btw9||0).toFixed(2)}</strong></div>}
          {(off.btw21>0||(off.btw9||0)===0)&&<div>BTW 21%: <strong>€ {Number(off.btw21??off.btw??0).toFixed(2)}</strong></div>}
          <div style={{fontSize:15,fontWeight:800,marginTop:3}}>Totaal: € {Number(off.totaal||0).toFixed(2)}</div>
        </div>
        <div className="ig"><label className="ilbl">Opmerkingen / garantietekst (optioneel)</label><textarea className="inp" rows={3} value={off.opmerkingen||""} onChange={e=>updateOff({opmerkingen:e.target.value})} placeholder="Bijv. 2 jaar garantie op installatie. Onderdelen inclusief. Geldigheid offerte: 30 dagen."/></div>
        <div className="modal-act"><button className="btn btn-ghost" onClick={()=>{setStep(0);setOff(null);setVraag("");}}>Opnieuw</button><button className="btn btn-ai" style={{flex:1,justifyContent:"center"}} onClick={opslaan}><Download size={14} strokeWidth={1.8}/> Opslaan & Verstuur</button></div>
      </>}
    </div>
  </div></div>);
}

// ── Dashboard ─────────────────────────────────────────────────
function DashboardTab({ openTab, bedrijf, offertes, planning, facturen, klanten, certificaten = [], userId, userEmail }) {
  const mob = useMobile();
  const hr=new Date().getHours();
  const gr=hr<12?"Goedemorgen":hr<18?"Goedemiddag":"Goedenavond";
  const openOffertes = offertes.filter(o=>o.status==="In afwachting").length;
  const td=new Date();const todayStr=`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
  const planningVandaag = planning.filter(p=>p.datum===todayStr).length;
  const openFacturen = facturen.filter(f=>f.status==="Openstaand"||f.status==="Herinnering"||f.status==="Verstuurd");
  const openBedrag = openFacturen.reduce((sum,f)=>{const t=f.totaal!=null?Number(f.totaal):parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."))||0;return sum+t;},0);

  const now = new Date(); now.setHours(0,0,0,0);
  const expiringCerts = certificaten.filter(c => {
    if (!c.vervaldatum) return false;
    const d = new Date(c.vervaldatum); d.setHours(0,0,0,0);
    const days = (d - now) / 86400000;
    return days >= 0 && days <= 30;
  }).map(c => {
    const d = new Date(c.vervaldatum); d.setHours(0,0,0,0);
    return { ...c, daysLeft: Math.round((d - now) / 86400000) };
  });

  useEffect(() => {
    if (!userId) return;
    const toEmail = bedrijf?.email || userEmail;
    if (!toEmail) return;
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token || import.meta.env.VITE_SUPABASE_KEY;

      // Only consider certs where today is a 5-day notification boundary:
      // day 30, 25, 20, 15, 10, 5 or 0 before expiry.
      const certsToNotify = expiringCerts.filter(c => c.daysLeft % 5 === 0);
      if (!certsToNotify.length) return;

      for (const c of certsToNotify) {
        // Check Supabase — never send more than once per day per cert
        const { data: alreadySent } = await supabase
          .from("cert_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("cert_id", c.id)
          .eq("sent_at", todayStr)
          .maybeSingle();
        if (alreadySent) continue;

        const datumStr = new Date(c.vervaldatum).toLocaleDateString("nl-NL", { day:"numeric", month:"long", year:"numeric" });
        const subject = `Certificaat verloopt binnenkort: ${c.naam}`;
        const message = `Goedendag,\n\nJe certificaat "${c.naam}" verloopt op ${datumStr} (nog ${c.daysLeft} dag${c.daysLeft !== 1 ? "en" : ""}).\n\nZorg dat je het op tijd verlengt zodat je werk niet stil komt te liggen.\n\nBekijk je certificaten via: https://app.werkmate.tech\n\nMet vriendelijke groet,\nHet WerkMate team`;
        try {
          const res = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ action: "send-compose-email", to_email: toEmail, subject, message }),
          });
          if (res.ok) {
            // Record in Supabase — UNIQUE constraint prevents duplicates even under race conditions
            await supabase.from("cert_notifications").insert({
              user_id: userId,
              cert_id: c.id,
              cert_naam: c.naam,
              sent_at: todayStr,
              days_left: c.daysLeft,
            });
            await logEmail(userId, toEmail, subject, "certificaat", message, "verzonden");
          }
        } catch(e) { /* silent — non-critical */ }
      }
    })();
  }, [userId]);

  return(<div>
    {expiringCerts.length > 0 && (
      <div style={{marginBottom:16,background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"14px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#92400E",marginBottom:6}}>⚠️ Certificaten verlopen binnenkort</div>
            {expiringCerts.map(c=>(
              <div key={c.id} style={{fontSize:13,color:"#78350F",marginBottom:3}}>
                <strong>{c.naam}</strong> — verloopt op {new Date(c.vervaldatum).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"})} ({c.daysLeft === 0 ? "vandaag!" : `nog ${c.daysLeft} dag${c.daysLeft !== 1 ? "en" : ""}`})
              </div>
            ))}
          </div>
          <button onClick={()=>openTab("profiel")} style={{whiteSpace:"nowrap",padding:"6px 14px",borderRadius:8,border:"1.5px solid #F59E0B",background:"#FEF3C7",color:"#92400E",fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",flexShrink:0}}>Bekijk certificaten</button>
        </div>
      </div>
    )}
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
    <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:mob?14:20}}>
      <div>
        <div className="sec-ttl">Planning vandaag</div>
        {planning.filter(p=>p.datum===todayStr).length===0
          ? <div className="card cp leeg"><div className="leeg-icon">📅</div><div className="leeg-title">Geen opdrachten vandaag</div><div className="leeg-sub">Voeg opdrachten toe via Planning</div></div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>{planning.filter(p=>p.datum===todayStr).slice(0,3).map((item,i)=><div className="pc" key={i}><div className="tp">{item.tijd}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:13.5}}>{item.klant}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{item.dienst}</div></div><Badge status={item.status}/></div>)}</div>
        }
      </div>
      <div><div className="sec-ttl">Snelle acties</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {[{icon: Sparkles, label:"Slimme offerte",tab:"offertes",bg:"#EEF2FF",border:"#C7D2FE",col:"#6366F1"},{icon: Mail, label:"Mail",tab:"mail",bg:"#F0FDF4",border:"#BBF7D0",col:"#16A34A"}]
          .map(({icon: QIcon, tab, bg, border, col, label})=><button key={tab} onClick={()=>openTab(tab)} style={{background:bg,border:`1.5px solid ${border}`,borderRadius:11,padding:"14px",cursor:"pointer",textAlign:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .14s"}} onMouseOver={e=>e.currentTarget.style.transform="translateY(-1px)"} onMouseOut={e=>e.currentTarget.style.transform="none"}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:5,color:col}}><QIcon size={22} strokeWidth={1.8}/></div><div style={{fontSize:12.5,fontWeight:700,color:col}}>{label}</div>
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

function OfferteTab({ prijslijst, userId, offertes, refresh, klanten, bedrijf, emailTemplates = {}, openTab }) {
  const mob = useMobile();
  const [showAI,setShowAI]=useState(false);
  const [mobDetail,setMobDetail]=useState(null);
  const [editOff,setEditOff]=useState(null);
  const [editSaving,setEditSaving]=useState(false);
  const [editSaved,setEditSaved]=useState(false);
  const [editSavedData,setEditSavedData]=useState(null);
  const [editResending,setEditResending]=useState(false);
  const [editResent,setEditResent]=useState(false);

  const closeEdit = () => { setEditOff(null); setEditSaved(false); setEditSavedData(null); setEditResending(false); setEditResent(false); };
  const openEdit = o => { closeEdit(); setEditOff({id:o.id,klant:o.klant||"",dienst:o.dienst||"",opmerkingen:o.opmerkingen||"",portal_token:o.portal_token||null,regels:parseOfferRules(o).map(r=>({...r}))}); };
  const setEditRegel = (i,f,v) => setEditOff(prev=>({...prev,regels:prev.regels.map((r,idx)=>idx===i?{...r,[f]:v}:r)}));
  const saveEdit = async () => {
    if(!editOff)return;
    setEditSaving(true);
    const regels=editOff.regels;
    const subtotaal=regels.reduce((s,r)=>s+(Number(r.aantal)||0)*(Number(r.prijs)||0),0);
    const btw=parseFloat(regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===0?s:s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*p/100;},0).toFixed(2));
    const totaal=parseFloat((subtotaal+btw).toFixed(2));
    await supabase.from("offertes").update({klant:editOff.klant,dienst:editOff.dienst,opmerkingen:editOff.opmerkingen,regels,subtotaal,btw,totaal,bedrag:`€ ${totaal.toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`}).eq("id",editOff.id);
    setEditSaving(false);
    setEditSavedData({...editOff,regels,subtotaal,btw,totaal});
    setEditSaved(true);
    refresh();
  };
  const parseBedrag = (o) => {
    if (o.totaal != null && Number(o.totaal) > 0) return Number(o.totaal);
    const bedrag = (o.bedrag||"0").replace(/[€\s]/g, "");
    const clean = bedrag.includes(",") ? bedrag.replace(/\./g, "").replace(",", ".") : bedrag;
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };
  const totaal = offertes.filter(o=>o.status==="Ondertekend").reduce((s,o)=>s+parseBedrag(o), 0);

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
    if (Array.isArray(offer.regels) && offer.regels.length > 0) return offer.regels;
    if (typeof offer.regels === "string") {
      try {
        const parsed = JSON.parse(offer.regels);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { }
    }
    if (offer.regels && typeof offer.regels === "object" && !Array.isArray(offer.regels)) return [offer.regels];
    const exBtw = offer.subtotaal != null && Number(offer.subtotaal) > 0
      ? Number(offer.subtotaal)
      : parseFloat((offer.bedrag||"0").replace(/[^\d,.]/g,"").replace(/,/g,".")) / 1.21;
    return [{ omschrijving: offer.dienst || "Offerte", aantal: 1, eenheid: "stuk", prijs: isNaN(exBtw) ? 0 : parseFloat(exBtw.toFixed(2)), btw_pct: 21 }];
  };

  const exportOfferPdf = (offer) => {
    try {
      const doc = createOfferPdfDocument(offer, bedrijf);
      doc.save(`${(offer.klant || "offerte").replace(/\s+/g, "_")}_offerte.pdf`);
    } catch (err) {
      console.error("PDF genereren mislukt:", err);
      alert("PDF kon niet worden gegenereerd. Probeer het opnieuw.");
    }
  };

  const resendOfferEmail = async (o) => {
    const k = (klanten||[]).find(x => x.naam === o.klant);
    const email = k?.email || "";
    if (!email) { alert("Geen e-mailadres bekend voor deze klant"); return null; }
    const portal_url = o.portal_token ? `https://app.werkmate.tech/portal/${o.portal_token}` : undefined;
    const tpl = emailTemplates?.offerte;
    const vars = { klantnaam: o.klant, bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate", nummer: "" };
    const regels = parseOfferRules(o);
    const payload = {
      action: "send-offer-email",
      customer_email: email,
      customer_name: o.klant,
      ...companyEmailFields(bedrijf),
      dienst: o.dienst,
      regels,
      subtotaal: o.subtotaal || 0,
      btw: o.btw || 0,
      totaal: o.totaal || 0,
      portal_url,
      ...(tpl?.subject ? { custom_subject: fillVars(tpl.subject, vars) } : {}),
      ...(tpl?.body    ? { custom_body:    fillVars(tpl.body,    vars) } : {}),
      attachments: [{
        type: "application/pdf",
        filename: `offerte-${o.klant.replace(/\s+/g,"_")}.pdf`,
        content: createOfferPdfBase64(o, bedrijf),
      }],
    };
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token || import.meta.env.VITE_SUPABASE_KEY;
    const response = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || data?.message || String(response.status));
    const subjectLogged = tpl?.subject ? fillVars(tpl.subject, vars) : `Offerte voor ${o.klant}`;
    await logEmail(userId, email, subjectLogged, "offerte", `Offerte — ${o.dienst}`, "verzonden", data?.html || null);
    return email;
  };

  return(<div>
    {showAI&&<AIOfferte onClose={()=>setShowAI(false)} prijslijst={prijslijst} userId={userId} klanten={klanten} onSaved={refresh} bedrijf={bedrijf} emailTemplates={emailTemplates}/>}

    {editOff&&<div className="overlay"><div className="modal modal-lg">
      <div className="mh"><div><div className="mt">Offerte bewerken</div></div><button className="mc" onClick={closeEdit}><X size={16}/></button></div>
      <div className="mb">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div className="ig"><label className="ilbl">Klant</label>
            <select className="inp" value={editOff.klant} onChange={e=>setEditOff({...editOff,klant:e.target.value})}>
              <option value="">— Kies klant —</option>
              {(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}
              {editOff.klant&&!(klanten||[]).find(k=>k.naam===editOff.klant)&&<option value={editOff.klant}>{editOff.klant}</option>}
            </select>
          </div>
          <div className="ig"><label className="ilbl">Dienst omschrijving</label>
            <input className="inp" value={editOff.dienst} onChange={e=>setEditOff({...editOff,dienst:e.target.value})}/>
          </div>
        </div>
        <div className="off-tbl">
          <div className="off-tbl-grid off-tbl-hdr mob-hide">
            <div className="off-cell">Omschrijving</div><div className="off-cell right">Aantal</div><div className="off-cell center">Eenheid</div><div className="off-cell right">Prijs</div><div className="off-cell center">BTW</div><div className="off-cell right">Totaal</div><div className="off-cell del"></div>
          </div>
          {editOff.regels.map((r,i)=>(
            <div key={i} className="off-tbl-grid off-tbl-row" style={{alignItems:"flex-start"}}>
              <div className="off-cell" style={{paddingTop:8}}><textarea className="off-inp off-inp-ta" rows={1} value={r.omschrijving} ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}} onChange={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";setEditRegel(i,"omschrijving",e.target.value);}}/></div>
              <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.1" value={r.aantal} onChange={e=>setEditRegel(i,"aantal",e.target.value)}/></div>
              <div className="off-cell center" style={{paddingTop:8}}><select className="off-inp center" value={r.eenheid} onChange={e=>setEditRegel(i,"eenheid",e.target.value)}>{["uur","stuk","st","m²","m","rit","dag","persoon","km"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
              <div className="off-cell" style={{paddingTop:8}}><input className="off-inp right" type="number" min="0" step="0.01" value={r.prijs} onChange={e=>setEditRegel(i,"prijs",e.target.value)}/></div>
              <div className="off-cell center" style={{paddingTop:8}}><select className="off-inp center" value={r.btw_pct??21} onChange={e=>setEditRegel(i,"btw_pct",Number(e.target.value))}>{[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}</select></div>
              <div className="off-cell off-cell-totaal" style={{paddingTop:12}}>€{((Number(r.aantal)||0)*(Number(r.prijs)||0)).toFixed(2)}</div>
              <div className="off-cell del" style={{paddingTop:8}}><button className="btn btn-danger btn-sm" onClick={()=>setEditOff(prev=>({...prev,regels:prev.regels.filter((_,ii)=>ii!==i)}))}><X size={14}/></button></div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{marginTop:8,marginBottom:16}} onClick={()=>setEditOff(prev=>({...prev,regels:[...prev.regels,{omschrijving:"",aantal:1,eenheid:"stuk",prijs:0,btw_pct:21}]}))}>+ Regel</button>
        {(()=>{const sub=editOff.regels.reduce((s,r)=>s+(Number(r.aantal)||0)*(Number(r.prijs)||0),0);const btw=editOff.regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===0?s:s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*p/100;},0);return<div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:10,padding:"12px 16px",marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>Subtotaal</span><span>€ {sub.toFixed(2)}</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:6}}><span>BTW</span><span>€ {btw.toFixed(2)}</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:"#111"}}><span>Totaal</span><span>€ {(sub+btw).toFixed(2)}</span></div></div>;})()}
        <div className="ig"><label className="ilbl">Opmerkingen</label><textarea className="inp" rows={2} value={editOff.opmerkingen} onChange={e=>setEditOff({...editOff,opmerkingen:e.target.value})} placeholder="Bijv. 2 jaar garantie op installatie."/></div>
        {editSaved ? (
          <div>
            <div style={{background:"#DCFCE7",border:"1px solid #86EFAC",borderRadius:10,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>✓</span>
              <div>
                <div style={{fontWeight:700,color:"#15803D",fontSize:14}}>Offerte opgeslagen</div>
                <div style={{color:"#166534",fontSize:12.5,marginTop:2}}>{editSavedData?.klant} · {editSavedData?.dienst} · €{editSavedData?.totaal?.toLocaleString("nl-NL",{minimumFractionDigits:2})}</div>
              </div>
            </div>
            {editResent
              ? <div style={{textAlign:"center",padding:"10px 0 4px",color:"#15803D",fontWeight:600,fontSize:14}}>✓ Verstuurd!</div>
              : <div className="modal-act">
                  <button className="btn btn-ghost" onClick={closeEdit}>Sluiten</button>
                  <button className="btn btn-dark btn-full" disabled={editResending} onClick={async()=>{
                    setEditResending(true);
                    try {
                      const r = await resendOfferEmail(editSavedData);
                      if (r !== null) { setEditResent(true); setTimeout(closeEdit, 2000); }
                    } catch(e) { alert("Versturen mislukt: "+e.message); }
                    setEditResending(false);
                  }}>{editResending?"Versturen…":"↺ Opnieuw versturen naar klant"}</button>
                </div>
            }
          </div>
        ) : (
          <div className="modal-act"><button className="btn btn-ghost" onClick={closeEdit}>Annuleren</button><button className="btn btn-dark btn-full" onClick={saveEdit} disabled={editSaving}><Save size={14} strokeWidth={1.8}/>{editSaving?"Opslaan…":"Opslaan"}</button></div>
        )}
      </div>
    </div></div>}

    {mob && mobDetail && (
      <MobDetailScreen title={mobDetail.klant} onBack={()=>setMobDetail(null)}>
        <div className="mob-det-section">
          <div className="mob-card-amount" style={{fontSize:32,margin:"0 0 8px"}}>{mobDetail.bedrag}</div>
          <Badge status={mobDetail.status}/>
          <div className="mob-det-row"><span className="mob-det-lbl">Dienst</span><span className="mob-det-val">{mobDetail.dienst||"—"}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Datum</span><span className="mob-det-val">{mobDetail.datum||"—"}</span></div>
          <div className="mob-det-row"><span className="mob-det-lbl">Klant</span><span className="mob-det-val">{mobDetail.klant}</span></div>
        </div>
        <button className="mob-det-action-btn" onClick={()=>{openEdit(mobDetail);setMobDetail(null);}}><span className="mob-det-action-ic"><Pencil size={18} strokeWidth={1.8} color="#6B7280"/></span>Bewerken</button>
        <button className="mob-det-action-btn" onClick={()=>exportOfferPdf(mobDetail)}><span className="mob-det-action-ic"><FileDown size={18} strokeWidth={1.8} color="#EF4444"/></span>PDF downloaden</button>
        <button className="mob-det-action-btn" onClick={async()=>{
          try {
            const email = await resendOfferEmail(mobDetail);
            if (!email) return;
            await supabase.from("offertes").update({status:"Verstuurd"}).eq("id",mobDetail.id);
            refresh(); setMobDetail({...mobDetail,status:"Verstuurd"});
            alert("Offerte verstuurd naar "+email);
          } catch(err) { alert("Versturen mislukt: "+err.message); }
        }}><span className="mob-det-action-ic"><Send size={18} strokeWidth={1.8} color="#3B82F6"/></span>Stuur naar klant</button>
        {mobDetail.portal_token&&<button className="mob-det-action-btn" onClick={()=>waOfferte(mobDetail,klanten,bedrijf)}><span className="mob-det-action-ic"><MessageCircle size={18} strokeWidth={1.8}/></span>Stuur via WhatsApp</button>}
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #EAECF0",padding:"14px 16px",marginBottom:8}}>
          <div style={{fontSize:13,color:"#64748B",marginBottom:8,fontWeight:600}}>Status wijzigen</div>
          <select value={mobDetail.status} onChange={async(e)=>{await supabase.from("offertes").update({status:e.target.value}).eq("id",mobDetail.id);refresh();setMobDetail({...mobDetail,status:e.target.value});}} className="inp">
            {["In afwachting","Verstuurd","Ondertekend","Afgewezen"].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Offerte verwijderen?")) { supabase.from("offertes").delete().eq("id",mobDetail.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic"><Trash2 size={18} strokeWidth={1.8} color="#EF4444"/></span>Verwijderen</button>
      </MobDetailScreen>
    )}
    <div className="ph"><div><div className="pg-title">Offertes</div><div className="pg-sub">{offertes.length} offertes</div></div><div className="ph-btns" style={{display:"flex",gap:8}}>{openTab&&<button className="btn btn-outline mob-hide" onClick={()=>openTab("prijslijst")}><TagIcon size={14} strokeWidth={1.8}/> Prijslijst</button>}<button className="btn btn-ai" onClick={()=>setShowAI(true)}><Sparkles size={14} strokeWidth={1.8}/> Slimme offerte</button></div></div>
    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
      {[
        {label:"In afwachting",val:offertes.filter(o=>o.status==="In afwachting").length,color:"#F59E0B"},
        {label:"Ondertekend",val:offertes.filter(o=>o.status==="Ondertekend").length,color:"#10B981"},
        {label:"Verstuurd",val:offertes.filter(o=>o.status==="Verstuurd").length,color:"#3B82F6"},
        {label:"Ondertekend waarde",val:`€ ${totaal.toLocaleString("nl-NL", {minimumFractionDigits:2, maximumFractionDigits:2})}` ,color:"#0F0F14"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color,fontSize:19}}>{s.val}</div></div>)}
    </div>
    {offertes.length===0
      ? <LeegScherm icon={<ClipboardList size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Nog geen offertes" sub="Maak je eerste offerte met de slimme generator" actie="Slimme offerte maken" onActie={()=>setShowAI(true)}/>
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
              <td style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(o)}><Pencil size={14} strokeWidth={1.8} color="#6B7280"/> Bewerken</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>exportOfferPdf(o)}><FileText size={14} strokeWidth={1.8} color="#EF4444"/> PDF</button>
                <button className="btn btn-blue btn-sm" onClick={async()=>{
                  try {
                    const email = await resendOfferEmail(o);
                    if (!email) return;
                    await supabase.from("offertes").update({status:"Verstuurd"}).eq("id",o.id); refresh();
                    alert("Verstuurd naar "+email);
                  } catch(err) { alert("Versturen mislukt: "+err.message); }
                }}><Mail size={14} strokeWidth={1.8}/> Mail</button>
                {o.portal_token&&<button className="btn btn-green btn-sm" onClick={()=>waOfferte(o,klanten,bedrijf)}><MessageCircle size={14} strokeWidth={1.8} color="#22C55E"/> WhatsApp</button>}
                <select value={o.status} onChange={async(e)=>{await supabase.from("offertes").update({status:e.target.value}).eq("id",o.id);refresh();}} className="sel">
                  {["In afwachting","Verstuurd","Ondertekend","Afgewezen"].map(s=><option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-danger btn-sm" onClick={()=>{ if(window.confirm("Offerte verwijderen?")) { supabase.from("offertes").delete().eq("id",o.id).then(()=>refresh()); } }}><Trash2 size={14} strokeWidth={1.8} color="#EF4444"/></button>
              </td>
            </tr>)}</tbody>
          </table></div></div>
    }
  </div>);
}

// ── Prijslijst ────────────────────────────────────────────────
// Fuzzy column detector for Excel import: returns the best-matching header key for each field.
function detectPrijslijstColumns(headers) {
  const scored = (keywords) => {
    let best = null, bestScore = 0;
    for (const h of headers) {
      const lh = String(h).toLowerCase();
      for (const kw of keywords) {
        const s = lh === kw ? 100 : lh.includes(kw) ? 80 : kw.includes(lh) && lh.length >= 3 ? 60 : 0;
        if (s > bestScore) { bestScore = s; best = h; }
      }
    }
    return bestScore >= 60 ? best : null;
  };
  return {
    dienst:    scored(["dienst","service","omschrijving","beschrijving","naam","artikel","product","activiteit","werk","taak","title","titel"]),
    prijs:     scored(["prijs","price","tarief","bedrag","rate","kosten","cost","euro","€","amount"]),
    eenheid:   scored(["eenheid","unit","per","maat"]),
    categorie: scored(["categorie","category","type","soort","groep","group"]),
  };
}

function PrijslijstTab({ initialItems, onSaveItems, userId }) {
  const [items,setItems]=useState(initialItems || []);
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [nieuw,setNieuw]=useState({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});
  const [importError,setImportError]=useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setItems(initialItems || []);
  }, [initialItems]);
  const upd=(id,f,v)=>setItems(p=>p.map(x=>x.id===id?{...x,[f]:v}:x));
  const del=(id)=>setItems(p=>p.filter(x=>x.id!==id));

  const saveToDb = async (list) => {
    if (!userId) return;
    setSaving(true);
    const { error: delErr } = await supabase.from("prijslijst_items").delete().eq("user_id", userId);
    if (delErr) { setSaving(false); alert("Opslaan mislukt: " + delErr.message); return; }
    if (list.length > 0) {
      const { error: insErr } = await supabase.from("prijslijst_items").insert(
        list.map(({dienst,eenheid,prijs,categorie}) => ({user_id:userId,dienst,eenheid,prijs:parseFloat(prijs)||0,categorie:categorie||"Overig"}))
      );
      if (insErr) { setSaving(false); alert("Opslaan mislukt: " + insErr.message); return; }
    }
    onSaveItems?.(list);
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const save=()=>saveToDb(items);
  const add=()=>{if(!nieuw.dienst||!nieuw.prijs)return;setItems(p=>[...p,{...nieuw,id:Date.now(),prijs:parseFloat(nieuw.prijs)}]);setNieuw({dienst:"",eenheid:"uur",prijs:"",categorie:"Arbeid"});setShowAdd(false);};
  const cats=[...new Set(items.map(i=>i.categorie))];

  const CAT_STYLE = {
    Arbeid:      { bg:"#F0FDF4", border:"#86EFAC", badge:"#DCFCE7", text:"#15803D" },
    Materiaal:   { bg:"#EFF6FF", border:"#93C5FD", badge:"#DBEAFE", text:"#1D4ED8" },
    Onderhoud:   { bg:"#FFFBEB", border:"#FCD34D", badge:"#FEF3C7", text:"#B45309" },
    Installatie: { bg:"#F5F3FF", border:"#C4B5FD", badge:"#EDE9FE", text:"#6D28D9" },
    Overig:      { bg:"#F8FAFC", border:"#CBD5E1", badge:"#F1F5F9", text:"#475569" },
  };
  const catStyle = cat => CAT_STYLE[cat] || { bg:"#F8FAFC", border:"#CBD5E1", badge:"#F1F5F9", text:"#475569" };

  const parsePrice = (value) => {
    const parsed = parseFloat(String(value || "").toString().replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    event.target.value = "";
    if (!rows.length) { setImportError({ type:"empty" }); return; }
    const headers = Object.keys(rows[0]);
    const cols = detectPrijslijstColumns(headers);
    if (!cols.dienst || !cols.prijs) {
      const missing = [!cols.dienst && "dienst / omschrijving", !cols.prijs && "prijs / tarief"].filter(Boolean);
      setImportError({ type:"cols", missing, found: headers });
      return;
    }
    const imported = rows.map((row, index) => {
      const dienst = String(row[cols.dienst] || "").trim();
      if (!dienst) return null;
      return {
        id: Date.now() + index,
        dienst,
        prijs: parsePrice(row[cols.prijs]),
        eenheid: cols.eenheid ? String(row[cols.eenheid] || "uur").trim() || "uur" : "uur",
        categorie: cols.categorie ? String(row[cols.categorie] || "Overig").trim() || "Overig" : "Overig",
      };
    }).filter(Boolean);
    if (!imported.length) { setImportError({ type:"norows" }); return; }
    setItems((current) => {
      const merged = [...current, ...imported];
      saveToDb(merged);
      return merged;
    });
  };
  return(<div>
    <div className="ph"><div><div className="pg-title">Prijslijst</div><div className="pg-sub">Jouw tarieven — de slimme generator gebruikt deze als basis</div></div><div className="ph-btns" style={{display:"flex",gap:8,alignItems:"center"}}><button className="btn btn-outline" onClick={()=>setShowAdd(true)}><Plus size={14} strokeWidth={2}/> Dienst</button><button className="btn btn-outline mob-hide" onClick={()=>fileInputRef.current?.click()}>Excel importeren</button><button className="btn btn-dark" onClick={save} disabled={saving}>{saving?"Opslaan…":saved?"✓ Opgeslagen!":"Opslaan"}</button><input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{display:"none"}} onChange={importFile} /></div></div>
    <div className="card cp">
      <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:9,padding:"10px 13px",marginBottom:18,fontSize:12.5,color:"#4338CA"}}>💡 De slimme offerte generator gebruikt jouw tarieven automatisch als basis.</div>
      {importError&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,padding:"14px 16px",marginBottom:18,fontSize:13,color:"#B91C1C",lineHeight:1.6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div>
            {importError.type==="empty"&&<><strong>Het bestand is leeg.</strong> Voeg rijen toe en probeer opnieuw.</>}
            {importError.type==="norows"&&<><strong>Geen geldige rijen gevonden.</strong> Controleer of de kolom met dienstnamen gevuld is.</>}
            {importError.type==="cols"&&<>
              <strong>Kolom niet herkend: {importError.missing.join(" en ")}.</strong><br/>
              Gevonden kolommen: <em>{importError.found.join(", ")}</em>.<br/>
              <span style={{color:"#991B1B"}}>Gebruik één van deze kolomnamen (hoofdletter maakt niet uit):</span>
              <div style={{marginTop:8,background:"#FFF1F2",border:"1px solid #FECDD3",borderRadius:6,padding:"8px 10px",fontFamily:"monospace",fontSize:12,color:"#7F1D1D",lineHeight:1.8}}>
                <strong>dienst</strong> &nbsp;of&nbsp; omschrijving &nbsp;|&nbsp; <strong>prijs</strong> &nbsp;of&nbsp; tarief &nbsp;|&nbsp; eenheid &nbsp;|&nbsp; categorie<br/>
                Schilderwerk buitengevel &nbsp;|&nbsp; 65 &nbsp;|&nbsp; uur &nbsp;|&nbsp; Arbeid<br/>
                Verfmateriaal &nbsp;|&nbsp; 18,50 &nbsp;|&nbsp; m² &nbsp;|&nbsp; Materiaal
              </div>
            </>}
          </div>
          <button onClick={()=>setImportError(null)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#B91C1C",flexShrink:0,padding:"0 2px"}}><X size={14}/></button>
        </div>
      </div>}
      {cats.map(cat=>{const cs=catStyle(cat);return(<div key={cat} style={{marginBottom:16,background:cs.bg,borderLeft:`3px solid ${cs.border}`,borderRadius:10,padding:"12px 14px"}}>
        <div style={{marginBottom:10}}>
          <span style={{background:cs.badge,color:cs.text,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,letterSpacing:".5px",textTransform:"uppercase",display:"inline-block"}}>{cat}</span>
        </div>
        {items.filter(i=>i.categorie===cat).map(item=><div key={item.id} className="pl-row">
          <input className="pl-inp" style={{flex:2}} value={item.dienst} onChange={e=>upd(item.id,"dienst",e.target.value)}/>
          <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:14,color:"#555",fontWeight:600}}>€</span><input className="pl-inp" style={{width:86,textAlign:"right"}} type="number" value={item.prijs} onChange={e=>upd(item.id,"prijs",parseFloat(e.target.value))}/></div>
          <span style={{fontSize:12,color:"#94A3B8"}}>per</span>
          <select className="pl-inp" style={{width:76}} value={item.eenheid} onChange={e=>upd(item.id,"eenheid",e.target.value)}>{["uur","st","m²","m","rit","dag"].map(u=><option key={u}>{u}</option>)}</select>
          <button className="btn btn-danger btn-sm" onClick={()=>del(item.id)}><X size={14}/></button>
        </div>)}
      </div>);})}
    </div>
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Dienst toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}><X size={14}/></button></div><div className="mb">
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
  const [deleteTaskDialog,setDeleteTaskDialog]=useState(null); // {id, herhaal_group_id, dienst, klant}
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
    const groupId=nieuw.herhaal?(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`):null;
    const rows=Array.from({length:count},(_,i)=>{
      const d=new Date(base);
      if(nieuw.herhaal==="daily")d.setDate(base.getDate()+i);
      else if(nieuw.herhaal==="weekly")d.setDate(base.getDate()+i*7);
      else if(nieuw.herhaal==="biweekly")d.setDate(base.getDate()+i*14);
      else if(nieuw.herhaal==="monthly")d.setMonth(base.getMonth()+i);
      return{datum:fmtDate(d),tijd:nieuw.tijd,eindtijd:nieuw.eindtijd||null,klant:nieuw.klant,adres:nieuw.adres,dienst:nieuw.dienst,status:nieuw.status,herhaal:nieuw.herhaal||null,herhaal_group_id:groupId,categorie:nieuw.categorie||null,medewerker:nieuw.medewerker||null,user_id:userId};
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
  const verwijderEnkel=async id=>{await supabase.from("planning").delete().eq("id",id);setDeleteTaskDialog(null);refresh();};
  const verwijderGroep=async groupId=>{await supabase.from("planning").delete().eq("herhaal_group_id",groupId);setDeleteTaskDialog(null);refresh();};
  const initieerVerwijder=t=>{
    if(t.herhaal_group_id){setDeleteTaskDialog(t);}
    else{if(window.confirm("Afspraak verwijderen?"))verwijderEnkel(t.id);}
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
    {deleteTaskDialog&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setDeleteTaskDialog(null)}>
        <div style={{background:"#fff",borderRadius:18,padding:"32px 28px",maxWidth:380,width:"100%",boxShadow:"0 24px 64px rgba(0,0,0,.18)"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:22,marginBottom:10}}><Trash2 size={20} strokeWidth={1.8}/></div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#0F172A",marginBottom:8}}>Afspraak verwijderen</div>
          <div style={{fontSize:14,color:"#64748B",marginBottom:24,lineHeight:1.6}}>
            <strong>{deleteTaskDialog.dienst}</strong> — {deleteTaskDialog.klant}<br/>
            Dit is een terugkerende afspraak. Wat wil je verwijderen?
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>verwijderEnkel(deleteTaskDialog.id)} style={{background:"#F8FAFC",border:"1.5px solid #E5E7EB",borderRadius:12,padding:"13px 18px",fontSize:14,fontWeight:700,cursor:"pointer",color:"#374151",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"left"}}>
              📅 Alleen deze afspraak verwijderen
            </button>
            <button onClick={()=>verwijderGroep(deleteTaskDialog.herhaal_group_id)} style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"13px 18px",fontSize:14,fontWeight:700,cursor:"pointer",color:"#DC2626",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"left"}}>
              Alle herhalingen verwijderen
            </button>
            <button onClick={()=>setDeleteTaskDialog(null)} style={{background:"none",border:"none",fontSize:14,color:"#94A3B8",cursor:"pointer",padding:"8px",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              Annuleren
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="ph">
      <div><div className="pg-title">Planning</div><div className="pg-sub">{planning.length} opdrachten totaal</div></div>
      <div style={{display:"flex",gap:8}}>
        {!mob&&<div className="cal-view-toggle">
          <button className={`cal-vt-btn${view==="month"?" on":""}`} onClick={()=>setView("month")}>Maand</button>
          <button className={`cal-vt-btn${view==="week"?" on":""}`} onClick={()=>setView("week")}>Week</button>
        </div>}
        {!mob&&<button className="btn btn-ghost" onClick={()=>setShowCats(true)} title="Categorieën beheren">🏷️</button>}
        <button className="btn btn-dark" onClick={()=>openAdd(mob?mobDayStr:todayStr)}><Plus size={14} strokeWidth={2}/> Opdracht</button>
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
                              <button className="btn btn-danger btn-sm" style={{fontSize:12}} onClick={e=>{e.stopPropagation();initieerVerwijder(t);}}><X size={14}/></button>
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
            const ds=fmtDate(d);const tasks=tasksFor(ds);const isToday=ds===todayStr;
            return<div key={i} className={`cal-wg-dc${isToday?" today-col":""}`}>
              <div style={{position:"relative",height:WG_TOTAL_H}}>
                {Array.from({length:WG_SLOTS},(_,j)=>(
                  <div key={j} className="cal-wg-slot" style={{top:j*WG_SLOT_H,borderTop:j%2===0?"1px solid #E8EDF5":"1px dashed #F3F5F9"}}/>
                ))}
                {tasks.map(t=>{
                  const top=wgTop(t.tijd);const height=wgH(t.tijd,t.eindtijd);
                  const cc=catColor(t);
                  const blkStyle=cc&&t.status!=="Klaar"?{background:cc+"22",color:cc,borderLeft:`3px solid ${cc}`}:{};
                  return<div key={t.id} className={`cal-task-blk${t.status==="Onderweg"?" onderweg":t.status==="Klaar"?" klaar":""}`} style={{top,height,...blkStyle}}>
                    <div className="cal-tbk-time">{t.eindtijd?`${t.tijd}–${t.eindtijd}`:t.tijd}</div>
                    <div className={`cal-tbk-name${t.status==="Klaar"?" done":""}`}>{t.klant}</div>
                    {height>44&&<div className="cal-tbk-dienst">{t.dienst}</div>}
                    <div className="cal-tbk-actions">
                      <button style={{background:"none",border:"1px solid currentColor",borderRadius:4,padding:"1px 5px",fontSize:9,cursor:"pointer",color:"currentColor",lineHeight:1.4}} onClick={e=>markDone(e,t.id,t.status)}>{t.status==="Klaar"?"↩":"✓"}</button>
                      <button style={{background:"none",border:"1px solid currentColor",borderRadius:4,padding:"1px 5px",fontSize:9,cursor:"pointer",color:"currentColor",lineHeight:1.4}} onClick={e=>{e.stopPropagation();initieerVerwijder(t);}}><X size={14}/></button>
                    </div>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>)}
    </div>}

    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Opdracht toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}><X size={14}/></button></div><div className="mb">
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
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.klant||!nieuw.dienst}><Plus size={14} strokeWidth={2}/>{nieuw.herhaal?"Herhaling aanmaken":"Toevoegen"}</button></div>
    </div></div></div>}

    {showCats&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Categorieën</div><div className="ms">Kleurcodering voor taken in de kalender</div></div><button className="mc" onClick={()=>setShowCats(false)}><X size={14}/></button></div><div className="mb">
      {planningCats.length===0&&<div style={{color:"#94A3B8",fontSize:13,textAlign:"center",padding:"8px 0 16px"}}>Nog geen categorieën — voeg er hieronder een toe</div>}
      {planningCats.map(c=><div key={c.id} className="cat-row">
        <span className="cat-swatch" style={{background:c.kleur}}/>
        <span style={{flex:1,fontSize:13.5,fontWeight:600,color:"#111"}}>{c.naam}</span>
        <button className="btn btn-danger btn-sm" onClick={()=>deleteCat(c.id)}><X size={14}/></button>
      </div>)}
      <div style={{display:"flex",gap:8,marginTop:16,alignItems:"center"}}>
        <input type="color" value={newCat.kleur} onChange={e=>setNewCat({...newCat,kleur:e.target.value})} className="cat-inp-color" title="Kies kleur"/>
        <input className="inp" style={{flex:1}} value={newCat.naam} onChange={e=>setNewCat({...newCat,naam:e.target.value})} placeholder="Naam (bijv. Installatie, Onderhoud…)" onKeyDown={e=>e.key==="Enter"&&addCat()}/>
        <button className="btn btn-dark" onClick={addCat} disabled={!newCat.naam.trim()}><Plus size={14} strokeWidth={2}/> Toevoegen</button>
      </div>
    </div></div></div>}
  </div>);
}

// ── CRM ───────────────────────────────────────────────────────
function CRMTab({ userId, klanten, offertes, facturen, werkbonnen, refresh }) {
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
    if (nieuw.naam.length > 100) { setCrmErr("Naam mag maximaal 100 tekens zijn."); return; }
    if (nieuw.email && !isValidEmail(nieuw.email)) { setCrmErr("Voer een geldig e-mailadres in."); return; }
    if (nieuw.tel && !isValidDutchPhone(nieuw.tel)) { setCrmErr("Voer een geldig Nederlands telefoonnummer in (bijv. 06-12345678)."); return; }
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
    if (bewerkt.naam.length > 100) { setCrmErr("Naam mag maximaal 100 tekens zijn."); return; }
    if (bewerkt.email && !isValidEmail(bewerkt.email)) { setCrmErr("Voer een geldig e-mailadres in."); return; }
    if (bewerkt.tel && !isValidDutchPhone(bewerkt.tel)) { setCrmErr("Voer een geldig Nederlands telefoonnummer in (bijv. 06-12345678)."); return; }
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

  const verwijder = async (id, naam) => {
    const nO=(offertes||[]).filter(o=>o.klant===naam).length;
    const nF=(facturen||[]).filter(f=>f.klant===naam).length;
    const nW=(werkbonnen||[]).filter(w=>w.klant===naam).length;
    const parts=[];
    if(nO>0)parts.push(`${nO} offerte${nO!==1?"s":""}`);
    if(nF>0)parts.push(`${nF} factuur${nF!==1?" / facturen":""}`);
    if(nW>0)parts.push(`${nW} werkbon${nW!==1?"nen":""}`);
    const waarschuwing=parts.length>0
      ?`⚠️ "${naam}" heeft nog ${parts.join(", ")} in het systeem.\n\nDeze records blijven bestaan maar zijn niet meer aan een klant gekoppeld.\n\nWeet je zeker dat je deze klant wil verwijderen?`
      :`Klant "${naam}" verwijderen?`;
    if(!window.confirm(waarschuwing))return false;
    const{error}=await supabase.from("klanten").delete().eq("id",id);
    if(!error){refresh();return true;}
    return false;
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
        {mobDetail.tel&&<a href={`tel:${mobDetail.tel}`} className="mob-det-action-btn" style={{textDecoration:"none"}}><span className="mob-det-action-ic"><Phone size={18} strokeWidth={1.8} color="#14B8A6"/></span>Bellen</a>}
        {mobDetail.email&&<a href={`mailto:${mobDetail.email}`} className="mob-det-action-btn" style={{textDecoration:"none"}}><span className="mob-det-action-ic"><Mail size={18} strokeWidth={1.8} color="#3B82F6"/></span>E-mailen</a>}
        <button className="mob-det-action-btn" onClick={()=>{setMobDetail(null);startEdit(mobDetail);}}><span className="mob-det-action-ic"><Pencil size={18} strokeWidth={1.8} color="#6B7280"/></span>Bewerken</button>
        <button className="mob-det-action-btn danger" onClick={async()=>{if(await verwijder(mobDetail.id,mobDetail.naam))setMobDetail(null);}}><span className="mob-det-action-ic"><Trash2 size={18} strokeWidth={1.8} color="#EF4444"/></span>Verwijderen</button>
      </MobDetailScreen>
    )}
    <div className="ph"><div><div className="pg-title">Klantenbeheer</div><div className="pg-sub">{klanten.length} klanten</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}><Plus size={14} strokeWidth={2}/> Klant</button></div>
    <input className="inp" style={{marginBottom:14}} placeholder="🔍  Zoek op naam, telefoon, e-mail, adres…" value={q} onChange={e=>setQ(e.target.value)}/>
    {klanten.length===0
      ? <LeegScherm icon={<Users size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Nog geen klanten" sub="Voeg je eerste klant toe" actie="+ Klant toevoegen" onActie={()=>setShowAdd(true)}/>
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
            {list.map(k=><div className="pc" key={k.id}><div className="av">{k.naam[0]}</div><div style={{flex:1}}><div style={{fontWeight:700,color:"#111",fontSize:15}}>{k.naam}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{k.tel}{k.tel&&k.email?" · ":""}{k.email}</div></div><Badge status={k.status}/><button className="btn btn-ghost btn-sm" onClick={()=>startEdit(k)}><Pencil size={14} strokeWidth={1.8} color="#6B7280"/> Bewerken</button><button className="btn btn-danger btn-sm" onClick={()=>verwijder(k.id,k.naam)}><Trash2 size={14} strokeWidth={1.8} color="#EF4444"/></button></div>)}
          </div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Klant toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}><X size={14}/></button></div><div className="mb">
      <div className="ig"><label className="ilbl">Naam</label><input className="inp" maxLength={100} value={nieuw.naam} onChange={e=>setNieuw({...nieuw,naam:e.target.value})} placeholder="Bedrijf of naam"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={nieuw.tel} onChange={e=>setNieuw({...nieuw,tel:e.target.value})} placeholder="06-12345678"/></div>
        <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={nieuw.email} onChange={e=>setNieuw({...nieuw,email:e.target.value})} placeholder="klant@email.nl"/></div><div className="ig"><label className="ilbl">Adres</label><input className="inp" value={nieuw.adres} onChange={e=>setNieuw({...nieuw,adres:e.target.value})} placeholder="Straat 1, Amsterdam"/></div>
      </div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Actief","Potentiële klant","Geïnteresseerd","Offerte verstuurd","Vaste klant","Inactief","Verloren"].map(s=><option key={s}>{s}</option>)}</select></div>
      {crmErr&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8,padding:"8px 12px",background:"#FEE2E2",borderRadius:6}}>{crmErr}</div>}
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setCrmErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={!nieuw.naam}><Plus size={14} strokeWidth={2}/> Toevoegen</button></div>
    </div></div></div>}
    {showEdit&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Klant bewerken</div></div><button className="mc" onClick={()=>setShowEdit(false)}><X size={14}/></button></div><div className="mb">
      <div className="ig"><label className="ilbl">Naam</label><input className="inp" maxLength={100} value={bewerkt.naam} onChange={e=>setBewerkt({...bewerkt,naam:e.target.value})} placeholder="Bedrijf of naam"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Telefoon</label><input className="inp" value={bewerkt.tel} onChange={e=>setBewerkt({...bewerkt,tel:e.target.value})} placeholder="06-12345678"/></div>
        <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={bewerkt.email} onChange={e=>setBewerkt({...bewerkt,email:e.target.value})} placeholder="klant@email.nl"/></div><div className="ig"><label className="ilbl">Adres</label><input className="inp" value={bewerkt.adres} onChange={e=>setBewerkt({...bewerkt,adres:e.target.value})} placeholder="Straat 1, Amsterdam"/></div>
      </div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={bewerkt.status} onChange={e=>setBewerkt({...bewerkt,status:e.target.value})}>{["Actief","Potentiële klant","Geïnteresseerd","Offerte verstuurd","Vaste klant","Inactief","Verloren"].map(s=><option key={s}>{s}</option>)}</select></div>
      {crmErr&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8,padding:"8px 12px",background:"#FEE2E2",borderRadius:6}}>{crmErr}</div>}
      <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowEdit(false);setCrmErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={saveEdit} disabled={!bewerkt.naam}><Save size={14} strokeWidth={1.8}/> Opslaan</button></div>
    </div></div></div>}
  </div>);
}

function WerkbonnenTab({ userId, klanten, werkbonnen, refresh, bedrijf, emailSettings, emailTemplates = {} }) {
  const mob = useMobile();
  const [mobDetail,setMobDetail]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [lightboxFotos,setLightboxFotos]=useState([]);
  const [lightboxIdx,setLightboxIdx]=useState(0);
  const originalStatusRef = useRef("Nieuw");
  const [nieuw,setNieuw]=useState({klant:"",datum:localToday(),omschrijving:"",fotos:[],uren:"",materialen:"",status:"Nieuw",handtekening:""});
  const [bewerkt,setBewerkt]=useState({klant:"",datum:localToday(),omschrijving:"",fotos:[],uren:"",materialen:"",status:"Nieuw",handtekening:""});
  const [saving,setSaving]=useState(false);
  const [editSaving,setEditSaving]=useState(false);
  const [error,setError]=useState("");
  const [editError,setEditError]=useState("");
  const [reviewConfirm,setReviewConfirm]=useState(null);
  const [expandedDesc,setExpandedDesc]=useState(new Set());
  const [reviewSending,setReviewSending]=useState(false);
  const [reviewSent,setReviewSent]=useState(false);
  const [reviewErr,setReviewErr]=useState("");

  const getWerkbonFotos = (b) => {
    if (b?.fotos?.length > 0) return b.fotos;
    if (b?.foto) return [b.foto];
    return [];
  };

  const openLightbox = (fotos, idx) => { setLightboxFotos(fotos); setLightboxIdx(idx); };

  const handleFotoAdd = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setNieuw(prev=>({ ...prev, fotos: [...prev.fotos, reader.result] }));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleEditFotoAdd = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setBewerkt(prev=>({ ...prev, fotos: [...prev.fotos, reader.result] }));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
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
      foto: nieuw.fotos[0] || "",
      fotos: nieuw.fotos,
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
    setNieuw({klant:"",datum:localToday(),omschrijving:"",fotos:[],uren:"",materialen:"",status:"Nieuw",handtekening:""});
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
      fotos: getWerkbonFotos(werkbon),
      uren: werkbon.uren != null ? String(werkbon.uren) : "",
      materialen: werkbon.materialen || "",
      status: werkbon.status || "Nieuw",
      handtekening: werkbon.handtekening || "",
    });
    setEditError("");
    setShowEdit(true);
  };

  const sendReviewRequestEmail = async (clientEmail, serviceDescription) => {
    if (!clientEmail) {
      console.warn("sendReviewRequestEmail: no client email available");
      return null;
    }
    const tpl = emailTemplates?.review;
    const vars = { klantnaam: "", bedrijfsnaam: bedrijf?.bedrijfsnaam || "WerkMate", dienst: serviceDescription || "jouw opdracht" };
    const payload = {
      action: "send-review-request-email",
      customer_email: clientEmail,
      ...companyEmailFields(bedrijf),
      service_description: serviceDescription || "jouw opdracht",
      google_review_url: bedrijf?.google_review_url || null,
      ...(tpl?.subject ? { custom_subject: fillVars(tpl.subject, vars) } : {}),
      ...(tpl?.body    ? { custom_body:    fillVars(tpl.body,    vars) } : {}),
    };
    const { data: { session: reviewSess } } = await supabase.auth.getSession();
    const reviewToken = reviewSess?.access_token || import.meta.env.VITE_SUPABASE_KEY;
    const response = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${reviewToken}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    const subjectLogged = tpl?.subject ? fillVars(tpl.subject, vars) : `Review verzoek — ${serviceDescription || "opdracht"}`;
    await logEmail(userId, clientEmail, subjectLogged, "review", `Review verzoek voor ${serviceDescription || "opdracht"}`, response.ok ? "verzonden" : "mislukt", response.ok ? data?.html : null);
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
      foto: bewerkt.fotos[0] || "",
      fotos: bewerkt.fotos,
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
    if (typeof refresh === "function") await refresh();
    setEditSaving(false);
  };

  return(<div>
    <div className="ph"><div><div className="pg-title">Werkbonnen</div><div className="pg-sub">Maak werkbonnen voor klant, uren, materialen en foto</div></div><button className="btn btn-dark" onClick={()=>setShowAdd(true)}><Plus size={14} strokeWidth={2}/> Werkbon</button></div>
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
        {getWerkbonFotos(mobDetail).length>0&&<div className="mob-det-section">
          <div style={{fontSize:13,color:"#64748B",fontWeight:600,marginBottom:8}}>Foto's ({getWerkbonFotos(mobDetail).length})</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {getWerkbonFotos(mobDetail).map((url,i)=>(
              <img key={i} src={url} alt="" style={{width:100,height:80,objectFit:"cover",borderRadius:10,cursor:"pointer",border:"2px solid #E2E8F0"}} onClick={()=>openLightbox(getWerkbonFotos(mobDetail),i)}/>
            ))}
          </div>
        </div>}
        {mobDetail.handtekening&&<div className="mob-det-section">
          <div style={{fontSize:13,color:"#64748B",fontWeight:600,marginBottom:8}}>Handtekening klant</div>
          <img src={mobDetail.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB"}}/>
        </div>}
        <button className="mob-det-action-btn" onClick={()=>{setMobDetail(null);startEdit(mobDetail);}}><span className="mob-det-action-ic"><Pencil size={18} strokeWidth={1.8} color="#6B7280"/></span>Werkbon bewerken</button>
        {mobDetail.status==="Afgerond"&&klanten?.find(k=>k.naam.toLowerCase()===(mobDetail.klant||"").toLowerCase())?.email&&<button className="mob-det-action-btn" onClick={()=>{const k=klanten.find(kl=>kl.naam.toLowerCase()===(mobDetail.klant||"").toLowerCase());setMobDetail(null);setReviewErr("");setReviewSent(false);setReviewConfirm({email:k.email,name:k.naam,omschrijving:mobDetail.omschrijving});}}><span className="mob-det-action-ic"><Star size={18} strokeWidth={1.8} color="#F59E0B"/></span>Review verzoek sturen</button>}
        <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Werkbon verwijderen?")) { supabase.from("werkbonnen").delete().eq("id",mobDetail.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic"><Trash2 size={18} strokeWidth={1.8} color="#EF4444"/></span>Verwijderen</button>
      </MobDetailScreen>
    )}
    {werkbonnen.length===0
      ? <LeegScherm icon={<Wrench size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Nog geen werkbonnen" sub="Maak je eerste werkbon aan" actie="+ Werkbon toevoegen" onActie={()=>setShowAdd(true)}/>
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
        : <div className="card"><div className="tw"><table><thead><tr>{["Klant","Datum · Uren","Status","Materialen","Foto","Acties"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{werkbonnen.map(b=>{const bKlant=klanten?.find(k=>k.naam.toLowerCase()===(b.klant||"").toLowerCase());const bFotos=getWerkbonFotos(b);return(<tr key={b.id}><td style={{minWidth:160,maxWidth:260}}><div style={{fontWeight:700,color:"#111",fontSize:15,lineHeight:"1.2"}}>{b.klant}</div>{b.omschrijving&&<div onClick={()=>setExpandedDesc(prev=>{const s=new Set(prev);s.has(b.id)?s.delete(b.id):s.add(b.id);return s;})} style={{fontSize:12,color:"#6B7280",marginTop:3,lineHeight:"1.4",cursor:"pointer",...(expandedDesc.has(b.id)?{}:{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"})}}>{b.omschrijving}{expandedDesc.has(b.id)&&<span style={{display:"block",fontSize:11,color:"#6366F1",marginTop:2,fontWeight:500}}>↑ Minder tonen</span>}</div>}</td><td style={{whiteSpace:"nowrap",verticalAlign:"middle"}}><span style={{background:"#F1F5F9",color:"#475569",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-block"}}>{fmtDatum(b.datum)}</span>{b.uren&&<div style={{fontSize:11,color:"#94A3B8",marginTop:4,textAlign:"center"}}>{b.uren} uur</div>}</td><td style={{verticalAlign:"middle"}}><Badge status={b.status||"Nieuw"}/></td><td style={{maxWidth:220,verticalAlign:"middle"}}>{b.materialen?b.materialen.split(/[,\n]+/).filter(m=>m.trim()).map((m,i)=><span key={i} style={{background:"#F0F9FF",color:"#0369A1",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:500,marginRight:4,marginBottom:2,display:"inline-block",whiteSpace:"nowrap"}}>{m.trim()}</span>):<span style={{color:"#CBD5E1"}}>—</span>}</td><td style={{verticalAlign:"middle"}}>{bFotos.length>0?<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{bFotos.slice(0,3).map((url,i)=><img key={i} src={url} alt="" style={{width:56,height:44,objectFit:"cover",borderRadius:8,cursor:"pointer"}} onClick={()=>openLightbox(bFotos,i)}/>)}{bFotos.length>3&&<div style={{width:56,height:44,borderRadius:8,background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#64748B",cursor:"pointer"}} onClick={()=>openLightbox(bFotos,3)}>+{bFotos.length-3}</div>}</div>:"-"}</td><td style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",verticalAlign:"middle"}}><button type="button" className="btn btn-outline btn-sm" onClick={()=>startEdit(b)}><Pencil size={14} strokeWidth={1.8} color="#6B7280"/> Bewerken</button>{b.status==="Afgerond"&&bKlant?.email&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>{setReviewErr("");setReviewSent(false);setReviewConfirm({email:bKlant.email,name:bKlant.naam,omschrijving:b.omschrijving});}}><Star size={14} strokeWidth={1.8} color="#F59E0B"/> Review verzoek</button>}<button type="button" className="btn btn-danger btn-sm" onClick={()=>{ if(window.confirm("Werkbon verwijderen?")) { supabase.from("werkbonnen").delete().eq("id",b.id).then(()=>refresh()); } }}><Trash2 size={14} strokeWidth={1.8} color="#EF4444"/></button></td></tr>);})}
</tbody>
          </table></div></div>
    }
    {showAdd&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Werkbon toevoegen</div></div><button className="mc" onClick={()=>setShowAdd(false)}><X size={14}/></button></div><div className="mb">
      <div className="ig"><label className="ilbl">Klant</label><select className="inp" value={nieuw.klant} onChange={e=>setNieuw({...nieuw,klant:e.target.value})}><option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})} /></div>
        <div className="ig"><label className="ilbl">Uren</label><input className="inp" type="number" value={nieuw.uren} onChange={e=>setNieuw({...nieuw,uren:e.target.value})} placeholder="0"/></div>
      </div>
      <div className="ig"><label className="ilbl">Omschrijving</label><textarea className="inp" style={{minHeight:100}} value={nieuw.omschrijving} onChange={e=>setNieuw({...nieuw,omschrijving:e.target.value})} placeholder="Wat is er gedaan?"/></div>
      <div className="ig"><label className="ilbl">Materialen</label><textarea className="inp" style={{minHeight:60}} value={nieuw.materialen} onChange={e=>setNieuw({...nieuw,materialen:e.target.value})} placeholder="Gewerkte materialen"/></div>
      <div className="ig"><label className="ilbl">Foto's</label><label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"#F8FAFC",border:"1px dashed #CBD5E1",cursor:"pointer",fontSize:13,color:"#475569",fontWeight:500}}><Camera size={14} strokeWidth={1.8}/> Foto toevoegen<input type="file" accept="image/*" capture="environment" multiple onChange={handleFotoAdd} style={{display:"none"}}/></label>{nieuw.fotos.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{nieuw.fotos.map((url,i)=><div key={i} style={{position:"relative",display:"inline-block"}}><img src={url} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:8,cursor:"pointer",border:"2px solid #E2E8F0"}} onClick={()=>openLightbox(nieuw.fotos,i)}/><button type="button" onClick={()=>setNieuw(prev=>({...prev,fotos:prev.fotos.filter((_,j)=>j!==i)}))} style={{position:"absolute",top:-7,right:-7,width:20,height:20,borderRadius:"50%",background:"#EF4444",border:"none",color:"#fff",fontSize:13,cursor:"pointer",lineHeight:"20px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>)}</div>}</div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={nieuw.status} onChange={e=>setNieuw({...nieuw,status:e.target.value})}>{["Nieuw","Bezig","Klaar","Ondertekend","Afgerond"].map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="ig"><label className="ilbl">Handtekening klant (optioneel)</label>
        {nieuw.handtekening?<div><img src={nieuw.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB",marginBottom:8}}/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setNieuw({...nieuw,handtekening:""})}>Wissen</button></div>:<SignatureCanvas onSave={sig=>setNieuw({...nieuw,handtekening:sig})}/>}
      </div>
      {error && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",gap:9}}><button type="button" className="btn btn-ghost" onClick={()=>{setShowAdd(false);setError("");}}>Annuleren</button><button type="button" className="btn btn-primary btn-full" onClick={add} disabled={saving||!nieuw.klant||!nieuw.datum}><Save size={14} strokeWidth={1.8}/>{saving?"Opslaan…":"Opslaan"}</button></div>
    </div></div></div>}
    {showEdit&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Werkbon bewerken</div></div><button className="mc" onClick={()=>setShowEdit(false)}><X size={14}/></button></div><div className="mb">
      <div className="ig"><label className="ilbl">Klant</label><select className="inp" value={bewerkt.klant} onChange={e=>setBewerkt({...bewerkt,klant:e.target.value})}><option value="">-- Kies klant --</option>{(klanten||[]).map(k=><option key={k.id} value={k.naam}>{k.naam}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={bewerkt.datum} onChange={e=>setBewerkt({...bewerkt,datum:e.target.value})} /></div>
        <div className="ig"><label className="ilbl">Uren</label><input className="inp" type="number" value={bewerkt.uren} onChange={e=>setBewerkt({...bewerkt,uren:e.target.value})} placeholder="0"/></div>
      </div>
      <div className="ig"><label className="ilbl">Omschrijving</label><textarea className="inp" style={{minHeight:100}} value={bewerkt.omschrijving} onChange={e=>setBewerkt({...bewerkt,omschrijving:e.target.value})} placeholder="Wat is er gedaan?"/></div>
      <div className="ig"><label className="ilbl">Materialen</label><textarea className="inp" style={{minHeight:60}} value={bewerkt.materialen} onChange={e=>setBewerkt({...bewerkt,materialen:e.target.value})} placeholder="Gewerkte materialen"/></div>
      <div className="ig"><label className="ilbl">Foto's</label><label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:"#F8FAFC",border:"1px dashed #CBD5E1",cursor:"pointer",fontSize:13,color:"#475569",fontWeight:500}}><Camera size={14} strokeWidth={1.8}/> Foto toevoegen<input type="file" accept="image/*" capture="environment" multiple onChange={handleEditFotoAdd} style={{display:"none"}}/></label>{bewerkt.fotos.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{bewerkt.fotos.map((url,i)=><div key={i} style={{position:"relative",display:"inline-block"}}><img src={url} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:8,cursor:"pointer",border:"2px solid #E2E8F0"}} onClick={()=>openLightbox(bewerkt.fotos,i)}/><button type="button" onClick={()=>setBewerkt(prev=>({...prev,fotos:prev.fotos.filter((_,j)=>j!==i)}))} style={{position:"absolute",top:-7,right:-7,width:20,height:20,borderRadius:"50%",background:"#EF4444",border:"none",color:"#fff",fontSize:13,cursor:"pointer",lineHeight:"20px",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>)}</div>}</div>
      <div className="ig"><label className="ilbl">Status</label><select className="inp" value={bewerkt.status} onChange={e=>setBewerkt({...bewerkt,status:e.target.value})}>{["Nieuw","Bezig","Klaar","Ondertekend","Afgerond"].map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="ig"><label className="ilbl">Handtekening klant</label>
        {bewerkt.handtekening?<div><img src={bewerkt.handtekening} alt="Handtekening" style={{width:"100%",maxHeight:120,objectFit:"contain",background:"#FAFAFA",borderRadius:10,border:"1px solid #E5E7EB",marginBottom:8}}/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setBewerkt({...bewerkt,handtekening:""})}>Wissen</button></div>:<SignatureCanvas onSave={sig=>setBewerkt({...bewerkt,handtekening:sig})}/>}
      </div>
      {editError && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{editError}</div>}
      <div style={{display:"flex",gap:9}}><button type="button" className="btn btn-ghost" onClick={()=>{setShowEdit(false);setEditError("");}}>Annuleren</button><button type="button" className="btn btn-primary btn-full" onClick={saveEdit} disabled={editSaving||!bewerkt.klant||!bewerkt.datum}><Save size={14} strokeWidth={1.8}/>{editSaving?"Opslaan…":"Opslaan"}</button></div>
    </div></div></div>}
    {lightboxFotos.length>0&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLightboxFotos([])}>
      {lightboxFotos.length>1&&<button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>(i-1+lightboxFotos.length)%lightboxFotos.length);}} style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:"50%",width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>}
      <img src={lightboxFotos[lightboxIdx]} alt="Foto" style={{maxWidth:"90vw",maxHeight:"86vh",borderRadius:14,boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}/>
      {lightboxFotos.length>1&&<button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>(i+1)%lightboxFotos.length);}} style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:"50%",width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>}
      <button onClick={()=>setLightboxFotos([])} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
      {lightboxFotos.length>1&&<div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6}}>{lightboxFotos.map((_,i)=><div key={i} onClick={e=>{e.stopPropagation();setLightboxIdx(i);}} style={{width:8,height:8,borderRadius:"50%",background:i===lightboxIdx?"#fff":"rgba(255,255,255,0.35)",cursor:"pointer"}}/>)}</div>}
    </div>}
    {reviewConfirm&&<EmailConfirmModal
      toEmail={reviewConfirm.email}
      toName={reviewConfirm.name}
      onConfirm={async()=>{
        setReviewSending(true);setReviewErr("");
        try{await sendReviewRequestEmail(reviewConfirm.email,reviewConfirm.omschrijving);}
        catch(e){setReviewErr("Versturen mislukt");setReviewSending(false);return;}
        setReviewSending(false);setReviewSent(true);
        setTimeout(()=>{setReviewConfirm(null);setReviewSent(false);},2200);
      }}
      onCancel={()=>{setReviewConfirm(null);setReviewSent(false);setReviewErr("");}}
      sending={reviewSending}
      sent={reviewSent}
      error={reviewErr}
    />}
  </div>);
}

// ── Financiën ─────────────────────────────────────────────────
function FinancienTab({ userId, facturen, uitgaven, ritten, refresh, klanten, offertes, bedrijf, emailSettings, emailTemplates = {} }) {
  const mob = useMobile();
  const [mobDetail,setMobDetail]=useState(null);
  const getTotal = (f) => f.totaal != null ? Number(f.totaal) : parseFloat((f.bedrag||"0").replace(/[€\s.]/g,"").replace(",","."))||0;

  const [subTab, setSubTab] = useState("facturen");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [btwJaar, setBtwJaar] = useState(new Date().getFullYear());
  const [btwQ, setBtwQ] = useState(Math.floor(new Date().getMonth()/3));
  const [btwStap, setBtwStap] = useState(0);
  const [btwCopied, setBtwCopied] = useState(null);
  const [winstJaar, setWinstJaar] = useState(new Date().getFullYear());
  const [winstPeriode, setWinstPeriode] = useState("maand");
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
  const [scanningBon, setScanningBon] = useState(false);
  const scanInputRef = useRef(null);
  const [uitgaveErr, setUitgaveErr] = useState("");
  const [uitgaveFotoPreview, setUitgaveFotoPreview] = useState("");
  const [uitMaand, setUitMaand] = useState(()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;});
  const autoReminderSentRef = useRef(false);
  const [autoReminderCount, setAutoReminderCount] = useState(0);

  useEffect(() => {
    if (autoReminderSentRef.current) return;
    if (!facturen.length || !emailSettings?.id) return;
    if (!emailSettings.auto_reminder_email && !emailSettings.auto_invoice_reminder) return;
    autoReminderSentRef.current = true;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const reminderDays = Number(emailSettings.reminder_days_before ?? 3);
    const invoiceDays  = Number(emailSettings.invoice_reminder_days ?? 7);
    const candidates = facturen.filter(f => {
      if (f.status !== "Verstuurd" || !f.klant_email) return false;
      // Skip if a reminder was already sent today (prevents double-send on re-mount)
      if (f.last_reminder_sent_at === todayIso) return false;
      const nearDue   = emailSettings.auto_reminder_email  && f.vervaldatum && ((new Date(f.vervaldatum) - today) / 86400000) >= 0 && ((new Date(f.vervaldatum) - today) / 86400000) <= reminderDays;
      const oldUnpaid = emailSettings.auto_invoice_reminder && f.datum      && ((today - new Date(f.datum)) / 86400000) >= invoiceDays;
      return nearDue || oldUnpaid;
    });
    if (!candidates.length) return;
    (async () => {
      const {data:{session:autoSess}} = await supabase.auth.getSession();
      const autoToken = autoSess?.access_token || import.meta.env.VITE_SUPABASE_KEY;
      const tplRem = emailTemplates?.herinnering;
      let sent = 0;
      for (const f of candidates) {
        try {
          const totF = f.totaal != null ? `€ ${Number(f.totaal).toLocaleString("nl-NL",{minimumFractionDigits:2})}` : "";
          const vars = { klantnaam:f.klant, bedrijfsnaam:bedrijf?.bedrijfsnaam||"WerkMate", nummer:f.nummer||"", bedrag:totF };
          const autoRes = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":`Bearer ${autoToken}`},
            body:JSON.stringify({action:"send-reminder-email",customer_email:f.klant_email,customer_name:f.klant,factuur_nummer:f.nummer,totaal:f.totaal,...companyEmailFields(bedrijf),...(tplRem?.subject?{custom_subject:fillVars(tplRem.subject,vars)}:{}),...(tplRem?.body?{custom_body:fillVars(tplRem.body,vars)}:{})}),
          });
          const autoData = await autoRes.json().catch(()=>null);
          if (!autoRes.ok) {
            const msg = autoData?.message||autoData?.error||`HTTP ${autoRes.status}`;
            console.warn("[auto reminder] mislukt voor", f.nummer, msg);
            await logEmail(userId, f.klant_email, `Herinnering factuur ${f.nummer||""}`, "herinnering", msg, "mislukt");
            continue;
          }
          // Record both the status change and the send date atomically
          await supabase.from("facturen").update({ status:"Herinnering", last_reminder_sent_at: todayIso }).eq("id", f.id);
          const subjectA = tplRem?.subject ? fillVars(tplRem.subject, vars) : `Herinnering factuur ${f.nummer||""}`;
          await logEmail(userId, f.klant_email, subjectA, "herinnering", `Automatische herinnering factuur ${f.nummer||""} voor ${f.klant}`, "verzonden", autoData?.html||null);
          sent++;
        } catch(e) {
          console.warn("[auto reminder] fout voor", f.nummer, e);
          await logEmail(userId, f.klant_email, `Herinnering factuur ${f.nummer||""}`, "herinnering", e.message, "mislukt").catch(()=>{});
        }
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

  const betaaldDatum = (f) => f.betaald_op || f.datum || "";
  const monthRevenue = facturen.filter(f=>f.status==="Betaald"&&betaaldDatum(f).startsWith(thisMonth)).reduce((s,f)=>s+getTotal(f),0);
  const openFacturen2 = facturen.filter(f=>{const s=dispStatus(f);return s!=="Betaald"&&s!=="Concept";});
  const openAmount = openFacturen2.reduce((s,f)=>s+getTotal(f),0);
  const yearRevenue = facturen.filter(f=>f.status==="Betaald"&&betaaldDatum(f).startsWith(String(now.getFullYear()))).reduce((s,f)=>s+getTotal(f),0);
  const btwKwartaal = facturen.filter(f=>{if(f.status!=="Betaald")return false;const d=betaaldDatum(f);return d&&new Date(d)>=qStart&&new Date(d)<=now;}).reduce((s,f)=>s+(getTotal(f)/1.21*0.21),0);

  const nextNummer = () => {
    const yr = now.getFullYear();
    const nums = facturen.map(f=>f.nummer).filter(n=>n&&n.startsWith(`${yr}-`)).map(n=>parseInt(n.split("-")[1])||0);
    return `${yr}-${String(nums.length?Math.max(...nums)+1:1).padStart(3,"0")}`;
  };

  const calcTotals = (regels) => {
    const sub = regels.reduce((s,r)=>s+(Number(r.aantal)||0)*(Number(r.prijs)||0),0);
    const btw9  = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===9  ?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.09:s;},0);
    const btw21 = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===21 ?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.21:s;},0);
    const btw = btw9+btw21;
    return {subtotaal:sub, btw9, btw21, btw, totaal:sub+btw};
  };

  const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

  const openCreate = () => {
    setImportOfferte("");
    const datum=todayStr(), d=new Date(now); d.setDate(d.getDate()+30);
    const vervaldatum=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    setNieuw({klant:"",klant_email:"",datum,vervaldatum,regels:[{omschrijving:"",aantal:1,eenheid:"stuk",prijs:"",btw_pct:21}],status:"Concept",_offerteBtw:null,_offerteTotaal:null});
    setSaveErr(""); setShowCreate(true);
  };

  const importFromOfferte = (offerteId) => {
    const o=(offertes||[]).find(x=>String(x.id)===String(offerteId));
    if(!o) return;
    const k=(klanten||[]).find(x=>x.naam===o.klant);
    const regels = parseOfferRules(o).map(r=>({...r}));
    setNieuw(prev=>({
      ...prev,
      klant:o.klant||"",
      klant_email:k?.email||"",
      regels,
      _offerteBtw: (o.btw != null && Number(o.btw) > 0) ? Number(o.btw) : null,
      _offerteTotaal: (o.totaal != null && Number(o.totaal) > 0) ? Number(o.totaal) : null,
    }));
  };

  // Clear locked offerte totals when the user edits regels manually
  const addRegel = () => setNieuw(prev=>({...prev,regels:[...prev.regels,{omschrijving:"",aantal:1,eenheid:"stuk",prijs:"",btw_pct:21}],_offerteBtw:null,_offerteTotaal:null}));
  const removeRegel = (i) => setNieuw(prev=>({...prev,regels:prev.regels.filter((_,idx)=>idx!==i),_offerteBtw:null,_offerteTotaal:null}));
  const setRegel = (i,field,val) => setNieuw(prev=>({...prev,regels:prev.regels.map((r,idx)=>idx===i?{...r,[field]:val}:r),_offerteBtw:null,_offerteTotaal:null}));

  const saveFactuur = async () => {
    if(!nieuw.klant){setSaveErr("Vul een klant in.");return;}
    if(!nieuw.regels.length){setSaveErr("Voeg minimaal één regel toe.");return;}
    setSaving(true); setSaveErr("");
    const calc=calcTotals(nieuw.regels);
    const btw   = nieuw._offerteBtw    != null ? nieuw._offerteBtw    : calc.btw;
    const totaal = nieuw._offerteTotaal != null ? nieuw._offerteTotaal : calc.totaal;
    const {data:numData,error:numErr}=await supabase.rpc("next_factuur_nummer",{p_user_id:userId});
    if(numErr){setSaveErr("Kon factuurnummer niet genereren: "+numErr.message);setSaving(false);return;}
    const {error}=await supabase.from("facturen").insert({user_id:userId,nummer:numData,klant:nieuw.klant,klant_email:nieuw.klant_email,datum:nieuw.datum,vervaldatum:nieuw.vervaldatum,regels:nieuw.regels,btw,totaal,status:nieuw.status});
    setSaving(false);
    if(error){setSaveErr(error.message);return;}
    setShowCreate(false); refresh();
  };

  const updateStatus = async (id, status) => {
    const updates = { status };
    if (status === "Betaald") updates.betaald_op = new Date().toISOString().slice(0,10);
    const {error}=await supabase.from("facturen").update(updates).eq("id",id);
    if (error) {
      // Column may not exist yet — fall back to status-only update
      await supabase.from("facturen").update({status}).eq("id",id);
    }
    refresh();
  };

  const sendInvoiceEmail = async () => {
    if(!emailAddr) return;
    setEmailSending(true); setEmailMsg("");
    try {
      const pdfB64=createFactuurPdfBase64(showEmail, bedrijf);
      const tpl=emailTemplates?.factuur;
      const vars={klantnaam:showEmail.klant,bedrijfsnaam:bedrijf?.bedrijfsnaam||"WerkMate",nummer:showEmail.nummer||""};
      const {data:{session:invSess}}=await supabase.auth.getSession();
      const invToken=invSess?.access_token||import.meta.env.VITE_SUPABASE_KEY;
      const invRes=await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${invToken}`},body:JSON.stringify({action:"send-invoice-email",customer_email:emailAddr,customer_name:showEmail.klant,factuur_nummer:showEmail.nummer,...companyEmailFields(bedrijf),...(tpl?.subject?{custom_subject:fillVars(tpl.subject,vars)}:{}),...(tpl?.body?{custom_body:fillVars(tpl.body,vars)}:{}),attachments:[{filename:`Factuur-${showEmail.nummer||"factuur"}.pdf`,content:pdfB64}]})});
      const invData=await invRes.json().catch(()=>null);
      console.log("[sendInvoiceEmail] result:", invRes.status, invData);
      if(!invRes.ok) throw new Error(invData?.message||invData?.error||`Versturen mislukt (${invRes.status})`);
      await supabase.from("facturen").update({status:"Verstuurd"}).eq("id",showEmail.id);
      const subjectLogged=tpl?.subject?fillVars(tpl.subject,vars):`Factuur ${showEmail.nummer||""}`;
      await logEmail(userId, emailAddr, subjectLogged, "factuur", `Factuur ${showEmail.nummer||""} voor ${showEmail.klant}`, "verzonden", invData?.html||null);
      setEmailMsg(`Email verstuurd naar ${emailAddr}`); refresh();
      setTimeout(()=>{setShowEmail(null);setEmailMsg("");setEmailAddr("");},2200);
    } catch(e){
      console.error("[sendInvoiceEmail] fout:", e);
      setEmailMsg("Fout: "+e.message);
    }
    setEmailSending(false);
  };

  const sendReminder = async () => {
    if(!emailAddr) return;
    setEmailSending(true); setEmailMsg("");
    try {
      const pdfB64=createFactuurPdfBase64(showReminder, bedrijf);
      const tpl=emailTemplates?.herinnering;
      const totF=`€ ${Number(getTotal(showReminder)).toLocaleString("nl-NL",{minimumFractionDigits:2})}`;
      const vars={klantnaam:showReminder.klant,bedrijfsnaam:bedrijf?.bedrijfsnaam||"WerkMate",nummer:showReminder.nummer||"",bedrag:totF};
      const {data:{session:remSess}}=await supabase.auth.getSession();
      const remToken=remSess?.access_token||import.meta.env.VITE_SUPABASE_KEY;
      const remRes=await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${remToken}`},body:JSON.stringify({action:"send-reminder-email",customer_email:emailAddr,customer_name:showReminder.klant,factuur_nummer:showReminder.nummer,totaal:getTotal(showReminder),...companyEmailFields(bedrijf),...(tpl?.subject?{custom_subject:fillVars(tpl.subject,vars)}:{}),...(tpl?.body?{custom_body:fillVars(tpl.body,vars)}:{}),attachments:[{filename:`Herinnering-${showReminder.nummer||"factuur"}.pdf`,content:pdfB64}]})});
      const remData=await remRes.json().catch(()=>null);
      console.log("[sendReminder] result:", remRes.status, remData);
      if(!remRes.ok) throw new Error(remData?.message||remData?.error||`Versturen mislukt (${remRes.status})`);
      await supabase.from("facturen").update({status:"Herinnering"}).eq("id",showReminder.id);
      const subjectLogged=tpl?.subject?fillVars(tpl.subject,vars):`Herinnering factuur ${showReminder.nummer||""}`;
      await logEmail(userId, emailAddr, subjectLogged, "herinnering", `Betalingsherinnering factuur ${showReminder.nummer||""} voor ${showReminder.klant}`, "verzonden", remData?.html||null);
      setEmailMsg(`Herinnering verstuurd naar ${emailAddr}`); refresh();
      setTimeout(()=>{setShowReminder(null);setEmailMsg("");setEmailAddr("");},2200);
    } catch(e){
      console.error("[sendReminder] fout:", e);
      await logEmail(userId, emailAddr, `Herinnering factuur ${showReminder.nummer||""}`, "herinnering", e.message, "mislukt");
      setEmailMsg("Fout: "+e.message);
    }
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

  const {subtotaal:cSub,btw9:cBtw9,btw21:cBtw21,btw:cBtw,totaal:cTot}=calcTotals(nieuw.regels);
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
            <select value={f.status||"Concept"} onChange={async e=>{await updateStatus(f.id,e.target.value);setMobDetail({...f,status:e.target.value});}} className="inp">
              {["Concept","Verstuurd","Herinnering","Betaald"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="mob-det-action-btn" onClick={()=>createFactuurPdf(f,bedrijf).save(`Factuur-${f.nummer||f.id}.pdf`)}><span className="mob-det-action-ic"><FileDown size={18} strokeWidth={1.8} color="#EF4444"/></span>PDF downloaden</button>
          <button className="mob-det-action-btn" onClick={()=>{setShowEmail(f);setEmailAddr(f.klant_email||"");}}><span className="mob-det-action-ic"><Mail size={18} strokeWidth={1.8} color="#3B82F6"/></span>Factuur e-mailen</button>
          {st!=="Betaald"&&st!=="Concept"&&<button className="mob-det-action-btn" onClick={()=>{setShowReminder(f);setEmailAddr(f.klant_email||"");}}><span className="mob-det-action-ic"><Bell size={18} strokeWidth={1.8} color="#F59E0B"/></span>Herinnering sturen</button>}
          <button className="mob-det-action-btn danger" onClick={()=>{ if(window.confirm("Factuur verwijderen?")) { supabase.from("facturen").delete().eq("id",f.id).then(()=>{refresh();setMobDetail(null);}); } }}><span className="mob-det-action-ic"><Trash2 size={18} strokeWidth={1.8} color="#EF4444"/></span>Verwijderen</button>
        </MobDetailScreen>
      );
    })()}
    <div className="ph"><div><div className="pg-title">Financiën</div><div className="pg-sub">Facturen & boekhouding</div></div><button className="btn btn-dark" onClick={openCreate}><Plus size={14} strokeWidth={2}/> Nieuwe factuur</button></div>
    <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
      {[
        {label:"Omzet deze maand",val:fmtEur(monthRevenue),sub:"betaald",color:"#10B981"},
        {label:"Openstaand",val:fmtEur(openAmount),sub:`${openFacturen2.length} factuur${openFacturen2.length!==1?"en":""}`,color:"#F59E0B"},
        {label:"Omzet dit jaar",val:fmtEur(yearRevenue),sub:"betaald",color:"#6366F1"},
        {label:"BTW dit kwartaal",val:fmtEur(btwKwartaal),sub:"afdragen",color:"#EF4444"},
      ].map(s=><div className="sc" key={s.label}><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.val}</div><div className="ss">{s.sub}</div></div>)}
    </div>

    <div className={mob?"tab-scroll":""}  style={{display:"flex",gap:8,marginBottom:16,flexWrap:mob?"nowrap":"wrap"}}>
      {[
        ["facturen", "📄 Facturen"],
        ["uitgaven", "💳 Uitgaven"],
        ["btw",      "📊 BTW"],
        ["winst",    "📈 Winst"],
        ["ritten",   "🚗 Ritten"],
        ["ai",       "✨ Assistent"],
      ].map(([id,lbl])=>(
        <button key={id} onClick={()=>setSubTab(id)} style={{display:"flex",alignItems:"center",padding:"7px 16px",borderRadius:20,border:"1.5px solid",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:subTab===id?"#0F0F14":"#fff",color:subTab===id?"#fff":"#555",borderColor:subTab===id?"#0F0F14":"#E5E7EB",flexShrink:0,whiteSpace:"nowrap"}}>{lbl}</button>
      ))}
    </div>

    {subTab==="facturen"&&(<>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",overflowX:"hidden"}}>
        {["Alle","Concept","Verstuurd","Herinnering","Betaald","Verlopen"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:filterStatus===s?"#0F0F14":"#fff",color:filterStatus===s?"#fff":"#555",borderColor:filterStatus===s?"#0F0F14":"#E5E7EB"}}>{s}</button>
        ))}
      </div>
      {filtered.length===0
        ?<LeegScherm icon={<CreditCard size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Geen facturen" sub="Maak je eerste factuur aan" actie="+ Factuur aanmaken" onActie={openCreate}/>
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
          : <div className="card"><div className="tw"><table>
              <thead><tr>
                <th>Nummer</th>
                <th>Klant</th>
                <th>Datum</th>
                <th>Vervaldatum</th>
                <th>Bedrag</th>
                <th>Status</th>
                <th style={{width:200}}>Acties</th>
              </tr></thead>
              <tbody>{filtered.map(f=>{
                const st=dispStatus(f), od=isOverdue(f);
                const statusKey = od ? "verlopen" : (f.status||"concept").toLowerCase();
                const canRemind = st!=="Betaald" && st!=="Concept";
                return(<tr key={f.id}>
                  <td className="f-nr">{f.nummer||"-"}</td>
                  <td className="f-klant">{f.klant}</td>
                  <td className="f-date">{fmtDate(f.datum)}</td>
                  <td className={`f-date${od?" f-overdue":""}`}>{fmtDate(f.vervaldatum)}</td>
                  <td className="f-amt">{fmtEur(getTotal(f))}</td>
                  <td style={{paddingTop:10,paddingBottom:10}}>
                    <select
                      value={f.status||"Concept"}
                      onChange={e=>updateStatus(f.id,e.target.value)}
                      className={`f-status-sel f-status-${statusKey}`}
                    >
                      {["Concept","Verstuurd","Herinnering","Betaald"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{paddingTop:10,paddingBottom:10}}>
                    <div className="f-actions">
                      <button className="f-btn f-btn-pdf" title="PDF downloaden" onClick={()=>createFactuurPdf(f,bedrijf).save(`Factuur-${f.nummer||f.id}.pdf`)}><FileText size={12} strokeWidth={1.8} color="#EF4444"/> PDF</button>
                      {canRemind&&<button className="f-btn f-btn-remind" onClick={()=>{setShowReminder(f);setEmailAddr(f.klant_email||"");}}><Bell size={12} strokeWidth={1.8} color="#F59E0B"/> Herinnering</button>}
                      <button className="f-btn f-btn-mail" onClick={()=>{setShowEmail(f);setEmailAddr(f.klant_email||"");}}><Mail size={12} strokeWidth={1.8} color="#3B82F6"/> Mail</button>
                      <button className="f-btn f-btn-del" title="Verwijderen" onClick={()=>{ if(window.confirm("Factuur verwijderen?")) { supabase.from("facturen").delete().eq("id",f.id).then(()=>refresh()); } }}><Trash2 size={12} strokeWidth={1.8} color="#EF4444"/></button>
                    </div>
                  </td>
                </tr>);
              })}</tbody></table></div></div>
      }
    </>)}

    {subTab==="uitgaven"&&(()=>{
      const uitGefilterd=(uitgaven||[]).filter(u=>u.datum&&u.datum.startsWith(uitMaand));
      const uitTotaal=uitGefilterd.reduce((s,u)=>s+Number(u.bedrag||0),0);
      const uitBtw=uitGefilterd.reduce((s,u)=>s+Number(u.bedrag||0)*Number(u.btw_percentage||0)/100/(1+Number(u.btw_percentage||0)/100),0);
      const uitLabel=new Date(uitMaand+"-02").toLocaleDateString("nl-NL",{month:"long",year:"numeric"});
      const uitPrev=()=>{const[y,m]=uitMaand.split("-").map(Number);const d=new Date(y,m-2);setUitMaand(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);};
      const uitNext=()=>{const[y,m]=uitMaand.split("-").map(Number);const d=new Date(y,m);setUitMaand(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);};
      const isHuidigeMaand=uitMaand===(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;})();
      return(<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:mob?"flex-start":"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:"#111"}}>Totaal: {fmtEur(uitTotaal)}</div>
          <div style={{fontSize:13,color:"#64748B"}}>BTW terug: {fmtEur(uitBtw)}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,background:"#F8FAFC",borderRadius:10,border:"1px solid #E5E7EB",padding:"4px 6px"}}>
          <button onClick={uitPrev} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 8px",borderRadius:6,fontSize:16,color:"#475569",lineHeight:1}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:"#111",minWidth:110,textAlign:"center",textTransform:"capitalize"}}>{uitLabel}</span>
          <button onClick={uitNext} disabled={isHuidigeMaand} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 8px",borderRadius:6,fontSize:16,color:isHuidigeMaand?"#D1D5DB":"#475569",lineHeight:1}}>›</button>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <button className="btn btn-ghost" disabled={scanningBon} onClick={()=>scanInputRef.current?.click()} style={{display:"flex",alignItems:"center",gap:6}}>
            {scanningBon?<><span style={{width:14,height:14,border:"2px solid #94A3B8",borderTopColor:"#475569",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>Scannen…</>:<><Camera size={14} strokeWidth={1.8}/> Scan</>}
          </button>
          <input ref={scanInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{
            const file=e.target.files?.[0]; e.target.value=""; if(!file)return;
            setScanningBon(true);
            try {
              const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
              const mt=file.type||"image/jpeg";
              const {data:{session:s}}=await supabase.auth.getSession();
              const token=s?.access_token||import.meta.env.VITE_SUPABASE_KEY;
              const resp=await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"scan-bonnetje",image_base64:b64,media_type:mt})});
              const result=await resp.json();
              if(!resp.ok)throw new Error(result?.error||"Scan mislukt");
              const preview=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
              setNieuweUitgave({datum:result.datum||localToday(),categorie:"",omschrijving:result.omschrijving||"",bedrag:result.bedrag?String(result.bedrag):"",btw_percentage:[0,9,21].includes(result.btw_percentage)?result.btw_percentage:21,foto:preview});
              setUitgaveFotoPreview(preview);
              setUitgaveErr("");
              setShowAddUitgave(true);
            } catch(err){alert("Scan mislukt: "+err.message);}
            setScanningBon(false);
          }}/>
          <button className="btn btn-dark" onClick={()=>{setNieuweUitgave({datum:localToday(),categorie:"",omschrijving:"",bedrag:"",btw_percentage:21,foto:""});setUitgaveFotoPreview("");setUitgaveErr("");setShowAddUitgave(true);}}><Plus size={14} strokeWidth={2}/> Uitgave</button>
        </div>
      </div>
      {uitGefilterd.length===0
        ?<LeegScherm icon={<FileText size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Geen uitgaven" sub={`Geen uitgaven in ${uitLabel}`} actie="+ Uitgave toevoegen" onActie={()=>setShowAddUitgave(true)}/>
        : mob
          ? <div className="mob-card-list">{uitGefilterd.map(u=>(
              <div className="mob-card" key={u.id}>
                <div className="mob-card-top">
                  <div className="mob-card-name">{u.omschrijving||"Uitgave"}</div>
                  {u.categorie&&<span style={{background:"#F1F5F9",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600,color:"#475569",flexShrink:0}}>{u.categorie}</span>}
                </div>
                <div className="mob-card-amount" style={{fontSize:22}}>{fmtEur(u.bedrag)}</div>
                <div className="mob-card-sub">{u.datum} · BTW {u.btw_percentage}%{u.foto&&" · 📷"}</div>
                <div className="mob-card-actions">
                  {u.foto&&<button className="btn btn-ghost btn-sm" onClick={()=>window.open(u.foto)}><Camera size={14} strokeWidth={1.8}/> Bon</button>}
                  <button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Uitgave verwijderen?"))supabase.from("uitgaven").delete().eq("id",u.id).then(()=>refresh());}}><Trash2 size={14} strokeWidth={1.8} color="#EF4444"/> Verwijderen</button>
                </div>
              </div>
            ))}</div>
          : <div className="card"><div className="tw"><table><thead><tr>{["Datum","Categorie","Omschrijving","Bedrag","BTW %","Acties"].map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{uitGefilterd.map(u=><tr key={u.id}>
            <td style={{color:"#888",fontSize:13}}>{u.datum}</td>
            <td><span style={{background:"#F1F5F9",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600}}>{u.categorie}</span></td>
            <td style={{fontWeight:600,color:"#111"}}>{u.omschrijving}{u.foto&&<img src={u.foto} alt="Bon" style={{width:36,height:28,objectFit:"cover",borderRadius:6,marginLeft:8,verticalAlign:"middle",cursor:"pointer"}} onClick={()=>window.open(u.foto)}/>}</td>
            <td style={{fontWeight:700,color:"#111"}}>{fmtEur(u.bedrag)}</td>
            <td style={{color:"#888"}}>{u.btw_percentage}%</td>
            <td><button className="btn btn-danger btn-sm" onClick={()=>{if(window.confirm("Uitgave verwijderen?"))supabase.from("uitgaven").delete().eq("id",u.id).then(()=>refresh());}}><X size={14}/></button></td>
          </tr>)}</tbody></table></div></div>
      }
      {showAddUitgave&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Uitgave toevoegen</div></div><button className="mc" onClick={()=>setShowAddUitgave(false)}><X size={14}/></button></div><div className="mb">
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
          {uitgaveFotoPreview
            ? <div style={{marginTop:6,position:"relative",display:"inline-block"}}>
                <img src={uitgaveFotoPreview} alt="Bon" style={{width:220,height:160,objectFit:"contain",borderRadius:10,border:"1px solid #E5E7EB",background:"#F8FAFC",display:"block"}}/>
                <button type="button" onClick={()=>{setNieuweUitgave(prev=>({...prev,foto:""}));setUitgaveFotoPreview("");}} style={{position:"absolute",top:-8,right:-8,width:24,height:24,borderRadius:"50%",background:"#EF4444",border:"none",color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}><X size={14}/></button>
              </div>
            : <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,background:"#F8FAFC",border:"1px dashed #CBD5E1",cursor:"pointer",fontSize:13,color:"#475569",fontWeight:500}}>
                Foto toevoegen
                <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onClick={e=>e.target.value=""} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{setNieuweUitgave(prev=>({...prev,foto:r.result}));setUitgaveFotoPreview(r.result);};r.readAsDataURL(f);}}/>
              </label>
          }
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
          }}><Save size={14} strokeWidth={1.8}/>{savingUitgave?"Opslaan…":"Opslaan"}</button>
        </div>
      </div></div></div>}
    </>);})()}

    {subTab==="ritten"&&<RittenTab userId={userId} ritten={ritten||[]} refresh={refresh} klanten={klanten} bedrijf={bedrijf}/>}

    {subTab==="btw"&&(()=>{
      const fE = n => `€ ${Number(n||0).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      const quarters = [
        {label:"Q1",naam:"Q1 (jan–mrt)",start:0,end:2},
        {label:"Q2",naam:"Q2 (apr–jun)",start:3,end:5},
        {label:"Q3",naam:"Q3 (jul–sep)",start:6,end:8},
        {label:"Q4",naam:"Q4 (okt–dec)",start:9,end:11},
      ];
      const q = quarters[btwQ];
      const ingKey = `btw_ingediend_${userId}_${btwJaar}_${q.label}`;
      const ingediend = !!localStorage.getItem(ingKey);

      const fInQ = facturen.filter(f => {
        if(f.status!=="Betaald")return false;
        const dateStr=f.betaald_op||f.datum;
        if(!dateStr)return false;
        const d=new Date(dateStr);
        return d.getFullYear()===btwJaar&&d.getMonth()>=q.start&&d.getMonth()<=q.end;
      });
      const uInQ = (uitgaven||[]).filter(u => {
        if(!u.datum)return false;
        const d=new Date(u.datum);
        return d.getFullYear()===btwJaar&&d.getMonth()>=q.start&&d.getMonth()<=q.end;
      });

      let omzet1a=0,btw1a=0,omzet1b=0,btw1b=0;
      fInQ.forEach(f => {
        const rr=Array.isArray(f.regels)?f.regels:[];
        if(rr.length>0){
          rr.forEach(r=>{
            const pct=Number(r.btw_pct??21),bedrag=(Number(r.aantal)||0)*(Number(r.prijs)||0);
            if(pct===21){omzet1a+=bedrag;btw1a+=bedrag*0.21;}
            else if(pct===9){omzet1b+=bedrag;btw1b+=bedrag*0.09;}
            else{omzet1a+=bedrag;}
          });
        } else {
          const tot=getTotal(f),sub=tot/1.21,btwAmt=tot-sub;
          omzet1a+=sub;btw1a+=btwAmt;
        }
      });
      const btw5a=btw1a+btw1b;
      const vb5b=uInQ.reduce((s,u)=>{const p=Number(u.btw_percentage||0);return p>0?s+Number(u.bedrag||0)*p/100/(1+p/100):s;},0);
      const res5g=btw5a-vb5b;
      const teBetalen=res5g>0;

      const Tip = ({txt}) => (
        <span title={txt} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:"50%",background:"#E0E7FF",color:"#6366F1",fontSize:10,fontWeight:700,cursor:"help",marginLeft:5,flexShrink:0}}>?</span>
      );

      const CopyBtn = ({value, id, roundUp=false}) => {
        const rounded = roundUp ? Math.ceil(value) : Math.floor(value);
        const ok = btwCopied === id;
        return (
          <button onClick={()=>{navigator.clipboard.writeText(String(rounded));setBtwCopied(id);setTimeout(()=>setBtwCopied(c=>c===id?null:c),2000);}} style={{marginLeft:5,padding:"1px 7px",fontSize:11,fontWeight:600,border:"1px solid",borderColor:ok?"#A5B4FC":"#C7D2FE",borderRadius:12,background:ok?"#EEF2FF":"#fff",color:ok?"#4338CA":"#6366F1",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap",transition:"all .15s",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            {ok?"✓ Gekopieerd!":"kopieer"}
          </button>
        );
      };

      const RubriekRow = ({lbl,tip,left,right,highlight,copyLeft,copyRight,copyRightUp}) => mob ? (
        <div style={{padding:"12px 14px",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{fontSize:13,color:"#374151",display:"flex",alignItems:"center",marginBottom:8,lineHeight:1.3}}>{lbl}<Tip txt={tip}/></div>
          <div style={{display:"flex",gap:8}}>
            {left!=null&&<div style={{flex:1}}>
              <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>Omzet</div>
              <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:600,color:"#111"}}>{fE(left)}</span>
                {copyLeft!=null&&<CopyBtn value={left} id={copyLeft}/>}
              </div>
            </div>}
            <div style={{flex:1,textAlign:left!=null?"right":"left"}}>
              <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>BTW</div>
              <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:left!=null?"flex-end":"flex-start",flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:highlight?"800":"600",color:highlight?highlight:"#6366F1"}}>{right!=null?fE(right):"—"}</span>
                {copyRight!=null&&right!=null&&<CopyBtn value={right} id={copyRight} roundUp={copyRightUp}/>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #F3F4F6"}}>
          <div style={{fontSize:13,color:"#374151",display:"flex",alignItems:"center"}}>{lbl}<Tip txt={tip}/></div>
          <div style={{fontSize:13,fontWeight:600,color:"#111",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
            {left!=null?fE(left):"—"}
            {copyLeft!=null&&left!=null&&<CopyBtn value={left} id={copyLeft}/>}
          </div>
          <div style={{fontSize:13,fontWeight:highlight?"800":"600",color:highlight?highlight:"#6366F1",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
            {right!=null?fE(right):"—"}
            {copyRight!=null&&right!=null&&<CopyBtn value={right} id={copyRight} roundUp={copyRightUp}/>}
          </div>
        </div>
      );

      const exportBtwPdf = () => {
        const doc = new jsPDF({unit:"mm",format:"a4"});
        const naam = bedrijf?.bedrijfsnaam||"Mijn bedrijf";
        doc.setFillColor(17,24,39); doc.rect(0,0,210,32,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(255,255,255);
        doc.text(naam,20,20);
        doc.setFontSize(10); doc.setFont("helvetica","normal");
        doc.text(`BTW aangifte — ${q.naam} ${btwJaar}`,20,27);
        doc.setTextColor(50,50,50); let y=44;
        const row=(lbl,l,r,bold)=>{
          if(bold){doc.setFont("helvetica","bold");}else{doc.setFont("helvetica","normal");}
          doc.setFontSize(9.5);
          doc.text(lbl,20,y);
          if(l!=null)doc.text(fE(l),140,y,{align:"right"});
          if(r!=null)doc.text(fE(r),190,y,{align:"right"});
          y+=8;
        };
        doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,100,100);
        doc.text("Rubriek",20,y); doc.text("Omzet excl. BTW",140,y,{align:"right"}); doc.text("Te betalen BTW",190,y,{align:"right"}); y+=5;
        doc.setDrawColor(200); doc.line(20,y,190,y); y+=5; doc.setTextColor(50,50,50);
        row("1a  Omzet belast met 21% BTW",omzet1a,btw1a);
        row("1b  Omzet belast met 9% BTW",omzet1b,btw1b);
        doc.setDrawColor(220); doc.line(20,y,190,y); y+=5;
        row("5a  Totaal verschuldigde BTW",null,btw5a,true);
        row("5b  Voorbelasting (inkopen/kosten)",null,-vb5b,true);
        doc.line(20,y,190,y); y+=5;
        doc.setFont("helvetica","bold"); doc.setFontSize(11);
        doc.setTextColor(...(teBetalen?[220,38,38]:[5,150,105]));
        doc.text(`5g  ${teBetalen?"Te betalen":"Terug te ontvangen"}`,20,y);
        doc.text(fE(Math.abs(res5g)),190,y,{align:"right"}); y+=14;
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(140,140,140);
        doc.text(`Gegenereerd via WerkMate op ${new Date().toLocaleDateString("nl-NL")}`,20,y);
        if(ingediend){doc.setTextColor(5,150,105);doc.text("✓ Ingediend bij Belastingdienst",20,y+6);}
        doc.save(`BTW_aangifte_${q.label}_${btwJaar}.pdf`);
      };

      const stappen = ["Binnenland","Voorbelasting","Overzicht"];

      // Deadline per kwartaal: Q1→30 apr, Q2→31 jul, Q3→31 okt, Q4→31 jan (volgend jaar)
      const deadlines = [
        {dag:30,maand:3,label:"30 april"},
        {dag:31,maand:6,label:"31 juli"},
        {dag:31,maand:9,label:"31 oktober"},
        {dag:31,maand:0,label:"31 januari",jaarOffset:1},
      ];
      const dl = deadlines[btwQ];
      const dlJaar = btwJaar + (dl.jaarOffset||0) + 1;
      const dlDate = new Date(dlJaar, dl.maand, dl.dag);
      const daysLeft = Math.ceil((dlDate - new Date()) / 86400000);
      const dlUrgent = daysLeft >= 0 && daysLeft <= 14;
      const dlVerstreken = daysLeft < 0;

      return (
        <div>
          {/* KOR-notitie */}
          <div style={{fontSize:12.5,color:"#64748B",background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
            <span>ℹ️</span>
            <span>Heb je een <strong>KOR-vrijstelling</strong>? Dan hoef je geen BTW-aangifte te doen via WerkMate.</span>
          </div>

          {/* Deadline banner */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderRadius:9,marginBottom:18,background:dlVerstreken?"#FEF2F2":dlUrgent?"#FFF7ED":"#F0FDF4",border:`1px solid ${dlVerstreken?"#FECACA":dlUrgent?"#FED7AA":"#BBF7D0"}`}}>
            <span style={{fontSize:16}}>{dlVerstreken?"🔴":dlUrgent?"⚠️":"🟢"}</span>
            <div style={{fontSize:13,fontWeight:600,color:dlVerstreken?"#991B1B":dlUrgent?"#92400E":"#15803D"}}>
              Deadline {q.naam}: <strong>{dl.label} {dlJaar}</strong>
              {dlVerstreken&&<span style={{fontWeight:400,marginLeft:6}}>— termijn verstreken</span>}
              {!dlVerstreken&&daysLeft<=30&&<span style={{fontWeight:400,marginLeft:6}}>— nog {daysLeft} dag{daysLeft!==1?"en":""}</span>}
            </div>
          </div>

          {/* Header met kwartaal/jaar selector */}
          <div style={{marginBottom:mob?14:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:mob?15:17,color:"#0F0F14",fontFamily:"'Syne',sans-serif"}}>BTW aangifte</div>
              {ingediend&&<span style={{fontSize:11.5,fontWeight:700,color:"#059669",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:20,padding:"3px 10px"}}>✓ Ingediend</span>}
            </div>
            <div className={mob?"tab-scroll":""} style={{display:"flex",gap:6,alignItems:"center",flexWrap:mob?"nowrap":"wrap",paddingBottom:mob?4:0}}>
              <select value={btwJaar} onChange={e=>{setBtwJaar(Number(e.target.value));setBtwStap(0);}} className="sel" style={{flexShrink:0}}>
                {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              {quarters.map((qq,qi)=>(
                <button key={qq.label} onClick={()=>{setBtwQ(qi);setBtwStap(0);}} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:btwQ===qi?"#0F0F14":"#fff",color:btwQ===qi?"#fff":"#555",borderColor:btwQ===qi?"#0F0F14":"#E5E7EB",flexShrink:0,whiteSpace:"nowrap"}}>{qq.label}</button>
              ))}
            </div>
            {!mob&&<div style={{fontSize:12,color:"#94A3B8",marginTop:6}}>{fInQ.length} betaalde factuur{fInQ.length!==1?"en":""} · {uInQ.length} uitgave{uInQ.length!==1?"n":""} · {q.naam} {btwJaar}</div>}
          </div>

          {/* Stap-indicator */}
          <div className={mob?"tab-scroll":""} style={{display:"flex",alignItems:"center",gap:0,marginBottom:24,overflowX:"auto",paddingBottom:mob?4:0}}>
            {stappen.map((s,i)=>(
              <Fragment key={s}>
                <button onClick={()=>setBtwStap(i)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",borderRadius:20,border:`1.5px solid ${btwStap===i?"#6366F1":"#E5E7EB"}`,background:btwStap===i?"#EEF2FF":"#fff",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12.5,fontWeight:600,color:btwStap===i?"#4338CA":"#64748B",whiteSpace:"nowrap"}}>
                  <span style={{width:20,height:20,borderRadius:"50%",background:btwStap===i?"#6366F1":btwStap>i?"#10B981":"#E5E7EB",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{btwStap>i?"✓":i+1}</span>
                  {s}
                </button>
                {i<stappen.length-1&&<div style={{width:24,height:2,background:"#E5E7EB",flexShrink:0}}/>}
              </Fragment>
            ))}
          </div>

          {/* STAP 0 — Binnenland */}
          {btwStap===0&&(
            <div>
              <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#4338CA"}}>
                💡 Hier vul je in wat je hebt gefactureerd aan BTW. WerkMate heeft dit automatisch uit je facturen gehaald.
              </div>
              <div className="card" style={{overflow:"hidden",marginBottom:12}}>
                <div className="btw-hdr-cols" style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"9px 14px",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Rubriek</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>Omzet excl. BTW</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>BTW bedrag</div>
                </div>
                <RubriekRow
                  lbl="1a — Leveringen/diensten belast met 21%"
                  tip="Alle omzet waarover je 21% BTW hebt berekend. Dit is het bedrag excl. BTW dat je hebt gefactureerd."
                  left={omzet1a} right={btw1a}
                />
                <RubriekRow
                  lbl="1b — Leveringen/diensten belast met 9%"
                  tip="Alle omzet waarover je 9% BTW hebt berekend (bijv. voedsel, boeken, reparaties aan woningen)."
                  left={omzet1b} right={btw1b}
                />
                {omzet1a===0&&omzet1b===0&&<div style={{padding:"16px 14px",fontSize:13,color:"#94A3B8",textAlign:"center"}}>Geen betaalde facturen in {q.naam} {btwJaar}</div>}
              </div>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button onClick={()=>setBtwStap(1)} className="btn btn-dark" style={{minWidth:140}}>Volgende stap →</button>
              </div>
            </div>
          )}

          {/* STAP 1 — Voorbelasting */}
          {btwStap===1&&(
            <div>
              <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#15803D"}}>
                💡 Voorbelasting is de BTW die jij zelf hebt betaald op inkopen en kosten. Dit mag je aftrekken van wat je moet afdragen.
              </div>
              <div className="card" style={{overflow:"hidden",marginBottom:12}}>
                <div className="btw-hdr-cols" style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"9px 14px",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Rubriek</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>Omzet excl. BTW</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>BTW bedrag</div>
                </div>
                <RubriekRow
                  lbl="5a — Totaal verschuldigde BTW (1a + 1b)"
                  tip="Dit is het totaal aan BTW dat je aan klanten hebt berekend. Automatisch berekend uit rubriek 1a en 1b."
                  left={null} right={btw5a} highlight="#6366F1"
                />
                <RubriekRow
                  lbl="5b — Voorbelasting (BTW op inkopen)"
                  tip="De BTW die jij hebt betaald op zakelijke inkopen en kosten. Komt uit jouw uitgaventabel."
                  left={null} right={vb5b} highlight="#10B981"
                />
                {uInQ.length===0&&<div style={{padding:"16px 14px",fontSize:13,color:"#94A3B8",textAlign:"center"}}>Geen uitgaven in {q.naam} {btwJaar} — voeg uitgaven toe via het Uitgaven tabblad</div>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                <button onClick={()=>setBtwStap(0)} className="btn btn-ghost">← Vorige</button>
                <button onClick={()=>setBtwStap(2)} className="btn btn-dark" style={{minWidth:140}}>Naar overzicht →</button>
              </div>
            </div>
          )}

          {/* STAP 2 — Overzicht */}
          {btwStap===2&&(
            <div>
              {/* Grote uitkomstkaart */}
              <div style={{background:teBetalen?"#FEF2F2":"#F0FDF4",border:`2px solid ${teBetalen?"#FECACA":"#BBF7D0"}`,borderRadius:16,padding:mob?"16px 18px":"24px 28px",marginBottom:mob?14:20,textAlign:"center"}}>
                <div style={{fontSize:mob?12:14,color:teBetalen?"#991B1B":"#15803D",fontWeight:600,marginBottom:4}}>{teBetalen?"Te betalen aan Belastingdienst":"Je krijgt terug van Belastingdienst"}</div>
                <div style={{fontSize:mob?32:40,fontWeight:900,color:teBetalen?"#DC2626":"#059669",fontFamily:"'Syne',sans-serif",lineHeight:1}}>{fE(Math.abs(res5g))}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:6}}>{q.naam} {btwJaar}</div>
              </div>

              {/* Volledige specificatie */}
              <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                <div style={{padding:"10px 14px",background:"#F8FAFC",borderBottom:"2px solid #E5E7EB",fontWeight:700,fontSize:13,color:"#0F0F14"}}>Specificatie</div>
                <div className="btw-hdr-cols" style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"9px 14px",borderBottom:"1px solid #F8FAFC"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}></div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>Omzet excl. BTW</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>BTW</div>
                </div>
                <RubriekRow lbl="1a — Omzet 21%" tip="Gefactureerde omzet belast met 21% BTW" left={omzet1a} right={btw1a} copyLeft="1a-omzet" copyRight="1a-btw"/>
                <RubriekRow lbl="1b — Omzet 9%" tip="Gefactureerde omzet belast met 9% BTW" left={omzet1b} right={btw1b} copyLeft="1b-omzet" copyRight="1b-btw"/>
                {mob ? (
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #F3F4F6",background:"#F8FAFC"}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>5a — Totaal verschuldigd</span>
                      <span style={{fontSize:14,fontWeight:700,color:"#6366F1"}}>{fE(btw5a)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid #F3F4F6"}}>
                      <span style={{fontSize:13,color:"#374151",display:"flex",alignItems:"center"}}>5b — Voorbelasting<Tip txt="BTW die je zelf hebt betaald op zakelijke inkopen."/></span>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:14,fontWeight:700,color:"#10B981"}}>- {fE(vb5b)}</span>
                        <CopyBtn value={vb5b} id="5b-vb" roundUp={true}/>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px",background:teBetalen?"#FEF2F2":"#F0FDF4"}}>
                      <span style={{fontSize:14,fontWeight:800,color:teBetalen?"#DC2626":"#059669"}}>5g — {teBetalen?"Te betalen":"Terug"}</span>
                      <span style={{fontSize:16,fontWeight:900,color:teBetalen?"#DC2626":"#059669"}}>{fE(Math.abs(res5g))}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"10px 14px",borderBottom:"1px solid #F3F4F6",background:"#F8FAFC"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#374151"}}>5a — Totaal verschuldigd</div>
                      <div/>
                      <div style={{fontSize:13,fontWeight:700,textAlign:"right",color:"#6366F1"}}>{fE(btw5a)}</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"10px 14px",borderBottom:"1px solid #F3F4F6"}}>
                      <div style={{fontSize:13,color:"#374151",display:"flex",alignItems:"center"}}>5b — Voorbelasting<Tip txt="BTW die je zelf hebt betaald op zakelijke inkopen. Dit trekt de Belastingdienst af van wat je moet afdragen."/></div>
                      <div/>
                      <div style={{fontSize:13,fontWeight:700,color:"#10B981",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>- {fE(vb5b)}<CopyBtn value={vb5b} id="5b-vb" roundUp={true}/></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:8,padding:"12px 14px",background:teBetalen?"#FEF2F2":"#F0FDF4"}}>
                      <div style={{fontSize:14,fontWeight:800,color:teBetalen?"#DC2626":"#059669"}}>5g — {teBetalen?"Te betalen":"Terug te ontvangen"}</div>
                      <div/>
                      <div style={{fontSize:14,fontWeight:900,textAlign:"right",color:teBetalen?"#DC2626":"#059669"}}>{fE(Math.abs(res5g))}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Kopieer-tip */}
              <div style={{fontSize:12.5,color:"#64748B",background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:8,padding:"8px 12px",marginBottom:16,display:"flex",alignItems:"center",gap:6}}>
                <span style={{flexShrink:0,display:"flex",alignItems:"center"}}><ClipboardList size={16} strokeWidth={1.8}/></span>
                <span>Vul deze getallen in op belastingdienst.nl — gebruik de <strong>kopieer</strong>-knoppen hierboven. Alleen hele bedragen toegestaan.</span>
              </div>

              {/* Acties */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                <button onClick={exportBtwPdf} className="btn btn-outline">⬇ Sla op als PDF</button>
                <a href="https://mijn.belastingdienst.nl" target="_blank" rel="noopener noreferrer" style={{padding:"8px 18px",background:"#1C4CC3",color:"#fff",borderRadius:9,fontSize:13,fontWeight:700,textDecoration:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"inline-flex",alignItems:"center",gap:6}}>Ga naar Belastingdienst ↗</a>
              </div>

              {ingediend
                ? <div style={{background:"#ECFDF5",border:"1.5px solid #A7F3D0",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{display:"flex",color:"#059669"}}><Check size={22} strokeWidth={2.5}/></span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#065F46"}}>{q.naam} {btwJaar} is ingediend</div>
                      <button onClick={()=>{localStorage.removeItem(ingKey);setBtwStap(2);}} style={{background:"none",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:0,marginTop:2,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Ongedaan maken</button>
                    </div>
                  </div>
                : <div style={{background:"#FFF7ED",border:"1.5px solid #FED7AA",borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#92400E"}}>Aangifte gedaan?</div>
                      <div style={{fontSize:13,color:"#78350F",marginTop:2}}>Bevestig dat je {q.naam} {btwJaar} hebt ingediend bij de Belastingdienst.</div>
                    </div>
                    <button onClick={()=>{localStorage.setItem(ingKey,"1");setBtwStap(2);}} style={{padding:"9px 20px",background:"#D97706",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",whiteSpace:"nowrap"}}>✓ Markeer als ingediend</button>
                  </div>
              }

              <div style={{display:"flex",justifyContent:"flex-start",marginTop:12}}>
                <button onClick={()=>setBtwStap(1)} className="btn btn-ghost">← Vorige stap</button>
              </div>
            </div>
          )}
        </div>
      );
    })()}

    {subTab==="winst"&&(()=>{
      const fmtEurW = n => `€ ${Number(n).toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      const maanden = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

      const monthData = maanden.map((m, mi) => {
        const ink = facturen.filter(f => { if(f.status!=="Betaald")return false; const ds=f.betaald_op||f.datum; return ds&&new Date(ds).getFullYear()===winstJaar&&new Date(ds).getMonth()===mi; }).reduce((s,f)=>s+getTotal(f),0);
        const uit = (uitgaven||[]).filter(u => u.datum && new Date(u.datum).getFullYear()===winstJaar && new Date(u.datum).getMonth()===mi).reduce((s,u)=>s+Number(u.bedrag||0),0);
        return { label:m, inkomsten:ink, uitgaven:uit, netto:ink-uit };
      });

      const allYears = Array.from(new Set([
        ...facturen.filter(f=>f.datum).map(f=>new Date(f.datum).getFullYear()),
        ...(uitgaven||[]).filter(u=>u.datum).map(u=>new Date(u.datum).getFullYear()),
        new Date().getFullYear(),
      ])).sort((a,b)=>b-a);

      const yearData = allYears.map(y => {
        const ink = facturen.filter(f => { if(f.status!=="Betaald")return false; const ds=f.betaald_op||f.datum; return ds&&new Date(ds).getFullYear()===y; }).reduce((s,f)=>s+getTotal(f),0);
        const uit = (uitgaven||[]).filter(u => u.datum && new Date(u.datum).getFullYear()===y).reduce((s,u)=>s+Number(u.bedrag||0),0);
        return { label:String(y), inkomsten:ink, uitgaven:uit, netto:ink-uit };
      });

      const rows = winstPeriode==="maand" ? monthData : yearData;
      const totInk = rows.reduce((s,r)=>s+r.inkomsten,0);
      const totUit = rows.reduce((s,r)=>s+r.uitgaven,0);
      const totNetto = totInk - totUit;

      const exportWinstXlsx = () => {
        const data = [
          ["Winst & verlies", winstPeriode==="maand" ? winstJaar : "Alle jaren"],
          [],
          ["Periode","Inkomsten","Uitgaven","Netto winst"],
          ...rows.map(r=>[r.label, r.inkomsten.toFixed(2), r.uitgaven.toFixed(2), r.netto.toFixed(2)]),
          ["TOTAAL", totInk.toFixed(2), totUit.toFixed(2), totNetto.toFixed(2)],
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = [{wch:12},{wch:14},{wch:14},{wch:14}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Winst verlies");
        XLSX.writeFile(wb, `Winst_verlies_${winstPeriode==="maand"?winstJaar:"alle"}.xlsx`);
      };

      const exportWinstPdf = () => {
        const doc = new jsPDF({ unit:"mm", format:"a4" });
        doc.setFont("helvetica","bold"); doc.setFontSize(18);
        doc.text(`Winst & verlies ${winstPeriode==="maand"?winstJaar:""}`, 20, 22);
        doc.setFont("helvetica","normal"); doc.setFontSize(10);
        doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}`, 20, 30);
        doc.setDrawColor(220); doc.line(20, 34, 190, 34);
        const cx = [20, 80, 130, 165]; let y = 42;
        doc.setFont("helvetica","bold"); doc.setFontSize(9);
        ["Periode","Inkomsten","Uitgaven","Netto winst"].forEach((h,i)=>doc.text(h,cx[i],y));
        doc.line(20, y+2, 190, y+2); y+=8;
        doc.setFont("helvetica","normal");
        rows.forEach(r => {
          doc.setTextColor(0); [r.label, fmtEurW(r.inkomsten), fmtEurW(r.uitgaven)].forEach((v,i)=>doc.text(v,cx[i],y));
          doc.setTextColor(...(r.netto>=0?[5,150,105]:[220,38,38])); doc.text(fmtEurW(r.netto),cx[3],y);
          doc.setTextColor(0); y+=7;
          if (y > 270) { doc.addPage(); y=20; }
        });
        doc.setDrawColor(200); doc.line(20,y,190,y); y+=5;
        doc.setFont("helvetica","bold");
        [" Totaal", fmtEurW(totInk), fmtEurW(totUit)].forEach((v,i)=>doc.text(v,cx[i],y));
        doc.setTextColor(...(totNetto>=0?[5,150,105]:[220,38,38])); doc.text(fmtEurW(totNetto),cx[3],y);
        doc.save(`Winst_verlies_${winstPeriode==="maand"?winstJaar:"alle"}.pdf`);
      };

      return (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{fontWeight:700,fontSize:16,color:"#111"}}>Winst & verlies</div>
              {["maand","jaar"].map(p=>(
                <button key={p} onClick={()=>setWinstPeriode(p)} style={{padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:winstPeriode===p?"#0F0F14":"#fff",color:winstPeriode===p?"#fff":"#555",borderColor:winstPeriode===p?"#0F0F14":"#E5E7EB"}}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
              ))}
              {winstPeriode==="maand"&&<select value={winstJaar} onChange={e=>setWinstJaar(Number(e.target.value))} className="sel">
                {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
              </select>}
            </div>
            <div className="mob-hide" style={{display:"flex",gap:8}}>
              <button className="btn btn-outline" onClick={exportWinstXlsx}>⬇ Excel</button>
              <button className="btn btn-outline" onClick={exportWinstPdf}>⬇ PDF</button>
            </div>
          </div>
          <div className="sg-3">
            {[
              {lbl:"Totale inkomsten",val:fmtEurW(totInk),color:"#10B981",bg:"#F0FDF4",border:"#BBF7D0"},
              {lbl:"Totale uitgaven",val:fmtEurW(totUit),color:"#EF4444",bg:"#FEF2F2",border:"#FECACA"},
              {lbl:"Netto winst",val:fmtEurW(totNetto),color:totNetto>=0?"#0F0F14":"#EF4444",bg:totNetto>=0?"#F8FAFC":"#FEF2F2",border:totNetto>=0?"#E2E8F0":"#FECACA"},
            ].map(s=>(
              <div key={s.lbl} style={{background:s.bg,border:`1.5px solid ${s.border}`,borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:12,color:"#64748B",marginBottom:4}}>{s.lbl}</div>
                <div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"'Syne',sans-serif"}}>{s.val}</div>
              </div>
            ))}
          </div>
          <div className="card"><div className="tw"><table>
            <thead><tr>{["Periode","Inkomsten","Uitgaven","Netto winst"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r=>(
              <tr key={r.label} style={{opacity:r.inkomsten===0&&r.uitgaven===0?0.4:1}}>
                <td style={{fontWeight:600,color:"#111"}}>{r.label}</td>
                <td style={{fontWeight:700,color:"#10B981"}}>{fmtEurW(r.inkomsten)}</td>
                <td style={{fontWeight:700,color:"#EF4444"}}>{fmtEurW(r.uitgaven)}</td>
                <td style={{fontWeight:800,color:r.netto>=0?"#0F0F14":"#EF4444"}}>{fmtEurW(r.netto)}</td>
              </tr>
            ))}</tbody>
          </table></div></div>
        </div>
      );
    })()}

    {subTab==="ai"&&(
      <div className="card cp" style={{maxWidth:620}}>
        <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}><Sparkles size={15} strokeWidth={1.8} style={{marginRight:6}}/> Slimme assistent</div>
        <div style={{fontSize:13,color:"#94A3B8",marginBottom:16}}>Stel vragen over je omzet, facturen en BTW</div>
        {["Hoeveel heb ik deze maand verdiend?","Welke facturen staan nog open?","Hoeveel BTW moet ik afdragen dit kwartaal?","Wat is mijn omzet dit jaar?"].map(q=>(
          <div key={q} className="tip-row" onClick={()=>setAiInput(q)} style={{fontSize:13,color:"#4338CA",cursor:"pointer",padding:"7px 0",borderBottom:"1px solid #F0F0F0"}}>→ {q}</div>
        ))}
        <div className="ig" style={{marginTop:14}}>
          <label className="ilbl">Vraag</label>
          <textarea className="inp" value={aiInput} onChange={e=>setAiInput(e.target.value)} style={{minHeight:72}} placeholder="Bijv: Hoeveel heb ik vorige maand verdiend?"/>
        </div>
        <button className="btn btn-ai btn-full" onClick={askAi} disabled={!aiInput.trim()||aiLoading} style={{opacity:aiInput.trim()?1:.5}}>{aiLoading?<><Sparkles size={14} strokeWidth={1.8}/><span className="dot">…</span></>:"Vraag het"}</button>
        {aiAnswer&&<div style={{marginTop:14,background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:10,padding:"14px 16px",fontSize:14,color:"#1e293b",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{aiAnswer}</div>}
      </div>
    )}

    {showCreate&&<div className="overlay"><div className="modal" style={{maxWidth:700,width:"95vw"}}>
      <div className="mh"><div><div className="mt">Nieuwe factuur</div></div><button className="mc" onClick={()=>setShowCreate(false)}><X size={14}/></button></div>
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
          {mob ? (
            <div>
              {nieuw.regels.map((r,i)=>(
                <div key={i} style={{border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px",marginBottom:8}}>
                  <div className="ig" style={{marginBottom:8}}><label className="ilbl">Omschrijving</label><textarea className="off-inp off-inp-ta" rows={2} value={r.omschrijving} onChange={e=>setRegel(i,"omschrijving",e.target.value)} placeholder="Omschrijving"/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div className="ig" style={{marginBottom:0}}><label className="ilbl">Aantal</label><input className="off-inp" type="number" value={r.aantal} onChange={e=>setRegel(i,"aantal",e.target.value)} style={{textAlign:"center"}}/></div>
                    <div className="ig" style={{marginBottom:0}}><label className="ilbl">Eenheid</label><select className="off-inp" value={r.eenheid} onChange={e=>setRegel(i,"eenheid",e.target.value)}>{["stuk","st","uur","dag","m²","m","rit","persoon","km","kg","l"].map(u=><option key={u}>{u}</option>)}</select></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div className="ig" style={{marginBottom:0}}><label className="ilbl">Prijs (€)</label><input className="off-inp" type="number" value={r.prijs} onChange={e=>setRegel(i,"prijs",e.target.value)} style={{textAlign:"right"}}/></div>
                    <div className="ig" style={{marginBottom:0}}><label className="ilbl">BTW</label><select className="off-inp center" value={r.btw_pct??21} onChange={e=>setRegel(i,"btw_pct",Number(e.target.value))}>{[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}</select></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#111"}}>= {fmtEur((Number(r.aantal)||0)*(Number(r.prijs)||0))}</span>
                    <button onClick={()=>removeRegel(i)} style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:7,padding:"5px 12px",color:"#EF4444",fontSize:13,fontWeight:600,cursor:"pointer"}}>Verwijderen</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <div className="off-tbl-grid" style={{borderBottom:"2px solid #E5E7EB",paddingBottom:6,marginBottom:4}}>
                {["Omschrijving","Aantal","Eenheid","Prijs","BTW","Totaal",""].map((h,i)=><div key={i} className="off-cell" style={{fontWeight:700,fontSize:12,color:"#94A3B8",justifyContent:i>=3&&i<6?"flex-end":i===1?"center":"flex-start"}}>{h}</div>)}
              </div>
              {nieuw.regels.map((r,i)=>(
                <div key={i} className="off-tbl-grid" style={{borderBottom:"1px solid #F3F4F6",alignItems:"flex-start"}}>
                  <div className="off-cell" style={{alignItems:"flex-start",paddingTop:8}}><textarea className="off-inp off-inp-ta" rows={1} value={r.omschrijving} ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}} onChange={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";setRegel(i,"omschrijving",e.target.value);}} placeholder="Omschrijving"/></div>
                  <div className="off-cell" style={{paddingTop:8}}><input className="off-inp" type="number" value={r.aantal} onChange={e=>setRegel(i,"aantal",e.target.value)} style={{textAlign:"center"}}/></div>
                  <div className="off-cell" style={{paddingTop:8}}><select className="off-inp" value={r.eenheid} onChange={e=>setRegel(i,"eenheid",e.target.value)} style={{minWidth:80}}>{["stuk","st","uur","dag","m²","m","rit","persoon","km","kg","l"].map(u=><option key={u}>{u}</option>)}</select></div>
                  <div className="off-cell" style={{paddingTop:8}}><input className="off-inp" type="number" value={r.prijs} onChange={e=>setRegel(i,"prijs",e.target.value)} style={{textAlign:"right"}}/></div>
                  <div className="off-cell" style={{paddingTop:8}}><select className="off-inp center" value={r.btw_pct??21} onChange={e=>setRegel(i,"btw_pct",Number(e.target.value))}>{[0,9,21].map(p=><option key={p} value={p}>{p}%</option>)}</select></div>
                  <div className="off-cell off-cell-totaal">{fmtEur((Number(r.aantal)||0)*(Number(r.prijs)||0))}</div>
                  <div className="off-cell"><button onClick={()=>removeRegel(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16}}>×</button></div>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={addRegel} style={{marginTop:8}}>+ Regel</button>
        </div>
        <div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:10,padding:"12px 16px",marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>Subtotaal (excl. BTW)</span><span>{fmtEur(cSub)}</span></div>
          {cBtw9>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>BTW 9%</span><span>{fmtEur(cBtw9)}</span></div>}
          {cBtw21>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>BTW 21%</span><span>{fmtEur(cBtw21)}</span></div>}
          {cBtw>0&&!cBtw9&&!cBtw21&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#888",marginBottom:4}}><span>BTW</span><span>{fmtEur(cBtw)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800,color:"#111",marginTop:2}}><span>Totaal</span><span>{fmtEur(cTot)}</span></div>
          {btwRateLabel(nieuw.regels)&&<div style={{textAlign:"right",fontSize:11,color:"#94A3B8",marginTop:4}}>{btwRateLabel(nieuw.regels)}</div>}
        </div>
        {saveErr&&<div style={{color:"#EF4444",fontSize:12.5,marginTop:8}}>{saveErr}</div>}
        <div style={{display:"flex",gap:9,marginTop:12}}>
          <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Annuleren</button>
          <button className="btn btn-dark btn-full" onClick={saveFactuur} disabled={saving||!nieuw.klant}><Plus size={14} strokeWidth={2}/>{saving?"Opslaan…":"Factuur aanmaken"}</button>
        </div>
      </div>
    </div></div>}

    {showEmail&&<div className="overlay"><div className="modal" style={{maxWidth:440}}>
      <div className="mh"><div><div className="mt">Factuur versturen</div><div style={{fontSize:12.5,color:"#94A3B8",marginTop:2}}>{showEmail.nummer} — {showEmail.klant}</div></div><button className="mc" onClick={()=>{setShowEmail(null);setEmailMsg("");}}><X size={14}/></button></div>
      <div className="mb">
        {emailMsg&&!emailMsg.startsWith("Fout")
          ? <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>✓</div>
              <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>Email verstuurd</div>
              <div style={{color:"#64748B",fontSize:13}}>Naar {emailAddr}</div>
            </div>
          : <>
              <p style={{fontSize:14,color:"#374151",marginBottom:12,lineHeight:1.6}}>
                Wil je factuur <strong>{showEmail.nummer}</strong> sturen naar <strong>{showEmail.klant}</strong>?
              </p>
              <div className="ig"><label className="ilbl">E-mailadres</label><input className="inp" type="email" value={emailAddr} onChange={e=>setEmailAddr(e.target.value)} placeholder="klant@email.nl" autoFocus/></div>
              {emailMsg&&<div style={{color:"#EF4444",fontSize:13,marginBottom:8}}>{emailMsg}</div>}
              <div className="modal-act"><button className="btn btn-ghost" onClick={()=>{setShowEmail(null);setEmailMsg("");}}>Annuleren</button><button className="btn btn-blue btn-full" onClick={sendInvoiceEmail} disabled={!emailAddr||emailSending}><Mail size={14} strokeWidth={1.8}/>{emailSending?"Versturen…":"Factuur versturen"}</button></div>
            </>
        }
      </div>
    </div></div>}

    {showReminder&&<div className="overlay"><div className="modal" style={{maxWidth:440}}>
      <div className="mh"><div><div className="mt">Betalingsherinnering sturen</div><div style={{fontSize:12.5,color:"#94A3B8",marginTop:2}}>{showReminder.nummer} — {showReminder.klant} — {fmtEur(getTotal(showReminder))}</div></div><button className="mc" onClick={()=>{setShowReminder(null);setEmailMsg("");}}><X size={14}/></button></div>
      <div className="mb">
        {emailMsg&&!emailMsg.startsWith("Fout")
          ? <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:36,marginBottom:10}}>✓</div>
              <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>Herinnering verstuurd</div>
              <div style={{color:"#64748B",fontSize:13}}>Naar {emailAddr}</div>
            </div>
          : <>
              <p style={{fontSize:14,color:"#374151",marginBottom:12,lineHeight:1.6}}>
                Wil je een betalingsherinnering sturen naar <strong>{showReminder.klant}</strong> voor factuur <strong>{showReminder.nummer}</strong> ({fmtEur(getTotal(showReminder))})?
              </p>
              <div className="ig"><label className="ilbl">E-mailadres</label><input className="inp" type="email" value={emailAddr} onChange={e=>setEmailAddr(e.target.value)} placeholder="klant@email.nl" autoFocus/></div>
              {emailMsg&&<div style={{color:"#EF4444",fontSize:13,marginBottom:8}}>{emailMsg}</div>}
              <div className="modal-act"><button className="btn btn-ghost" onClick={()=>{setShowReminder(null);setEmailMsg("");}}>Annuleren</button><button className="btn btn-amber btn-full" onClick={sendReminder} disabled={!emailAddr||emailSending}><Bell size={14} strokeWidth={1.8}/>{emailSending?"Versturen…":"Herinnering versturen"}</button></div>
            </>
        }
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
    if (!isValidEmail(email)) { setError("Ongeldig e-mailadres."); return; }
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
            ...companyEmailFields(bedrijf),
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
    <div className="ph"><div><div className="pg-title">Team</div><div className="pg-sub">Nodig teamleden uit en beheer rollen</div></div><button className="btn btn-dark" onClick={()=>setShowInvite(true)}><Plus size={14} strokeWidth={2}/> Teamlid uitnodigen</button></div>
    {teamMembers.length===0
      ? <LeegScherm icon={<Users size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Nog geen teamleden" sub="Nodig iemand uit om samen te werken" actie="+ Uitnodigen" onActie={()=>setShowInvite(true)}/>
      : <div className="card"><div className="tw"><table><thead><tr>{["E-mail","Rol","Uitgenodigd","Acties"].map(h=><th key={h} className={h==="Uitgenodigd"?"mob-hide":undefined}>{h}</th>)}</tr></thead>
          <tbody>{teamMembers.map(member=><tr key={member.id}><td style={{fontWeight:700,color:"#111"}}>{member.email}</td><td style={{color:"#555"}}>{member.role}</td><td className="mob-hide" style={{color:"#888"}}>{member.invited_at?new Date(member.invited_at).toLocaleDateString("nl-NL"):"-"}</td><td><button className="btn btn-danger btn-sm" onClick={()=>removeMember(member.id)}>Verwijderen</button></td></tr>)}</tbody>
        </table></div></div>
    }
    {showInvite&&<div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Teamlid uitnodigen</div></div><button className="mc" onClick={()=>setShowInvite(false)}><X size={14}/></button></div><div className="mb">
      <div className="ig"><label className="ilbl">E-mail</label><input className="inp" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} placeholder="voorbeeld@bedrijf.nl"/></div>
      <div className="ig"><label className="ilbl">Rol</label><select className="inp" value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value})}>{["Baas","Beheerder","Monteur","Stagiair","Verkoper","Boekhouder","Chauffeur","Magazijnmedewerker","Projectleider","Uitvoerder"].map(r=><option key={r}>{r}</option>)}</select></div>
      {error && <div style={{color:'#B91C1C',marginBottom:12,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",gap:9}}>
        <button type="button" className="btn btn-ghost" onClick={()=>{setShowInvite(false);setError("");}}>Annuleren</button>
        <button type="button" className="btn btn-dark btn-full" onClick={inviteMember} disabled={saving||!invite.email||!invite.role}><Send size={14} strokeWidth={1.8}/>{saving?"Uitnodigen…":"Uitnodigen"}</button>
      </div>
    </div></div></div>}
  </div>);
}

// ── Mail ──────────────────────────────────────────────────────
const TYPE_LABELS = { offerte:"Offerte", factuur:"Factuur", herinnering:"Herinnering", review:"Review", team:"Team", handmatig:"Handmatig" };
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

function MailTab({ userId, emailsLog = [], refresh, klanten = [], bedrijf }) {
  const mob = useMobile();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Alle");
  const [detail, setDetail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [compose, setCompose] = useState({ klantId:"", to:"", subject:"", body:"" });
  const [composeSending, setComposeSending] = useState(false);
  const [composeSent, setComposeSent] = useState(false);
  const [composeErr, setComposeErr] = useState("");
  const [resending, setResending] = useState(new Set());

  const retryEmail = async (e) => {
    setResending(prev => new Set(prev).add(e.id));
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token || import.meta.env.VITE_SUPABASE_KEY;
      const res = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: "send-compose-email", to_email: e.to_email, subject: e.subject, message: e.body || e.subject }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resData?.message || resData?.error || "Versturen mislukt");
      await supabase.from("emails_log").update({ status: "verzonden" }).eq("id", e.id);
      refresh();
    } catch(err) {
      alert("Opnieuw versturen mislukt: " + err.message);
    }
    setResending(prev => { const n = new Set(prev); n.delete(e.id); return n; });
  };

  const deleteEmail = async (id, ev) => {
    ev.stopPropagation();
    await supabase.from("emails_log").delete().eq("id", id);
    refresh();
  };

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

  const sendCompose = async () => {
    if (!compose.to || !compose.subject || !compose.body) { setComposeErr("Vul ontvanger, onderwerp en bericht in."); return; }
    if (!compose.to.includes("@")) { setComposeErr("Ongeldig e-mailadres."); return; }
    setComposeSending(true); setComposeErr("");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token || import.meta.env.VITE_SUPABASE_KEY;
      const res = await fetch("https://cpfdyrscucicvqzpnisd.supabase.co/functions/v1/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: "send-compose-email", to_email: compose.to, subject: compose.subject, message: compose.body }),
      });
      const composeData = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(composeData?.message||composeData?.error||"Versturen mislukt");
      await logEmail(userId, compose.to, compose.subject, "handmatig", compose.body, "verzonden", composeData?.html||null);
      setComposeSent(true);
      setTimeout(() => { setShowCompose(false); setComposeSent(false); setCompose({ klantId:"", to:"", subject:"", body:"" }); refresh(); }, 2200);
    } catch(e) { setComposeErr(e.message || "Versturen mislukt"); }
    setComposeSending(false);
  };

  return (
    <div>
      <div className="ph">
        <div><div className="pg-title">Mail</div><div className="pg-sub">Overzicht verzonden e-mails</div></div>
        <button className="btn btn-dark" onClick={()=>{setShowCompose(true);setComposeSent(false);setComposeErr("");setCompose({klantId:"",to:"",subject:"",body:""});}}><Plus size={14} strokeWidth={2}/> Nieuwe email</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <input
          className="inp"
          style={{maxWidth:mob?undefined:260,margin:0,flex:mob?"1 1 100%":undefined}}
          placeholder="Zoeken op ontvanger of onderwerp…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
      </div>
      <div className={mob?"tab-scroll":""} style={{display:"flex",gap:6,flexWrap:mob?"nowrap":"wrap",marginBottom:16}}>
        {["Alle","Offerte","Factuur","Herinnering","Review","Certificaat","Team","Handmatig"].map(t=>(
          <button key={t} onClick={()=>setFilterType(t)} style={{padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:filterType===t?"#0F0F14":"#fff",color:filterType===t?"#fff":"#555",borderColor:filterType===t?"#0F0F14":"#E5E7EB",flexShrink:0,whiteSpace:"nowrap"}}>{t}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <LeegScherm icon={<Mail size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Geen e-mails gevonden" sub={emailsLog.length === 0 ? "Verstuurde e-mails verschijnen hier automatisch" : "Geen e-mails die overeenkomen met je zoekopdracht"}/>
        : mob
          ? <div className="mob-card-list">{filtered.map(e=>(
              <div className="mob-card" key={e.id} onClick={()=>setDetail(e)}>
                <div className="mob-card-top">
                  <TypeBadge type={e.type}/>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:600,color:e.status==="verzonden"?"#065F46":"#991B1B"}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:e.status==="verzonden"?"#10B981":"#EF4444",display:"inline-block"}}/>
                    {e.status==="verzonden"?"Verzonden":"Mislukt"}
                  </span>
                </div>
                <div style={{fontWeight:600,fontSize:14,color:"#0F0F14",margin:"6px 0 3px",lineHeight:1.3}}>{e.subject}</div>
                <div className="mob-card-sub">{e.to_email}</div>
                <div className="mob-card-sub" style={{marginTop:2}}>{fmtDate(e.sent_at)}</div>
                <div className="mob-card-actions">
                  {e.status!=="verzonden"&&<button className="btn btn-ghost btn-sm" disabled={resending.has(e.id)} onClick={ev=>{ev.stopPropagation();retryEmail(e);}}>{resending.has(e.id)?"Bezig…":"Opnieuw"}</button>}
                  <button className="btn btn-danger btn-sm" onClick={ev=>deleteEmail(e.id,ev)}><X size={14}/></button>
                </div>
                <span className="mob-card-chevron">›</span>
              </div>
            ))}</div>
          : <div className="card"><div className="tw"><table>
              <thead><tr>{["Datum","Ontvanger","Onderwerp","Type","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(e=>(
                  <tr key={e.id} onClick={()=>setDetail(e)} style={{cursor:"pointer"}}>
                    <td style={{color:"#888",fontSize:13,whiteSpace:"nowrap"}}>{fmtDate(e.sent_at)}</td>
                    <td style={{fontWeight:600,color:"#111"}}>{e.to_email}</td>
                    <td style={{color:"#374151",fontSize:13}}>{e.subject}</td>
                    <td><TypeBadge type={e.type}/></td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12.5,fontWeight:600,color:e.status==="verzonden"?"#065F46":"#991B1B"}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:e.status==="verzonden"?"#10B981":"#EF4444",display:"inline-block"}}/>
                          {e.status==="verzonden"?"Verzonden":"Mislukt"}
                        </span>
                        {e.status!=="verzonden"&&<button className="btn btn-ghost btn-sm" style={{fontSize:11.5,padding:"2px 9px"}} disabled={resending.has(e.id)} onClick={ev=>{ev.stopPropagation();retryEmail(e);}}>{resending.has(e.id)?"Bezig…":"Opnieuw"}</button>}
                      </div>
                    </td>
                    <td onClick={ev=>ev.stopPropagation()}><button className="btn btn-danger btn-sm" style={{fontSize:11.5,padding:"2px 8px"}} onClick={ev=>deleteEmail(e.id,ev)}><X size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
      }

      {detail && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?`16px 16px calc(${80}px + env(safe-area-inset-bottom)) 16px`:"16px"}}>
          <div style={{background:"#fff",borderRadius:mob?"16px":"18px",padding:mob?"20px 18px 18px":"28px 28px 22px",width:"100%",maxWidth:520,boxShadow:"0 24px 60px rgba(0,0,0,0.22)",maxHeight:mob?"80dvh":"85vh",overflowY:"auto"}}>
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
            {detail.html_body
              ? <div style={{marginBottom:18}}>
                  <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>E-mail preview</div>
                  <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #E5E7EB"}}>
                    <iframe
                      srcDoc={detail.html_body}
                      sandbox=""
                      style={{width:"100%",height:mob?260:420,border:"none",display:"block"}}
                      title="E-mail preview"
                    />
                  </div>
                </div>
              : detail.body && (
                  <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>Inhoud</div>
                    <div style={{fontSize:13.5,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{detail.body}</div>
                  </div>
                )
            }
            <button className="btn btn-ghost btn-full" onClick={()=>setDetail(null)}>Sluiten</button>
          </div>
        </div>
      )}

      {showCompose&&<div className="overlay"><div className="modal" style={{maxWidth:520}}>
        <div className="mh"><div><div className="mt">Nieuwe email schrijven</div></div><button className="mc" onClick={()=>{setShowCompose(false);setComposeSent(false);setComposeErr("");}}><X size={14}/></button></div>
        <div className="mb">
          {composeSent
            ? <div style={{textAlign:"center",padding:"28px 0"}}>
                <div style={{fontSize:40,marginBottom:12}}>✓</div>
                <div style={{fontWeight:700,fontSize:16,color:"#111",marginBottom:6}}>Email verstuurd</div>
                <div style={{color:"#64748B",fontSize:13}}>Naar {compose.to}</div>
              </div>
            : <>
                {klanten.length>0&&<div className="ig">
                  <label className="ilbl">Klant (optioneel — vult e-mail in)</label>
                  <select className="inp" value={compose.klantId} onChange={e=>{const k=klanten.find(kl=>kl.id?.toString()===e.target.value);setCompose({...compose,klantId:e.target.value,to:k?.email||compose.to});}}>
                    <option value="">— Handmatig invullen —</option>
                    {klanten.map(k=><option key={k.id} value={k.id?.toString()}>{k.naam}{k.email?` (${k.email})`:""}</option>)}
                  </select>
                </div>}
                <div className="ig"><label className="ilbl">Aan (e-mailadres)</label><input className="inp" type="email" value={compose.to} onChange={e=>setCompose({...compose,to:e.target.value})} placeholder="ontvanger@email.nl"/></div>
                <div className="ig"><label className="ilbl">Onderwerp</label><input className="inp" value={compose.subject} onChange={e=>setCompose({...compose,subject:e.target.value})} placeholder="Onderwerp"/></div>
                <div className="ig"><label className="ilbl">Bericht</label><textarea className="inp" style={{minHeight:140}} value={compose.body} onChange={e=>setCompose({...compose,body:e.target.value})} placeholder="Schrijf je bericht hier…"/></div>
                {composeErr&&<div style={{color:"#EF4444",fontSize:13,marginBottom:8}}>{composeErr}</div>}
                <div className="modal-act">
                  <button className="btn btn-ghost" onClick={()=>{setShowCompose(false);setComposeErr("");}}>Annuleren</button>
                  <button className="btn btn-blue btn-full" onClick={sendCompose} disabled={composeSending||!compose.to||!compose.subject||!compose.body}><Mail size={14} strokeWidth={1.8}/>{composeSending?"Versturen…":"Verstuur email"}</button>
                </div>
              </>
          }
        </div>
      </div></div>}
    </div>
  );
}

// ── Social ────────────────────────────────────────────────────
function SocialTab({ userId }) {
  const storageKey = `werkmate_social_${userId||"u"}`;
  const [links, setLinks] = useState(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||"{}");}catch{return {};}});
  const [linksSaved, setLinksSaved] = useState(false);
  const saveLinks = l => { setLinks(l); localStorage.setItem(storageKey, JSON.stringify(l)); setLinksSaved(true); setTimeout(()=>setLinksSaved(false),2000); };
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
      <div>
        <div className="sec-ttl">🔗 Mijn accounts</div>
        <div className="card cp" style={{marginBottom:16}}>
          <div className="ig"><label className="ilbl">Facebook pagina URL</label><input className="inp" value={links.facebook||""} onChange={e=>setLinks({...links,facebook:e.target.value})} placeholder="https://facebook.com/jouwpagina"/></div>
          <div className="ig"><label className="ilbl"><Image size={13} strokeWidth={1.8} style={{marginRight:5}}/> Instagram profiel URL</label><input className="inp" value={links.instagram||""} onChange={e=>setLinks({...links,instagram:e.target.value})} placeholder="https://instagram.com/jouwprofiel"/></div>
          <div className="ig" style={{marginBottom:12}}><label className="ilbl"><Star size={13} strokeWidth={1.8} style={{marginRight:5}}/> Google Business URL</label><input className="inp" value={links.google||""} onChange={e=>setLinks({...links,google:e.target.value})} placeholder="https://g.page/jouwbedrijf"/></div>
          <button className="btn btn-outline btn-full" onClick={()=>saveLinks(links)}><Save size={14} strokeWidth={1.8}/>{linksSaved?"✓ Opgeslagen!":"Links opslaan"}</button>
        </div>
        <div className="sec-ttl"><Settings size={14} strokeWidth={1.8} style={{marginRight:5}}/> Instellingen</div><div className="card cp">
        <div className="ig"><label className="ilbl">Platform</label><div className="soc-plat" style={{flexWrap:"wrap"}}>
          <button className={`soc-btn ${plat==="insta"?"on insta":""}`} onClick={()=>setPlat("insta")}><Image size={14} strokeWidth={1.8}/> Insta</button>
          <button className={`soc-btn ${plat==="tiktok"?"on tik":""}`} onClick={()=>setPlat("tiktok")}>TikTok</button>
          <button className={`soc-btn ${plat==="facebook"?"on fb":""}`} onClick={()=>setPlat("facebook")} style={plat==="facebook"?{borderColor:"#1877F2",background:"#EBF5FB",color:"#1877F2"}:{}}>Facebook</button>
          <button className={`soc-btn ${plat==="beide"?"on both":""}`} onClick={()=>setPlat("beide")}><Sparkles size={14} strokeWidth={1.8}/> Beide</button>
          <button className={`soc-btn ${plat==="alle"?"on both":""}`} onClick={()=>setPlat("alle")}>🌐 Alle</button>
        </div></div>
        <div className="ig"><label className="ilbl">Stijl</label><select className="inp" value={stijl} onChange={e=>setStijl(e.target.value)}>{["professioneel","stoer","informeel","grappig","motiverend"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></div>
        <div className="ig"><label className="ilbl">Onderwerp</label><textarea className="inp" value={ond} onChange={e=>setOnd(e.target.value)} style={{minHeight:85}} placeholder="Bijv: Airco bij bakkerij Rotterdam geïnstalleerd"/></div>
        <div style={{background:"#F8FAFC",border:"1px solid #EAECF0",borderRadius:8,padding:"10px 13px",marginBottom:14}}>
          {["Afgerond project (voor & na)","Team aan het werk","Handige tip","5-sterren review","Dag uit het leven"].map((t,i)=><div key={i} className="tip-row" onClick={()=>setOnd(t)} style={{borderBottom:i<4?"1px solid #F0F0F0":"none"}}>→ {t}</div>)}
        </div>
        <button className="btn btn-ai btn-full" onClick={gen} disabled={!ond.trim()||loading} style={{opacity:ond.trim()?1:.5}}>{loading?<><Sparkles size={14} strokeWidth={1.8}/><span className="dot">…</span></>:"Maak posts"}</button>
      </div></div>
      <div><div className="sec-ttl">Posts</div>
        {!posts&&!loading&&<div style={{background:"#fff",border:"1px dashed #D1D5DB",borderRadius:13,padding:"48px 24px",textAlign:"center",color:"#94A3B8"}}><div style={{fontSize:32,marginBottom:10}}>📱</div><div style={{fontSize:14,fontWeight:600,color:"#555",marginBottom:5}}>Nog geen posts</div><div style={{fontSize:12.5}}>Vul links in en klik op maak posts</div></div>}
        {loading&&<div style={{background:"#fff",border:"1px solid #EAECF0",borderRadius:13,padding:"48px 24px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>⚡</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>Bezig<span className="dot">…</span></div></div>}
        {posts&&<>
          {posts.instagram&&(plat==="insta"||plat==="beide"||plat==="alle")&&<div className="post-card"><div className="post-bar insta"><Image size={13} strokeWidth={1.8} style={{marginRight:4}}/> Instagram</div><div className="post-body">{posts.instagram}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.instagram)}><ClipboardList size={13} strokeWidth={1.8}/> Kopiëren</button><button className="btn btn-outline btn-sm" onClick={()=>{copy(posts.instagram);window.open(links.instagram||"https://instagram.com","_blank");}}>Open Instagram</button><button className="btn btn-outline btn-sm" onClick={gen}><RefreshCw size={13} strokeWidth={1.8}/></button></div></div>}
          {posts.tiktok&&(plat==="tiktok"||plat==="beide"||plat==="alle")&&<div className="post-card"><div className="post-bar tik">TikTok</div><div className="post-body">{posts.tiktok}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.tiktok)}><ClipboardList size={13} strokeWidth={1.8}/> Kopiëren</button><button className="btn btn-outline btn-sm" onClick={()=>{copy(posts.tiktok);window.open("https://tiktok.com","_blank");}}>Open TikTok</button><button className="btn btn-outline btn-sm" onClick={gen}><RefreshCw size={13} strokeWidth={1.8}/></button></div></div>}
          {posts.facebook&&(plat==="facebook"||plat==="alle")&&<div className="post-card"><div className="post-bar" style={{background:"#EBF5FB",color:"#1877F2",borderBottom:"1px solid #C9E6F8"}}>Facebook</div><div className="post-body">{posts.facebook}</div><div className="post-actions"><button className="btn btn-ghost btn-sm" onClick={()=>copy(posts.facebook)}><ClipboardList size={13} strokeWidth={1.8}/> Kopiëren</button><button className="btn btn-outline btn-sm" style={{color:"#1877F2",borderColor:"#1877F2"}} onClick={()=>{copy(posts.facebook);window.open(links.facebook||"https://facebook.com","_blank");}}>Open Facebook</button><button className="btn btn-outline btn-sm" onClick={gen}><RefreshCw size={13} strokeWidth={1.8}/></button></div></div>}
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
    { icon:"FileText", label:"Offertes & facturen", desc:"Professionele PDF's, verstuur per e-mail" },
    { icon:"📅", label:"Planning kalender", desc:"Maand- en weekoverzicht, terugkerende taken" },
    { icon:"👥", label:"CRM & klantenbeheer", desc:"Alle klanten en contacten op één plek" },
    { icon:"🤖", label:"AI assistent", desc:"Offertes, mails en social posts in seconden" },
    { icon:"🔧", label:"Werkbonnen", desc:"Digitaal invullen en ondertekenen" },
    { icon:"👷", label:"Teambeheer", desc:"Medewerkers uitnodigen en taken toewijzen" },
  ];
  return (
    <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:"24px",boxSizing:"border-box"}}>
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
          style={{display:"block",width:"100%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"center",textDecoration:"none",boxSizing:"border-box",marginBottom:10}}>
          {blocked ? "Abonnement kiezen" : "🚀 Start 14 dagen gratis"}
        </a>
        {!blocked && onSkip && (
          <button onClick={onSkip}
            style={{display:"block",width:"100%",background:"none",border:"none",color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:"8px"}}>
            Misschien later
          </button>
        )}
        {blocked && onLogout && (
          <button onClick={onLogout}
            style={{display:"block",width:"100%",background:"none",border:"none",color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:"8px"}}>
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

// ── Email templates section ────────────────────────────────────
const TEMPLATE_TYPES = [
  { key:"offerte",     label:"Offerte",             vars:"{klantnaam}, {bedrijfsnaam}, {nummer}" },
  { key:"factuur",     label:"Factuur",             vars:"{klantnaam}, {bedrijfsnaam}, {nummer}" },
  { key:"herinnering", label:"Betalingsherinnering", vars:"{klantnaam}, {bedrijfsnaam}, {nummer}, {bedrag}" },
  { key:"review",      label:"Review verzoek",       vars:"{klantnaam}, {bedrijfsnaam}, {dienst}" },
];

function EmailTemplatesSection({ userId, bedrijf, emailTemplates, onTemplatesUpdate }) {
  const sampleVars = {
    klantnaam: "Jan Jansen",
    bedrijfsnaam: bedrijf?.bedrijfsnaam || "Uw bedrijf",
    nummer: "2024-001",
    bedrag: "€ 1.250,00",
    dienst: "de dakbedekking",
  };

  const [drafts, setDrafts] = useState(() => {
    const d = {};
    TEMPLATE_TYPES.forEach(t => {
      d[t.key] = {
        subject: emailTemplates?.[t.key]?.subject || TEMPLATE_DEFAULTS[t.key].subject,
        body:    emailTemplates?.[t.key]?.body    || TEMPLATE_DEFAULTS[t.key].body,
      };
    });
    return d;
  });
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});
  const [openKey, setOpenKey] = useState("offerte");
  const [showPreview, setShowPreview] = useState(false);

  const saveTemplate = async (typeKey) => {
    setSaving(s => ({...s, [typeKey]:true}));
    setMsgs(m => ({...m, [typeKey]:""}));
    const { error } = await supabase.from("email_templates").upsert(
      { user_id: userId, type: typeKey, subject: drafts[typeKey].subject, body: drafts[typeKey].body, updated_at: new Date().toISOString() },
      { onConflict: "user_id,type" }
    );
    setSaving(s => ({...s, [typeKey]:false}));
    if (error) { setMsgs(m => ({...m, [typeKey]:`Opslaan mislukt: ${error.message}`})); return; }
    setMsgs(m => ({...m, [typeKey]:"Opgeslagen ✓"}));
    setTimeout(() => setMsgs(m => ({...m, [typeKey]:""})), 2500);
    onTemplatesUpdate && onTemplatesUpdate(prev => ({...prev, [typeKey]: { subject: drafts[typeKey].subject, body: drafts[typeKey].body }}));
  };

  const resetTemplate = (typeKey) => {
    setDrafts(d => ({...d, [typeKey]: { subject: TEMPLATE_DEFAULTS[typeKey].subject, body: TEMPLATE_DEFAULTS[typeKey].body }}));
  };

  const currentDraft = drafts[openKey];
  const previewSubject = fillVars(currentDraft?.subject || "", sampleVars);
  const previewBody = fillVars(currentDraft?.body || "", sampleVars);

  return (
    <div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {TEMPLATE_TYPES.map(t => (
          <button key={t.key} onClick={()=>{setOpenKey(t.key);setShowPreview(false);}} style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:openKey===t.key?"#0F0F14":"#fff",color:openKey===t.key?"#fff":"#555",borderColor:openKey===t.key?"#0F0F14":"#E5E7EB"}}>
            {t.label}
          </button>
        ))}
      </div>

      {TEMPLATE_TYPES.filter(t => t.key === openKey).map(t => (
        <div key={t.key} className="card cp" style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:12,color:"#94A3B8",background:"#F8FAFC",borderRadius:8,padding:"8px 12px"}}>
            Beschikbare variabelen: <span style={{fontFamily:"monospace",color:"#6366F1",fontWeight:600}}>{t.vars}</span>
          </div>
          <div className="ig" style={{marginBottom:0}}>
            <label className="ilbl">Onderwerp</label>
            <input className="inp" value={drafts[t.key].subject} onChange={e=>setDrafts(d=>({...d,[t.key]:{...d[t.key],subject:e.target.value}}))} placeholder={TEMPLATE_DEFAULTS[t.key].subject}/>
          </div>
          <div className="ig" style={{marginBottom:0}}>
            <label className="ilbl">Bericht</label>
            <textarea className="inp" rows={5} value={drafts[t.key].body} onChange={e=>setDrafts(d=>({...d,[t.key]:{...d[t.key],body:e.target.value}}))} placeholder={TEMPLATE_DEFAULTS[t.key].body} style={{resize:"vertical",lineHeight:1.6}}/>
          </div>

          <div>
            <button onClick={()=>setShowPreview(p=>!p)} style={{background:"none",border:"none",padding:0,fontSize:13,color:"#6366F1",fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              {showPreview ? "▲ Verberg preview" : "▼ Preview (met voorbeeldgegevens)"}
            </button>
            {showPreview && (
              <div style={{marginTop:10,background:"#F8FAFC",borderRadius:10,padding:"14px 16px",border:"1px solid #E5E7EB"}}>
                <div style={{fontSize:11,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Onderwerp</div>
                <div style={{fontSize:14,fontWeight:600,color:"#111",marginBottom:12}}>{previewSubject}</div>
                <div style={{fontSize:11,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Bericht</div>
                <div style={{fontSize:13.5,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{previewBody}</div>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button className="btn btn-dark" onClick={()=>saveTemplate(t.key)} disabled={saving[t.key]}><Save size={14} strokeWidth={1.8}/>{saving[t.key]?"Opslaan…":"Opslaan"}</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>resetTemplate(t.key)}>Standaard herstellen</button>
            {msgs[t.key] && <span style={{fontSize:13,fontWeight:600,color:msgs[t.key].startsWith("Opgeslagen")?"#15803D":"#B91C1C"}}>{msgs[t.key]}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Instellingen ───────────────────────────────────────────────
function InstellingenTab({ userId, refresh, bedrijf, subscription, onBedrijfUpdate, openTab, emailTemplates = {}, onTemplatesUpdate, onPrijslijstUpdate }) {
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
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");

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

  const generateDemoData = async () => {
    if (!window.confirm("Dit verwijdert alle huidige gegevens (klanten, offertes, facturen, planning, werkbonnen, ritten, uitgaven, certificaten) en vervangt ze door verse demo data. Doorgaan?")) return;
    setDemoLoading(true); setDemoMsg("");

    // ── Alles wissen ──────────────────────────────────────────────
    await Promise.all([
      supabase.from("certificaten").delete().eq("user_id",userId),
      supabase.from("uitgaven").delete().eq("user_id",userId),
      supabase.from("ritten").delete().eq("user_id",userId),
      supabase.from("werkbonnen").delete().eq("user_id",userId),
      supabase.from("planning").delete().eq("user_id",userId),
      supabase.from("facturen").delete().eq("user_id",userId),
      supabase.from("offertes").delete().eq("user_id",userId),
      supabase.from("klanten").delete().eq("user_id",userId),
    ]);

    const iso = d => d.toISOString().slice(0,10);
    const nlDatum = d => d.toLocaleDateString("nl-NL",{day:"numeric",month:"short"});
    const addDays = (n,base=new Date()) => { const d=new Date(base); d.setDate(d.getDate()+n); return d; };
    const now = new Date();

    // ── Klanten ──────────────────────────────────────────────────
    const {error:klErr}=await supabase.from("klanten").insert([
      {user_id:userId,naam:"Villa Zonnedal",email:"eigenaar@villazonnedal.nl",tel:"0620384756",adres:"Zonneweg 14, Wassenaar",status:"Actief"},
      {user_id:userId,naam:"Bakkerij De Molen",email:"info@demolenbrood.nl",tel:"0612345678",adres:"Molenstraat 12, Rotterdam",status:"Actief"},
      {user_id:userId,naam:"Zorgcentrum De Bron",email:"facilitair@debron.nl",tel:"0698011234",adres:"Bronlaan 88, Delft",status:"Actief"},
      {user_id:userId,naam:"Jan van der Berg",email:"j.vanderberg@gmail.com",tel:"0687654321",adres:"Acacialaan 3, Haarlem",status:"Actief"},
      {user_id:userId,naam:"Cafe t Centrum",email:"info@cafetcentrum.nl",tel:"0611223344",adres:"Marktplein 7, Leiden",status:"Actief"},
      {user_id:userId,naam:"Sporthal De Brug",email:"beheer@debrug.nl",tel:"0654321987",adres:"Brugweg 5, Utrecht",status:"Actief"},
    ]);
    if(klErr){setDemoLoading(false);setDemoMsg("Klanten insert mislukt: "+klErr.message);return;}

    // ── Offerte regels ────────────────────────────────────────────
    const rZonnedal=[
      {omschrijving:"Tuin aanleggen (arbeid)",aantal:24,eenheid:"uur",prijs:55,btw_pct:21},
      {omschrijving:"Bestrating leggen terras 40m2",aantal:40,eenheid:"m2",prijs:35,btw_pct:21},
      {omschrijving:"Beplanting en vaste planten",aantal:1,eenheid:"stuk",prijs:680,btw_pct:21},
    ];
    const rMolen=[
      {omschrijving:"Tuinonderhoud seizoen",aantal:8,eenheid:"uur",prijs:45,btw_pct:21},
      {omschrijving:"Heg snoeien frontheg 18m",aantal:18,eenheid:"m",prijs:3.50,btw_pct:21},
    ];
    const rBron=[
      {omschrijving:"Bestrating leggen pad 60m2",aantal:60,eenheid:"m2",prijs:35,btw_pct:21},
      {omschrijving:"Borders aanleggen",aantal:12,eenheid:"uur",prijs:55,btw_pct:21},
      {omschrijving:"Mulch aanbrengen",aantal:8,eenheid:"m2",prijs:18,btw_pct:21},
    ];
    const rBerg=[
      {omschrijving:"Beplanting aanbrengen",aantal:6,eenheid:"uur",prijs:40,btw_pct:21},
      {omschrijving:"Grind aanbrengen 25m2",aantal:25,eenheid:"m2",prijs:45,btw_pct:21},
    ];
    const rCafe=[
      {omschrijving:"Heg snoeien terras",aantal:10,eenheid:"m",prijs:3.50,btw_pct:21},
      {omschrijving:"Onkruid verwijderen",aantal:2,eenheid:"uur",prijs:45,btw_pct:21},
    ];
    const totStr = regels => {
      const sub=regels.reduce((s,r)=>s+(r.aantal||0)*(r.prijs||0),0);
      const btw=parseFloat(regels.reduce((s,r)=>{const p=r.btw_pct??21;return p===0?s:s+(r.aantal||0)*(r.prijs||0)*p/100;},0).toFixed(2));
      return {subtotaal:sub,btw,totaal:parseFloat((sub+btw).toFixed(2))};
    };
    const fmtB = n => `EUR ${n.toLocaleString("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const tZ=totStr(rZonnedal),tM=totStr(rMolen),tBr=totStr(rBron),tBe=totStr(rBerg),tC=totStr(rCafe);

    await supabase.from("offertes").insert([
      {user_id:userId,klant:"Villa Zonnedal",dienst:"Tuin aanleggen",bedrag:fmtB(tZ.totaal),status:"Ondertekend",datum:nlDatum(addDays(-14)),regels:rZonnedal,...tZ,opmerkingen:"1 jaar garantie op beplanting. Materialen inclusief. Geldigheid: 30 dagen."},
      {user_id:userId,klant:"Bakkerij De Molen",dienst:"Tuinonderhoud",bedrag:fmtB(tM.totaal),status:"Verstuurd",datum:nlDatum(addDays(-5)),regels:rMolen,...tM,opmerkingen:"Seizoensonderhoud lente/zomer. Maandelijks bezoek."},
      {user_id:userId,klant:"Zorgcentrum De Bron",dienst:"Bestrating en borders",bedrag:fmtB(tBr.totaal),status:"In afwachting",datum:nlDatum(addDays(-3)),regels:rBron,...tBr,opmerkingen:"Uitvoering in overleg met facilitair beheer."},
      {user_id:userId,klant:"Jan van der Berg",dienst:"Beplanting en grind",bedrag:fmtB(tBe.totaal),status:"Verstuurd",datum:nlDatum(addDays(-8)),regels:rBerg,...tBe,opmerkingen:"Grind kleur naar wens aanpasbaar. Beplanting winterhard."},
      {user_id:userId,klant:"Cafe t Centrum",dienst:"Heg snoeien terras",bedrag:fmtB(tC.totaal),status:"Afgewezen",datum:nlDatum(addDays(-20)),regels:rCafe,...tC,opmerkingen:""},
    ]);

    // ── Facturen ──────────────────────────────────────────────────
    const {data:n1}=await supabase.rpc("next_factuur_nummer",{p_user_id:userId});
    await supabase.from("facturen").insert({user_id:userId,nummer:n1,klant:"Villa Zonnedal",klant_email:"eigenaar@villazonnedal.nl",datum:iso(addDays(-30)),vervaldatum:iso(addDays(-2)),regels:rZonnedal,btw:tZ.btw,totaal:tZ.totaal,status:"Betaald"});
    const {data:n2}=await supabase.rpc("next_factuur_nummer",{p_user_id:userId});
    await supabase.from("facturen").insert({user_id:userId,nummer:n2,klant:"Bakkerij De Molen",klant_email:"info@demolenbrood.nl",datum:iso(addDays(-10)),vervaldatum:iso(addDays(20)),regels:rMolen,btw:tM.btw,totaal:tM.totaal,status:"Verstuurd"});
    const {data:n3}=await supabase.rpc("next_factuur_nummer",{p_user_id:userId});
    await supabase.from("facturen").insert({user_id:userId,nummer:n3,klant:"Sporthal De Brug",klant_email:"beheer@debrug.nl",datum:iso(addDays(-20)),vervaldatum:iso(addDays(-5)),regels:[{omschrijving:"Tuinaanleg sportvelden omgeving",aantal:20,eenheid:"uur",prijs:55,btw_pct:21}],btw:231,totaal:1331,status:"Herinnering gestuurd"});
    const {data:n4}=await supabase.rpc("next_factuur_nummer",{p_user_id:userId});
    await supabase.from("facturen").insert({user_id:userId,nummer:n4,klant:"Jan van der Berg",klant_email:"j.vanderberg@gmail.com",datum:iso(now),vervaldatum:iso(addDays(30)),regels:rBerg,btw:tBe.btw,totaal:tBe.totaal,status:"Concept"});

    // ── Planning categorieën ──────────────────────────────────────
    const {data:existingCats}=await supabase.from("planning_categorieen").select("naam,kleur").eq("user_id",userId);
    let cats = existingCats || [];
    if (cats.length === 0) {
      const defaultCats = [
        {user_id:userId,naam:"Onderhoud",kleur:"#22C55E"},
        {user_id:userId,naam:"Aanleg",kleur:"#3B82F6"},
        {user_id:userId,naam:"Overleg",kleur:"#F97316"},
        {user_id:userId,naam:"Levering",kleur:"#A855F7"},
      ];
      await supabase.from("planning_categorieen").insert(defaultCats);
      cats = defaultCats;
    }
    const catNaam = naam => cats.find(c=>c.naam===naam)?.naam || cats[0]?.naam || "";

    // ── Planning ──────────────────────────────────────────────────
    await supabase.from("planning").insert([
      {user_id:userId,datum:iso(now),tijd:"08:00",eindtijd:"12:00",klant:"Villa Zonnedal",adres:"Zonneweg 14, Wassenaar",dienst:"Tuin aanleggen dag 1 bestrating",status:"Ingepland",categorie:catNaam("Aanleg")},
      {user_id:userId,datum:iso(now),tijd:"13:00",eindtijd:"17:00",klant:"Bakkerij De Molen",adres:"Molenstraat 12, Rotterdam",dienst:"Tuinonderhoud heg snoeien",status:"Ingepland",categorie:catNaam("Onderhoud")},
      {user_id:userId,datum:iso(addDays(1)),tijd:"08:30",eindtijd:"12:30",klant:"Villa Zonnedal",adres:"Zonneweg 14, Wassenaar",dienst:"Tuin aanleggen dag 2 beplanting",status:"Ingepland",categorie:catNaam("Aanleg")},
      {user_id:userId,datum:iso(addDays(2)),tijd:"09:00",eindtijd:"15:00",klant:"Zorgcentrum De Bron",adres:"Bronlaan 88, Delft",dienst:"Bestrating leggen voorbereiding",status:"Ingepland",categorie:catNaam("Aanleg")},
      {user_id:userId,datum:iso(addDays(7)),tijd:"08:00",eindtijd:"13:00",klant:"Jan van der Berg",adres:"Acacialaan 3, Haarlem",dienst:"Beplanting en grind aanbrengen",status:"Ingepland",categorie:catNaam("Onderhoud")},
      {user_id:userId,datum:iso(addDays(8)),tijd:"10:00",eindtijd:"12:00",klant:"Sporthal De Brug",adres:"Brugweg 5, Utrecht",dienst:"Inspectie en nalevering materialen",status:"Ingepland",categorie:catNaam("Levering")},
    ]);

    // ── Werkbonnen ────────────────────────────────────────────────
    const {error:wbErr}=await supabase.from("werkbonnen").insert([
      {user_id:userId,klant:"Villa Zonnedal",datum:iso(addDays(-7)),omschrijving:"Voortuin volledig aangelegd. Bestrating gelegd, borders aangemaakt en beplanting geplaatst. Klant aanwezig en akkoord.",uren:8,materialen:"Tegels 60x60 (40st), Grondfolie, Compost 4 zak, Vaste planten assortiment",status:"Afgerond"},
      {user_id:userId,klant:"Sporthal De Brug",datum:iso(addDays(-14)),omschrijving:"Gazon rondom sporthal gemaaid, opgeschoond en nagelopen. Beschadigd gazon bijgezaaid. Onkruid verwijderd.",uren:4,materialen:"Graszaad 2kg, Onkruidverwijderaar",status:"Afgerond"},
      {user_id:userId,klant:"Bakkerij De Molen",datum:iso(addDays(-21)),omschrijving:"Achterzijde tuin gesnoeid en opgeruimd. Heg bijgewerkt op hoogte. Snoeiafval afgevoerd.",uren:3,materialen:"Hegmaaier messen vervangen, Snoeiafval afgevoerd",status:"Afgerond"},
    ]);
    if(wbErr){setDemoLoading(false);setDemoMsg("Werkbonnen insert mislukt: "+wbErr.message);return;}

    // ── Ritten ────────────────────────────────────────────────────
    await supabase.from("ritten").insert([
      {user_id:userId,datum:iso(now),vertrek:"Utrecht",bestemming:"Wassenaar Villa Zonnedal",km:68,doel:"zakelijk",klant:"Villa Zonnedal"},
      {user_id:userId,datum:iso(addDays(-1)),vertrek:"Utrecht",bestemming:"Rotterdam Bakkerij De Molen",km:58,doel:"zakelijk",klant:"Bakkerij De Molen"},
      {user_id:userId,datum:iso(addDays(-5)),vertrek:"Utrecht",bestemming:"Delft Zorgcentrum De Bron",km:42,doel:"zakelijk",klant:"Zorgcentrum De Bron"},
      {user_id:userId,datum:iso(addDays(-7)),vertrek:"Utrecht",bestemming:"Haarlem Jan van der Berg",km:54,doel:"zakelijk",klant:"Jan van der Berg"},
    ]);

    // ── Uitgaven ─────────────────────────────────────────────────
    await supabase.from("uitgaven").insert([
      {user_id:userId,datum:iso(addDays(-3)),categorie:"Materialen",omschrijving:"Tegels, grondfolie en compost Villa Zonnedal project",bedrag:386,btw_percentage:21},
      {user_id:userId,datum:iso(addDays(-8)),categorie:"Gereedschap",omschrijving:"Nieuwe hegrotor messen en slijpbladen",bedrag:74,btw_percentage:21},
      {user_id:userId,datum:iso(addDays(-12)),categorie:"Brandstof",omschrijving:"Diesel busje week 23",bedrag:118,btw_percentage:21},
    ]);

    // ── Certificaten ──────────────────────────────────────────────
    await supabase.from("certificaten").insert([
      {user_id:userId,naam:"BHV Basis",type:"Veiligheid",vervaldatum:iso(addDays(18)),notitie:"Verlenging inplannen via Rode Kruis. Cursus duurt 1 dag."},
      {user_id:userId,naam:"VBA Hovenieren",type:"Vakbekwaamheid",vervaldatum:iso(addDays(420)),notitie:"Gecertificeerd door Vakgroep Hovenierswerk Nederland."},
    ]);

    // ── Prijslijst ────────────────────────────────────────────────
    const demoPrijslijst=[
      {dienst:"Tuinonderhoud",eenheid:"uur",prijs:45,categorie:"Arbeid"},
      {dienst:"Tuin aanleggen (arbeid)",eenheid:"uur",prijs:55,categorie:"Arbeid"},
      {dienst:"Beplanting aanbrengen",eenheid:"uur",prijs:40,categorie:"Arbeid"},
      {dienst:"Boomonderhoud",eenheid:"uur",prijs:75,categorie:"Arbeid"},
      {dienst:"Bestrating leggen",eenheid:"m²",prijs:35,categorie:"Materiaal"},
      {dienst:"Gazon aanleggen",eenheid:"m²",prijs:12,categorie:"Materiaal"},
      {dienst:"Grind of kies aanbrengen",eenheid:"m²",prijs:45,categorie:"Materiaal"},
      {dienst:"Heg snoeien",eenheid:"m",prijs:3.50,categorie:"Onderhoud"},
    ];
    await supabase.from("prijslijst_items").delete().eq("user_id",userId);
    await supabase.from("prijslijst_items").insert(demoPrijslijst.map(p=>({...p,user_id:userId})));
    if(onPrijslijstUpdate) onPrijslijstUpdate(demoPrijslijst);

    setDemoLoading(false);
    setDemoMsg("Demo data aangemaakt! Navigeer door de app om alles te bekijken.");
    if(refresh) refresh();
    setTimeout(()=>setDemoMsg(""),6000);
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
      <div className="ph"><div><div className="pg-title">Instellingen</div><div className="pg-sub">Automatisering, e-mail templates, reiskosten en abonnement</div></div></div>

      {false&&<><div className="sec-ttl" style={{marginBottom:12}}><Mail size={14} strokeWidth={1.8} color="#3B82F6" style={{marginRight:6}}/> E-mail automatisering</div>
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
      </div></>}
      {msg.text && <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:msg.type==="ok"?"#DCFCE7":"#FEE2E2",color:msg.type==="ok"?"#15803D":"#B91C1C"}}>{msg.text}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,marginBottom:28}}>
        <button className="btn btn-dark" onClick={save} disabled={saving}><Save size={14} strokeWidth={1.8}/>{saving?"Opslaan…":"Opslaan"}</button>
      </div>

      <div className="sec-ttl" style={{marginBottom:12}}><Mail size={14} strokeWidth={1.8} color="#3B82F6" style={{marginRight:6}}/> E-mail templates</div>
      <EmailTemplatesSection userId={userId} bedrijf={bedrijf} emailTemplates={emailTemplates} onTemplatesUpdate={onTemplatesUpdate}/>

      <div style={{marginBottom:28}}/>

      <div className="sec-ttl" style={{marginBottom:12}}><Car size={14} strokeWidth={1.8} color="#EF4444" style={{marginRight:6}}/> Reiskosten</div>
      <div className="card cp">
        <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
          <div className="ig" style={{maxWidth:200,marginBottom:0}}>
            <label className="ilbl">KM-vergoeding (€/km)</label>
            <input className="inp" type="number" step="0.01" min="0" max="10" value={kmRate} onChange={e=>setKmRate(parseFloat(e.target.value)||0.23)} placeholder="0.23"/>
          </div>
          <button className="btn btn-dark" onClick={saveKmRate} disabled={kmSaving}><Save size={14} strokeWidth={1.8}/>{kmSaving?"Opslaan…":"Opslaan"}</button>
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
            <button className="btn btn-outline" onClick={()=>openTab&&openTab("profiel")}><Pencil size={14} strokeWidth={1.8}/> Bedrijfsprofiel bewerken</button>
          </div>
        </>
      )}

      <div className="sec-ttl" style={{marginTop:28,marginBottom:12}}>🎯 Demo data</div>
      <div className="card cp">
        <div style={{fontSize:13,color:"#64748B",marginBottom:12,lineHeight:1.6}}>Vul de app snel met voorbeelddata voor een demo: 3 klanten, 2 offertes, 1 factuur, 1 planningitem en 1 werkbon.</div>
        <button className="btn btn-outline" onClick={generateDemoData} disabled={demoLoading}>{demoLoading?"Bezig…":"↺ Reset & update demo data"}</button>
        {demoMsg&&<div style={{marginTop:10,fontSize:13,color:"#15803D",fontWeight:500}}>{demoMsg}</div>}
      </div>
    </div>
  );
}

// ── WerkMate App ──────────────────────────────────────────────
function WerkMateApp({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [accountDd, setAccountDd] = useState(false);
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
  const [emailTemplates, setEmailTemplates] = useState({});

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
        // Check time-limited free access whitelist
        const { data: freeAccess } = await supabase.from("free_access_whitelist").select("expires_at").eq("email", user.email).maybeSingle();
        const hasFreeAccess = freeAccess && new Date(freeAccess.expires_at) > new Date();
        if (!hasFreeAccess) {
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
      }

      await refreshAlles();
      setLoadingData(false);
    };
    laadData();
  }, [isOrgInitialized, orgOwnerId]);

  const refreshAlles = async () => {
      const ownerId = orgOwnerId || user.id;
      const [o, k, p, f, w, t, pc, el, ri, ui, ce, pl] = await Promise.all([
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
        supabase.from("prijslijst_items").select("*").eq("user_id", ownerId).order("created_at", {ascending:true}),
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
      if (pl.data?.length) setPrijslijst(pl.data);
      const { data: esData } = await supabase.from("email_settings").select("*").eq("user_id", ownerId).maybeSingle();
      if (esData) setEmailSettings(esData);
      const { data: etData } = await supabase.from("email_templates").select("*").eq("user_id", ownerId);
      if (etData) {
        const map = {};
        etData.forEach(t => { map[t.type] = { subject: t.subject, body: t.body }; });
        setEmailTemplates(map);
      }
    };

  const onDone = async (data) => {
    setBedrijf(data);
    const template = getPrijslijstTemplate(data.sector);
    setPrijslijst(template);
    const ownerId = orgOwnerId || user.id;
    const { data: existing } = await supabase.from("prijslijst_items").select("id").eq("user_id", ownerId).limit(1);
    if (!existing?.length && template.length) {
      await supabase.from("prijslijst_items").insert(template.map(({dienst,eenheid,prijs,categorie}) => ({user_id:ownerId,dienst,eenheid,prijs,categorie})));
    }
    setShowOnboard(false);
    setShowSubscription(true);
  };

  const handleTabSwitch = async (newTab) => {
    setTab(newTab);
    if (SUBSCRIPTION_WHITELIST.includes(user.email)) return;
    try {
      const { data: freeAccess } = await supabase.from("free_access_whitelist").select("expires_at").eq("email", user.email).maybeSingle();
      if (freeAccess && new Date(freeAccess.expires_at) > new Date()) return;
      const { data: sub } = await supabase.from("subscriptions").select("status,trial_ends_at").eq("user_id", orgOwnerId).maybeSingle();
      if (!sub) return;
      setSubscription(sub);
      const isActive = sub.status === "active";
      const inTrial  = sub.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date();
      if (!isActive && !inTrial) setMustSubscribe(true);
    } catch { /* network error — don't block the user */ }
  };

  if (loadingData) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18, fontFamily:"sans-serif" }}>
      ⚡ Laden...
    </div>
  );

  const render = () => {
    switch(tab) {
      case "dashboard":  return <DashboardTab openTab={setTab} bedrijf={bedrijf} offertes={offertes} planning={planning} facturen={facturen} klanten={klanten} certificaten={certificaten} userId={orgOwnerId} userEmail={user.email}/>;
      case "offertes":   return <OfferteTab prijslijst={prijslijst} userId={orgOwnerId} offertes={offertes} klanten={klanten} refresh={refreshAlles} bedrijf={bedrijf} emailTemplates={emailTemplates} openTab={setTab}/>;
      case "prijslijst": return <PrijslijstTab initialItems={prijslijst} onSaveItems={setPrijslijst} userId={orgOwnerId}/>;
      case "planning":   return <PlanningTab userId={orgOwnerId} planning={planning} refresh={refreshAlles} klanten={klanten||[]} teamMembers={teamMembers||[]} planningCats={planningCats||[]}/>;
      case "crm":        return <CRMTab userId={orgOwnerId} klanten={klanten} offertes={offertes} facturen={facturen} werkbonnen={werkbonnen} refresh={refreshAlles}/>;
      case "profiel":     return <ProfielTab userId={orgOwnerId} bedrijf={bedrijf} certificaten={certificaten} onSaved={async (updated)=>{setBedrijf(updated); await refreshAlles();}} />;
      case "facturen":   return <FinancienTab userId={orgOwnerId} facturen={facturen} uitgaven={uitgaven} ritten={ritten} refresh={refreshAlles} klanten={klanten} offertes={offertes} bedrijf={bedrijf} emailSettings={emailSettings} emailTemplates={emailTemplates}/>;
      case "team":       return <TeamTab ownerId={orgOwnerId} teamMembers={teamMembers} refresh={refreshAlles} bedrijf={bedrijf} />;
      case "werkregistratie": return <WerkbonnenTab userId={orgOwnerId} klanten={klanten} werkbonnen={werkbonnen} refresh={refreshAlles} bedrijf={bedrijf} emailSettings={emailSettings} emailTemplates={emailTemplates}/>;
      case "mail":       return <MailTab userId={orgOwnerId} emailsLog={emailsLog} refresh={refreshAlles} klanten={klanten} bedrijf={bedrijf}/>;
      case "social":     return false&&<SocialTab userId={orgOwnerId}/>;
      case "ritten":     return <RittenTab userId={orgOwnerId} ritten={ritten} refresh={refreshAlles} klanten={klanten} bedrijf={bedrijf}/>;
      case "prijslijst": return <PrijslijstTab initialItems={prijslijst} onSaveItems={setPrijslijst} userId={orgOwnerId}/>;
      case "certificaten": return <ProfielTab userId={orgOwnerId} bedrijf={bedrijf} certificaten={certificaten} onSaved={async (updated)=>{setBedrijf(updated); await refreshAlles();}} certOnly={true}/>;
      case "instellingen": return <InstellingenTab userId={orgOwnerId} refresh={refreshAlles} bedrijf={bedrijf} subscription={subscription} onBedrijfUpdate={(b)=>setBedrijf(b)} openTab={setTab} emailTemplates={emailTemplates} onTemplatesUpdate={setEmailTemplates} onPrijslijstUpdate={setPrijslijst}/>;
      default: return PH[tab]?<Placeholder {...PH[tab]}/>:null;
    }
  };

  if (mustSubscribe) return (
    <>
      <style>{css}</style>
      <SubscriptieScherm bedrijfsnaam={bedrijf?.bedrijfsnaam} blocked={true} onLogout={() => supabase.auth.signOut()}/>
    </>
  );

  const handleSkipTrial = async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from("subscriptions").upsert({
      user_id: orgOwnerId,
      status: "trialing",
      trial_ends_at: trialEnd.toISOString().slice(0, 10),
    }, { onConflict: "user_id" });
    setSubscription({ status: "trialing", trial_ends_at: trialEnd.toISOString().slice(0, 10) });
    setShowSubscription(false);
  };

  if (showOnboard) return (
    <>
      <style>{css}</style>
      <OnboardingWizard userId={orgOwnerId} onDone={onDone}/>
    </>
  );

  if (showSubscription) return (
    <>
      <style>{css}</style>
      <SubscriptieScherm bedrijfsnaam={bedrijf?.bedrijfsnaam} onSkip={handleSkipTrial}/>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="shell">
        <div className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark"><div className="sb-icon"><Zap size={16} strokeWidth={2.5} color="#fff"/></div><div className="sb-name">WerkMate</div></div>
            <div className="sb-sub">Bedrijfsbeheer platform</div>
          </div>
          <div className="nav-wrap">
            {NAV_ITEMS.map(({id, icon, label})=>(
              <button key={id} className={`nb ${tab===id?"on":""}`} onClick={()=>handleTabSwitch(id)}>
                <span className="nb-ic">{icon}</span>{label}
              </button>
            ))}
          </div>
          <div className="sb-acct">
            {accountDd&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setAccountDd(false)}/>}
            <button className="sb-acct-btn" onClick={()=>setAccountDd(d=>!d)}>
              <div className="sb-acct-av">{(bedrijf?.bedrijfsnaam||user?.email||"?")[0].toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="sb-acct-name">{bedrijf?.bedrijfsnaam||user?.email||"Bedrijf"}</div>
                <div className="sb-acct-sub">Account</div>
              </div>
              <span className="sb-acct-chevron">▾</span>
            </button>
            {accountDd&&<div className="sb-acct-dd">
              <button className="sb-dd-item" onClick={()=>{setTab("profiel");setAccountDd(false);}}>🏢 Bedrijfsprofiel</button>
              <button className="sb-dd-item" onClick={()=>{setTab("prijslijst");setAccountDd(false);}}>🏷️ Prijslijst</button>
              <button className="sb-dd-item" onClick={()=>{setTab("certificaten");setAccountDd(false);}}>📜 Certificaten</button>
              <button className="sb-dd-item" onClick={()=>{setTab("instellingen");setAccountDd(false);}}>⚙️ Instellingen</button>
              <hr className="sb-dd-sep"/>
              <button className="sb-dd-item" style={{color:"#EF4444"}} onClick={onLogout}>Uitloggen</button>
            </div>}
          </div>
        </div>
        <div className="main">{render()}</div>
        {/* bottom nav – mobile only (hidden via CSS on desktop) */}
        <nav className="mob-nav">
          {MOB_NAV.map(item => {
            const mobActive = tab === item.id && !mobMore;
            const moreActive = item.id === "meer" && mobMore;
            return item.id === "meer"
              ? <button key="meer" className={`mob-nb${mobMore ? " mob-nb-on" : ""}`} onClick={() => setMobMore(m => !m)}>
                  <span className="mob-nb-ic">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              : <button key={item.id} className={`mob-nb${mobActive ? " mob-nb-on" : ""}`} onClick={() => { handleTabSwitch(item.id); setMobMore(false); }}>
                  <span className="mob-nb-ic">{item.icon}</span>
                  <span>{item.label}</span>
                </button>;
          })}
        </nav>
        {/* Meer panel – mobile only */}
        {mobMore && <>
          <div onClick={() => setMobMore(false)} style={{position:"fixed",inset:0,zIndex:198}}/>
          <div style={{position:"fixed",bottom:"calc(70px + env(safe-area-inset-bottom))",left:0,right:0,background:"#fff",zIndex:199,boxShadow:"0 -4px 24px rgba(0,0,0,.10)",maxHeight:"70dvh",overflowY:"auto",borderTop:"1px solid #E5E7EB"}}>
            {MOB_MORE.map(item=>{
              const active=tab===item.id;
              return(
                <button key={item.id} onClick={()=>{handleTabSwitch(item.id);setMobMore(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 20px",background:active?"#F5F3FF":"none",border:"none",borderBottom:"1px solid #F3F4F6",color:active?item.color:"#374151",fontSize:15,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:22,width:28,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.label}</span>
                  {active&&<span style={{width:7,height:7,borderRadius:"50%",background:item.color,flexShrink:0}}/>}
                </button>
              );
            })}
            <div style={{height:1,background:"#E5E7EB",margin:"2px 0"}}/>
            {[["profiel","🏢","Bedrijfsprofiel"],["prijslijst","🏷️","Prijslijst"],["certificaten","📜","Certificaten"],["instellingen","⚙️","Instellingen"]].map(([id,icon,label])=>{
              const active=tab===id;
              return(
                <button key={id} onClick={()=>{setTab(id);setMobMore(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"13px 20px",background:active?"#F5F3FF":"none",border:"none",borderBottom:"1px solid #F3F4F6",color:active?"#6366F1":"#6B7280",fontSize:14,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:20,width:28,textAlign:"center",flexShrink:0}}>{icon}</span>
                  <span style={{flex:1}}>{label}</span>
                  {active&&<span style={{width:7,height:7,borderRadius:"50%",background:"#6366F1",flexShrink:0}}/>}
                </button>
              );
            })}
            <div style={{height:1,background:"#E5E7EB",margin:"2px 0"}}/>
            <button onClick={()=>{setMobMore(false);onLogout();}} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 20px",background:"none",border:"none",color:"#EF4444",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",WebkitTapHighlightColor:"transparent"}}>
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",width:28,flexShrink:0}}><LogOut size={20} strokeWidth={1.8}/></span>
              Uitloggen
            </button>
          </div>
        </>}
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
      const { data: bp } = await supabase.from("bedrijfsprofiel_portal").select("bedrijfsnaam,logo,adres,email,telefoon,website").eq("user_id", data.user_id).single();
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
  const btw9p = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===9?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.09:s;},0);
  const btw21p = regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===21?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.21:s;},0);
  const btw = offerte?.btw ?? (btw9p + btw21p || subtotaal * 0.21);
  const totaal = offerte?.totaal ?? subtotaal + btw;

  const portalStyle = {fontFamily:"'Plus Jakarta Sans',sans-serif",minHeight:"100vh",background:"#F8FAFC",color:"#111"};
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
                <div>Subtotaal (excl. BTW): <strong>{fmtEur(subtotaal)}</strong></div>
                {regels.some(r=>Number(r.btw_pct??21)===9)&&<div>BTW 9%: <strong>{fmtEur(regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===9?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.09:s;},0))}</strong></div>}
                <div>BTW 21%: <strong>{fmtEur(regels.some(r=>Number(r.btw_pct??21)===21)?regels.reduce((s,r)=>{const p=Number(r.btw_pct??21);return p===21?s+(Number(r.aantal)||0)*(Number(r.prijs)||0)*0.21:s;},0):btw)}</strong></div>
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
                <input value={klantEmail} onChange={e=>{setKlantEmail(e.target.value);setSignErr("");}} placeholder="uw@email.nl" style={{width:"100%",border:`1.5px solid ${signErr?"#EF4444":"#E5E7EB"}`,borderRadius:9,padding:"11px 13px",fontSize:14,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",marginBottom:signErr?6:14,boxSizing:"border-box",color:"#111"}}/>
                {signErr&&<div style={{color:"#EF4444",fontSize:12,marginBottom:14}}>{signErr}</div>}
                <button onClick={()=>{if(!klantEmail||!klantEmail.includes("@")){setSignErr("Vul een geldig e-mailadres in.");return;}setStep("sign");}} style={{background:"#0F0F14",color:"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
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
                <button onClick={()=>setStep("view")} style={{marginTop:14,background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",padding:0}}>← Terug</button>
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
  const [whitelist, setWhitelist] = useState([]);
  const [wlEmail, setWlEmail] = useState("");
  const [wlMonths, setWlMonths] = useState(2);
  const [wlNote, setWlNote] = useState("");
  const [wlSaving, setWlSaving] = useState(false);
  const [wlMsg, setWlMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || session.user.email !== ADMIN_EMAIL) { setLoading(false); return; }
      setUser(session.user);
      loadStats();
    });
  }, []);

  const loadStats = async () => {
    const [{ data: profielen }, { data: subs }, { data: wl }] = await Promise.all([
      supabase.from("bedrijfsprofiel").select("*").order("created_at",{ascending:false}),
      supabase.from("subscriptions").select("*"),
      supabase.from("free_access_whitelist").select("*").order("created_at",{ascending:false}),
    ]);
    const activeCount = (subs||[]).filter(s=>s.status==="active").length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const newThisWeek = (profielen||[]).filter(p=>new Date(p.created_at)>weekAgo).length;
    setStats({ total:(profielen||[]).length, active:activeCount, newThisWeek });
    setUsers(profielen||[]);
    setWhitelist(wl||[]);
    setLoading(false);
  };

  const addWhitelist = async () => {
    if (!wlEmail.trim() || !isValidEmail(wlEmail)) { setWlMsg("Vul een geldig e-mailadres in."); return; }
    setWlSaving(true); setWlMsg("");
    const expires = new Date();
    expires.setMonth(expires.getMonth() + Number(wlMonths));
    const { error } = await supabase.from("free_access_whitelist").upsert({ email: wlEmail.trim().toLowerCase(), expires_at: expires.toISOString(), note: wlNote||null }, { onConflict: "email" });
    if (error) { setWlMsg("Fout: " + error.message); }
    else { setWlMsg(`✓ ${wlEmail} heeft ${wlMonths} maanden gratis toegang t/m ${expires.toLocaleDateString("nl-NL")}`); setWlEmail(""); setWlNote(""); loadStats(); }
    setWlSaving(false);
  };

  const removeWhitelist = async (id, email) => {
    if (!window.confirm(`Gratis toegang verwijderen voor ${email}?`)) return;
    await supabase.from("free_access_whitelist").delete().eq("id", id);
    loadStats();
  };

  const cardStyle = {background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",overflow:"hidden",marginBottom:20};
  const thStyle = {padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px"};
  const tdStyle = {padding:"12px 16px",fontSize:13};

  if (loading) return <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"sans-serif"}}>⚡ Laden…</div>;
  if (!user) return <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"sans-serif",textAlign:"center"}}><div><div style={{fontSize:40,marginBottom:16}}>🔒</div><div>Toegang geweigerd</div></div></div>;

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",minHeight:"100vh",background:"#F1F5F9"}}>
      <div style={{background:"#0F0F14",padding:"20px 32px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#fff"}}>⚡ WerkMate Admin</div>
        <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,.4)"}}>{user.email}</span>
      </div>
      <div style={{maxWidth:1060,margin:"0 auto",padding:"28px 24px"}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
          {[{label:"Totaal gebruikers",val:stats?.total||0,color:"#6366F1"},{label:"Actieve abonnementen",val:stats?.active||0,color:"#10B981"},{label:"Nieuw deze week",val:stats?.newThisWeek||0,color:"#F59E0B"}].map(s=>(
            <div key={s.label} style={{background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",padding:"18px 20px"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:".7px",textTransform:"uppercase",color:"#94A3B8",marginBottom:6}}>{s.label}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Gratis toegang whitelist */}
        <div style={cardStyle}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #F0F3F8",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
            🎁 Gratis toegang verlenen
          </div>
          <div style={{padding:"18px 20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr auto",gap:10,alignItems:"flex-end",marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:".2px"}}>E-mailadres</div>
                <input value={wlEmail} onChange={e=>setWlEmail(e.target.value)} placeholder="gebruiker@email.nl" style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 13px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:".2px"}}>Maanden</div>
                <input type="number" min={1} max={24} value={wlMonths} onChange={e=>setWlMonths(e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 13px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:".2px"}}>Notitie (optioneel)</div>
                <input value={wlNote} onChange={e=>setWlNote(e.target.value)} placeholder="Bijv. Betatester, partner..." style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 13px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <button onClick={addWhitelist} disabled={wlSaving||!wlEmail} style={{background:"#0F0F14",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {wlSaving?"Opslaan…":"+ Toevoegen"}
              </button>
            </div>
            {wlMsg&&<div style={{fontSize:13,color:wlMsg.startsWith("✓")?"#15803D":"#B91C1C",background:wlMsg.startsWith("✓")?"#F0FDF4":"#FEF2F2",borderRadius:8,padding:"8px 12px"}}>{wlMsg}</div>}
            {whitelist.length > 0 && (
              <table style={{width:"100%",borderCollapse:"collapse",marginTop:16}}>
                <thead><tr style={{background:"#F8FAFC"}}>
                  {["E-mail","Geldig t/m","Notitie",""].map(h=><th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>{whitelist.map(w=>{
                  const expired = new Date(w.expires_at) < new Date();
                  return <tr key={w.id} style={{borderTop:"1px solid #F0F3F8"}}>
                    <td style={{...tdStyle,fontWeight:600,color:expired?"#94A3B8":"#0F172A"}}>{w.email}</td>
                    <td style={{...tdStyle,color:expired?"#EF4444":"#10B981",fontWeight:600}}>{new Date(w.expires_at).toLocaleDateString("nl-NL")}{expired?" (verlopen)":""}</td>
                    <td style={{...tdStyle,color:"#64748B"}}>{w.note||"—"}</td>
                    <td style={{...tdStyle}}><button onClick={()=>removeWhitelist(w.id,w.email)} style={{background:"#FEE2E2",color:"#B91C1C",border:"none",borderRadius:7,padding:"4px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Verwijderen</button></td>
                  </tr>;
                })}</tbody>
              </table>
            )}
          </div>
        </div>

        {/* Alle gebruikers */}
        <div style={cardStyle}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #F0F3F8",fontWeight:700,fontSize:14}}>Alle gebruikers ({users.length})</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#F8FAFC"}}>
                {["Bedrijf","Sector","Stad","Email","Aangemeld"].map(h=><th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>{users.map(u=>(
                <tr key={u.id} style={{borderTop:"1px solid #F0F3F8"}}>
                  <td style={{...tdStyle,fontWeight:700,color:"#0F172A"}}>{u.bedrijfsnaam||"—"}</td>
                  <td style={{...tdStyle,color:"#555"}}>{u.sector||"—"}</td>
                  <td style={{...tdStyle,color:"#555"}}>{u.stad||"—"}</td>
                  <td style={{...tdStyle,color:"#6366F1"}}>{u.email||"—"}</td>
                  <td style={{...tdStyle,color:"#888",fontSize:12}}>{u.created_at?new Date(u.created_at).toLocaleDateString("nl-NL"):"—"}</td>
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
  const [kmErr, setKmErr] = useState("");

  const kmRate = Number(bedrijf?.km_vergoeding ?? 0.23);

  const calcKm = async (vertrek, bestemming) => {
    if (!vertrek.trim() || !bestemming.trim()) return;
    setKmLoading(true);
    setKmErr("");
    try {
      const geocode = async (addr) => {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=nl,be,de`, {headers:{"User-Agent":"WerkMate/1.0 (mauritsverweij2010@gmail.com)"}});
        const d = await r.json();
        return d.length ? {lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)} : null;
      };
      const from = await geocode(vertrek);
      if (!from) { setKmLoading(false); setKmErr("Vertrekpunt niet gevonden"); return; }
      const to = await geocode(bestemming);
      if (!to) { setKmLoading(false); setKmErr("Bestemming niet gevonden"); return; }
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);
      const d = await r.json();
      if (d.code === "Ok" && d.routes?.length) {
        const km = Math.round(d.routes[0].distance / 100) / 10;
        setNieuw(prev => ({...prev, km: km.toString()}));
      } else {
        setKmErr("Route niet berekend, vul km handmatig in");
      }
    } catch(e) { setKmErr("Berekening mislukt, vul km handmatig in"); }
    setKmLoading(false);
  };

  useEffect(() => {
    if (!showAdd) return;
    const timer = setTimeout(() => {
      if (nieuw.vertrek.trim() && nieuw.bestemming.trim()) {
        calcKm(nieuw.vertrek, nieuw.bestemming);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [nieuw.vertrek, nieuw.bestemming, showAdd]);

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
  const doelStyle = (d) => ({padding:"5px 14px",borderRadius:20,border:"1.5px solid",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",background:filterDoel===d?"#0F0F14":"#fff",color:filterDoel===d?"#fff":"#555",borderColor:filterDoel===d?"#0F0F14":"#E5E7EB"});

  return (<div>
    <div className="ph">
      <div><div className="pg-title">Rittenregistratie</div><div className="pg-sub">{ritten.length} ritten geregistreerd · €{kmRate.toFixed(2)}/km</div></div>
      <div className="ph-btns" style={{display:"flex",gap:8}}>
        <button className="btn btn-ghost mob-hide" onClick={exportXlsx}><Download size={14} strokeWidth={1.8}/> Export</button>
        <button className="btn btn-dark" onClick={()=>setShowAdd(true)}><Plus size={14} strokeWidth={2}/> Rit</button>
      </div>
    </div>

    <div className="sg" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>
      <div className="sc"><div className="sl">Zakelijke KM</div><div className="sv" style={{color:"#6366F1"}}>{zakelijkKm.toFixed(0)} km</div></div>
      <div className="sc"><div className="sl">Privé KM</div><div className="sv" style={{color:"#64748B"}}>{priveKm.toFixed(0)} km</div></div>
      <div className="sc"><div className="sl">Aftrekbaar zakelijk</div><div className="sv" style={{color:"#10B981"}}>€ {aftrekbaar.toFixed(2)}</div></div>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {["Alle","zakelijk","privé"].map(d=><button key={d} onClick={()=>setFilterDoel(d)} style={doelStyle(d)}>{d==="Alle"?"Alle":d.charAt(0).toUpperCase()+d.slice(1)}</button>)}
      <select value={filterMaand} onChange={e=>setFilterMaand(e.target.value)} className="sel" style={{borderRadius:20,padding:"5px 32px 5px 14px",fontWeight:600}}>
        <option value="">Alle maanden</option>
        {maanden.map(m=><option key={m} value={m}>{new Date(m+"-01").toLocaleDateString("nl-NL",{month:"long",year:"numeric"})}</option>)}
      </select>
    </div>

    {filtered.length === 0
      ? <LeegScherm icon={<Car size={36} strokeWidth={1.3} color="#A5B4FC"/>} titel="Geen ritten" sub="Voeg je eerste rit toe" actie="+ Rit toevoegen" onActie={()=>setShowAdd(true)}/>
      : mob
        ? <div className="mob-card-list">{filtered.map(r=>(
            <div className="mob-card" key={r.id}>
              <div className="mob-card-top">
                <div className="mob-card-name">{r.vertrek} → {r.bestemming}</div>
                <span style={{background:r.doel==="zakelijk"?"#EEF2FF":"#F3F4F6",color:r.doel==="zakelijk"?"#6366F1":"#6B7280",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{r.doel}</span>
              </div>
              <div className="mob-card-amount" style={{fontSize:20}}>{r.km} km</div>
              <div className="mob-card-sub">{r.datum}{r.doel==="zakelijk"?` · €${(Number(r.km)*kmRate).toFixed(2)}`:" · Privé"}{r.klant?` · ${r.klant}`:""}</div>
              <div className="mob-card-actions"><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}><X size={14}/></button></div>
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
                <td><button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}><X size={14}/></button></td>
              </tr>
            ))}</tbody>
          </table></div></div>
    }

    {showAdd && <div className="overlay"><div className="modal"><div className="mh"><div><div className="mt">Rit toevoegen</div></div><button className="mc" onClick={()=>{setShowAdd(false);setSaveErr("");}}><X size={14}/></button></div>
      <div className="mb">
        <div className="ig"><label className="ilbl">Datum</label><input className="inp" type="date" value={nieuw.datum} onChange={e=>setNieuw({...nieuw,datum:e.target.value})}/></div>
        <div className="ig"><label className="ilbl">Vertrekpunt</label><input className="inp" value={nieuw.vertrek} onChange={e=>setNieuw({...nieuw,vertrek:e.target.value})} placeholder="Straat 1, Amsterdam"/></div>
        <div className="ig"><label className="ilbl">Bestemming</label><input className="inp" value={nieuw.bestemming} onChange={e=>setNieuw({...nieuw,bestemming:e.target.value})} placeholder="Straat 2, Rotterdam"/></div>
        <div className="ig"><label className="ilbl">Afstand (km){kmLoading&&<span style={{marginLeft:6,fontSize:11,color:"#6366F1",fontWeight:600}}>Berekenen…</span>}</label><input className="inp" type="number" value={nieuw.km} onChange={e=>{setNieuw({...nieuw,km:e.target.value});setKmErr("");}} placeholder="Wordt automatisch berekend"/>
        {kmErr&&<div style={{marginTop:4,fontSize:12,color:"#B45309"}}>{kmErr}</div>}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="ig">
            <label className="ilbl">Doel</label>
            <div style={{display:"flex",borderRadius:9,overflow:"hidden",border:"1.5px solid #E5E7EB"}}>
              {["zakelijk","privé"].map(d=>(
                <button key={d} type="button" onClick={()=>setNieuw({...nieuw,doel:d})} style={{flex:1,padding:"10px 0",border:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:600,background:nieuw.doel===d?"#0F0F14":"#fff",color:nieuw.doel===d?"#fff":"#555",transition:"background .15s",borderRight:d==="zakelijk"?"1px solid #E5E7EB":"none"}}>
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
        <div style={{display:"flex",gap:9}}><button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setSaveErr("");setKmErr("");}}>Annuleren</button><button className="btn btn-dark btn-full" onClick={add} disabled={saving||kmLoading||!nieuw.vertrek||!nieuw.bestemming||!nieuw.km}><Save size={14} strokeWidth={1.8}/>{saving?"Opslaan…":kmLoading?"Berekenen…":"Opslaan"}</button></div>
      </div>
    </div></div>}
  </div>);
}
