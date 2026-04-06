import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth"; // Ensure this points to your NextAuth config

const handler = NextAuth(authOptions);

// NextAuth requires both GET and POST exports for the App Router
export { handler as GET, handler as POST };