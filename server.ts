import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily to avoid crashes if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNUNG: GEMINI_API_KEY ist nicht in den Umgebungsvariablen definiert!");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// In-Memory Database
interface Seat {
  id: string; // e.g. "A1"
  row: string; // A, B, C, D, E, F
  number: number;
  type: 'Parkett' | 'Luxus' | 'Loge';
  price: number;
  booked: boolean;
}

interface ShowTime {
  id: string;
  time: string;
}

interface Movie {
  id: string;
  title: string;
  genre: string;
  duration: string;
  rating: string;
  banner: string;
  description: string;
  showtimes: ShowTime[];
  seats: { [showtimeId: string]: Seat[] };
}

interface Booking {
  id: string;
  movieId: string;
  movieTitle: string;
  showtimeId: string;
  showtime: string;
  date: string;
  seats: string[]; // e.g. ["C4", "C5"]
  customerName: string;
  customerEmail: string;
  ticketType: 'Standard' | 'Student';
  paymentMethod: 'Stripe' | 'PayPal' | 'GooglePay' | 'ApplePay';
  subtotal: number;
  discount: number;
  total: number;
  qrCodeUrl: string;
  timestamp: string;
}

const INITIAL_MOVIES: Movie[] = [
  {
    id: "m1",
    title: "Dune: Part Two",
    genre: "Science-Fiction / Sci-Fi",
    duration: "166 Min.",
    rating: "FSK 12",
    banner: "https://images.unsplash.com/photo-1547483238-f400e65ccd56?auto=format&fit=crop&w=1200&q=80",
    description: "Der legendäre Kampf um Arrakis geht in die nächste Runde. Erleben Sie Paul Atreides' Schicksal auf der gigantischen IMAX-Leinwand mit atemberaubendem Sound.",
    showtimes: [
      { id: "s1_1", time: "16:30 Uhr" },
      { id: "s1_2", time: "19:45 Uhr (IMAX 3D)" },
      { id: "s1_3", time: "22:15 Uhr" }
    ],
    seats: {}
  },
  {
    id: "m2",
    title: "Oppenheimer",
    genre: "Drama / Biografie",
    duration: "180 Min.",
    rating: "FSK 12",
    banner: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
    description: "Christopher Nolans Meisterwerk über das Manhattan-Projekt und den Vater der Atombombe. Spektakulär gefilmt in nativem IMAX 70mm.",
    showtimes: [
      { id: "m2_1", time: "16:00 Uhr" },
      { id: "m2_2", time: "20:00 Uhr (IMAX 70mm)" }
    ],
    seats: {}
  },
  {
    id: "m3",
    title: "Interstellar",
    genre: "Sci-Fi / Abenteuer",
    duration: "169 Min.",
    rating: "FSK 12",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    description: "Der epische Klassiker kehrt zurück auf die Leinwand. Eine emotionale Reise durch Raum und Zeit jenseits unserer Galaxie.",
    showtimes: [
      { id: "m3_1", time: "17:00 Uhr" },
      { id: "m3_2", time: "21:00 Uhr (IMAX Special)" }
    ],
    seats: {}
  },
  {
    id: "m4",
    title: "Gladiator II",
    genre: "Action / Historie",
    duration: "148 Min.",
    rating: "FSK 16",
    banner: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
    description: "Jahrzehnte nach dem Tod von Maximus tritt Lucius in das Kolosseum ein, um das Schicksal Roms neu zu schmieden. Gewaltiges Historienkino.",
    showtimes: [
      { id: "m4_1", time: "15:00 Uhr" },
      { id: "m4_2", time: "18:15 Uhr" },
      { id: "m4_3", time: "21:30 Uhr" }
    ],
    seats: {}
  }
];

// Seed seats for all showtimes
function generateSeatsHelper(): Seat[] {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  // A & B are Loge, C & D are Luxus, E & F are Parkett
  rows.forEach(row => {
    let type: 'Parkett' | 'Luxus' | 'Loge' = 'Parkett';
    let price = 12.00;
    if (row === 'A' || row === 'B') {
      type = 'Loge';
      price = 18.50;
    } else if (row === 'C' || row === 'D') {
      type = 'Luxus';
      price = 15.50;
    }

    for (let num = 1; num <= 10; num++) {
      // randomly book 15% of seats initially for organic theater feel
      const booked = Math.random() < 0.20;
      seats.push({
        id: `${row}${num}`,
        row,
        number: num,
        type,
        price,
        booked
      });
    }
  });
  return seats;
}

