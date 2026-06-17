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
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables!");
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
  type: 'Standard' | 'Premium' | 'VIP';
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
    genre: "Sci-Fi / Adventure",
    duration: "166 Min.",
    rating: "PG-13",
    banner: "https://images.unsplash.com/photo-1547483238-f400e65ccd56?auto=format&fit=crop&w=1200&q=80",
    description: "The legendary struggle for Arrakis continues. Experience Paul Atreides' destiny on the massive IMAX screen with breathtaking immersive sound.",
    showtimes: [
      { id: "s1_1", time: "4:30 PM" },
      { id: "s1_2", time: "7:45 PM (IMAX 3D)" },
      { id: "s1_3", time: "10:15 PM" }
    ],
    seats: {}
  },
  {
    id: "m2",
    title: "Oppenheimer",
    genre: "Drama / Biography",
    duration: "180 Min.",
    rating: "R",
    banner: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
    description: "Christopher Nolan's epic masterpiece about the Manhattan Project and the father of the atomic bomb. Spectacularly filmed in native IMAX 70mm.",
    showtimes: [
      { id: "m2_1", time: "4:00 PM" },
      { id: "m2_2", time: "8:00 PM (IMAX 70mm)" }
    ],
    seats: {}
  },
  {
    id: "m3",
    title: "Interstellar",
    genre: "Sci-Fi / Drama",
    duration: "169 Min.",
    rating: "PG-13",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    description: "The visual masterpiece returns to the big screen. An emotional journey through space and time beyond our galaxy.",
    showtimes: [
      { id: "m3_1", time: "5:00 PM" },
      { id: "m3_2", time: "9:00 PM (IMAX Special)" }
    ],
    seats: {}
  },
  {
    id: "m4",
    title: "Gladiator II",
    genre: "Action / History",
    duration: "148 Min.",
    rating: "R",
    banner: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
    description: "Decades after the death of Maximus, Lucius enters the Colosseum to forge a new destiny for Rome. Monumental historical cinema.",
    showtimes: [
      { id: "m4_1", time: "3:00 PM" },
      { id: "m4_2", time: "6:15 PM" },
      { id: "m4_3", time: "9:30 PM" }
    ],
    seats: {}
  }
];

// Seed seats for all showtimes
function generateSeatsHelper(): Seat[] {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  rows.forEach(row => {
    let type: 'Standard' | 'Premium' | 'VIP' = 'Standard';
    let price = 12.00;
    if (row === 'A' || row === 'B') {
      type = 'VIP';
      price = 18.50;
    } else if (row === 'C' || row === 'D') {
      type = 'Premium';
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
    return res.status(404).json({ error: "Movie not found" });
  }
  const seats = movie.seats[showtimeId];
  if (!seats) {
    return res.status(404).json({ error: "Showtime not found" });
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
    return res.status(400).json({ error: "Missing required booking details" });
  }

  const movie = moviesDb.find(m => m.id === movieId);
  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }

  const showtime = movie.showtimes.find(s => s.id === showtimeId);
  if (!showtime) {
    return res.status(404).json({ error: "Showtime not found" });
  }

  const movieSeats = movie.seats[showtimeId];
  if (!movieSeats) {
    return res.status(404).json({ error: "Seats not found" });
  }

  // Ensure seats are not already booked
  const unavailableSeats = seats.filter((sId: string) => {
    const seatObj = movieSeats.find(s => s.id === sId);
    return !seatObj || seatObj.booked;
  });

  if (unavailableSeats.length > 0) {
    return res.status(400).json({ error: `Some selected seats have already been booked: ${unavailableSeats.join(", ")}` });
  }

  // Calculate prices
  let subtotal = 0;
  seats.forEach((sId: string) => {
    const seatObj = movieSeats.find(s => s.id === sId);
    if (seatObj) {
      subtotal += seatObj.price;
    }
  });

  // Apply ticket discount (student ticket gets $2.00 discount per seat)
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
    timestamp: new Date().toLocaleString("en-US")
  };

  bookingsDb.push(newBooking);
  res.status(201).json(newBooking);
});

// 4. Get specific Booking (for ticket scanning or landing receipt)
app.get("/api/bookings/:id", (req, res) => {
  const { id } = req.params;
  const booking = bookingsDb.find(b => b.id === id);
  if (!booking) {
    return res.status(404).json({ error: "Ticket booking not found" });
  }
  res.json(booking);
});

