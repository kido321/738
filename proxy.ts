import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything needs sign-in except the sign-in page and the home screen files.
const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/manifest.webmanifest",
  "/icon-(.*)",
  "/apple-touch-icon.png",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
