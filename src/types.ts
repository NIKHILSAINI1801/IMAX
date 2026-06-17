export interface Movie {
  id: string;
  title: string;
  genre: string;
  duration: string;
  rating: string;
  banner: string;
  description: string;
  showtimes: { id: string; time: string }[];
}

export type ClientMovie = Movie; // Alias for seamless compatibility

export interface Seat {
  id: string;
  row: string;
  number: number;
  type: 'Parkett' | 'Luxus' | 'Loge';
  price: number;
  booked: boolean;
}

export interface Booking {
  id: string;
  movieId: string;
  movieTitle: string;
  showtimeId: string;
  showtime: string;
  date: string;
  seats: string[];
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

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  modelUsed?: string;
}
