// Mock data for the Smart Bus Tracking System

export interface BusStop {
  id: string;
  name: string;
  x: number; // map coords (0-100)
  y: number;
  eta: string;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface Bus {
  id: string;
  number: string;
  driver: string;
  driverPhone: string;
  capacity: number;
  occupied: number;
  status: "active" | "delayed" | "arrived" | "inactive";
  speed: number; // km/h
  plate: string;
}

export const mockBus: Bus = {
  id: "bus-22",
  number: "Route 22",
  driver: "Rajesh Kumar",
  driverPhone: "+91 98765 43210",
  capacity: 48,
  occupied: 31,
  status: "active",
  speed: 38,
  plate: "TN 12 AB 4242",
};

// Route as percentage coordinates of the map viewport
export const busRoute: RoutePoint[] = [
  { x: 8, y: 88 },
  { x: 18, y: 78 },
  { x: 22, y: 62 },
  { x: 32, y: 55 },
  { x: 42, y: 48 },
  { x: 48, y: 36 },
  { x: 58, y: 32 },
  { x: 68, y: 38 },
  { x: 78, y: 30 },
  { x: 88, y: 18 },
  { x: 94, y: 10 },
];

export const busStops: BusStop[] = [
  { id: "s1", name: "Campus Main Gate", x: 8, y: 88, eta: "Departed" },
  { id: "s2", name: "Library Junction", x: 22, y: 62, eta: "2 min ago" },
  { id: "s3", name: "Tech Park Square", x: 42, y: 48, eta: "Arriving" },
  { id: "s4", name: "Metro Station", x: 68, y: 38, eta: "8 min" },
  { id: "s5", name: "Riverside Mall", x: 88, y: 18, eta: "15 min" },
  { id: "s6", name: "Sunrise Apartments", x: 94, y: 10, eta: "22 min" },
];

export const studentLocation: RoutePoint = { x: 56, y: 58 };

// Helper: linear interpolation between two points
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Build a smooth path string from route points
export const buildPath = (points: RoutePoint[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
