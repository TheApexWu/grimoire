import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  // Only run Clerk middleware on the save API (only route needing auth)
  // All other pages load without waiting on Clerk's external API
  matcher: ["/api/save(.*)"],
};
