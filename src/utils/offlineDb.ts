import { ClientMovie, Seat, Booking } from "../types";

export const INITIAL_MOVIES: ClientMovie[] = [
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
    ]
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
    ]
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
    ]
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
    ]
  }
];

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
    timestamp: new Date().toLocaleString("en-US")
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
I is your digital IMAX assistant. I invite you to browse our movie catalog or directly reserve custom seating configurations for today.

Do you have any questions regarding movie showtimes (e.g., **Dune** or **Gladiator II**), our special **opening offer**, or **ticket prices**? Ask away!`;
}