INITIAL_MOVIES.forEach(movie => {
  movie.showtimes.forEach(st => {
    movie.seats[st.id] = generateSeatsHelper();
  });
});

const moviesDb: Movie[] = INITIAL_MOVIES;
const bookingsDb: Booking[] = [];

// API ENDPOINTS

// 1. Get Movies List
app.get("/api/movies", (req, res) => {
  res.json(moviesDb);
});

// 2. Get specific Movie Seat Map
app.get("/api/movies/:movieId/seats/:showtimeId", (req, res) => {
  const { movieId, showtimeId } = req.params;
  const movie = moviesDb.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: "Film nicht gefunden" });
  }
  const seats = movie.seats[showtimeId];
  if (!seats) {
    return res.status(404).json({ error: "Vorstellungszeit nicht gefunden" });
  }
  res.json({ title: movie.title, showtimeId, seats });
});

// 3. Create a Booking
app.post("/api/bookings", (req, res) => {
  const {
    movieId,
    showtimeId,
    date,
    seats,
    customerName,
    customerEmail,
    ticketType,
    paymentMethod
  } = req.body;

  if (!movieId || !showtimeId || !seats || !seats.length || !customerName || !customerEmail) {
    return res.status(400).json({ error: "Fehlende Pflichtangaben für eine Buchung" });
  }

  const movie = moviesDb.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: "Film nicht gefunden" });
  }

  const showtime = movie.showtimes.find(s => s.id === showtimeId);
  if (!showtime) {
    return res.status(404).json({ error: "Showtime nicht gefunden" });
  }

  const movieSeats = movie.seats[showtimeId];
  if (!movieSeats) {
    return res.status(404).json({ error: "Sitze nicht gefunden" });
  }

  // Ensure seats are not already booked
  const unavailableSeats = seats.filter((sId: string) => {
    const seatObj = movieSeats.find(s => s.id === sId);
    return !seatObj || seatObj.booked;
  });

  if (unavailableSeats.length > 0) {
    return res.status(400).json({ error: `Einige der ausgewählten Sitze sind bereits vergriffen: ${unavailableSeats.join(", ")}` });
  }

  // Calculate prices
  let subtotal = 0;
  seats.forEach((sId: string) => {
    const seatObj = movieSeats.find(s => s.id === sId);
    if (seatObj) {
      subtotal += seatObj.price;
    }
  });

  // Apply ticket discount (student ticket gets 2.00 € discount per seat)
  let discount = 0;
  if (ticketType === 'Student') {
    discount = seats.length * 2.0;
  }

  const total = Math.max(0, subtotal - discount);

  // Book seats in the DB
  seats.forEach((sId: string) => {
    const seatObj = movieSeats.find(s => s.id === sId);
    if (seatObj) {
      seatObj.booked = true;
    }
  });

  const bookingId = "IMX-" + Math.floor(100000 + Math.random() * 900000);
  
  // Create UPI Payment QR code for Nikhil Saini
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=052c24&bgcolor=ffffff&data=${encodeURIComponent("upi://pay?pa=nikhil.2613-1@waicici&pn=NIKHIL%20SAINI")}`;

  const newBooking: Booking = {
    id: bookingId,
    movieId,
    movieTitle: movie.title,
    showtimeId,
    showtime: showtime.time,
    date,
    seats,
    customerName,
    customerEmail,
    ticketType,
    paymentMethod,
    subtotal,
    discount,
    total,
    qrCodeUrl,
    timestamp: new Date().toLocaleString("de-DE")
  };

  bookingsDb.push(newBooking);
  res.status(201).json(newBooking);
});

// 4. Get specific Booking (for ticket scanning or landing receipt)
app.get("/api/bookings/:id", (req, res) => {
  const { id } = req.params;
  const booking = bookingsDb.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ error: "Ticket-Buchung nicht gefunden" });
  }
  res.json(booking);
});

// 5. Digital Support Assistant Support
function generateFallbackResponse(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("hallo") || msg.includes("hi ") || msg.includes("hey") || msg.includes("guten tag") || msg.includes("servus") || msg.includes("moin")) {
    return `Hallo! Ich bin dein IMAX Support-Assistent. 🍿 