// 5. Digital Support Assistant Support
function generateFallbackResponse(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey") || msg.includes("greetings") || msg.includes("welcome")) {
    return `Hello! I am your IMAX support assistant. 🍿 

I'm happy to help! You can ask me about:
- Our current movie programming (e.g., **Dune: Part Two**, **Oppenheimer**, **Interstellar**, or **Gladiator II**)
- Our exclusive **opening special offer**
- Ticket prices (Standard, Premium, VIP) or seat options
- Supported payment methods.

How can I bring you joy in your cinema experience today?`;
  }
  
  if (msg.includes("offer") || msg.includes("opening") || msg.includes("promotion") || msg.includes("free") || msg.includes("drink") || msg.includes("save") || msg.includes("deal")) {
    return `🎉 **Our exclusive Opening Offer:**
Buy **2 tickets** of your choice and get **1 drink completely free**! 
This offer is available for a limited time under the motto: *"Enjoy cinema and save!"*

Additionally, students receive a discount of **$2.00** on every booked ticket! Simply select the "Student" tariff option during checkout.`;
  }
  
  if (msg.includes("movie") || msg.includes("program") || msg.includes("theater") || msg.includes("cinema") || msg.includes("show") || msg.includes("time") || msg.includes("today") || msg.includes("dune") || msg.includes("oppenheimer") || msg.includes("interstellar") || msg.includes("gladiator")) {
    let reply = `🎬 **Today's IMAX Movie Program:**\n\n`;
    
    if (msg.includes("dune")) {
      reply += `🏜️ **Dune: Part Two** (PG-13 | 166 Min.)\nThe epic battle for Arrakis. Screenings today at:\n- 4:30 PM\n- 7:45 PM (IMAX 3D)\n- 10:15 PM`;
    } else if (msg.includes("oppenheimer")) {
      reply += `⚛️ **Oppenheimer** (R | 180 Min.)\nChristopher Nolan's masterpiece about the creator of the atomic bomb. Screenings:\n- 4:00 PM\n- 8:00 PM (IMAX 70mm)`;
    } else if (msg.includes("interstellar")) {
      reply += `🌌 **Interstellar** (PG-13 | 169 Min.)\nThe visually stunning classic returns to the big screen!\n- 5:00 PM\n- 9:00 PM (IMAX Special)`;
    } else if (msg.includes("gladiator")) {
      reply += `⚔️ **Gladiator II** (R | 148 Min.)\nThe thrilling sequel of the legendary historical epic.\n- 3:00 PM\n- 6:15 PM\n- 9:30 PM`;
    } else {
      reply += `1️⃣ **Dune: Part Two** (Sci-Fi, PG-13)\n   🕒 4:30 PM | 7:45 PM (IMAX 3D) | 10:15 PM\n\n`;
      reply += `2️⃣ **Oppenheimer** (Biography, R)\n   🕒 4:00 PM | 8:00 PM (IMAX 70mm)\n\n`;
      reply += `3️⃣ **Interstellar** (Adventure, PG-13)\n   🕒 5:00 PM | 9:00 PM (IMAX Special)\n\n`;
      reply += `4️⃣ **Gladiator II** (History, R)\n   🕒 3:00 PM | 6:15 PM | 9:30 PM\n\n`;
      reply += `Tip: Simply click on your preferred showtime on our website to access the interactive seat reservation!`;
    }
    return reply;
  }
  
  if (msg.includes("price") || msg.includes("cost") || msg.includes("ticket") || msg.includes("seat") || msg.includes("vip") || msg.includes("premium") || msg.includes("standard")) {
    return `🎟️ **Our Ticket and Seat Categories:**

1. **Standard** - $12.00 (Classic comfortable seating in the front section)
2. **Premium** - $15.50 (Extra wide premium recliners in the middle section)
3. **VIP** - $18.50 (Exclusive back rows with optimal acoustics & table space)

*Note:* Booking as a student automatically applies a **$2.00 discount** per ticket!`;
  }
  
  if (msg.includes("pay") || msg.includes("checkout") || msg.includes("stripe") || msg.includes("paypal") || msg.includes("card") || msg.includes("apple") || msg.includes("google")) {
    return `💳 **Secure and Instant Online Payment:**

We support the following modern payment methods directly during checkout:
- **Stripe** (Convenient credit card payment)
- **PayPal**
- **Google Pay**
- **Apple Pay**

Upon successful booking, a **mobile QR code ticket** will be immediately generated for you to scan for contactless entry.`;
  }
  
  if (msg.includes("location") || msg.includes("address") || msg.includes("where") || msg.includes("direction") || msg.includes("bus") || msg.includes("train") || msg.includes("parking")) {
    return `📍 **Central Location & Easy Access:**

We are situated right in the city center with excellent transit connections!
- **Public Transit:** Easily reachable by bus and all subway lines (stop: *IMAX / Kinopark* right outside).
- **By Car:** Free parking spaces are available for cinema guests in our multi-story parking garage open 24/7.`;
  }
  
  if (msg.includes("tech") || msg.includes("sound") || msg.includes("laser") || msg.includes("screen") || msg.includes("3d")) {
    return `🔊 **World-Class technology: Feel it in IMAX!**

Our custom cinema hall boasts:
- The region's largest IMAX screen featuring crystal-clear laser projection.
- Next-generation 12-channel immersive audio for intense, room-shaking sound.
- Ergonomically placed VIP, Premium, and Standard seating with perfect viewing angles.
- High-grade, featherlight 3D glasses for crisp depth and rich colors.`;
  }

  return `Thank you for your message! 😊 
I am your digital support assistant. I invite you to browse our movie catalog or directly reserve custom seating configurations for today.

Do you have any questions regarding movie showtimes (e.g., **Dune** or **Gladiator II**), our special **opening offer**, or **ticket prices**? Ask away!`;
}

