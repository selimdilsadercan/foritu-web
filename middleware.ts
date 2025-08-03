import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  // Protect the /home route specifically
  if (req.nextUrl.pathname.startsWith('/home')) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect to sign-in if not authenticated
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  // Allow access to sign-in and sign-up routes
  if (req.nextUrl.pathname.startsWith('/sign-in') || req.nextUrl.pathname.startsWith('/sign-up')) {
    return;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}; 