Gerne helfe ich dir weiter! Du kannst mich fragen zu:
- Unserem aktuellen Filmprogramm (z.B. **Dune: Part Two**, **Oppenheimer**, **Interstellar** oder **Gladiator II**)
- Unserem exklusiven **Eröffnungsangebot**
- Den Ticketpreisen (Parkett, Luxussitze, Loge) oder Sitzplatzoptionen
- Den unterstützten Zahlungsmethoden.

Wie kann ich dir heute eine Freude bereiten?`;
  }
  
  if (msg.includes("angebot") || msg.includes("eröffnung") || msg.includes("aktion") || msg.includes("gratis") || msg.includes("getränk") || msg.includes("sparen") || msg.includes("student")) {
    return `🎉 **Unser exklusives Eröffnungsangebot:**
Kaufen Sie **2 Tickets** Ihrer Wahl und erhalten Sie **1 Getränk völlig kostenlos** dazu! 
Dieses Angebot gilt nur für kurze Zeit unter dem Motto: *"Kino genießen und sparen!"*

Zusätzlich erhalten Schüler und Studenten einen Rabatt von **2,00 EUR** auf jedes gebuchte Ticket! Wähle dafür im Online-Zahlungsauswahl einfach die Option "Student" aus.`;
  }
  
  if (msg.includes("film") || msg.includes("programm") || msg.includes("kino") || msg.includes("vorstellung") || msg.includes("zeiten") || msg.includes("heute") || msg.includes("dune") || msg.includes("oppenheimer") || msg.includes("interstellar") || msg.includes("gladiator")) {
    let reply = `🎬 **Heute im IMAX Programm:**\n\n`;
    
    if (msg.includes("dune")) {
      reply += `🏜️ **Dune: Part Two** (FSK 12 | 166 Min.)\nDer epische Kampf um Arrakis. Vorstellungen heute um:\n- 16:30 Uhr\n- 19:45 Uhr (IMAX 3D)\n- 22:15 Uhr`;
    } else if (msg.includes("oppenheimer")) {
      reply += `⚛️ **Oppenheimer** (FSK 12 | 180 Min.)\nChristopher Nolans Meisterwerk über den Erfinder der Atombombe. Vorstellungen:\n- 16:00 Uhr\n- 20:00 Uhr (IMAX 70mm)`;
    } else if (msg.includes("interstellar")) {
      reply += `🌌 **Interstellar** (FSK 12 | 169 Min.)\nDer visuell atemberaubende Klassiker zurück auf großer Leinwand!\n- 17:00 Uhr\n- 21:00 Uhr (IMAX Special)`;
    } else if (msg.includes("gladiator")) {
      reply += `⚔️ **Gladiator II** (FSK 16 | 148 Min.)\nDas packende Sequel des legendären Historienepos.\n- 15:00 Uhr\n- 18:15 Uhr\n- 21:30 Uhr`;
    } else {
      reply += `1️⃣ **Dune: Part Two** (Sci-Fi, FSK 12)\n   🕒 16:30 Uhr | 19:45 Uhr (IMAX 3D) | 22:15 Uhr\n\n`;
      reply += `2️⃣ **Oppenheimer** (Biografie, FSK 12)\n   🕒 16:00 Uhr | 20:00 Uhr (IMAX 70mm)\n\n`;
      reply += `3️⃣ **Interstellar** (Abenteuer, FSK 12)\n   🕒 17:00 Uhr | 21:00 Uhr (IMAX Special)\n\n`;
      reply += `4️⃣ **Gladiator II** (Historie, FSK 16)\n   🕒 15:00 Uhr | 18:15 Uhr | 21:30 Uhr\n\n`;
      reply += `Tipp: Klicke einfach auf eine gewünschte Uhrzeit auf unserer Webseite, um direkt zur interaktiven Sitzplatzreservierung zu gelangen!`;
    }
    return reply;
  }
  
  if (msg.includes("preis") || msg.includes("preise") || msg.includes("kostet") || msg.includes("ticket") || msg.includes("sitz") || msg.includes("sitze") || msg.includes("loge") || msg.includes("luxus") || msg.includes("parkett")) {
    return `🎟️ **Unsere Ticket- und Sitzplatzkategorien:**

