import { robotsText } from "@/lib/robots-policy";
export const dynamic = "force-static";
export function GET() {
  return new Response(robotsText(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
