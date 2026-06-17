import React, { useState, useEffect, useRef } from "react";
import { 
  Clapperboard, 
  Smartphone, 
  Globe, 
  MapPin, 
  Coins, 
  Smile, 
  Volume2, 
  Video, 
  GraduationCap, 
  Users, 
  Plus, 
  Minus, 
  Check, 
  Sparkles, 
  MessageSquare, 
  X, 
  Send, 
  Info, 
  QrCode, 
  User, 
  Mail, 
  CreditCard,
  Tv,
  CheckCircle,
  HelpCircle,
  BrainCircuit,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Movie, Seat, Booking, ChatMessage } from "./types";
import { 
  getOfflineMovies, 
  getOfflineSeats, 
  bookOfflineSeats, 
  createOfflineBooking, 
  getOfflineBooking, 
  getOfflineChatResponse 
} from "./utils/offlineDb";

export default function App() {
  // State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Interactive modal system
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"movies" | "info" | "verify">("movies");
  
  // Booking selections
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedShowtime, setSelectedShowtime] = useState<{ id: string; time: string } | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seatMap, setSeatMap] = useState<Seat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  
  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [ticketType, setTicketType] = useState<'Standard' | 'Student'>("Standard");
  const [paymentMethod, setPaymentMethod] = useState<'Stripe' | 'PayPal' | 'GooglePay' | 'ApplePay'>("Stripe");
  const [bookingSuccess, setBookingSuccess] = useState<Booking | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hallo! Willkommen im IMAX Berlin. Ich bin dein digitaler Kinoservice-Assistent. Möchtest du Informationen zu unseren IMAX-Sälen, dem Eröffnungsangebot oder Unterstützung bei der Auswahl deines heutigen Films?",
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [highThinking, setHighThinking] = useState(false); // Gemini high thinking mode option
  
  // Ticket lookup/Verification simulation
  const [verificationId, setVerificationId] = useState("");
  const [verifiedBooking, setVerifiedBooking] = useState<Booking | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const [searchingVerification, setSearchingVerification] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load initial movie list
  useEffect(() => {
    fetchMovies();
  }, []);

  // Scroll chatbot to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isTyping]);

  const fetchMovies = async () => {
    try {
      setLoadingMovies(true);
      const res = await fetch("/api/movies");
      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Server response is not valid JSON");
      }
      const data = await res.json();
      setMovies(data);
      if (data.length > 0) {
        setSelectedMovie(data[0]);
        setSelectedShowtime(data[0].showtimes[0]);
      }
    } catch (e) {
      console.warn("API Server not available, falling back to client-only mode on Vercel:", e);
      setIsOfflineMode(true);
      const offlineMovies = getOfflineMovies();
      setMovies(offlineMovies);
      if (offlineMovies.length > 0) {
        setSelectedMovie(offlineMovies[0]);
        setSelectedShowtime(offlineMovies[0].showtimes[0]);
      }
    } finally {
      setLoadingMovies(false);
    }
  };

  // Load seats when movie or showtime changes
  useEffect(() => {
    if (selectedMovie && selectedShowtime) {
      fetchSeats(selectedMovie.id, selectedShowtime.id);
    }
  }, [selectedMovie, selectedShowtime]);

  const fetchSeats = async (movieId: string, showtimeId: string) => {
    try {
      setLoadingSeats(true);
      setSelectedSeats([]);
      if (isOfflineMode) {
        const seats = getOfflineSeats(movieId, showtimeId);
        setSeatMap(seats);
        return;
      }
      const res = await fetch(`/api/movies/${movieId}/seats/${showtimeId}`);
      if (res.ok) {
        const data = await res.json();
        setSeatMap(data.seats);
      } else {
        const seats = getOfflineSeats(movieId, showtimeId);
        setSeatMap(seats);
      }
    } catch (e) {
      console.error("Fehler beim Laden des Sitzplans, weiche aus auf Offline-Sitzplan:", e);
      const seats = getOfflineSeats(movieId, showtimeId);
      setSeatMap(seats);
    } finally {
      setLoadingSeats(false);
    }
  };

  const toggleSeat = (seatId: string) => {
    const target = seatMap.find(s => s.id === seatId);
    if (!target || target.booked) return;
    
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(id => id !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  // Live calculations helper
  const calculateTotal = () => {
    let subtotal = 0;
    selectedSeats.forEach(sId => {
      const seat = seatMap.find(s => s.id === sId);
      if (seat) subtotal += seat.price;
    });
    const discount = ticketType === "Student" ? selectedSeats.length * 2.0 : 0;
    return {
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount)
    };
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovie || !selectedShowtime || selectedSeats.length === 0 || !customerName || !customerEmail) {
      alert("Bitte füllen Sie alle erforderlichen Felder aus und wählen Sie mindestens einen Sitzplatz.");
      return;
    }

    try {
      setSubmittingBooking(true);
      
      const bookingData = {
        movieId: selectedMovie.id,
        showtimeId: selectedShowtime.id,
        showtime: selectedShowtime.time,
        movieTitle: selectedMovie.title,
        date: "Heute, " + new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }),
        seats: selectedSeats,
        customerName,
        customerEmail,
        ticketType,
        paymentMethod,
        subtotal,
        discount,
        total
      };

      if (isOfflineMode) {
        // Process offline simulation
        const booking = createOfflineBooking(bookingData);
        bookOfflineSeats(selectedMovie.id, selectedShowtime.id, selectedSeats);
        setBookingSuccess(booking);
        fetchSeats(selectedMovie.id, selectedShowtime.id);
        
        setChatMessages(prev => [
          ...prev,
          {
            id: `booking-${booking.id}`,
            role: "bot",
            content: `Vielen Dank für Ihre Buchung, ${customerName}! Ich habe Ihre ${selectedSeats.length} Tickets für "${selectedMovie.title}" (${selectedShowtime.time}) erfolgreich reserviert. Ihre Buchungsnummer lautet ${booking.id}. Sie können das Ticket hier direkt verifizieren lassen!`,
            timestamp: new Date()
          }
        ]);
        return;
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: selectedMovie.id,
          showtimeId: selectedShowtime.id,
          date: bookingData.date,
          seats: selectedSeats,
          customerName,
          customerEmail,
          ticketType,
          paymentMethod
        })
      });

      if (res.ok) {
        const booking = await res.json();
        setBookingSuccess(booking);
        // Refresh local seat list
        fetchSeats(selectedMovie.id, selectedShowtime.id);
        
        // Push chatbot congratulatory notice
        setChatMessages(prev => [
          ...prev,
          {
            id: `booking-${booking.id}`,
            role: "bot",
            content: `Vielen Dank für Ihre Buchung, ${customerName}! Ich habe Ihre ${selectedSeats.length} Tickets für "${selectedMovie.title}" (${selectedShowtime.time}) erfolgreich reserviert. Ihre Buchungsnummer lautet ${booking.id}. Sie können das Ticket hier direkt verifizieren lassen!`,
            timestamp: new Date()
          }
        ]);
      } else {
        const err = await res.json();
        alert("Buchungsfehler: " + err.error);
      }
    } catch (error) {
      console.warn("Zahlungsverbindungsfehler, weiche auf lokale Buchungssimulation aus:", error);
      // Fallback booking
      const booking = createOfflineBooking({
        movieId: selectedMovie.id,
        showtimeId: selectedShowtime.id,
        showtime: selectedShowtime.time,
        movieTitle: selectedMovie.title,
        date: "Heute, " + new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }),
        seats: selectedSeats,
        customerName,
        customerEmail,
        ticketType,
        paymentMethod,
        subtotal,
        discount,
        total
      });
      bookOfflineSeats(selectedMovie.id, selectedShowtime.id, selectedSeats);
      setBookingSuccess(booking);
      fetchSeats(selectedMovie.id, selectedShowtime.id);
      
      setChatMessages(prev => [
        ...prev,
        {
          id: `booking-${booking.id}`,
          role: "bot",
          content: `Vielen Dank für Ihre Buchung, ${customerName}! Ich habe Ihre ${selectedSeats.length} Tickets für "${selectedMovie.title}" (${selectedShowtime.time}) erfolgreich offline reserviert. Ihre Buchungsnummer lautet ${booking.id}. Sie können das Ticket hier direkt verifizieren lassen!`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleVerificationLookup = async (idToSearch?: string) => {
    const searchId = idToSearch || verificationId;
    if (!searchId.trim()) return;
    try {
      setSearchingVerification(true);
      setVerificationError("");
      setVerifiedBooking(null);

      if (isOfflineMode) {
        const booking = getOfflineBooking(searchId.trim().toUpperCase());
        if (booking) {
          setVerifiedBooking(booking);
        } else {
          setVerificationError("Keine Buchung mit dieser Ticket-Nummer gefunden. Bitte prüfen Sie Ihre Eingabe.");
        }
        return;
      }

      const res = await fetch(`/api/bookings/${searchId.trim().toUpperCase()}`);
      if (res.ok) {
        const booking = await res.json();
        setVerifiedBooking(booking);
      } else {
        const booking = getOfflineBooking(searchId.trim().toUpperCase());
        if (booking) {
          setVerifiedBooking(booking);
        } else {
          setVerificationError("Keine Buchung mit dieser Ticket-Nummer gefunden. Bitte prüfen Sie Ihre Eingabe.");
        }
      }
    } catch (e) {
      const booking = getOfflineBooking(searchId.trim().toUpperCase());
      if (booking) {
        setVerifiedBooking(booking);
      } else {
        setVerificationError("Fehler beim Abrufen der Ticket-Daten.");
      }
    } finally {
      setSearchingVerification(false);
    }
  };

  const sendMessageToBot = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || userInput;
    if (!promptToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: promptToSend,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    if (!customPrompt) setUserInput("");

    try {
      if (isOfflineMode) {
        setTimeout(() => {
          const response = getOfflineChatResponse(promptToSend);
          setChatMessages(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              role: "bot",
              content: response,
              timestamp: new Date(),
              modelUsed: "Offline-Kundenservice-Modell"
            }
          ]);
          setIsTyping(false);
        }, 800);
        return;
      }

      const recentHistory = chatMessages
        .slice(-10) // keep reasonable context size
        .map(msg => ({ role: msg.role, content: msg.content }));
      recentHistory.push({ role: "user", content: promptToSend });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: recentHistory,
          highThinking: highThinking
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "bot",
            content: data.content,
            timestamp: new Date(),
            modelUsed: data.modelUsed
          }
        ]);
      } else {
        const fallback = getOfflineChatResponse(promptToSend);
        setChatMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            role: "bot",
            content: fallback,
            timestamp: new Date(),
            modelUsed: "Lokale Notfall-Engine"
          }
        ]);
      }
    } catch (error) {
      const fallback = getOfflineChatResponse(promptToSend);
      setChatMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "bot",
          content: fallback,
          timestamp: new Date(),
          modelUsed: "Lokale Notfall-Engine"
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOpenSeating = () => {
    setIsBookingOpen(true);
    setBookingSuccess(null);
  };

  const { subtotal, discount, total } = calculateTotal();

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans antialiased bg-cinema-spotlight" id="imax-root-view">
      
      {/* 1. HEADER / HERO SECTION */}
      <header className="relative w-full overflow-hidden border-b border-zinc-900" id="cinema-hero-header">
        
        {/* Cosmos background with earth blue horizon curve & stars */}
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-85" 
             style={{ 
               backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(5,5,5,1) 95%), url('https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=1600&q=80')` 
             }}>
          {/* Earth Horizon Accent Glowing line */}
          <div className="absolute left-1/2 -bottom-[150px] w-[180%] h-[240px] -translate-x-1/2 bg-gradient-to-t from-sky-950/40 via-cyan-500/10 to-transparent rounded-[50%] blur-3xl z-10 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Top Left Badge - BESTE FILME. BESTES ERLEBNIS. */}
          <div className="flex-shrink-0 animate-bounce duration-1000" id="awards-badge-group">
            <div className="relative flex items-center justify-center w-36 h-36 rounded-full border-2 border-[#d4af37] bg-gradient-to-br from-[#c62828] to-[#800c0c] gold-border-glow p-2">
              {/* Inner dashed ring */}
              <div className="absolute inset-2 rounded-full border border-dashed border-[#d4af37]/60" />
              {/* Content */}
              <div className="relative text-center flex flex-col items-center justify-center">
                <span className="text-xl text-[#d4af37] font-bold leading-none mb-1">★</span>
                <span className="text-[#ffd700] font-sans font-bold text-[13px] leading-[14px] tracking-wider">BESTE</span>
                <span className="text-[#ffd700] font-sans font-extrabold text-[15px] leading-[15px] tracking-widest my-0.5">FILME.</span>
                <span className="text-[#ffd700] font-sans font-medium text-[11px] leading-[12px] tracking-wide">BESTES</span>
                <span className="text-[#ffd700] font-sans font-extrabold text-[12px] leading-[12px] tracking-wide">ERLEBNIS.</span>
                {/* Small laurel wreath accents or line below */}
                <div className="w-10 h-0.5 bg-[#d4af37] mt-1.5" />
              </div>
            </div>
          </div>

          {/* Center IMAX Branding */}
          <div className="text-center flex-grow py-4" id="imax-marquee-branding">
            <h1 className="text-7xl sm:text-[95px] font-black tracking-[10px] text-white uppercase select-none drop-shadow-[0_0_20px_rgba(255,255,255,0.25)] font-heading leading-none">
              IMAX
            </h1>
            <p className="text-sm sm:text-lg tracking-[8px] text-[#d4af37] py-2 font-light uppercase text-center ml-2">
              FEEL IT IN IMAX
            </p>
          </div>

          {/* Right Side German Slogan & 5 Stars */}
          <div className="max-w-xs text-center md:text-right flex flex-col items-center md:items-end gap-3" id="hero-marketing-quote">
            <blockquote className="text-base sm:text-[17px] font-medium leading-relaxed tracking-wide text-zinc-100">
              Mehr als <span className="text-white font-semibold">nur ein Film – </span> 
              <span className="block mt-1 text-[#ffd700] font-serif tracking-wider font-semibold italic text-xl">ein unvergessliches Erlebnis!</span>
            </blockquote>
            {/* 5 Golden Stars */}
            <div className="flex gap-1 py-1" id="star-rating-display">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-[#d4af37] text-lg select-none filter drop-shadow-[0_0_3px_rgba(212,175,55,0.5)]">★</span>
              ))}
            </div>
          </div>

        </div>
      </header>

      {/* Behind content backdrop - Red Theater Seats in perspective */}
      <div className="relative z-10 w-full bg-[size:100%_auto] bg-top" 
           style={{ 
             backgroundImage: `linear-gradient(to top, rgba(5,5,5,1) 30%, rgba(5,5,5,0.7) 100%), url('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80')`
           }}>
        
        {/* Main Columns Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12" id="imax-bento-grid">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* 2. LEFT FEATURE PANEL – "WAS BIETEN WIR AN?" */}
            <section className="lg:col-span-4 flex flex-col bg-black/65 backdrop-blur-md rounded-2xl border border-zinc-900 overflow-hidden shadow-2xl" id="what-we-offer-panel">
              {/* Ribbon Header banner */}
              <div className="relative bg-gradient-to-r from-[#c62828] to-[#8c1c1c] px-6 py-4 shadow-md border-b border-[#d4af37]/30 flex items-center justify-between">
                <div className="absolute top-0 right-0 h-full w-4 bg-[#d4af37] transform skew-x-12 translate-x-1 opacity-25" />
                <h2 className="text-lg font-bold tracking-widest text-white uppercase font-heading">
                  WAS BIETEN WIR AN?
                </h2>
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-ping" />
              </div>

              {/* Offer Rows */}
              <div className="p-6 flex flex-col gap-5 flex-grow justify-around" id="left-features-list">
                
                {/* Item 1 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5">
                    <Clapperboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Neueste Filme aus aller Welt</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Blockbuster, Klassiker und mehr.</p>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] font-bold text-xs shadow-inner mt-0.5">
                    3D
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">IMAX- und 3D-Säle</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Für ein beeindruckendes Kinoerlebnis.</p>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5">
                    <Smartphone className="w-5 h-5 rotate-12" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Bequeme Luxussitze</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Mehr Platz, mehr Komfort.</p>
                  </div>
                </div>

                {/* Item 4 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Online-Ticketbuchung</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Schnell, einfach und sicher über unsere App oder Website.</p>
                  </div>
                </div>

                {/* Item 5 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Günstige Studentenrabatte</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Mehr Filme, weniger Preis.</p>
                  </div>
                </div>

                {/* Item 6 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5 flex-col leading-none">
                    <span className="text-[10px] uppercase font-bold">Pop</span>
                    <span className="text-[9px] text-[#ffd700]">🍿</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Frisches Popcorn und Getränke</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Leckere Snacks für den perfekten Filmabend.</p>
                  </div>
                </div>

                {/* Item 7 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-950 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shadow-inner mt-0.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Familien- und Freundesangebote</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">Gemeinsam mehr sparen und genießen.</p>
                  </div>
                </div>

              </div>
            </section>

            {/* 3. CENTER OFFER PANEL – "SONDERANGEBOT" */}
            <section className="lg:col-span-4 flex flex-col bg-zinc-950/80 rounded-2xl border-2 border-dashed border-[#d4af37] overflow-hidden shadow-2xl relative p-0.5" id="center-deal-marque">
              
              {/* Repeating glowing lights around border - marquee emulation */}
              <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                {/* Horizontal Top Lights */}
                <div className="absolute top-0 left-0 right-0 flex justify-between px-4 py-1 z-20">
                  {[...Array(10)].map((_, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-amber-600 animate-marquee-lights" style={{ animationDelay: `${idx * 0.15}s` }} />
                  ))}
                </div>
                {/* Horizontal Bottom Lights */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 py-1 z-20">
                  {[...Array(10)].map((_, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-amber-600 animate-marquee-lights" style={{ animationDelay: `${idx * 0.15}s` }} />
                  ))}
                </div>
                {/* Side Left Lights */}
                <div className="absolute left-0 top-4 bottom-4 flex flex-col justify-between py-2 px-1 z-20">
                  {[...Array(8)].map((_, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-amber-600 animate-marquee-lights" style={{ animationDelay: `${idx * 0.2}s` }} />
                  ))}
                </div>
                {/* Side Right Lights */}
                <div className="absolute right-0 top-4 bottom-4 flex flex-col justify-between py-2 px-1 z-20">
                  {[...Array(8)].map((_, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-amber-600 animate-marquee-lights" style={{ animationDelay: `${idx * 0.2}s` }} />
                  ))}
                </div>
              </div>

              {/* Inside Marquee Content */}
              <div className="relative z-10 px-6 py-8 h-full flex flex-col items-center justify-between text-center gap-4 bg-gradient-to-b from-[#0a0a0a] via-amber-950/15 to-[#0a0a0a]">
                
                {/* Small Tag Header inside */}
                <span className="text-zinc-400 tracking-[5px] text-[11px] font-bold uppercase py-0.5 px-3 rounded border border-zinc-800 bg-zinc-900/60 font-heading">
                  SONDERANGEBOT
                </span>

                {/* Elegant Cursive Title */}
                <h2 className="text-4xl text-white font-script px-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter font-bold">
                  Eröffnungsangebot!
                </h2>

                {/* 3 stars */}
                <div className="flex gap-1.5 text-[#d4af37] text-sm justify-center -mt-2">
                  <span>★</span><span>★</span><span>★</span>
                </div>

                <div className="my-2 flex flex-col items-center" id="deal-content-body">
                  <p className="text-zinc-300 font-bold tracking-widest text-[12px] uppercase">KAUFEN SIE</p>
                  <p className="text-4xl font-extrabold text-white tracking-wider my-0.5 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] font-heading">
                    2 TICKETS
                  </p>
                  <p className="text-zinc-300 font-bold tracking-widest text-[11px] uppercase mt-1">UND ERHALTEN SIE</p>
                  <p className="text-lg font-black text-[#ffd700] tracking-wider mt-1 underline decoration-dotted decoration-[#ffd700]/80">
                    1 GETRÄNK KOSTENLOS!
                  </p>
                </div>

                {/* Dual Illustration: Overflowing Popcorn Box + Beverage Cup */}
                <div className="relative w-48 h-36 flex items-center justify-center my-1 select-none" id="illustration-deal">
                  
                  {/* Popcorn container */}
                  <div className="absolute left-4 bottom-2 w-20 h-28 bg-[#c62828] border-2 border-zinc-200/90 rounded-b-md rounded-t-sm shadow-xl flex flex-col justify-end overflow-hidden z-10">
                    {/* Vertical Striping */}
                    <div className="absolute inset-0 flex justify-around">
                      <div className="w-2 h-full bg-white" />
                      <div className="w-2 h-full bg-white" />
                      <div className="w-2 h-full bg-white" />
                      <div className="w-2 h-full bg-white" />
                    </div>
                    {/* IMAX golden text plate */}
                    <div className="relative z-15 bg-black/85 border-y border-[#d4af37]/60 py-1 px-1.5 text-center text-[10px] text-[#ffd700] font-bold tracking-widest font-serif leading-none">
                      IMAX
                    </div>
                  </div>

                  {/* Overflowing Popcorn bits */}
                  <div className="absolute left-2 bottom-[90px] w-24 h-12 z-20 flex flex-wrap justify-center overflow-visible pointer-events-none">
                    {[...Array(14)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-4 h-4 bg-amber-100 border border-amber-300 rounded-full shadow-sm"
                        style={{
                          transform: `translate(${Math.sin(i) * 12}px, ${Math.cos(i) * 5}px) scale(${0.8 + Math.random() * 0.4})`,
                          backgroundColor: i % 3 === 0 ? '#fdf6e2' : i % 3 === 1 ? '#ffe099' : '#fff9ec'
                        }}
                      />
                    ))}
                  </div>

                  {/* Drink Container */}
                  <div className="absolute right-6 bottom-1 w-16 h-24 bg-[#a61c1c] border border-zinc-100 rounded-b-md rounded-t-sm shadow-xl flex items-center justify-center z-15">
                    {/* Bevel details */}
                    <div className="absolute top-2 w-12 h-1 bg-white/25 rounded-full" />
                    {/* Straw protruding */}
                    <div className="absolute -top-6 right-6 w-2 h-10 bg-zinc-200 border-r border-zinc-400 rotate-[20deg] rounded-t-sm" />
                    <span className="text-[10px] text-white font-bold tracking-wider font-heading opacity-90">IMAX</span>
                  </div>

                  {/* Tilted IMAX Tickets overlay */}
                  <div className="absolute left-6 bottom-0 rotate-[-15deg] bg-gradient-to-br from-[#ffd700] to-[#b89320] border border-black/85 text-black px-2 py-0.5 rounded text-[8px] font-bold font-heading shadow-md z-30">
                    IMAX TICKET
                  </div>
                </div>

                {/* Slogan cursive bottom right */}
                <p className="text-white text-xl font-script ml-auto pr-2 mt-1 whitespace-nowrap leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Kino genießen und sparen!
                </p>

                {/* Red Circular Seal Badge - NUR FÜR KURZE ZEIT! */}
                <div className="absolute right-0 top-16 rotate-12 z-25">
                  <div className="w-16 h-16 rounded-full bg-white border border-red-500 red-border-glow p-0.5 shadow-xl flex items-center justify-center text-center">
                    <div className="w-full h-full rounded-full border border-dashed border-red-500 flex flex-col items-center justify-center p-1 bg-stone-100">
                      <span className="text-red-600 text-[6px] font-bold leading-none select-none">★</span>
                      <span className="text-red-700 font-extrabold text-[8px] leading-relaxed select-none tracking-tight">NUR FÜR</span>
                      <span className="text-red-700 font-extrabold text-[8px] leading-relaxed select-none tracking-tight">KURZE ZEIT!</span>
                      <span className="text-red-600 text-[6px] font-bold leading-none select-none">★</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* 4. RIGHT FEATURE PANEL */}
            <section className="lg:col-span-4 flex flex-col bg-black/65 backdrop-blur-md rounded-2xl border border-[#d4af37]/35 overflow-hidden shadow-2xl" id="tech-advantages-panel">
              {/* Gold rounded ribbon banner header */}
              <div className="relative bg-gradient-to-r from-[#1a1a1a] via-[#222] to-[#121212] px-6 py-4 shadow-md border-b border-[#d4af37]/50 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-widest text-[#ffd700] uppercase font-heading">
                  PREMIUM SERVICE
                </h2>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>

              {/* Advantages Rows */}
              <div className="p-6 flex flex-col gap-6 flex-grow justify-around" id="right-features-list">
                
                {/* Tech Item 1 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-500/10 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700] shadow-md mt-0.5">
                    <Video className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Modernste Technologie</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Für beste Bild- und Tonqualität.</p>
                  </div>
                </div>

                {/* Tech Item 2 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-500/10 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700] shadow-md mt-0.5">
                    <Volume2 className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Beste Bild- und Tonqualität</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Kino wie in einer anderen Welt.</p>
                  </div>
                </div>

                {/* Tech Item 3 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-500/10 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700] shadow-md mt-0.5">
                    <Smile className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Freundlicher Service</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Ihr Wohl ist unser Ziel.</p>
                  </div>
                </div>

                {/* Tech Item 4 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-500/10 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700] shadow-md mt-0.5 font-bold text-lg">
                    €
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Faire Preise</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Top-Erlebnis zu fairen Preisen.</p>
                  </div>
                </div>

                {/* Tech Item 5 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-500/10 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700] shadow-md mt-0.5">
                    <MapPin className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Zentrale Lage</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Leicht erreichbar mit Bus und Bahn.</p>
                  </div>
                </div>

              </div>
            </section>

          </div>

          {/* DYNAMIC HUB DESIGN / ACTIVE WORKSPACE: Movie Browser & Selection */}
          <section className="mt-12 bg-zinc-950/90 rounded-2xl border border-zinc-900 p-6 md:p-8 relative shadow-3xl" id="movie-lobby-selection">
            <div className="absolute top-0 left-12 w-32 h-1 bg-gradient-to-r from-red-600 via-[#d4af37] to-transparent" />
            
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-zinc-900 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black uppercase text-white tracking-wider font-heading flex items-center gap-2">
                  <span className="text-[#ffd700]">🎬</span> HEUTE IM IMAX PROGRAMM
                </h2>
                <p className="text-xs text-zinc-400 mt-1">Ausgewähltes Kinoprogramm für unvergessliche Erlebnisse.</p>
              </div>
              
              {/* Custom Action Router Tabs */}
              <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => setActiveTab("movies")}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                    activeTab === "movies" ? "bg-red-700 text-white shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Filmauswahl
                </button>
                <button 
                  onClick={() => setActiveTab("info")}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                    activeTab === "info" ? "bg-red-700 text-white shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  IMAX Preise
                </button>
                <button 
                  onClick={() => setActiveTab("verify")}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                    activeTab === "verify" ? "bg-red-700 text-white shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Ticket Scanner
                </button>
              </div>
            </div>

            {loadingMovies ? (
              <div className="py-20 text-center text-zinc-500 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-t-red-600 rounded-full animate-spin" />
                <p>Kino-Daten werden geladen...</p>
              </div>
            ) : (
              <div>
                {activeTab === "movies" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {movies.map(movie => (
                      <div 
                        key={movie.id} 
                        className={`group rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-300 flex flex-col ${
                          selectedMovie?.id === movie.id ? "border-[#d4af37] scale-[1.02] shadow-xl shadow-red-950/20" : "border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {/* Movie image */}
                        <div className="relative h-44 overflow-hidden">
                          <img 
                            src={movie.banner} 
                            alt={movie.title} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-[#ffd700] border border-[#d4af37]/30">
                            {movie.rating}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-4 flex flex-col flex-grow justify-between">
                          <div>
                            <span className="text-[10px] text-red-500 tracking-wider font-bold uppercase">{movie.genre}</span>
                            <h3 className="text-base font-bold text-white mt-1 group-hover:text-[#ffd700] transition-colors">{movie.title}</h3>
                            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{movie.description}</p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-zinc-800/80">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                              <span>Laufzeit: {movie.duration}</span>
                            </div>

                            {/* Showtimes selection */}
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {movie.showtimes.map(st => (
                                <button
                                  key={st.id}
                                  onClick={() => {
                                    setSelectedMovie(movie);
                                    setSelectedShowtime(st);
                                    handleOpenSeating();
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold tracking-wide rounded bg-zinc-950 hover:bg-red-700 hover:text-white border border-zinc-800 text-zinc-300 transition-colors"
                                >
                                  {st.time}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "info" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    {/* Parkett */}
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                      <div className="text-zinc-500 uppercase font-black tracking-widest text-[10px]">Kategorie A</div>
                      <h3 className="text-xl font-bold text-white mt-1">Parkett-Plätze</h3>
                      <p className="text-xs text-zinc-400 mt-2">Klassische Kino-Bestuhlung im vorderen Kinosaalbereich. Perfekte Sicht für Action und Abenteuer.</p>
                      <div className="text-2xl font-black text-[#ffd700] mt-4">12,00 EUR</div>
                      <button 
                        onClick={() => { setActiveTab("movies"); }}
                        className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold tracking-widest uppercase rounded text-white"
                      >
                        Film Wählen
                      </button>
                    </div>
                    {/* Luxus */}
                    <div className="bg-zinc-900 p-6 rounded-xl border border-[#d4af37]/45 relative">
                      <span className="absolute -top-3 right-4 bg-red-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Premium</span>
                      <div className="text-zinc-400 uppercase font-black tracking-widest text-[10px]">Kategorie B</div>
                      <h3 className="text-xl font-bold text-white mt-1">Luxussitze</h3>
                      <p className="text-xs text-zinc-400 mt-2">Extra breite Sitze mit verstellbarer Rückenlehne im mittleren Bereich der Ränge für maximalen Komfort.</p>
                      <div className="text-2xl font-black text-[#ffd700] mt-4">15,50 EUR</div>
                      <button 
                        onClick={() => { setActiveTab("movies"); }}
                        className="w-full mt-4 py-2 bg-gradient-to-r from-red-700 to-red-800 hover:bg-red-600 text-xs font-bold tracking-widest uppercase rounded text-white"
                      >
                        Film Wählen
                      </button>
                    </div>
                    {/* VIP Loge */}
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                      <div className="text-zinc-500 uppercase font-black tracking-widest text-[10px]">Kategorie C</div>
                      <h3 className="text-xl font-bold text-white mt-1">VIP Loge</h3>
                      <p className="text-xs text-zinc-400 mt-2">Beste Akustik, luxuriöse Polstersitze in den obersten hinteren Reihen mit exklusivem Tischplatz und Einlassservice.</p>
                      <div className="text-2xl font-black text-[#ffd700] mt-4">18,50 EUR</div>
                      <button 
                        onClick={() => { setActiveTab("movies"); }}
                        className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold tracking-widest uppercase rounded text-white"
                      >
                        Film Wählen
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "verify" && (
                  <div className="max-w-xl mx-auto py-6" id="ticket-checker-panel">
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-[#ffd700]" /> Ticket-Einlasskontrolle
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Nutzen Sie den Simulator, um Ihr mobiles PDF_Ticket verifizieren zu lassen. Geben Sie die 9-stellige Buchungsnummer ein (z. B. <strong>STK-XXXXXX</strong>), um den Sicherheitsstatus und Einlassberechtigungen anzuzeigen.
                      </p>
                      
                      <div className="flex gap-2 mt-5">
                        <input 
                          type="text" 
                          placeholder="z.B. STK-123456" 
                          value={verificationId}
                          onChange={(e) => setVerificationId(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 px-4 py-2.5 rounded-md text-sm text-white focus:outline-none focus:border-[#d4af37] flex-grow text-center tracking-widest font-mono uppercase"
                        />
                        <button 
                          onClick={() => handleVerificationLookup()}
                          disabled={searchingVerification}
                          className="bg-red-700 hover:bg-red-600 text-white disabled:bg-zinc-800 text-xs font-black tracking-widest uppercase px-6 rounded-md transition-all flex items-center gap-2"
                        >
                          {searchingVerification ? "Prüft..." : "Ticket Prüfen"}
                        </button>
                      </div>

                      {verificationError && (
                        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-md text-xs text-red-400 mt-4 text-center">
                          {verificationError}
                        </div>
                      )}

                      {verifiedBooking && (
                        <div className="bg-emerald-950/20 border border-emerald-900/40 p-5 rounded-md mt-5 text-zinc-300">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-3">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                            TICKET GÜLTIG – EINLASS GEWÄHRT
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="text-zinc-500">Film</div>
                              <div className="font-bold text-white">{verifiedBooking.movieTitle}</div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Sitzplätze</div>
                              <div className="font-bold text-[#ffd700] tracking-wide font-mono">{verifiedBooking.seats.join(", ")}</div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Vorstellung</div>
                              <div className="font-bold text-white">{verifiedBooking.showtime}</div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Datum / Gast</div>
                              <div className="font-bold text-white truncate">{verifiedBooking.customerName}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

        </main>

        {/* 5. FOOTER SECTION */}
        <footer className="relative bg-zinc-950 pt-12 pb-6 border-t border-zinc-900 text-zinc-300 z-10" id="portal-landing-footer">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pb-10 border-b border-zinc-900">
              
              {/* Left footer phone graphic tilted showing ticket */}
              <div className="lg:col-span-4 flex items-center justify-center lg:justify-start gap-4">
                
                {/* Visual Smartphone Skeleton Wrapper */}
                <div className="relative w-40 h-64 bg-zinc-900 border-4 border-zinc-700 rounded-3xl p-1 shadow-2xl overflow-hidden flex flex-col justify-between select-none rotate-[-6deg]" id="smart-phone-asset">
                  {/* Dynamic speaker camera notches top */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-zinc-700 rounded-b-md z-30 flex items-center justify-center">
                    <div className="w-6 h-1 bg-black rounded-full" />
                  </div>
                  
                  {/* Display content screen */}
                  <div className="w-full h-full bg-[#800707] rounded-2xl flex flex-col items-center justify-between p-3 border border-black/80 relative bg-cover"
                       style={{ backgroundImage: `linear-gradient(to bottom, rgba(128,7,7,0.92) 0%, rgba(5,5,5,0.95) 90%)` }}>
                    
                    <span className="text-[7px] text-[#d4af37] tracking-[2px] font-bold mt-2">IMAX PORTAL</span>
                    
                    <div className="flex flex-col items-center flex-grow justify-center mt-3">
                      <span className="text-white text-xs font-black tracking-widest text-center leading-tight uppercase font-heading">
                        JETZT
                      </span>
                      <span className="text-[#ffd700] text-[10px] font-bold tracking-widest text-center uppercase">
                        TICKETS
                      </span>
                      <span className="text-white text-xs font-black tracking-widest text-center uppercase leading-tight font-heading">
                        BUCHEN!
                      </span>
                      <span className="text-[14px] text-[#ffd700] leading-none mt-1.5">★</span>
                    </div>

                    {/* Smartphone action booking representation button */}
                    <button 
                      onClick={() => {
                        setActiveTab("movies");
                        if (movies.length > 0) {
                          setSelectedMovie(movies[0]);
                          setSelectedShowtime(movies[0].showtimes[0]);
                        }
                        handleOpenSeating();
                      }}
                      className="w-full py-1.5 bg-[#d4af37] hover:bg-[#ffd700] text-black font-black text-[9px] uppercase tracking-widest rounded-lg font-heading shadow-md transition-all"
                    >
                      Ticket App
                    </button>
                  </div>
                </div>

                {/* Right text of phone */}
                <div className="flex flex-col gap-1.5" id="ticket-action-box">
                  <h3 className="text-[#ffd700] text-xl font-black uppercase tracking-wider font-heading leading-tight">
                    JETZT TICKETS BUCHEN!
                  </h3>
                  <p className="text-xs text-zinc-400">Einfach. Schnell. Bequem.</p>
                  
                  <div className="flex gap-2.5 mt-2" id="footer-ticket-channels">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-[#d4af37]/40 flex items-center justify-center text-[#fffae0] text-xs">
                        📱
                      </div>
                      <span className="text-[9px] uppercase font-bold text-zinc-400 mt-1">APP</span>
                    </div>
                    <div className="h-8 w-[1px] bg-zinc-800" />
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-[#d4af37]/40 flex items-center justify-center text-[#fffae0] text-xs">
                        💻
                      </div>
                      <span className="text-[9px] uppercase font-bold text-zinc-400 mt-1">WEBSITE</span>
                    </div>
                    <div className="h-8 w-[1px] bg-zinc-800" />
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-[#d4af37]/40 flex items-center justify-center text-[#fffae0] text-xs">
                        🎟️
                      </div>
                      <span className="text-[9px] uppercase font-bold text-zinc-400 mt-1">VOR ORT</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Middle footer column: CONTACT INFO */}
              <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left gap-3 py-4" id="agency-contacts">
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="text-[#d4af37] font-bold">📞</span>
                  <a href="tel:+917982194414" className="hover:text-[#ffd700] transition-colors font-mono">+91 79821 94414</a>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="text-[#d4af37] font-bold">✉</span>
                  <a href="mailto:support@imax-berlin.de" className="hover:text-[#ffd700] transition-colors">support@imax-berlin.de</a>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="text-[#d4af37] font-bold">🌐</span>
                  <a href="https://www.instagram.com/theishikarao_?utm_source=qr&igsh=cmIwazd6aDZ0MTNp" target="_blank" rel="noreferrer" className="hover:text-[#ffd700] transition-colors">instagram.com/theishikarao_</a>
                </div>
              </div>

              {/* Right Footer Columns: Social and QR code */}
              <div className="lg:col-span-4 flex flex-col sm:flex-row items-center justify-between gap-6" id="social-qrcode-footer">
                
                {/* Followers layout text */}
                <div className="text-center sm:text-left">
                  <h4 className="text-xs font-black text-white tracking-widest uppercase font-heading">
                    FOLGEN SIE UNS!
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">Bleiben Sie immer auf dem Laufenden.</p>
                  
                  {/* Social circle icons pointing to Ishika's Instagram */}
                  <div className="flex justify-center sm:justify-start gap-2 mt-3" id="footer-social-hubs">
                    {['f', 'ig', 'tt', 'yt'].map((hub) => (
                      <a 
                        key={hub} 
                        href="https://www.instagram.com/theishikarao_?utm_source=qr&igsh=cmIwazd6aDZ0MTNp"
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-full bg-white text-zinc-950 font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-[#d4af37] hover:scale-110 shadow-sm transition-all select-none"
                      >
                        {hub === 'f' && "f"}
                        {hub === 'ig' && "📷"}
                        {hub === 'tt' && "♪"}
                        {hub === 'yt' && "▶"}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Scannable verifier QR Code block pointing to Instagram */}
                <div className="flex-shrink-0" id="booking-qrcode-container">
                  <a 
                    href="https://www.instagram.com/theishikarao_?utm_source=qr&igsh=cmIwazd6aDZ0MTNp"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white p-2 rounded-xl shadow-lg border border-[#d4af37]/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-all w-[100px] h-[100px] relative group" 
                    title="Scan to follow @theishikarao_ on Instagram"
                  >
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=e1306c&bgcolor=ffffff&data=${encodeURIComponent("https://www.instagram.com/theishikarao_?utm_source=qr&igsh=cmIwazd6aDZ0MTNp")}`}
                      alt="Instagram QR Scan"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                    {/* Tiny tooltip indicator */}
                    <span className="absolute bottom-1 right-1 bg-black text-[#ffd700] text-[6px] px-1 rounded uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      INSTAGRAM
                    </span>
                  </a>
                </div>

              </div>

            </div>

            {/* Bottom red slogan bar across full width */}
            <div className="w-full pt-6 mt-4 text-center border-t border-zinc-900 bg-zinc-950" id="copyright-strip-bottom">
              <span className="text-[#ffd700] text-[13px] sm:text-sm tracking-[4px] uppercase font-serif animate-pulse-gold inline-flex items-center gap-1.5 font-semibold">
                ★ IMAX – HIER BEGINNT DEIN FILMERLEBNIS! ★
              </span>
            </div>

          </div>
        </footer>

      </div>

      {/* FLOAT CHATBOT INTERFACE COMPONENT */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end" id="cinematic-ai-chatbot">
        
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="mb-3 w-[360px] sm:w-[410px] h-[520px] rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col z-50 mr-1"
            >
              
              {/* Header Title bar */}
              <div className="bg-gradient-to-r from-red-800 via-red-950 to-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-[#d4af37]/60 flex items-center justify-center text-[#ffd700]">
                    🍿
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#ffd700] font-heading flex items-center gap-1">
                      IMAX Kundenservice
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Ihr digitaler IMAX Concierge</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Support Status Slogan */}
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between text-[10px] text-lime-500 uppercase font-bold tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                  <span>Kinoservice Online</span>
                </div>
                <span className="text-zinc-500 text-[9px] font-mono">ID: IMX-SUPPORT</span>
              </div>

              {/* Chat messages thread */}
              <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 scrollbar-custom bg-zinc-950/40">
                {chatMessages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[82%] ${
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.role === "user" 
                        ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white rounded-tr-none shadow-md" 
                        : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none shadow-md"
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[7px] text-zinc-500 mt-1 uppercase tracking-wider font-mono select-none">
                      {msg.role === "user" ? "Sie" : "Support-Team"} • {new Date(msg.timestamp || Date.now()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-2 rounded-xl rounded-tl-none text-xs flex items-center gap-1 max-w-[80%] shadow-md">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-[10px] ml-1">Kinoservice schreibt...</span>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Suggested Quick Prompts */}
              <div className="px-3 py-2 bg-zinc-900/40 border-t border-zinc-800/50 flex flex-wrap gap-1">
                <button 
                  onClick={() => sendMessageToBot(undefined, "Welche IMAX Filme laufen heute?")}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] hover:text-white"
                >
                  🎬 Verügbare Filme
                </button>
                <button 
                  onClick={() => sendMessageToBot(undefined, "Gibt es ein Eröffnungsangebot?")}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] hover:text-white"
                >
                  🍿 Eröffnungsangebot
                </button>
                <button 
                  onClick={() => sendMessageToBot(undefined, "Vergünstigungen für Studenten?")}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] hover:text-white"
                >
                  🎓 Studentenrabatt?
                </button>
              </div>

              {/* Footer text field */}
              <form onSubmit={sendMessageToBot} className="p-3 bg-zinc-950 border-t border-zinc-800 flex gap-2">
                <input 
                  type="text" 
                  placeholder="Schreiben Sie eine Nachricht..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs flex-grow focus:outline-none focus:border-[#d4af37] text-white"
                />
                <button 
                  type="submit"
                  className="bg-red-700 hover:bg-red-600 border border-red-800 text-white rounded-lg px-3 py-1 flex items-center justify-center transition-all shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-gradient-to-br from-red-600 to-red-800 border border-[#d4af37]/50 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all outline-none"
          id="imax-floating-bubble"
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      {/* 6. INTERACTIVE MOVIE THEATER BOOKING MODAL */}
      <AnimatePresence>
        {isBookingOpen && (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto" id="cinema-booking-lightbox">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row shadow-[#d4af37]/5 my-auto"
            >
              
              {/* Left Column of Lightbox: Selection planning */}
              <div className="w-full md:w-3/5 p-5 md:p-7 border-b md:border-b-0 md:border-r border-zinc-900 bg-[#070707] flex flex-col justify-between">
                
                {/* Header info */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 uppercase font-black text-[9px] tracking-widest font-heading">SITZPLATZ-KONFIGURATOR</span>
                    <button 
                      onClick={() => setIsBookingOpen(false)}
                      className="text-zinc-500 hover:text-white md:hidden"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {selectedMovie && selectedShowtime && (
                    <div className="mt-2">
                      <h2 className="text-xl font-extrabold text-white tracking-wide">{selectedMovie.title}</h2>
                      <div className="flex gap-2 items-center text-xs text-zinc-400 mt-1 flex-wrap">
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-red-500 text-[10px] font-bold">{selectedMovie.genre}</span>
                        <span>•</span>
                        <span className="text-[#ffd700] font-bold">{selectedShowtime.time}</span>
                        <span>•</span>
                        <span>Laufzeit: {selectedMovie.duration}</span>
                      </div>
                    </div>
                  )}

                  {/* SCREEN / LEINWAND representing indicator */}
                  <div className="mt-8 flex flex-col items-center select-none">
                    {/* Visual glowing line of curve screen */}
                    <div className="w-[85%] h-2 bg-gradient-to-r from-red-700/10 via-zinc-200 to-red-700/10 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
                    <span className="text-[9px] tracking-[6px] text-zinc-500 uppercase mt-2 select-none leading-none">LEINWAND / SCREEN</span>
                  </div>

                  {/* Seat Map Selections */}
                  <div className="mt-8 overflow-x-auto pb-4">
                    {loadingSeats ? (
                      <div className="py-12 text-center text-xs text-zinc-500">
                        Sitzplatzmatrix wird generiert...
                      </div>
                    ) : (
                      <div className="min-w-[420px] mx-auto flex flex-col gap-1.5" id="seating-chart-grid">
                        
                        {/* Split seats into rows for layout */}
                        {['A', 'B', 'C', 'D', 'E', 'F'].map(rowLabel => {
                          const rowSeats = seatMap.filter(s => s.row === rowLabel);
                          return (
                            <div key={rowLabel} className="flex items-center gap-2 justify-center">
                              {/* Left Row Identifier */}
                              <span className="w-4 text-[10px] font-bold text-zinc-650 text-center font-mono">{rowLabel}</span>
                              
                              {/* Row Seats */}
                              <div className="flex gap-1.5">
                                {rowSeats.map(seat => {
                                  const isSelected = selectedSeats.includes(seat.id);
                                  
                                  // Color presets based on seat Type and selection status
                                  let bgClass = "bg-zinc-800 border-zinc-700 hover:bg-zinc-700";
                                  if (seat.booked) {
                                    bgClass = "bg-stone-900/60 border-zinc-950 text-zinc-800 stroke-zinc-800 cursor-not-allowed";
                                  } else if (isSelected) {
                                    bgClass = "bg-[#d4af37] border-amber-400 text-black";
                                  } else {
                                    // Categories highlights
                                    if (seat.type === "Loge") bgClass = "bg-amber-950/40 border-amber-900/80 text-amber-300 hover:bg-amber-900/60";
                                    if (seat.type === "Luxus") bgClass = "bg-red-950/30 border-red-950/80 text-red-300 hover:bg-red-900/40";
                                    if (seat.type === "Parkett") bgClass = "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800";
                                  }

                                  return (
                                    <button
                                      key={seat.id}
                                      disabled={seat.booked}
                                      onClick={() => toggleSeat(seat.id)}
                                      title={`Sitz ${seat.id} (${seat.type}): ${seat.price.toFixed(2)}€`}
                                      className={`w-6.5 h-6.5 rounded text-[8px] font-bold border transition-all flex items-center justify-center font-sans tracking-tighter ${bgClass}`}
                                    >
                                      {seat.booked ? "×" : seat.number}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Right Row Identifier */}
                              <span className="w-4 text-[10px] font-bold text-zinc-650 text-center font-mono">{rowLabel}</span>
                            </div>
                          );
                        })}

                      </div>
                    )}
                  </div>
                  
                  {/* Legend representation */}
                  <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] text-zinc-400 pb-2 border-b border-zinc-900">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-zinc-900 border border-zinc-800" />
                      <span>Parkett (12,00 €)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-red-950/30 border border-red-950/80" />
                      <span>Luxus (15,50 €)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-amber-950/40 border border-amber-900/80" />
                      <span>Loge VIP (18,50 €)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-[#d4af37] border border-amber-400" />
                      <span>Ausgewählt</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-stone-900 flex items-center justify-center font-bold text-[8px] text-zinc-850 border border-zinc-950">×</div>
                      <span>Verkauft</span>
                    </div>
                  </div>

                </div>

                {/* Slogan footnote */}
                <div className="hidden md:flex gap-2 items-center text-zinc-500 mt-6 md:mt-2 text-[10px]" id="booking-seal-footnote">
                  <span>🥇 Beste IMAX Bildschirme in Deutschland</span>
                  <span>•</span>
                  <span>🔒 SSL Verschlüsselte Transaktion</span>
                </div>

              </div>

              {/* Right Column of Lightbox: Payment Checkout receipt */}
              <div className="w-full md:w-2/5 p-5 md:p-7 bg-zinc-900/30 flex flex-col justify-between">
                
                <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                  <span className="text-zinc-400 uppercase font-black text-[10px] tracking-widest font-heading">Kasse / Buchung</span>
                  <button 
                    onClick={() => setIsBookingOpen(false)}
                    className="text-zinc-400 hover:text-white hidden md:block"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {bookingSuccess ? (
                  /* Booking success receipt view */
                  <div className="py-2 flex flex-col justify-between h-full gap-5">
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                        <Check className="w-6 h-6 animate-pulse" />
                      </div>
                      <h3 className="text-base font-bold text-white">RESERVIERUNG BESTÄTIGT!</h3>
                      <p className="text-xs text-zinc-400 mt-1">Ihr mobiles Einlass-Ticket wurde generiert.</p>
                    </div>

                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-3 font-sans" id="success-recepit-canvas">
                      <div className="flex justify-between border-b border-zinc-900 pb-2 text-[11px]">
                        <span className="text-zinc-500">Buchungs-Nr.</span>
                        <span className="font-bold text-[#ffd700] tracking-wider font-mono uppercase">{bookingSuccess.id}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Film</span>
                        <span className="font-bold text-white">{bookingSuccess.movieTitle}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Sitze</span>
                        <span className="font-bold text-[#ffd700] font-mono tracking-wide">{bookingSuccess.seats.join(", ")}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Zeit / Ticket</span>
                        <span className="font-bold text-white">{bookingSuccess.showtime} ({bookingSuccess.ticketType})</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Kunde / Gast</span>
                        <span className="font-bold text-white truncate max-w-[140px]">{bookingSuccess.customerName}</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-900 pt-3 mt-1 text-sm font-black">
                        <span className="text-zinc-400">Gesamtpreis</span>
                        <span className="text-emerald-400">{bookingSuccess.total.toFixed(2)} EUR</span>
                      </div>
                    </div>

                    {/* Breathtaking UPI Payment Card replica */}
                    <div className="flex flex-col items-center select-none mt-2 w-full max-w-[270px] mx-auto">
                      
                      {/* White Card Envelope */}
                      <div className="relative bg-white rounded-3xl p-5 text-black border border-zinc-200/50 shadow-2xl flex flex-col items-center w-full mt-7 pb-6">
                        
                        {/* Overlapping Profile picture at top of card */}
                        <div className="absolute -top-7 w-14 h-14 rounded-full border-4 border-white shadow-lg overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
                          <img 
                            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
                            alt="Ishika Rao"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Name Header */}
                        <h4 className="text-sm font-black text-zinc-900 tracking-wide uppercase mt-6 text-center leading-none">
                          ISHIKA RAO
                        </h4>
                        
                        {/* Scan Instruction */}
                        <p className="text-[9px] text-zinc-500 font-medium text-center mt-1 leading-none">
                          Scan this code to pay with any UPI app
                        </p>

                        {/* Core QR code */}
                        <div className="my-5 p-2 bg-stone-50 border border-zinc-100/60 rounded-2xl shadow-inner cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform relative group">
                          <img 
                            src={bookingSuccess.qrCodeUrl} 
                            alt="UPI ID Ishika Rao Pay" 
                            referrerPolicy="no-referrer"
                            className="w-36 h-36 object-contain"
                            onClick={() => {
                              // Fallback support for simulator scan actions
                              setVerificationId(bookingSuccess.id);
                              setActiveTab("verify");
                              handleVerificationLookup(bookingSuccess.id);
                              setIsBookingOpen(false);
                            }}
                          />
                          {/* Hover tooltip hint */}
                          <div className="absolute inset-0 bg-black/85 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-[#ffd700] text-[11px] font-bold">Einlass simulieren</span>
                            <span className="text-[8px] text-zinc-400 mt-1">Hier klicken zum Ticket-Scan</span>
                          </div>
                        </div>

                        {/* Interactive green UPI copying button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText("7982194414@upi");
                            }
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={`w-full py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-extrabold ${
                            copied 
                              ? "bg-emerald-500/10 border-emerald-400 text-emerald-600 shadow-sm" 
                              : "bg-emerald-50 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100/60 active:scale-[0.97]"
                          }`}
                        >
                          {copied ? (
                            <>
                              <span className="text-xs">✓</span>
                              <span>KOPIERT / COPIED!</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs">📋</span>
                              <span>UPI ID: 7982194414@upi</span>
                            </>
                          )}
                        </button>

                      </div>

                      {/* Unified Payments Interface Emblem below card */}
                      <div className="flex flex-col items-center justify-center gap-0.5 mt-3 opacity-95 text-zinc-400">
                        <div className="flex items-center gap-1">
                          <span className="font-mono tracking-widest font-black italic text-zinc-100 text-sm">UPI</span>
                          <span className="text-[8px] text-[#ffd700] font-bold uppercase tracking-widest">Unified Payments Interface</span>
                        </div>
                        <span className="text-[7px] text-zinc-500 font-medium">Bequeme Direktüberweisung von jedem Bankkonto</span>
                      </div>

                    </div>

                    <button
                      onClick={() => setIsBookingOpen(false)}
                      className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg mt-3"
                    >
                      Fertig / Schließen
                    </button>
                  </div>
                ) : (
                  /* Form Input checkout view */
                  <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4 mt-2">
                    
                    {/* Itemized receipt calculations preview */}
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 flex flex-col gap-2.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Ausgewählte Plätze</span>
                        <span className="font-bold text-[#ffd750] font-mono tracking-wide">
                          {selectedSeats.length > 0 ? selectedSeats.join(", ") : "Keine"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Zwischensumme</span>
                        <span className="text-zinc-300">{subtotal.toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between text-xs text-red-400">
                        <span className="flex items-center gap-1">Studentenrabatt {ticketType === "Student" && "aktiv"}</span>
                        <span>-{discount.toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-900 pt-3 mt-1.5 text-sm font-black">
                        <span className="text-zinc-300">Gesamtbetrag (EUR)</span>
                        <span className="text-[#ffd700]">{total.toFixed(2)} EUR</span>
                      </div>
                    </div>

                    {/* Form Controls */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Kunden-Name *</label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                          <input 
                            type="text" 
                            required
                            placeholder="Z.B. Michael Schmidt" 
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white pl-9 pr-3 py-2.5 rounded focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1">E-Mail-Adresse *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                          <input 
                            type="email" 
                            required
                            placeholder="ihre-mail@imax-berlin.de" 
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white pl-9 pr-3 py-2.5 rounded focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      {/* Ticket Type select radio */}
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Tarif Option</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTicketType("Standard")}
                            className={`py-2 text-[11px] font-bold tracking-wider uppercase border rounded transition-colors ${
                              ticketType === "Standard" ? "bg-red-700/20 border-red-650 text-white" : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                            }`}
                          >
                            Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => setTicketType("Student")}
                            className={`py-2 text-[11px] font-bold tracking-wider uppercase border rounded transition-colors flex items-center justify-center gap-1 ${
                              ticketType === "Student" ? "bg-red-700/20 border-red-650 text-white" : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                            }`}
                          >
                            <GraduationCap className="w-3.5 h-3.5" /> Student (-2€)
                          </button>
                        </div>
                      </div>

                      {/* Payment SDK integrations choice */}
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Zahlungsmittel</span>
                        <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold text-center">
                          {[
                            { name: "Stripe", label: "Karte", icon: "💳" },
                            { name: "PayPal", label: "PayPal", icon: "🅿️" },
                            { name: "GooglePay", label: "G-Pay", icon: "📱" },
                            { name: "ApplePay", label: "Apple", icon: "🍏" }
                          ].map((pay) => (
                            <button
                              key={pay.name}
                              type="button"
                              onClick={() => setPaymentMethod(pay.name as any)}
                              className={`py-2 px-1 border rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                                paymentMethod === pay.name ? "bg-zinc-900 border-[#d4af37] text-white" : "bg-zinc-950 border-zinc-900 text-zinc-400"
                              }`}
                            >
                              <span>{pay.icon}</span>
                              <span className="tracking-wide">{pay.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Submit checkout CTA */}
                    <button
                      type="submit"
                      disabled={submittingBooking || selectedSeats.length === 0}
                      className="w-full bg-gradient-to-r from-[#d4af37] to-[#b89320] text-black disabled:from-zinc-800 disabled:to-zinc-850 disabled:text-zinc-500 font-extrabold text-xs uppercase tracking-widest py-3 rounded-lg mt-2 flex items-center justify-center gap-2 cursor-pointer border border-[#ffd700]/30 shadow-md transition-all active:scale-95"
                    >
                      {submittingBooking ? (
                        <>
                          <div className="w-3.5 h-3.5 border border-t-black rounded-full animate-spin" />
                          <span>Zahlung wird autorisiert...</span>
                        </>
                      ) : (
                        <>
                          <span>KOSTENPFLICHTIG BUCHEN</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                  </form>
                )}

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
