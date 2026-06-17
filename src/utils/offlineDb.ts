import { ClientMovie, Seat, Booking } from "../types";

export const INITIAL_MOVIES: ClientMovie[] = [
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
    ]
  },
  {
    id: "m2",
    title: "Oppenheimer",
    genre: "Drama / Biografie",
    duration: "180 Min.",
    rating: "FSK 12",
    banner: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
    description: "Der epische Meilenstein von Christopher Nolan über das Manhattan-Projekt und den Vater der Atombombe. Spektakulär gefilmt in nativem IMAX 70mm.",
    showtimes: [
      { id: "m2_1", time: "16:00 Uhr" },
      { id: "m2_2", time: "20:00 Uhr (IMAX 70mm)" }
    ]
  },
  {
    id: "m3",
    title: "Interstellar",
    genre: "Sci-Fi / Abenteuer",
    duration: "169 Min.",
    rating: "FSK 12",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    description: "Der visuelle Meilenstein kehrt zurück auf die Leinwand. Eine emotionale Reise durch Raum und Zeit jenseits unserer Galaxie.",
    showtimes: [
      { id: "m3_1", time: "17:00 Uhr" },
      { id: "m3_2", time: "21:00 Uhr (IMAX Special)" }
    ]
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
    ]
  }
];

function generateSeatsHelper(): Seat[] {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
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

export function getOfflineMovies(): ClientMovie[] {
  const stored = localStorage.getItem("imax_offline_movies");
  if (!stored) {
    localStorage.setItem("imax_offline_movies", JSON.stringify(INITIAL_MOVIES));
    return INITIAL_MOVIES;
  }
  return JSON.parse(stored);
}

export function getOfflineSeats(movieId: string, showtimeId: string): Seat[] {
  const key = `imax_offline_seats_${movieId}_${showtimeId}`;
  const stored = localStorage.getItem(key);
  if (!stored) {
    const seats = generateSeatsHelper();
    localStorage.setItem(key, JSON.stringify(seats));
    return seats;
  }
  return JSON.parse(stored);
}

export function bookOfflineSeats(movieId: string, showtimeId: string, seatIds: string[]): Seat[] {
  const key = `imax_offline_seats_${movieId}_${showtimeId}`;
  const seats = getOfflineSeats(movieId, showtimeId);
  const updated = seats.map(s => {
    if (seatIds.includes(s.id)) {
      return { ...s, booked: true };
    }
    return s;
  });
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export function createOfflineBooking(bookingData: {
  movieId: string;
  showtimeId: string;
  showtime: string;
  movieTitle: string;
  date: string;
  seats: string[];
  customerName: string;
  customerEmail: string;
  ticketType: 'Standard' | 'Student';
  paymentMethod: 'Stripe' | 'PayPal' | 'GooglePay' | 'ApplePay';
  subtotal: number;
  discount: number;
  total: number;
}): Booking {
  const bookingId = "IMX-" + Math.floor(100000 + Math.random() * 900000);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=052c24&bgcolor=ffffff&data=${encodeURIComponent("upi://pay?pa=nikhil.2613-1@waicici&pn=NIKHIL%20SAINI")}`;
  
  const newBooking: Booking = {
    id: bookingId,
    ...bookingData,
    qrCodeUrl,
    timestamp: new Date().toLocaleString("de-DE")
  };

  const storedBookings = localStorage.getItem("imax_offline_bookings");
  const bookings: Booking[] = storedBookings ? JSON.parse(storedBookings) : [];
  bookings.push(newBooking);
  localStorage.setItem("imax_offline_bookings", JSON.stringify(bookings));

  return newBooking;
}

export function getOfflineBooking(id: string): Booking | null {
  const storedBookings = localStorage.getItem("imax_offline_bookings");
  if (!storedBookings) return null;
  const bookings: Booking[] = JSON.parse(storedBookings);
  return bookings.find(b => b.id === id) || null;
}

export function getOfflineChatResponse(message: string): string {
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
Dieses Angebot gilt nur für kurze Zeit unter dem Slogan: *"Kino genießen und sparen!"*

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

  return `Vielen Dank für deine Nachricht! 😊 
Ich bin dein IMAX Support-Assistent. Gerne lade ich dich ein, das Kinoprogramm auf unserer Webseite zu durchstöbern oder direkt einen Sitzplatz für heute zu buchen.

Haben Sie Fragen zu den Vorstellungszeiten der Filme (z.B. **Dune** oder **Gladiator II**), zu unserem tollen **Eröffnungsangebot** oder den **Ticketpreisen**? Fragen Sie mich einfach!`;
}