app.post("/api/chat", async (req, res) => {
  const { messages, highThinking } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing chat history" });
  }

  try {
    const chatClient = getGeminiClient();
    
    // Choose model based on user selection
    // gemini-3.1-pro-preview for complex reasoning tasks with ThinkingLevel.HIGH
    // gemini-3.5-flash for friendly fast chats
    const isPro = highThinking === true || highThinking === "true";
    const modelToUse = isPro ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    // Build standard prompt with contextual cinema details in English
    const contextPrompt = `You are the "IMAX Support Assistant", the customer service representative of IMAX Cinema. 
Your role is to support website visitors with selecting movies, details about payment methods, seating configurations, and opening special offers.

Use the following IMAX facts to answer:
- IMAX: It is a complete, immersive experience ("FEEL IT IN IMAX"). We offer magnificent, top-tier audio-visual quality in an unforgettable cinema atmosphere.
- WHAT WE OFFER:
  1. The latest movies from around the world (Blockbusters, classics, and more).
  2. IMAX and 3D screening halls for a spectacular experience.
  3. Ultra-comfortable recliners (More legroom, premium comfort).
  4. Online ticket booking (Fast, easy, and secure through our app or website).
  5. Student discounts ($2.00 off per ticket).
  6. Fresh popcorn and beverages.
  7. Friends and family deals.
- SPECIAL OFFER (Opening Special):
  - Buy 2 tickets, get 1 drink FREE! Limited time offer. Slogan: "Enjoy cinema and save!"
- TECHNOLOGY: State-of-the-art IMAX laser projection, premium 3D glasses, immersive audio.
- PRICES: Standard $12.00, Premium $15.50, VIP (VIP recliners) $18.50.
- LOCATION: Direct city center, easily accessible via bus and train transit.
- PAYMENT: We accept Stripe (credit card), PayPal, Google Pay, and Apple Pay.
- MOVIES AVAILABLE TODAY:
  1. Dune: Part Two (Sci-Fi / Adventure, PG-13, showings at 4:30 PM, 7:45 PM IMAX 3D, and 10:15 PM)
  2. Oppenheimer (Drama / Biography, R, showings at 4:00 PM, 8:00 PM IMAX 70mm)
  3. Interstellar (Sci-Fi / Drama, PG-13, showings at 5:00 PM, 9:00 PM IMAX Special)
  4. Gladiator II (Action / History, R, showings at 3:00 PM, 6:15 PM, 9:30 PM)

IMPORTANT INSTRUCTIONS:
- ALWAYS reply in English.
- Be extremely polite, welcoming, and behave like a premium cinema representative.
- Format times or list offers using bullet points for clarity.
- Refer visitors wishing to manage reservations directly to our interactive seat booking on the main page.
`;

    // Map recent messages to Gemini structure
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
    } else {
      config.temperature = 1.0;
    }

    const response = await chatClient.models.generateContent({
      model: modelToUse,
      contents: geminiContents,
      config: config
    });

    const botMessage = response.text || "I'm sorry, I couldn't generate a response. Please try again.";
    res.json({ content: botMessage, modelUsed: modelToUse });
  } catch (error: any) {
    console.error("Gemini API error. Falling back to local support bot. Error:", error);
    try {
      const lastUserMessageObj = messages[messages.length - 1];
      const lastUserMessage = lastUserMessageObj ? lastUserMessageObj.content : "";
      const fallbackContent = generateFallbackResponse(lastUserMessage);
      res.json({ content: fallbackContent, modelUsed: "IMAX Local Fallback Engine" });
    } catch (fallbackErr: any) {
      res.status(500).json({ error: "An error occurred with our customer support bot: " + error.message });
    }
  }
});

// Configure Vite or production folder serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in Development Mode (Vite)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in Production Mode (Static Client serving)...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IMAX Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
