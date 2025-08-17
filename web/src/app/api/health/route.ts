// 1) Tell Next to run this on the Node.js runtime, not the Edge runtime.
//    Prisma and some Node APIs need Node.js runtime. We'll keep consistency now.
export const runtime = 'nodejs';

// 2) The App Router uses file-system routing. This file path:
//    /src/app/api/health/route.ts → serves /api/health
//    Export a GET() to handle GET requests to that path.
export async function GET() {
  // 3) Response.json() is a tiny helper from the Web Fetch API that
  //    sets content-type and stringifies for you.
  //    We include an 'env' hint so you can tell local vs Vercel at a glance.
  return Response.json({
    ok: true,
    env: process.env.VERCEL ? 'vercel' : 'local',
  });
}