1. **Parkett** - 12,00 EUR (Klassische komfortable Bestuhlung im vorderen Saalbereich)
2. **Luxussitze** - 15,50 EUR (Extra breite Wohlfühlsessel mit verstellbarer Rückenlehne)
3. **VIP Loge** - 18,50 EUR (Hintere exklusive Reihen mit bester Akustik & Tischplatz)

*Hinweis:* Bei Buchung als Student werden **2,00 EUR Rabatt** automatisch abgezogen!`;
  }
  
  if (msg.includes("bezahl") || msg.includes("zahlen") || msg.includes("stripe") || msg.includes("paypal") || msg.includes("karte") || msg.includes("apple") || msg.includes("google")) {
    return `💳 **Sichere und schnelle Online-Zahlung:**

Wir unterstützen die folgenden modernen Zahlungsmethoden direkt bei der Buchung:
- **Stripe** (Bequemes Bezahlen per Kreditkarte)
- **PayPal**
- **Google Pay**
- **Apple Pay**

Nach erfolgreicher Buchung wird dir sofort ein **mobiler QR-Code** generiert, welchen du am Einlass für den kontaktlosen Zutritt scannen lassen kannst.`;
  }
  
  if (msg.includes("lage") || msg.includes("ort") || msg.includes("adresse") || msg.includes("bus") || msg.includes("bahn") || msg.includes("wo") || msg.includes("parken")) {
    return `📍 **Zentrale Lage & Erreichbarkeit:**

Wir befinden uns im Herzen der Stadt und sind hervorragend angebunden! 
- **Öffentliche Verkehrsmittel:** Leicht erreichbar mit Bus und allen U-Bahnen (Haltestelle *IMAX / Am Kinopark* direkt vor der Haustür).
- **Auto:** Parkplätze stehen in unserem eigenen, 24h geöffneten Parkhaus für Kinogäste kostenlos zur Verfügung.`;
  }
  
  if (msg.includes("technologie") || msg.includes("sound") || msg.includes("ton") || msg.includes("bild") || msg.includes("imax") || msg.includes("3d")) {
    return `🔊 **Technologieführer: Erleben Sie IMAX!**

Unser Kinosaal verfügt über:
- Die größte IMAX-Leinwand der Region mit kristallklarer Laserprojektion.
- Next-Generation 12-Kanal-Immersive-Sound für spürbare Bässe und perfekten Raumklang.
- Ergonomisch ausgerichtete Luxussitze für optimalen Blickwinkel aus jeder Reihe.
- Neueste, federleichte 3D-Brillen für eine flimmerfreie Tiefenwirkung.`;
  }

  // Generisches nettes Feedback
  return `Vielen Dank für deine Nachricht! 😊 
Ich bin dein IMAX Support-Assistent. Gerne lade ich dich ein, das Kinoprogramm auf unserer Webseite zu durchstöbern oder direkt einen Sitzplatz für heute zu buchen.

Haben Sie Fragen zu den Vorstellungszeiten der Filme (z.B. **Dune** oder **Gladiator II**), zu unserem tollen **Eröffnungsangebot** oder den **Ticketpreisen**? Fragen Sie mich einfach!`;
}

app.post("/api/chat", async (req, res) => {
  const { messages, highThinking } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Fehlender Chat-Verlauf" });
  }

  try {
    const chatClient = getGeminiClient();
    
    // Choose model based on user selection
    // gemini-3.1-pro-preview for complex reasoning tasks with ThinkingLevel.HIGH
    // gemini-3.5-flash for friendly fast chats
    const isPro = highThinking === true || highThinking === "true";
    const modelToUse = isPro ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    // Build standard prompt with contextual cinema details
    const contextPrompt = `Du bist ein "IMAX Support-Assistent", der Kundenservice des IMAX Kinos. 
Deine Rolle ist es, die Webseitenbesucher bei der Wahl des Films, Details zu Bezahlmethoden, Sitzplatzoptionen und Sonderangeboten zu unterstützen.

Verwende die folgenden IMAX-Fakten für deine Antworten:
- IMAX: Es handelt sich um ein vollständiges, immersives Erlebnis ("FEEL IT IN IMAX"). Wir bieten grandiose Bild- und Tonqualität der Extraklasse in unvergesslicher Kinoatmosphäre.
- WAS BIETEN WIR AN?
  1. Neueste Filme aus aller Welt (Blockbuster, Klassiker und mehr)
  2. IMAX- und 3D-Säle für ein beeindruckendes Kinoerlebnis
  3. Bequeme Luxussitze (Mehr Platz, mehr Komfort)
  4. Online-Ticketbuchung (Schnell, einfach und sicher über unsere Website oder App)
  5. Günstige Studentenrabatte (2€ Rabatt pro Ticket bei Schülern/Studenten)
  6. Frisches Popcorn und Getränke
  7. Familien- und Freundesangebote
- SONDERANGEBOT (Eröffnungsangebot): 
  - Kaufen Sie 2 Tickets, erhalten Sie 1 Getränk KOSTENLOS! Nur für kurze Zeit. Slogan: "Kino genießen und sparen!"
- TECHNOLOGIE: Modernste IMAX-Projektion, 3D-Brillen der Top-Klasse, beste Akustik.
- PREISE: Parkett 12,00 EUR, Luxus 15,50 EUR, Loge (VIP-Sitze) 18,50 EUR.
- LAGE: Zentrale Lage, leicht erreichbar mit Bus und Bahn.
- BEZAHNUNG: Wir akzeptieren Stripe (Kreditkarte), PayPal, Google Pay und Apple Pay.
- VERFÜGBARE FILME HEUTE:
  1. Dune: Part Two (Science-Fiction / Sci-Fi, FSK 12, Vorstellungen um 16:30 Uhr, 19:45 Uhr IMAX 3D, und 22:15 Uhr)
  2. Oppenheimer (Drama / Biografie, FSK 12, Vorstellungen um 16:00 Uhr, 20:00 Uhr IMAX 70mm)
  3. Interstellar (Sci-Fi / Abenteuer, FSK 12, Vorstellungen um 17:00 Uhr, 21:00 Uhr IMAX Special)
  4. Gladiator II (Action / Historie, FSK 16, Vorstellungen um 15:00 Uhr, 18:15 Uhr, 21:30 Uhr)

WICHTIGE ANWEISUNGEN:
- Schreibe IMMER ausschließlich auf DEUTSCH.
- Sei extrem höflich, einladend und verhalte dich wie ein erstklassiger Kinomitarbeiter.
- Nutze gerne Bulletpoints, um Filmzeiten oder Sonderangebote klar zu gliedern.
- Falls der Nutzer Fragen zum aktuellen Buchungsstatus hat, verweise ihn auf den interaktiven Ticket-Buchungsbereich auf der Hauptseite.
- Hebe das tolle Eröffnungsangebot (2 Tickets = 1 Getränk umsonst) hervor, wenn es passt!
- Du darfst kreativ sein bei Filmempfehlungen d.h. wenn jemand fragen für einen romantischen Abend oder epische Action hat, empfiehl die passenden IMAX Filme.
`;

    // Map recent messages to Gemini structure
    // Since the API accepts simple format, let's build content structure:
    const geminiContents = messages.map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));

    const config: any = {
      systemInstruction: contextPrompt,
    };

    if (isPro) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH
      };
      // Do not set maxOutputTokens for high thinking reasoning models
    } else {
      config.temperature = 1.0;
    }

    const response = await chatClient.models.generateContent({
      model: modelToUse,
      contents: geminiContents,
      config: config
    });

    const botMessage = response.text || "Es tut mir leid, ich konnte kein Feedback generieren. Bitte versuche es erneut.";
    res.json({ content: botMessage, modelUsed: modelToUse });
  } catch (error: any) {
    console.error("Gemini API Fehler. Weiche auf lokalen Support-Bot aus. Fehler:", error);
    try {
      const lastUserMessageObj = messages[messages.length - 1];
      const lastUserMessage = lastUserMessageObj ? lastUserMessageObj.content : "";
      const fallbackContent = generateFallbackResponse(lastUserMessage);
      res.json({ content: fallbackContent, modelUsed: "IMAX Local Fallback Engine" });
    } catch (fallbackErr: any) {
      res.status(500).json({ error: "Ein Fehler ist bei dem Kundenservice aufgetreten: " + error.message });
    }
  }
});

// Configure Vite or production folder serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starte Server im Entwicklungsmodus (Vite)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starte Server im Produktionsmodus (Static Client serving)...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IMAX Server läuft auf http://0.0.0.0:${PORT}`);
  });
}

setupServer();
